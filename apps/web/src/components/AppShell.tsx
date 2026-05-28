import * as React from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { LayoutDashboard, BookOpen, LogOut, Mic, Plus, Users, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

interface Props {
  children: React.ReactNode;
}

interface NavItem {
  to: string;
  params?: Record<string, string>;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  resolvedPath: string;
}

export function AppShell({ children }: Props) {
  const { user, workspaces, logout } = useAuth();
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });

  const activeWorkspaceId = React.useMemo<string | null>(() => {
    const match = location.pathname.match(/^\/workspaces\/([^/]+)/);
    if (match?.[1]) return match[1];
    return workspaces[0]?.id ?? null;
  }, [location.pathname, workspaces]);

  const navItems: NavItem[] = React.useMemo(() => {
    const base: NavItem[] = [
      {
        to: '/dashboard',
        label: 'Dashboard',
        Icon: LayoutDashboard,
        resolvedPath: '/dashboard',
      },
    ];
    if (activeWorkspaceId) {
      base.push(
        {
          to: '/workspaces/$workspaceId',
          params: { workspaceId: activeWorkspaceId },
          label: 'Overview',
          Icon: Users,
          resolvedPath: `/workspaces/${activeWorkspaceId}`,
        },
        {
          to: '/workspaces/$workspaceId/sessions',
          params: { workspaceId: activeWorkspaceId },
          label: 'Sessions',
          Icon: Mic,
          resolvedPath: `/workspaces/${activeWorkspaceId}/sessions`,
        },
        {
          to: '/workspaces/$workspaceId/sessions/new',
          params: { workspaceId: activeWorkspaceId },
          label: 'New session',
          Icon: Plus,
          resolvedPath: `/workspaces/${activeWorkspaceId}/sessions/new`,
        },
        {
          to: '/workspaces/$workspaceId/exercises',
          params: { workspaceId: activeWorkspaceId },
          label: 'Exercises',
          Icon: BookOpen,
          resolvedPath: `/workspaces/${activeWorkspaceId}/exercises`,
        },
      );
    }
    return base;
  }, [activeWorkspaceId]);

  const initials = (user?.displayName ?? 'U')
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleLogout = async () => {
    await logout();
    void navigate({ to: '/login' });
  };

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-[var(--card)]/40 md:flex md:flex-col">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--primary)] text-[var(--primary-foreground)]">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold tracking-tight">FluentQuest</span>
        </div>

        <div className="px-3 pb-3">
          <WorkspaceSwitcher activeId={activeWorkspaceId} />
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => {
            const { to, params, label, Icon, resolvedPath } = item;
            const active =
              location.pathname === resolvedPath ||
              (resolvedPath !== '/dashboard' &&
                location.pathname.startsWith(resolvedPath));
            return (
              <Link
                key={resolvedPath}
                // SAFETY: `to` is one of the literal route paths, but TanStack
                // Router's Link generic cannot narrow a union of literals at
                // this site; the runtime check is enforced by the typed routes
                // referenced in router.tsx
                to={to as never}
                params={params as never}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]/60 hover:text-[var(--foreground)]',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--border)] p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-[var(--accent)]/60"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 truncate">
                  <p className="truncate text-sm font-medium">{user?.displayName}</p>
                  <p className="truncate text-xs text-[var(--muted-foreground)]">
                    {user?.email}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void handleLogout()}>
                <LogOut className="h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-[var(--border)] px-4 md:px-6">
          <span className="text-sm text-[var(--muted-foreground)] md:hidden">FluentQuest</span>
          <div className="ml-auto md:hidden">
            <Button variant="ghost" size="sm" onClick={() => void handleLogout()}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
