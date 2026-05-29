import { contextBridge, ipcRenderer } from 'electron';

export interface Settings {
  apiUrl?: string;
  token?: string;
  workspaceId?: string;
  defaultLanguage?: 'en' | 'es' | 'fr';
  whisperModel?: string;
}

export interface TranscribeSegment {
  startMs: number;
  endMs: number;
  text: string;
  language: string;
}

export interface TranscribeResult {
  segments: TranscribeSegment[];
  language: string;
}

export interface UploadResult {
  sessionId: string;
  fauteCount?: number;
  url: string;
}

const api = {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke('settings:set', patch),

  transcribe: (
    audio: Float32Array,
    options?: { language?: 'en' | 'es' | 'fr' | 'auto'; modelId?: string },
  ): Promise<TranscribeResult> =>
    ipcRenderer.invoke('whisper:transcribe', { audio, ...options }),

  onTranscribeProgress: (handler: (p: { status: string; progress?: number }) => void) => {
    const listener = (_e: unknown, p: { status: string; progress?: number }) => handler(p);
    ipcRenderer.on('whisper:progress', listener);
    return () => ipcRenderer.off('whisper:progress', listener);
  },

  uploadSession: (payload: {
    title?: string;
    languages: Array<'en' | 'es' | 'fr'>;
    segments: TranscribeSegment[] & Array<{ speakerLabel: string; language: 'en' | 'es' | 'fr' }>;
  }): Promise<UploadResult> => ipcRenderer.invoke('api:uploadSession', payload),

  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),

  info: (): Promise<{ platform: string; version: string; userDataPath: string }> =>
    ipcRenderer.invoke('app:info'),
};

contextBridge.exposeInMainWorld('fluentquest', api);

export type FluentQuestApi = typeof api;
