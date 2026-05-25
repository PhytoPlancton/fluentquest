interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  signal?: AbortSignal;
}

interface ChatResponse {
  choices: Array<{ message: { content: string }; finish_reason: string }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  model: string;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export async function llmChat(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
  const apiKey = process.env.EDJ_API_KEY;
  if (!apiKey) throw new Error('EDJ_API_KEY required');

  const base = process.env.EDJ_API_BASE ?? 'https://api.perplexity.edj-labs.com/v1';
  const model = options.model ?? process.env.EDJ_DEFAULT_MODEL ?? 'pplx-claude-sonnet-4.6';

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 2000,
  };
  if (options.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new LLMError(`LLM call failed: ${res.status}`, res.status, text);
  }

  const data = (await res.json()) as ChatResponse;
  const content = data.choices[0]?.message?.content;
  if (!content) throw new LLMError('LLM returned empty content', 500, JSON.stringify(data));
  return content;
}

export async function llmJson<T>(
  messages: LLMMessage[],
  parser: (raw: string) => T,
  options: LLMOptions = {},
): Promise<T> {
  const raw = await llmChat(messages, { ...options, jsonMode: true });
  try {
    return parser(raw);
  } catch (err) {
    throw new LLMError(
      `Failed to parse LLM JSON output: ${(err as Error).message}`,
      500,
      raw.slice(0, 2000),
    );
  }
}
