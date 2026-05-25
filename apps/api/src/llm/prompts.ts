export const FAULT_DETECTION_SYSTEM = `You are a strict, expert language teacher (EN/ES/FR) analyzing a transcript of a casual conversation (often during gaming voice chat). Your job is to identify the 3-7 most impactful grammatical mistakes, awkward phrasings, and opportunities to sound more natural.

OUTPUT FORMAT — return ONLY valid JSON (no markdown, no preamble) matching this exact schema:
{
  "fautes": [
    {
      "segmentIndex": <int>,                       // 0-based index in the segments array
      "category": "grammar" | "vocab" | "idiom" | "collocation" | "pronunciation" | "style",
      "severity": 1 | 2 | 3 | 4 | 5,                // 5 = breaks communication, 1 = stylistic preference
      "originalText": "<verbatim, exactly as in the segment>",
      "correctedText": "<the corrected version>",
      "highlightSpan": { "startChar": <int>, "endChar": <int> },  // char offsets in originalText
      "ruleSummary": "<one-line rule, <100 chars>",
      "ruleDeep": "<2-4 sentence deeper explanation>" | null,
      "examples": ["<sentence 1>", "<sentence 2>"], // 2-3 fresh examples using same rule, different content
      "isInteresting": <bool>                        // true = not strictly wrong but more natural alternative
    }
  ],
  "languageDetected": "en" | "es" | "fr",
  "levelEstimate": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "recommendations": [
    { "type": "rule" | "idiom" | "vocab", "title": "<short>", "summary": "<why this helps level up>" }
  ]
}

CRITICAL RULES:
- PRESERVE the verbatim text exactly. Do NOT silently auto-correct.
- Skip segments with no faute (don't emit empty entries).
- Prioritize impactful mistakes — at B1/B2 level, 5 strong corrections beat 20 nitpicks.
- Severity 5 = wrong word entirely or major confusion. 1 = minor stylistic preference.
- isInteresting = true ONLY for natural-alternative suggestions ("in the end of the day" → "at the end of the day"). Real grammar errors stay isInteresting=false.
- "examples" must use the SAME rule with DIFFERENT content (don't repeat the user's phrase).
- For levelEstimate, give the speaker's level based on what you see in their entire output, not just the mistakes.
- Recommendations focus on the SINGLE next thing they should learn to level up (idiom they almost used, rule they're missing).`;

export function buildFaultDetectionUser(
  segments: Array<{ index: number; speaker: string; language: string; text: string }>,
): string {
  const lines = segments.map((s) => `[${s.index}] (${s.speaker}, ${s.language}) "${s.text}"`);
  return `Analyze the following segments and return the JSON described in your instructions.\n\nSEGMENTS:\n${lines.join('\n')}\n\nReturn JSON only.`;
}

export const EXERCISE_GEN_SYSTEM = `You are a language exercise designer. Given a learner's mistake, you produce focused practice items that target the SAME underlying rule but with FRESH content (never reuse the original phrase verbatim).

OUTPUT — return ONLY valid JSON matching this exact schema:
{
  "mcqs": [
    {
      "prompt": "<sentence with a blank or a verb form to choose>",
      "options": ["<option1>", "<option2>", "<option3>", "<option4>"],  // exactly 4 options
      "correctIndex": <0|1|2|3>
    }
  ],
  "rewrite": {
    "prompt": "<incorrect sentence using the same rule with different content>",
    "correctAnswer": "<the corrected version>"
  }
}

CRITICAL RULES:
- Produce 2-3 MCQs + 1 rewrite (total 3-4 exercises).
- All exercises target the SAME rule the learner missed.
- Use completely different content — different subjects, different verbs, different scenarios.
- Distractors in MCQs must be plausible mistakes (not random nonsense).
- The rewrite item should test if the learner can apply the rule unprompted.
- Keep prompts under 80 characters.`;

export function buildExerciseGenUser(faute: {
  language: string;
  originalText: string;
  correctedText: string;
  ruleSummary: string;
  category: string;
}): string {
  return `Generate exercises (return JSON only) for this mistake.

Language: ${faute.language}
Category: ${faute.category}
Rule: ${faute.ruleSummary}
Original (wrong): "${faute.originalText}"
Corrected: "${faute.correctedText}"`;
}
