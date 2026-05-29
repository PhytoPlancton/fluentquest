import * as React from 'react';
import { startCapture, type CaptureHandle } from './audio-capture';

declare global {
  interface Window {
    fluentquest: {
      getSettings: () => Promise<Settings>;
      setSettings: (patch: Partial<Settings>) => Promise<Settings>;
      transcribe: (
        audio: Float32Array,
        options?: { language?: 'en' | 'es' | 'fr' | 'auto'; modelId?: string },
      ) => Promise<{
        segments: Array<{ startMs: number; endMs: number; text: string; language: string }>;
        language: string;
      }>;
      onTranscribeProgress: (
        handler: (p: { status: string; progress?: number; message?: string }) => void,
      ) => () => void;
      uploadSession: (payload: {
        title?: string;
        languages: Array<'en' | 'es' | 'fr'>;
        segments: Array<{
          speakerLabel: string;
          startMs: number;
          endMs: number;
          text: string;
          language: 'en' | 'es' | 'fr';
        }>;
      }) => Promise<{ sessionId: string; url: string }>;
      openExternal: (url: string) => Promise<void>;
      info: () => Promise<{ platform: string; version: string; userDataPath: string }>;
    };
  }
}

interface Settings {
  apiUrl?: string;
  token?: string;
  workspaceId?: string;
  defaultLanguage?: 'en' | 'es' | 'fr';
  whisperModel?: string;
}

type Phase =
  | { state: 'idle' }
  | { state: 'recording'; startedAt: number }
  | { state: 'transcribing'; status: string; progress?: number }
  | { state: 'uploading' }
  | { state: 'done'; url: string; sessionId: string; segments: number }
  | { state: 'error'; message: string };

