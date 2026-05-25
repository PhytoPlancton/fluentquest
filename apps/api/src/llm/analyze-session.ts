import {
  Faute,
  Segment,
  Session as RecordingSession,
  User,
  type CEFRLevel,
  type Language,
} from '@fluentquest/db';
import { llmJson } from './client.js';
import { FAULT_DETECTION_SYSTEM, buildFaultDetectionUser } from './prompts.js';
import { SessionAnalysisSchema, parseJsonStrict } from './schemas.js';

export async function analyzeSession(sessionId: string): Promise<void> {
  const session = await RecordingSession.findById(sessionId).exec();
  if (!session) throw new Error('Session not found');

  session.analysisStatus = 'processing';
  await session.save();

  try {
    const segments = await Segment.find({ sessionId: session._id })
      .sort({ startMs: 1 })
      .exec();

    if (segments.length === 0) {
      session.analysisStatus = 'done';
      await session.save();
      return;
    }

    const llmInput = segments.map((s, i) => ({
      index: i,
      speaker: s.assignedUserId ? String(s.assignedUserId) : s.speakerLabel,
      language: s.language,
      text: s.text,
    }));

    const analysis = await llmJson(
      [
        { role: 'system', content: FAULT_DETECTION_SYSTEM },
        { role: 'user', content: buildFaultDetectionUser(llmInput) },
      ],
      (raw) => parseJsonStrict(raw, SessionAnalysisSchema),
      { temperature: 0.2, maxTokens: 3500 },
    );

    const model = process.env.EDJ_DEFAULT_MODEL ?? 'pplx-claude-sonnet-4.6';

    for (const f of analysis.fautes ?? []) {
      const seg = segments[f.segmentIndex];
      if (!seg) continue;

      const userId = seg.assignedUserId ?? session.recordedByUserId;
      await Faute.create({
        segmentId: seg._id,
        sessionId: session._id,
        workspaceId: session.workspaceId,
        userId,
        category: f.category,
        language: seg.language,
        severity: f.severity,
        originalText: f.originalText,
        correctedText: f.correctedText,
        highlightSpan: f.highlightSpan,
        ruleSummary: f.ruleSummary,
        ruleDeep: f.ruleDeep ?? null,
        examples: f.examples,
        isInteresting: f.isInteresting,
        generatedByModel: model,
      });
    }

    if (analysis.levelEstimate && analysis.languageDetected) {
      await updatePrimarySpeakerLevel(
        session._id.toString(),
        analysis.languageDetected,
        analysis.levelEstimate,
      );
    }

    const recos = analysis.recommendations ?? [];
    if (recos.length > 0) {
      session.title = (session.title ?? '') + ` [recos:${JSON.stringify(recos)}]`;
    }

    session.analysisStatus = 'done';
    await session.save();
  } catch (err) {
    session.analysisStatus = 'failed';
    await session.save();
    throw err;
  }
}

async function updatePrimarySpeakerLevel(
  sessionId: string,
  language: Language,
  level: CEFRLevel,
): Promise<void> {
  const session = await RecordingSession.findById(sessionId).exec();
  if (!session) return;

  // Heuristic: attribute level to the user who recorded if no clear primary speaker.
  // M10 refinement: count words per speaker, attribute level to majority speaker.
  const segments = await Segment.find({ sessionId: session._id }).exec();
  const wordCount = new Map<string, number>();
  for (const seg of segments) {
    const key = seg.assignedUserId ? String(seg.assignedUserId) : '__unknown__';
    wordCount.set(key, (wordCount.get(key) ?? 0) + seg.text.split(/\s+/).length);
  }
  wordCount.delete('__unknown__');

  let primaryUserId: string | undefined;
  let max = 0;
  for (const [k, v] of wordCount) {
    if (v > max) {
      max = v;
      primaryUserId = k;
    }
  }
  if (!primaryUserId) primaryUserId = String(session.recordedByUserId);

  const user = await User.findById(primaryUserId).exec();
  if (!user) return;

  user.level = { ...user.level, [language]: level };
  await user.save();
}
