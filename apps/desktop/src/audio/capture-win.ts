import type { AudioCapture, AudioCaptureChunk, AudioCaptureStatus } from './types.js';

/**
 * Windows audio capture.
 *
 * TODO (needs hardware testing) :
 *   - WASAPI loopback capture via a native Node addon (node-audiocapture, node-wasapi)
 *   - Or shell out to `ffmpeg -f dshow -i audio="virtual-audio-capturer"` (free virtual driver)
 *   - The mix should combine microphone + loopback for full conversation
 *
 * For now: stub that records nothing but exposes the interface.
 */
export class WinAudioCapture implements AudioCapture {
  private state: AudioCaptureStatus = 'idle';
  private chunkHandlers: Array<(c: AudioCaptureChunk) => void> = [];

  async start(): Promise<void> {
    if (this.state !== 'idle') throw new Error(`Cannot start in state ${this.state}`);
    this.state = 'recording';
    console.warn('WinAudioCapture: STUB — no actual audio is captured. See TODO in this file.');
  }

  async stop(): Promise<{ outputPath: string; durationSec: number }> {
    this.state = 'stopping';
    this.state = 'idle';
    return { outputPath: '', durationSec: 0 };
  }

  onChunk(handler: (chunk: AudioCaptureChunk) => void): void {
    this.chunkHandlers.push(handler);
  }

  status(): AudioCaptureStatus {
    return this.state;
  }
}
