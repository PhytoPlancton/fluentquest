import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth-context';
import { CreateWorkspaceDialog } from './forms/CreateWorkspaceForm';

interface Props {
  activeId: string | null;
}

export function WorkspaceSwitcher({ activeId }: Props) {
  const { workspaces } = useAuth();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = React.useState(false);

  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-md border bg-[var(--card)] px-3 py-2 text-left text-sm hover:bg-[var(--accent)]/60"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{active?.name ?? 'No workspace'}</p>
              {active && (
                <p className="truncate text-xs text-[var(--muted-foreground)]">
                  {active.isPersonal ? 'Personal' : 'Team'} · {active.role}
                </p>
              )}
            </div>
            <ChevronsUpDown className="h-4 w-4 text-[var(--muted-foreground)]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60" align="start">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {workspaces.length === 0 && (
            <DropdownMenuItem disabled>No workspaces yet</DropdownMenuItem>
          )}
          {workspaces.map((w) => (
            <DropdownMenuItem
              key={w.id}
              onClick={() =>
                void navigate({
                  to: '/workspaces/$workspaceId',
                  params: { workspaceId: w.id },
                })
              }
            >
              <div className="flex-1 truncate">
                <p className="truncate text-sm">{w.name}</p>
                <p className="truncate text-xs text-[var(--muted-foreground)]">
                  {w.isPersonal ? 'Personal' : 'Team'} · {w.role}
                </p>
              </div>
              {w.id === active?.id && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
