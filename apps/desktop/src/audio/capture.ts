import os from 'node:os';
import { MacAudioCapture } from './capture-mac.js';
import { WinAudioCapture } from './capture-win.js';
import type { AudioCapture } from './types.js';

export function createAudioCapture(): AudioCapture {
  const platform = os.platform();
  if (platform === 'darwin') return new MacAudioCapture();
  if (platform === 'win32') return new WinAudioCapture();
  throw new Error(`Unsupported platform: ${platform}. Mac and Windows only for now.`);
}

export type { AudioCapture, AudioCaptureChunk, AudioCaptureStatus } from './types.js';
