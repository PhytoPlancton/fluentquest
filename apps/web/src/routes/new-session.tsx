import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { Route as rootRoute } from './__root';

const LINE_RE = /^\[([^\s\]]+)(?:\s+(\w+))?\]\s*(.+)$/;

interface ParsedLine {
  speakerLabel: string;
  language: 'en' | 'es' | 'fr';
  text: string;
  rawIndex: number;
}

function parseTranscript(input: string, defaultLang: 'en' | 'es' | 'fr'): ParsedLine[] {
  const lines = input.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.map((line, idx) => {
    const m = LINE_RE.exec(line);
    if (m) {
      const speakerRaw = (m[1] ?? '').toLowerCase();
      const langRaw = (m[2] ?? '').toLowerCase();
      const text = m[3] ?? '';
      let speakerLabel = 'SPEAKER_00';
      if (speakerRaw === 'her' || speakerRaw === 'she' || speakerRaw === '1') speakerLabel = 'SPEAKER_01';
      else if (speakerRaw === 'me' || speakerRaw === 'i' || speakerRaw === '0') speakerLabel = 'SPEAKER_00';
      else speakerLabel = `SPEAKER_${speakerRaw.toUpperCase().slice(0, 8)}`;
      const lang: 'en' | 'es' | 'fr' =
        langRaw === 'en' || langRaw === 'es' || langRaw === 'fr' ? langRaw : defaultLang;
      return { speakerLabel, language: lang, text, rawIndex: idx };
    }
    return { speakerLabel: 'SPEAKER_00', language: defaultLang, text: line, rawIndex: idx };
  });
}

const EXAMPLE = `[me] he act weird this creeper, lets run
[her] I no want to die again, please come
[me] we need find more iron in the cave
[her es] Mira que bonito el atardecer en el juego
[me] in the end of the day we got two diamonds
[her] I have 25 years old, I am tired of dying`;

