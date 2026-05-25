import * as React from 'react';
import { Link, createRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { SdkError, type SdkInvitationPreview } from '@fluentquest/sdk';
import { Route as rootRoute } from './__root';

function InvitePage() {
  const { token } = Route.useParams();
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  const [preview, setPreview] = React.useState<SdkInvitationPreview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [accepting, setAccepting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getInvitation(token)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof SdkError) {
          if (err.status === 404) setError('This invitation is no longer valid.');
          else if (err.status === 410) setError('This invitation has expired.');
          else setError(err.message);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load invitation.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const accept = async () => {
    if (!user) {
      void navigate({ to: '/login' });
      return;
    }
    setAccepting(true);
    setError(null);
    try {
      const result = await api.acceptInvitation(token);
      await refresh();
      void navigate({
        to: '/workspaces/$workspaceId',
        params: { workspaceId: result.workspaceId },
      });
    } catch (err) {
      if (err instanceof SdkError && err.code === 'email_mismatch') {
        setError('This invitation is for a different email address.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to accept invitation.');
      }
    } finally {
      setAccepting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join workspace</CardTitle>
          <CardDescription>You've been invited to collaborate on FluentQuest.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-[var(--muted-foreground)]">Loading invitation…</p>
          ) : error ? (
            <p className="text-sm text-[var(--destructive)]">{error}</p>
          ) : preview ? (
            <>
              <div className="space-y-1">
                <p className="text-sm text-[var(--muted-foreground)]">Workspace</p>
                <p className="text-lg font-semibold">{preview.workspace?.name ?? '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-[var(--muted-foreground)]">Invitation for</p>
                <p className="text-sm">{preview.invitation.email}</p>
              </div>
              {preview.invitedBy && (
                <div className="space-y-1">
                  <p className="text-sm text-[var(--muted-foreground)]">Invited by</p>
                  <p className="text-sm">
                    {preview.invitedBy.displayName} ({preview.invitedBy.email})
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-sm text-[var(--muted-foreground)]">Role</p>
                <p className="text-sm capitalize">{preview.invitation.role}</p>
              </div>

              {user ? (
                user.email === preview.invitation.email ? (
                  <Button onClick={() => void accept()} disabled={accepting} className="w-full">
                    {accepting ? 'Joining…' : 'Accept invitation'}
                  </Button>
                ) : (
                  <p className="text-sm text-[var(--destructive)]">
                    You're signed in as {user.email}, but this invitation is for{' '}
                    {preview.invitation.email}.
                  </p>
                )
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Sign in or create an account with{' '}
                    <span className="text-[var(--foreground)]">
                      {preview.invitation.email}
                    </span>{' '}
                    to accept.
                  </p>
                  <div className="flex gap-2">
                    <Button asChild className="flex-1">
                      <Link to="/login">Sign in</Link>
                    </Button>
                    <Button asChild variant="outline" className="flex-1">
                      <Link to="/signup">Sign up</Link>
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invite/$token',
  component: InvitePage,
});
