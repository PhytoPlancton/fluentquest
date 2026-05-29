// Browser-side audio capture using Web APIs.
// - getDisplayMedia({ audio: true, video: true }) for system audio (Mac 13+ / Win)
// - getUserMedia({ audio: true }) for microphone
// - Mixed via AudioContext and resampled to 16kHz mono for Whisper input.

export interface CaptureHandle {
  stop: () => Promise<Float32Array>;
  getElapsedMs: () => number;
}

export async function startCapture(): Promise<CaptureHandle> {
  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: true,
  });
  // Discard the video track immediately — we only want audio.
  for (const track of displayStream.getVideoTracks()) {
    track.stop();
    displayStream.removeTrack(track);
  }

  let micStream: MediaStream | null = null;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false,
    });
  } catch {
    micStream = null; // mic optional — system audio alone is enough
  }

  const audioContext = new AudioContext({ sampleRate: 48_000 });
  const dest = audioContext.createMediaStreamDestination();

  if (displayStream.getAudioTracks().length > 0) {
    const src = audioContext.createMediaStreamSource(displayStream);
    src.connect(dest);
  }
  if (micStream) {
    const src = audioContext.createMediaStreamSource(micStream);
    src.connect(dest);
  }

  // Collect raw PCM from the mixed stream using a ScriptProcessor (deprecated but works).
  // AudioWorklet would be cleaner, but ScriptProcessor avoids extra file loading.
  const mixedSource = audioContext.createMediaStreamSource(dest.stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);

  // Accumulate Float32 samples at 48kHz, we resample on stop.
  const buffers: Float32Array[] = [];

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    const copy = new Float32Array(input.length);
    copy.set(input);
    buffers.push(copy);
  };

  mixedSource.connect(processor);
  processor.connect(audioContext.destination);

  const startedAt = performance.now();

  const stop = async (): Promise<Float32Array> => {
    processor.disconnect();
    mixedSource.disconnect();
    await audioContext.close();
    for (const track of displayStream.getTracks()) track.stop();
    if (micStream) for (const track of micStream.getTracks()) track.stop();

    const total = buffers.reduce((acc, b) => acc + b.length, 0);
    const merged = new Float32Array(total);
    let offset = 0;
    for (const b of buffers) {
      merged.set(b, offset);
      offset += b.length;
    }
    return resample(merged, 48_000, 16_000);
  };

  return {
    stop,
    getElapsedMs: () => performance.now() - startedAt,
  };
}

// Simple linear-interpolation downsample from inputRate to outputRate.
// Sufficient for Whisper input — quality difference is negligible for ASR.
function resample(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate) return input;
  const ratio = inputRate / outputRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const i0 = Math.floor(srcIndex);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = srcIndex - i0;
    output[i] = (input[i0] ?? 0) * (1 - frac) + (input[i1] ?? 0) * frac;
  }
  return output;
}
