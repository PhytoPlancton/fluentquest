import * as React from 'react';
import { Link, createRoute } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Mic, X } from 'lucide-react';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InviteForm } from '@/components/forms/InviteForm';
import { api } from '@/lib/api';
import { SdkError, type SdkInvitation, type SdkMember, type SdkWorkspace } from '@fluentquest/sdk';
import type { Role } from '@fluentquest/types';
import { Route as rootRoute } from './__root';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function WorkspaceOverviewPage() {
  const { workspaceId } = Route.useParams();

  const [workspace, setWorkspace] = React.useState<SdkWorkspace | null>(null);
  const [role, setRole] = React.useState<Role | null>(null);
  const [memberCount, setMemberCount] = React.useState(0);
  const [members, setMembers] = React.useState<SdkMember[]>([]);
  const [invitations, setInvitations] = React.useState<SdkInvitation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const isAdmin = role === 'owner' || role === 'admin';

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ws = await api.getWorkspace(workspaceId);
      setWorkspace(ws.workspace);
      setRole(ws.role);
      setMemberCount(ws.memberCount);

      const m = await api.listMembers(workspaceId);
      setMembers(m.members);

      if (ws.role === 'owner' || ws.role === 'admin') {
        try {
          const i = await api.listInvitations(workspaceId);
          setInvitations(i.invitations);
        } catch {
          // members can't list — ignore
        }
      } else {
        setInvitations([]);
      }
    } catch (err) {
      if (err instanceof SdkError && err.status === 404) {
        setError('Workspace not found or you do not have access.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load workspace.');
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  React.useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const revokeInvite = async (id: string) => {
    try {
      await api.revokeInvitation(workspaceId, id);
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
      toast.success('Invitation revoked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke');
    }
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className="mx-auto max-w-5xl space-y-8">
          {loading ? (
            <p className="text-sm text-[var(--muted-foreground)]">Loading workspace…</p>
          ) : error ? (
            <Card className="p-6">
              <p className="text-[var(--destructive)]">{error}</p>
            </Card>
          ) : workspace ? (
            <>
              <header className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {workspace.isPersonal ? 'Personal' : 'Team'}
                  </Badge>
                  {role && <Badge variant="secondary">{role}</Badge>}
                </div>
                <h1 className="text-3xl font-bold tracking-tight">{workspace.name}</h1>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {memberCount} member{memberCount === 1 ? '' : 's'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button asChild>
                    <Link
                      to="/workspaces/$workspaceId/sessions"
                      params={{ workspaceId }}
                    >
                      <Mic className="h-4 w-4" />
                      View sessions
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link
                      to="/workspaces/$workspaceId/exercises"
                      params={{ workspaceId }}
                    >
                      Today's exercises
                    </Link>
                  </Button>
                </div>
              </header>

              <Card>
                <CardHeader>
                  <CardTitle>Members</CardTitle>
                  <CardDescription>People with access to this workspace.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {members.map((m) => (
                    <div
                      key={m.userId}
                      className="flex items-center justify-between gap-3 rounded-md border bg-[var(--card)]/40 p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{initials(m.displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{m.displayName}</p>
                          <p className="truncate text-xs text-[var(--muted-foreground)]">
                            {m.email}
                          </p>
                        </div>
                      </div>
                      <Badge variant={m.role === 'owner' ? 'default' : 'secondary'}>
                        {m.role}
                      </Badge>
                    </div>
                  ))}
                  {members.length === 0 && (
                    <p className="text-sm text-[var(--muted-foreground)]">
                      No members loaded.
                    </p>
                  )}
                </CardContent>
              </Card>

              {isAdmin && (
                <Card>
                  <CardHeader>
                    <CardTitle>Invite teammates</CardTitle>
                    <CardDescription>
                      Send an invitation email. They'll join with the chosen role.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <InviteForm workspaceId={workspaceId} onInvited={() => void loadAll()} />

                    {invitations.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-[var(--muted-foreground)]">
                          Pending
                        </h4>
                        {invitations.map((inv) => (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="truncate">{inv.email}</p>
                              <p className="text-xs text-[var(--muted-foreground)]">
                                {inv.role} · expires{' '}
                                {new Date(inv.expiresAt).toLocaleDateString()}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void revokeInvite(inv.id)}
                            >
                              <X className="h-4 w-4" />
                              Revoke
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {role === 'owner' && !workspace.isPersonal && (
                <Card>
                  <CardHeader>
                    <CardTitle>Settings</CardTitle>
                    <CardDescription>Workspace owner controls.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        if (!window.confirm(`Delete workspace "${workspace.name}"?`)) return;
                        try {
                          await api.deleteWorkspace(workspaceId);
                          toast.success('Workspace deleted');
                          window.location.assign('/dashboard');
                        } catch (err) {
                          toast.error(
                            err instanceof Error ? err.message : 'Failed to delete',
                          );
                        }
                      }}
                    >
                      Delete workspace
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </div>
      </AppShell>
    </AuthGuard>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workspaces/$workspaceId',
  component: WorkspaceOverviewPage,
});
