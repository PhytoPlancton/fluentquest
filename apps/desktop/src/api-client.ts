// HTTP client to talk to the FluentQuest backend from the main process.

export interface UploadSessionInput {
  apiUrl: string;
  token: string;
  workspaceId: string;
  title?: string;
  languages: Array<'en' | 'es' | 'fr'>;
  segments: Array<{
    speakerLabel: string;
    startMs: number;
    endMs: number;
    text: string;
    language: 'en' | 'es' | 'fr';
  }>;
}

export interface UploadSessionResult {
  sessionId: string;
  url: string;
}

export async function uploadSession(input: UploadSessionInput): Promise<UploadSessionResult> {
  const base = input.apiUrl.replace(/\/+$/, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${input.token}`,
  };

  // 1) Create session
  const createRes = await fetch(`${base}/v1/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      title: input.title ?? 'Desktop capture',
      languages: input.languages,
    }),
  });
  if (!createRes.ok) {
    throw new Error(`createSession ${createRes.status}: ${await createRes.text()}`);
  }
  const created = (await createRes.json()) as { session: { id: string } };
  const sessionId = created.session.id;

  // 2) Bulk segments — chunked to respect API max(500) per call
  const CHUNK = 500;
  for (let i = 0; i < input.segments.length; i += CHUNK) {
    const slice = input.segments.slice(i, i + CHUNK);
    const segRes = await fetch(`${base}/v1/sessions/${sessionId}/segments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ segments: slice }),
    });
    if (!segRes.ok) {
      throw new Error(`segments[${i}] ${segRes.status}: ${await segRes.text()}`);
    }
  }

  // 3) End + analyze
  const endRes = await fetch(`${base}/v1/sessions/${sessionId}/end`, {
    method: 'POST',
    headers,
  });
  if (!endRes.ok) throw new Error(`end ${endRes.status}`);

  const analyzeRes = await fetch(`${base}/v1/sessions/${sessionId}/analyze`, {
    method: 'POST',
    headers,
  });
  if (!analyzeRes.ok && analyzeRes.status !== 202) {
    throw new Error(`analyze ${analyzeRes.status}`);
  }

  // Derive web URL from API URL by swapping subdomain.
  // localhost:3030 → localhost:8080
  // api-fluentquest.nmt.ovh → fluentquest.nmt.ovh
  let webBase = base;
  webBase = webBase.replace(':3030', ':8080');
  webBase = webBase.replace('api-fluentquest', 'fluentquest');
  // strip /v1 if present (shouldn't be, but defensive)
  webBase = webBase.replace(/\/v1\/?$/, '');

  return {
    sessionId,
    url: `${webBase}/workspaces/${input.workspaceId}/sessions/${sessionId}`,
  };
}
