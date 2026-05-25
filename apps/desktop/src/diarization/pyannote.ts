export interface DiarizationSegment {
  startMs: number;
  endMs: number;
  speaker: string; // 'SPEAKER_00', 'SPEAKER_01', ...
}

export interface DiarizationOptions {
  /** Path to the pyannote-onnx ONNX model. */
  modelPath?: string;
  /** Min segment duration in ms (segments shorter are discarded). */
  minDurationMs?: number;
}

/**
 * Speaker diarization via pyannote ONNX (onnxruntime-node).
 *
 * TODO (needs setup) :
 *   - Download pyannote ONNX models (segmentation + speaker embedding) :
 *     https://github.com/pengzhendong/pyannote-onnx OR
 *     https://huggingface.co/pyannote/segmentation-3.0
 *   - Run onnxruntime-node inference on PCM 16kHz mono audio (Whisper-compatible)
 *   - Cluster speaker embeddings (agglomerative or VBx) to assign labels
 *
 * For now : returns a single-speaker fallback. Real diarization needs the ONNX model
 * and audio buffer routing from Whisper's chunks.
 */
export async function diarizeFile(
  audioPath: string,
  _options: DiarizationOptions = {},
): Promise<DiarizationSegment[]> {
  void audioPath;
  console.warn('diarizeFile: STUB — returning single-speaker placeholder. See TODO in this file.');
  return [{ startMs: 0, endMs: 0, speaker: 'SPEAKER_00' }];
}

/**
 * Merge Whisper segments with diarization segments : assigns a speaker label
 * to each transcribed segment based on overlap with diarization.
 */
export function mergeTranscriptDiarization<T extends { startMs: number; endMs: number }>(
  segments: T[],
  diar: DiarizationSegment[],
): Array<T & { speaker: string }> {
  return segments.map((seg) => {
    let best: DiarizationSegment | null = null;
    let bestOverlap = 0;
    for (const d of diar) {
      const overlap = Math.max(0, Math.min(seg.endMs, d.endMs) - Math.max(seg.startMs, d.startMs));
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = d;
      }
    }
    return { ...seg, speaker: best?.speaker ?? 'SPEAKER_00' };
  });
}