export function App() {
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [phase, setPhase] = React.useState<Phase>({ state: 'idle' });
  const captureRef = React.useRef<CaptureHandle | null>(null);
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    void window.fluentquest.getSettings().then(setSettings);
  }, []);

  // Tick elapsed time while recording.
  React.useEffect(() => {
    if (phase.state !== 'recording') return;
    const id = setInterval(() => setElapsed(captureRef.current?.getElapsedMs() ?? 0), 250);
    return () => clearInterval(id);
  }, [phase.state]);

  // Subscribe to whisper progress events.
  React.useEffect(() => {
    return window.fluentquest.onTranscribeProgress((p) => {
      setPhase((prev) => {
        if (prev.state !== 'transcribing') return prev;
        return {
          state: 'transcribing',
          status: p.message ?? p.status,
          progress: p.progress,
        };
      });
    });
  }, []);

  const isConfigured = Boolean(settings?.token && settings?.apiUrl && settings?.workspaceId);

  const handleStart = async () => {
    try {
      const handle = await startCapture();
      captureRef.current = handle;
      setPhase({ state: 'recording', startedAt: Date.now() });
    } catch (err) {
      setPhase({ state: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleStop = async () => {
    if (!captureRef.current || !settings) return;
    try {
      setPhase({ state: 'transcribing', status: 'Stopping capture…' });
      const audio = await captureRef.current.stop();
      captureRef.current = null;

      setPhase({ state: 'transcribing', status: 'Loading Whisper model (first run downloads ~150MB)…' });
      const result = await window.fluentquest.transcribe(audio, {
        language: settings.defaultLanguage ?? 'auto',
        modelId: settings.whisperModel ?? 'Xenova/whisper-base',
      });

      if (result.segments.length === 0) {
        setPhase({ state: 'error', message: 'No speech detected.' });
        return;
      }

      setPhase({ state: 'uploading' });
      const apiSegments = result.segments.map((s) => ({
        speakerLabel: 'SPEAKER_00', // manual tagging later — pyannote skipped for MVP
        startMs: s.startMs,
        endMs: s.endMs,
        text: s.text,
        language: normLang(s.language, settings.defaultLanguage),
      }));
      const lang = settings.defaultLanguage ?? normLang(result.language, 'en');
      const uploaded = await window.fluentquest.uploadSession({
        title: `Desktop capture ${new Date().toLocaleString()}`,
        languages: [lang],
        segments: apiSegments,
      });

      setPhase({
        state: 'done',
        url: uploaded.url,
        sessionId: uploaded.sessionId,
        segments: apiSegments.length,
      });
    } catch (err) {
      setPhase({ state: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  const reset = () => setPhase({ state: 'idle' });

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div style={styles.logo}>✦</div>
        <h1 style={styles.title}>FluentQuest</h1>
        <span style={styles.subtitle}>desktop capture</span>
      </header>

      {!isConfigured ? (
        <SettingsPanel settings={settings ?? {}} onSave={async (s) => setSettings(await window.fluentquest.setSettings(s))} />
      ) : (
        <main style={styles.main}>
          {phase.state === 'idle' && (
            <button style={styles.bigButton} onClick={() => void handleStart()}>
              <span style={styles.dot} /> Start recording
            </button>
          )}
          {phase.state === 'recording' && (
            <>
              <button style={{ ...styles.bigButton, background: '#dc2626' }} onClick={() => void handleStop()}>
                ◼ Stop and transcribe
              </button>
              <p style={styles.elapsed}>{formatMs(elapsed)}</p>
              <p style={styles.muted}>Speak normally. macOS will ask which window/screen to share — that's how system audio (TS/Discord) is captured.</p>
            </>
          )}
          {phase.state === 'transcribing' && (
            <>
              <Spinner />
              <p style={styles.status}>{phase.status}</p>
              {phase.progress !== undefined && (
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progressFill, width: `${Math.round(phase.progress * 100)}%` }} />
                </div>
              )}
            </>
          )}
          {phase.state === 'uploading' && (
            <>
              <Spinner />
              <p style={styles.status}>Uploading to FluentQuest API…</p>
            </>
          )}
          {phase.state === 'done' && (
            <>
              <div style={styles.success}>✓</div>
              <p style={styles.status}>{phase.segments} segments transcribed and analyzing.</p>
              <button
                style={styles.linkButton}
                onClick={() => void window.fluentquest.openExternal(phase.url)}
              >
                Open in browser
              </button>
              <button style={styles.smallButton} onClick={reset}>
                New recording
              </button>
            </>
          )}
          {phase.state === 'error' && (
            <>
              <div style={styles.error}>!</div>
              <p style={styles.status}>{phase.message}</p>
              <button style={styles.smallButton} onClick={reset}>
                Try again
              </button>
            </>
          )}
          <SettingsTrigger settings={settings ?? {}} onSave={async (s) => setSettings(await window.fluentquest.setSettings(s))} />
        </main>
      )}
    </div>
  );
}

function normLang(lang: string | undefined, fallback: 'en' | 'es' | 'fr' = 'en'): 'en' | 'es' | 'fr' {
  if (lang === 'en' || lang === 'es' || lang === 'fr') return lang;
  return fallback;
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function SettingsPanel({
  settings,
  onSave,
}: {
  settings: Settings;
  onSave: (s: Partial<Settings>) => Promise<void>;
}) {
  const [apiUrl, setApiUrl] = React.useState(settings.apiUrl ?? 'http://localhost:3030');
  const [token, setToken] = React.useState(settings.token ?? '');
  const [workspaceId, setWorkspaceId] = React.useState(settings.workspaceId ?? '');
  const [language, setLanguage] = React.useState<'en' | 'es' | 'fr'>(settings.defaultLanguage ?? 'en');

  return (
    <main style={styles.settings}>
      <h2 style={{ marginTop: 0 }}>First-run setup</h2>
      <p style={styles.muted}>
        Paste your FluentQuest session token (from the web app cookie or signup response) and the
        workspace ID where new sessions should land.
      </p>
      <label style={styles.label}>
        API URL
        <input style={styles.input} value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
      </label>
      <label style={styles.label}>
        Session token
        <input
          style={styles.input}
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="paste from web app login response"
        />
      </label>
      <label style={styles.label}>
        Workspace ID
        <input
          style={styles.input}
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          placeholder="Mongo ObjectId of the workspace"
        />
      </label>
      <label style={styles.label}>
        Default language
        <select
          style={styles.input}
          value={language}
          onChange={(e) => setLanguage(e.target.value as 'en' | 'es' | 'fr')}
        >
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
        </select>
      </label>
      <button
        style={styles.bigButton}
        disabled={!apiUrl || !token || !workspaceId}
        onClick={() =>
          void onSave({ apiUrl, token, workspaceId, defaultLanguage: language })
        }
      >
        Save and continue
      </button>
    </main>
  );
}

function SettingsTrigger({
  settings,
  onSave,
}: {
  settings: Settings;
  onSave: (s: Partial<Settings>) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  if (!open) {
    return (
      <button style={styles.gear} onClick={() => setOpen(true)} title="Settings">
        ⚙
      </button>
    );
  }
  return (
    <div style={styles.modalOverlay} onClick={() => setOpen(false)}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <SettingsPanel settings={settings} onSave={async (s) => { await onSave(s); setOpen(false); }} />
      </div>
    </div>
  );
}

function Spinner() {
  return <div style={styles.spinner} />;
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 6,
    background: '#e4e4f0',
    color: '#0c0c12',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
  },
  title: { margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: -0.01 },
  subtitle: { color: '#8888a8', fontSize: 12 },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    position: 'relative',
  },
  bigButton: {
    background: '#e4e4f0',
    color: '#0c0c12',
    border: 'none',
    padding: '16px 32px',
    fontSize: 18,
    fontWeight: 600,
    borderRadius: 12,
    cursor: 'pointer',
    minWidth: 280,
  },
  smallButton: {
    background: 'transparent',
    color: '#e4e4f0',
    border: '1px solid rgba(255,255,255,0.18)',
    padding: '8px 16px',
    fontSize: 13,
    borderRadius: 8,
    cursor: 'pointer',
  },
  linkButton: {
    background: '#20b8cd',
    color: '#0c0c12',
    border: 'none',
    padding: '10px 24px',
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 8,
    cursor: 'pointer',
  },
  dot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#dc2626',
    marginRight: 10,
    verticalAlign: 'middle',
  },
  elapsed: { fontSize: 32, fontVariantNumeric: 'tabular-nums', margin: 0 },
  status: { color: '#c4c4d0', fontSize: 14, margin: 0, textAlign: 'center', maxWidth: 480 },
  muted: { color: '#8888a8', fontSize: 13, margin: 0, textAlign: 'center', maxWidth: 480 },
  progressBar: {
    width: 320,
    height: 6,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', background: '#20b8cd', transition: 'width 0.2s' },
  spinner: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.12)',
    borderTopColor: '#20b8cd',
    animation: 'spin 1s linear infinite',
  },
  success: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: '#16a34a',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    fontWeight: 700,
  },
  error: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: '#dc2626',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    fontWeight: 700,
  },
  gear: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    background: 'transparent',
    color: '#8888a8',
    border: '1px solid rgba(255,255,255,0.12)',
    width: 36,
    height: 36,
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 16,
  },
  settings: {
    maxWidth: 520,
    margin: '40px auto',
    padding: '0 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#c4c4d0' },
  input: {
    background: '#1a1a26',
    color: '#e4e4f0',
    border: '1px solid rgba(255,255,255,0.12)',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 14,
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modal: {
    background: '#13131c',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    width: 520,
    maxWidth: '92vw',
  },
};

// Inject keyframes for spinner.
if (typeof document !== 'undefined' && !document.getElementById('fq-keyframes')) {
  const s = document.createElement('style');
  s.id = 'fq-keyframes';
  s.textContent = '@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}';
  document.head.appendChild(s);
}
