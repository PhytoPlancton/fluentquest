import * as React from 'react';
import { Link, createRoute } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SegmentRow } from '@/components/SegmentRow';
import { FauteCard } from '@/components/FauteCard';
import { api } from '@/lib/api';
import {
  SdkError,
  type SdkFauteCategory,
  type SdkRecordingSession,
  type SdkSegment,
} from '@fluentquest/sdk';
import type { UiFaute } from '@/types/review';
import { Route as rootRoute } from './__root';

interface ApiFaute {
  id: string;
  segmentId: string;
  userId: string;
  category: SdkFauteCategory;
  severity: 1 | 2 | 3 | 4 | 5;
  language: 'en' | 'es' | 'fr';
  originalText: string;
  correctedText: string;
  highlightSpan: { startChar: number; endChar: number };
  ruleSummary: string;
  ruleDeep: string | null;
  examples: string[];
  isInteresting: boolean;
}

async function fetchFautes(sessionId: string): Promise<ApiFaute[]> {
  const baseUrl = (import.meta.env.VITE_API_URL ?? '') as string;
  const res = await fetch(`${baseUrl}/v1/sessions/${sessionId}/fautes`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Fautes fetch failed: ${res.status}`);
  const data = (await res.json()) as { fautes: ApiFaute[] };
  return data.fautes;
}

function deepLoaderFor(map: Map<string, string | null>): (id: string) => Promise<string> {
  return async (id) => {
    const deep = map.get(id);
    return deep ?? 'No deeper explanation provided by the LLM for this rule.';
  };
}

function SessionDetailPage() {
  const { workspaceId, sessionId } = Route.useParams();
  const [session, setSession] = React.useState<SdkRecordingSession | null>(null);
  const [segments, setSegments] = React.useState<SdkSegment[]>([]);
  const [fautes, setFautes] = React.useState<ApiFaute[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api.getRecordingSession(sessionId),
      fetchFautes(sessionId).catch(() => [] as ApiFaute[]),
    ])
      .then(([sessionData, fautesData]) => {
        if (cancelled) return;
        setSession(sessionData.session);
        setSegments(sessionData.segments);
        setFautes(fautesData);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof SdkError && err.status === 404) {
          setError('Session not found.');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load session.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const speakerBySegmentId = React.useMemo(() => {
    const map = new Map<string, { speakerLabel: string; startMs: number }>();
    for (const seg of segments) {
      map.set(seg.id, { speakerLabel: seg.speakerLabel, startMs: seg.startMs });
    }
    return map;
  }, [segments]);

  const deepByFauteId = React.useMemo(() => {
    const map = new Map<string, string | null>();
    for (const f of fautes) map.set(f.id, f.ruleDeep);
    return map;
  }, [fautes]);

  const uiFautes: UiFaute[] = React.useMemo(
    () =>
      fautes
        .slice()
        .sort((a, b) => b.severity - a.severity)
        .map((f) => {
          const seg = speakerBySegmentId.get(f.segmentId);
          return {
            id: f.id,
            originalText: f.originalText,
            correctedText: f.correctedText,
            category: f.category,
            severity: f.severity,
            ruleSummary: f.ruleSummary,
            ruleDeep: f.ruleDeep ?? undefined,
            speakerLabel: seg?.speakerLabel,
            startMs: seg?.startMs,
          };
        }),
    [fautes, speakerBySegmentId],
  );

  return (
    <AuthGuard>
      <AppShell>
        <div className="mx-auto max-w-5xl space-y-6">
          <div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/workspaces/$workspaceId/sessions" params={{ workspaceId }}>
                <ArrowLeft className="h-4 w-4" />
                Back to sessions
              </Link>
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>
          ) : error ? (
            <Card className="p-6 text-[var(--destructive)]">{error}</Card>
          ) : session ? (
            <>
              <header className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={session.endedAt ? 'secondary' : 'default'}>
                    {session.endedAt ? 'Completed' : 'Live'}
                  </Badge>
                  <Badge variant="outline">{session.analysisStatus}</Badge>
                  {session.languages.map((l) => (
                    <Badge key={l} variant="outline">
                      {l.toUpperCase()}
                    </Badge>
                  ))}
                </div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {session.title ?? 'Untitled session'}
                </h1>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Started {new Date(session.startedAt).toLocaleString()} ·{' '}
                  {Math.floor(session.durationSec / 60)}m{' '}
                  {Math.floor(session.durationSec % 60)}s
                </p>
              </header>

              <Card>
                <CardHeader>
                  <CardTitle>Transcript</CardTitle>
                  <CardDescription>
                    Verbatim transcription — errors are preserved on purpose.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {segments.length === 0 ? (
                    <p className="text-sm text-[var(--muted-foreground)]">
                      No segments yet.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {segments.map((s) => (
                        <SegmentRow key={s.id} segment={s} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Corrections ({uiFautes.length})</CardTitle>
                  <CardDescription>
                    {session.analysisStatus === 'done'
                      ? `${uiFautes.length} fautes detected by the LLM.`
                      : session.analysisStatus === 'processing'
                        ? 'LLM is analyzing — fautes will appear in a few seconds. Refresh the page.'
                        : session.analysisStatus === 'failed'
                          ? 'Analysis failed. Check API logs.'
                          : 'Analysis not started yet.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {uiFautes.length === 0 ? (
                    <p className="text-sm text-[var(--muted-foreground)]">
                      No fautes yet for this session.
                    </p>
                  ) : (
                    uiFautes.map((f) => (
                      <FauteCard
                        key={f.id}
                        faute={f}
                        loadRuleDeep={deepLoaderFor(deepByFauteId)}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </AppShell>
    </AuthGuard>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workspaces/$workspaceId/sessions/$sessionId',
  component: SessionDetailPage,
});