function NewSessionPage() {
  const navigate = useNavigate();
  const params = Route.useParams();
  const workspaceId = params.workspaceId;

  const [title, setTitle] = React.useState('');
  const [transcript, setTranscript] = React.useState('');
  const [defaultLang, setDefaultLang] = React.useState<'en' | 'es' | 'fr'>('en');
  const [phase, setPhase] = React.useState<
    'idle' | 'creating' | 'segments' | 'analyzing' | 'done' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [progressDetail, setProgressDetail] = React.useState<string>('');

  const preview = React.useMemo(() => parseTranscript(transcript, defaultLang), [transcript, defaultLang]);
  const canSubmit = preview.length > 0 && (phase === 'idle' || phase === 'error');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (preview.length === 0) return;

    setErrorMessage(null);
    setPhase('creating');
    setProgressDetail('Creating session…');

    try {
      const languages = Array.from(new Set(preview.map((l) => l.language)));
      const created = await api.createRecordingSession({
        workspaceId,
        title: title.trim() || 'Manual session',
        languages,
      });
      const sessionId = created.session.id;

      setPhase('segments');
      setProgressDetail(`Posting ${preview.length} segments…`);

      const now = Date.now();
      const segments = preview.map((l, i) => ({
        speakerLabel: l.speakerLabel,
        startMs: i * 3000,
        endMs: i * 3000 + 2500,
        text: l.text,
        language: l.language,
      }));

      // Bulk POST via SDK request (raw — SDK doesn't expose segments yet)
      const segmentsRes = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/v1/sessions/${sessionId}/segments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments }),
      });
      if (!segmentsRes.ok) throw new Error(`Segments POST failed (${segmentsRes.status})`);

      await api.endRecordingSession(sessionId);

      setPhase('analyzing');
      setProgressDetail('LLM analyzing transcript — this can take 10-30s…');

      const analyzeRes = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/v1/sessions/${sessionId}/analyze`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!analyzeRes.ok && analyzeRes.status !== 202) {
        throw new Error(`Analyze trigger failed (${analyzeRes.status})`);
      }

      // Poll status until done or failed
      const start = now;
      let analysisStatus = 'pending';
      while (analysisStatus !== 'done' && analysisStatus !== 'failed') {
        if (Date.now() - start > 120_000) {
          throw new Error('Analysis timed out (>2min). The fautes might still be created; check the session.');
        }
        await new Promise((r) => setTimeout(r, 2000));
        const detail = await api.getRecordingSession(sessionId);
        analysisStatus = detail.session.analysisStatus;
        setProgressDetail(`Status: ${analysisStatus}`);
      }

      if (analysisStatus === 'failed') {
        throw new Error('Analysis failed on the backend. Check API logs.');
      }

      setPhase('done');
      setProgressDetail('All set — redirecting…');
      setTimeout(() => {
        void navigate({
          to: '/workspaces/$workspaceId/sessions/$sessionId',
          params: { workspaceId, sessionId },
        });
      }, 600);
    } catch (err) {
      setPhase('error');
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className="mx-auto max-w-3xl space-y-6">
          <header>
            <h1 className="text-2xl font-bold tracking-tight">New session — manual entry</h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Paste a transcript of what was said. Each line becomes a segment. Use
              <code className="ml-1 rounded bg-[var(--muted)] px-1 py-0.5 text-xs">[me]</code> or
              <code className="ml-1 rounded bg-[var(--muted)] px-1 py-0.5 text-xs">[her]</code> to label the speaker,
              and optionally a language code like
              <code className="ml-1 rounded bg-[var(--muted)] px-1 py-0.5 text-xs">[her es]</code>.
            </p>
          </header>

          <Card>
            <CardHeader>
              <CardTitle>Transcript</CardTitle>
              <CardDescription>One segment per line. Markers are optional.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="title">Session title</Label>
                  <Input
                    id="title"
                    placeholder="Saturday Minecraft night"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={phase !== 'idle' && phase !== 'error'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultLang">Default language (when not specified per line)</Label>
                  <div className="flex gap-2">
                    {(['en', 'es', 'fr'] as const).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setDefaultLang(lang)}
                        disabled={phase !== 'idle' && phase !== 'error'}
                        className={
                          defaultLang === lang
                            ? 'rounded-md border border-[var(--primary)] bg-[var(--accent)] px-3 py-1 text-sm'
                            : 'rounded-md border border-[var(--border)] px-3 py-1 text-sm text-[var(--muted-foreground)] hover:bg-[var(--accent)]/40'
                        }
                      >
                        {lang.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="transcript">Transcript</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setTranscript(EXAMPLE)}
                      disabled={phase !== 'idle' && phase !== 'error'}
                    >
                      <Wand2 className="h-3 w-3" />
                      Insert example
                    </Button>
                  </div>
                  <textarea
                    id="transcript"
                    className="min-h-[260px] w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    placeholder={EXAMPLE}
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    disabled={phase !== 'idle' && phase !== 'error'}
                  />
                </div>

                {preview.length > 0 && (
                  <div className="rounded-md border border-dashed border-[var(--border)] p-3">
                    <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                      Preview ({preview.length} segments)
                    </p>
                    <ul className="mt-2 space-y-1 text-xs">
                      {preview.slice(0, 6).map((l) => (
                        <li key={l.rawIndex} className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {l.speakerLabel === 'SPEAKER_00' ? 'me' : l.speakerLabel === 'SPEAKER_01' ? 'her' : l.speakerLabel}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {l.language.toUpperCase()}
                          </Badge>
                          <span className="truncate text-[var(--muted-foreground)]">{l.text}</span>
                        </li>
                      ))}
                      {preview.length > 6 && (
                        <li className="text-[var(--muted-foreground)]">… and {preview.length - 6} more</li>
                      )}
                    </ul>
                  </div>
                )}

                {phase !== 'idle' && (
                  <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--muted)]/30 p-3 text-sm">
                    {phase === 'done' ? (
                      <Sparkles className="h-4 w-4 text-emerald-400" />
                    ) : phase === 'error' ? null : (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    <span>{progressDetail}</span>
                  </div>
                )}

                {errorMessage && (
                  <p className="text-sm text-[var(--destructive)]" role="alert">
                    {errorMessage}
                  </p>
                )}

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={!canSubmit}>
                    Analyze transcript
                  </Button>
                  {phase === 'error' && (
                    <Button type="button" variant="outline" onClick={() => setPhase('idle')}>
                      Try again
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </AuthGuard>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workspaces/$workspaceId/sessions/new',
  component: NewSessionPage,
});
