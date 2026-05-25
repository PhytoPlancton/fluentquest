import * as React from 'react';
import { createRoute } from '@tanstack/react-router';
import { Mic } from 'lucide-react';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { Card } from '@/components/ui/card';
import { SessionCard } from '@/components/SessionCard';
import { api } from '@/lib/api';
import { SdkError, type SdkRecordingSession } from '@fluentquest/sdk';
import { Route as rootRoute } from './__root';

function SessionsListPage() {
  const { workspaceId } = Route.useParams();
  const [sessions, setSessions] = React.useState<SdkRecordingSession[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .listSessions(workspaceId, 50)
      .then((data) => {
        if (cancelled) return;
        setSessions(data.sessions);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof SdkError && err.status === 403) {
          setError('You do not have access to this workspace.');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load sessions.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return (
    <AuthGuard>
      <AppShell>
        <div className="mx-auto max-w-5xl space-y-6">
          <header>
            <h1 className="text-2xl font-bold tracking-tight">Sessions</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Recordings captured by the desktop client.
            </p>
          </header>

          {loading ? (
            <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>
          ) : error ? (
            <Card className="p-6 text-[var(--destructive)]">{error}</Card>
          ) : sessions.length === 0 ? (
            <Card className="p-8 text-center text-sm text-[var(--muted-foreground)]">
              <Mic className="mx-auto mb-2 h-5 w-5" />
              No sessions yet. Start a session from the desktop app and it will appear here.
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  workspaceId={workspaceId}
                  session={session}
                />
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workspaces/$workspaceId/sessions',
  component: SessionsListPage,
});
