// Whisper transcription via @huggingface/transformers (ONNX Runtime).
// Models download to userData on first use. No native bindings required.
//
// The audio input is a Float32Array of PCM mono 16kHz samples — this is what
// the renderer produces via Web Audio API (AudioContext.createScriptProcessor
// or AudioWorklet → 16kHz resample → Float32Array).

import path from 'node:path';
import { app } from 'electron';

export interface TranscribeOptions {
  modelId?: string; // e.g. 'Xenova/whisper-base' (multilingual)
  language?: 'en' | 'es' | 'fr' | 'auto';
  onProgress?: (p: TranscribeProgress) => void;
}

export interface TranscribeProgress {
  status: 'downloading' | 'loading' | 'transcribing' | 'done' | 'error';
  progress?: number; // 0..1
  message?: string;
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

// Cached pipeline. Loaded once, reused for subsequent calls.
let cachedPipeline: {
  modelId: string;
  pipe: (audio: Float32Array, options: unknown) => Promise<unknown>;
} | null = null;

export async function transcribe(
  audio: Float32Array,
  options: TranscribeOptions = {},
): Promise<TranscribeResult> {
  const modelId = options.modelId ?? 'Xenova/whisper-base';
  const onProgress = options.onProgress ?? (() => undefined);

  try {
    if (!cachedPipeline || cachedPipeline.modelId !== modelId) {
      onProgress({ status: 'loading', message: `Loading ${modelId}…` });
      const transformers = await import('@huggingface/transformers');
      const { pipeline, env } = transformers as unknown as {
        pipeline: (task: string, model: string, options?: unknown) => Promise<unknown>;
        env: { cacheDir?: string };
      };
      env.cacheDir = path.join(app.getPath('userData'), 'models');

      const pipe = (await pipeline('automatic-speech-recognition', modelId, {
        progress_callback: (p: { status?: string; progress?: number; file?: string }) => {
          if (p.status === 'downloading' || p.status === 'progress') {
            onProgress({
              status: 'downloading',
              progress: p.progress,
              message: p.file ? `Downloading ${p.file}` : 'Downloading model',
            });
          }
        },
      })) as unknown as (audio: Float32Array, options: unknown) => Promise<unknown>;
      cachedPipeline = { modelId, pipe };
    }

    onProgress({ status: 'transcribing' });

    const verbatimPrompt =
      'Transcribe verbatim. Preserve grammatical errors and disfluencies exactly as spoken.';

    const result = (await cachedPipeline.pipe(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      language: options.language && options.language !== 'auto' ? options.language : null,
      task: 'transcribe',
      return_timestamps: true,
      // initial_prompt is supported by Whisper.cpp via transformers.js
      forced_decoder_ids: undefined,
      no_repeat_ngram_size: 3,
      temperature: 0,
      // Hint Whisper not to "clean up" by passing verbatim instruction.
      // (transformers.js passes this through to the model when supported.)
      initial_prompt: verbatimPrompt,
    })) as {
      text: string;
      chunks?: Array<{ timestamp: [number, number]; text: string }>;
      language?: string;
    };

    const segments: TranscribeSegment[] = (result.chunks ?? []).map((c) => ({
      startMs: Math.round((c.timestamp[0] ?? 0) * 1000),
      endMs: Math.round((c.timestamp[1] ?? 0) * 1000),
      text: c.text.trim(),
      language: result.language ?? 'en',
    }));

    onProgress({ status: 'done' });
    return { segments, language: result.language ?? 'en' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onProgress({ status: 'error', message });
    throw err;
  }
}
