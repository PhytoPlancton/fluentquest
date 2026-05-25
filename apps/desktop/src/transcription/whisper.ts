import { spawn } from 'node:child_process';
import path from 'node:path';

export interface WhisperSegment {
  startMs: number;
  endMs: number;
  text: string;
  language: string;
}

export interface WhisperOptions {
  /** Path to the whisper.cpp binary (bundled or user-provided). */
  binaryPath?: string;
  /** Path to the GGUF model file. */
  modelPath?: string;
  /** Force language detection ('auto' = let Whisper decide). */
  language?: 'auto' | 'en' | 'es' | 'fr';
}

/**
 * Whisper.cpp wrapper.
 *
 * VERBATIM MODE :
 *   - `temperature=0` (no creativity)
 *   - `--prompt "transcribe verbatim, preserve all grammatical errors exactly as spoken"`
 *   - `--no-fallback` (don't fallback to text-only if confidence is low — we want raw)
 *
 * TODO (needs setup) :
 *   - Bundle whisper.cpp binary per platform in resources/ (~5MB each)
 *   - Bundle or download large-v3 model on first run (~3GB) — store in userData/whisper-models/
 *   - Implement streaming chunk processing (whisper.cpp supports SDL audio input)
 *
 * For now : exposes the subprocess interface but returns empty if binary is missing.
 */
export async function transcribeFile(
  audioPath: string,
  options: WhisperOptions = {},
): Promise<WhisperSegment[]> {
  const binary = options.binaryPath ?? process.env.WHISPER_BIN ?? 'whisper-cli';
  const model = options.modelPath ?? process.env.WHISPER_MODEL;
  if (!model) {
    console.warn('WHISPER_MODEL not set — returning empty transcription (stub).');
    return [];
  }

  const args = [
    '-m', model,
    '-f', audioPath,
    '--language', options.language ?? 'auto',
    '--temperature', '0',
    '--prompt', 'Transcribe verbatim. Preserve all grammatical errors and disfluencies exactly as spoken.',
    '--output-json',
    '--output-file', path.join(path.dirname(audioPath), 'whisper-out'),
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => (stderr += String(d)));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0) return reject(new Error(`whisper exited ${code}: ${stderr}`));
      // TODO: parse whisper-out.json (whisper.cpp's --output-json format)
      resolve([]);
    });
  });
}
