import { Link } from '@tanstack/react-router';
import { Clock, Languages, Mic } from 'lucide-react';
import type { SdkRecordingSession } from '@fluentquest/sdk';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface Props {
  workspaceId: string;
  session: SdkRecordingSession;
}

function formatDuration(seconds: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function SessionCard({ workspaceId, session }: Props) {
  return (
    <Link
      to="/workspaces/$workspaceId/sessions/$sessionId"
      params={{ workspaceId, sessionId: session.id }}
      className="block focus:outline-none focus:ring-2 focus:ring-[var(--ring)] rounded-xl"
    >
      <Card className="p-4 transition-colors hover:bg-[var(--accent)]/40">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">
              {session.title ?? 'Untitled session'}
            </h3>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {formatDate(session.startedAt)}
            </p>
          </div>
          <Badge variant={session.endedAt ? 'secondary' : 'default'}>
            {session.endedAt ? 'Done' : 'Live'}
          </Badge>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--muted-foreground)]">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(session.durationSec)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Languages className="h-3.5 w-3.5" />
            {session.languages.length > 0 ? session.languages.join(', ') : '—'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Mic className="h-3.5 w-3.5" />
            {session.participants.length} participant
            {session.participants.length === 1 ? '' : 's'}
          </span>
        </div>
      </Card>
    </Link>
  );
}
