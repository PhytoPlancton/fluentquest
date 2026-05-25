import type { AudioCapture, AudioCaptureChunk, AudioCaptureStatus } from './types.js';

/**
 * Mac audio capture.
 *
 * TODO (needs hardware testing) :
 *   - Use ScreenCaptureKit (macOS 13+) via a native Swift addon, OR
 *   - Use AVCaptureSession + AVAudioEngine via objc-runtime / nodobjc bindings
 *   - As a fallback, spawn `ffmpeg -f avfoundation -i ":0"` and parse stdout
 *
 * The mix should include both microphone + system audio (VoIP output). On macOS,
 * capturing system audio requires either BlackHole virtual driver or ScreenCaptureKit.
 *
 * For now: stub that records nothing but exposes the interface.
 */
export class MacAudioCapture implements AudioCapture {
  private state: AudioCaptureStatus = 'idle';
  private chunkHandlers: Array<(c: AudioCaptureChunk) => void> = [];

  async start(): Promise<void> {
    if (this.state !== 'idle') throw new Error(`Cannot start in state ${this.state}`);
    this.state = 'recording';
    console.warn('MacAudioCapture: STUB — no actual audio is captured. See TODO in this file.');
  }

  async stop(): Promise<{ outputPath: string; durationSec: number }> {
    this.state = 'stopping';
    // STUB
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
