export type AudioCaptureStatus = 'idle' | 'recording' | 'stopping' | 'error';

export interface AudioCaptureChunk {
  /** PCM 16-bit mono 16kHz buffer (Whisper-ready). */
  pcm16: Buffer;
  /** Monotonic timestamp in ms from session start. */
  startMs: number;
  endMs: number;
}

export interface AudioCapture {
  start(): Promise<void>;
  stop(): Promise<{ outputPath: string; durationSec: number }>;
  onChunk(handler: (chunk: AudioCaptureChunk) => void): void;
  status(): AudioCaptureStatus;
}
