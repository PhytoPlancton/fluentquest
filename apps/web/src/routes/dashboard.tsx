import * as React from 'react';
import { Link, createRoute } from '@tanstack/react-router';
import { Mic, Plus, Users } from 'lucide-react';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SessionCard } from '@/components/SessionCard';
import { CreateWorkspaceDialog } from '@/components/forms/CreateWorkspaceForm';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { SdkRecordingSession } from '@fluentquest/sdk';
import { Route as rootRoute } from './__root';

interface RecentSession {
  workspaceId: string;
  session: SdkRecordingSession;
}

function DashboardPage() {
  const { user, workspaces } = useAuth();
  const [recent, setRecent] = React.useState<RecentSession[]>([]);
  const [loadingSessions, setLoadingSessions] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const loadRecent = async () => {
      if (workspaces.length === 0) {
        setLoadingSessions(false);
        return;
      }
      setLoadingSessions(true);
      try {
        const results = await Promise.all(
          workspaces.map(async (w) => {
            try {
              const data = await api.listSessions(w.id, 3);
              return data.sessions.map((session) => ({ workspaceId: w.id, session }));
            } catch {
              return [];
            }
          }),
        );
        if (cancelled) return;
        const flat = results
          .flat()
          .sort(
            (a, b) =>
              new Date(b.session.startedAt).getTime() -
              new Date(a.session.startedAt).getTime(),
          )
          .slice(0, 6);
        setRecent(flat);
      } finally {
        if (!cancelled) setLoadingSessions(false);
      }
    };

    void loadRecent();
    return () => {
      cancelled = true;
    };
  }, [workspaces]);

  return (
    <AuthGuard>
      <AppShell>
        <div className="mx-auto max-w-5xl space-y-8">
          <header className="flex flex-col gap-2">
            <p className="text-sm text-[var(--muted-foreground)]">
              Welcome back{user ? `, ${user.displayName}` : ''}.
            </p>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          </header>

          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Your workspaces</h2>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                New workspace
              </Button>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((w) => (
                <Link
                  key={w.id}
                  to="/workspaces/$workspaceId"
                  params={{ workspaceId: w.id }}
                  className="block focus:outline-none focus:ring-2 focus:ring-[var(--ring)] rounded-xl"
                >
                  <Card className="h-full p-4 transition-colors hover:bg-[var(--accent)]/40">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{w.name}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {w.isPersonal ? 'Personal' : 'Team'} · {w.role}
                        </p>
                      </div>
                      <Users className="h-4 w-4 text-[var(--muted-foreground)]" />
                    </div>
                  </Card>
                </Link>
              ))}
              {workspaces.length === 0 && (
                <Card className="p-6 text-sm text-[var(--muted-foreground)]">
                  No workspaces yet. Create one to get started.
                </Card>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Recent sessions</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {loadingSessions ? (
                <Card className="p-6 text-sm text-[var(--muted-foreground)]">
                  Loading sessions…
                </Card>
              ) : recent.length > 0 ? (
                recent.map(({ workspaceId, session }) => (
                  <SessionCard
                    key={session.id}
                    workspaceId={workspaceId}
                    session={session}
                  />
                ))
              ) : (
                <Card className="p-6 text-sm text-[var(--muted-foreground)]">
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4" />
                    No sessions yet. Record one from the desktop client to get started.
                  </div>
                </Card>
              )}
            </div>
          </section>
        </div>
        <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
      </AppShell>
    </AuthGuard>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage,
});
