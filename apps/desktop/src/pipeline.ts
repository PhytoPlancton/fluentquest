import { createAudioCapture, type AudioCapture } from './audio/capture.js';
import { diarizeFile, mergeTranscriptDiarization } from './diarization/pyannote.js';
import { transcribeFile, type WhisperSegment } from './transcription/whisper.js';

export interface PipelineConfig {
  apiBaseUrl: string;
  authToken?: string;
  workspaceId: string;
}

export interface PipelineStatus {
  state: 'idle' | 'recording' | 'transcribing' | 'analyzing' | 'done' | 'error';
  message?: string;
  segmentCount?: number;
}

/**
 * Orchestrator : start → record → stop → transcribe (Whisper verbatim) →
 * diarize (pyannote) → merge → POST segments to API → trigger analysis.
 *
 * The current implementation is a SKELETON. Each step works in isolation
 * (or stubs cleanly), but the end-to-end pipeline needs real audio to test.
 */
export class CapturePipeline {
  private capture: AudioCapture | null = null;
  private listeners = new Set<(s: PipelineStatus) => void>();
  private currentStatus: PipelineStatus = { state: 'idle' };

  constructor(private config: PipelineConfig) {}

  onStatus(listener: (s: PipelineStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: PipelineStatus): void {
    this.currentStatus = status;
    for (const l of this.listeners) l(status);
  }

  async start(): Promise<void> {
    if (this.currentStatus.state !== 'idle') {
      throw new Error(`Cannot start in state ${this.currentStatus.state}`);
    }
    this.capture = createAudioCapture();
    await this.capture.start();
    this.setStatus({ state: 'recording' });
  }

  async stop(): Promise<{ sessionId: string | null; segments: number }> {
    if (!this.capture) throw new Error('Pipeline not started');

    const captured = await this.capture.stop();
    this.setStatus({ state: 'transcribing', message: 'Whisper running...' });

    const whisperSegs: WhisperSegment[] = captured.outputPath
      ? await transcribeFile(captured.outputPath)
      : [];

    const diar = await diarizeFile(captured.outputPath);
    const merged = mergeTranscriptDiarization(whisperSegs, diar);

    this.setStatus({
      state: 'analyzing',
      message: 'Sending to backend...',
      segmentCount: merged.length,
    });

    // POST to API : create session → bulk segments → trigger analysis
    // TODO: integrate with @fluentquest/sdk when desktop deps allow workspace import
    const sessionId = await this.uploadToApi(merged);

    this.setStatus({ state: 'done', segmentCount: merged.length });
    this.capture = null;
    return { sessionId, segments: merged.length };
  }

  status(): PipelineStatus {
    return this.currentStatus;
  }

  private async uploadToApi(
    segments: Array<WhisperSegment & { speaker: string }>,
  ): Promise<string | null> {
    if (segments.length === 0) return null;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.authToken) headers.Authorization = `Bearer ${this.config.authToken}`;

    // 1) create session
    const createRes = await fetch(`${this.config.apiBaseUrl}/v1/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        workspaceId: this.config.workspaceId,
        languages: Array.from(new Set(segments.map((s) => s.language))),
      }),
    });
    if (!createRes.ok) throw new Error(`createSession failed: ${createRes.status}`);
    const created = (await createRes.json()) as { session: { id: string } };
    const sessionId = created.session.id;

    // 2) bulk segments
    const payload = segments.map((s) => ({
      speakerLabel: s.speaker,
      startMs: s.startMs,
      endMs: s.endMs,
      text: s.text,
      language: s.language,
    }));
    await fetch(`${this.config.apiBaseUrl}/v1/sessions/${sessionId}/segments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ segments: payload }),
    });

    // 3) end + analyze
    await fetch(`${this.config.apiBaseUrl}/v1/sessions/${sessionId}/end`, {
      method: 'POST',
      headers,
    });
    await fetch(`${this.config.apiBaseUrl}/v1/sessions/${sessionId}/analyze`, {
      method: 'POST',
      headers,
    });

    return sessionId;
  }
}
