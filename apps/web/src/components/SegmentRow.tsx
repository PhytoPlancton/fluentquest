import type { SdkSegment } from '@fluentquest/sdk';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Props {
  segment: SdkSegment;
  highlighted?: boolean;
}

function formatTimestamp(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function SegmentRow({ segment, highlighted }: Props) {
  return (
    <div
      className={cn(
        'grid grid-cols-[80px_120px_1fr] gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        highlighted
          ? 'bg-[var(--accent)]/60'
          : 'hover:bg-[var(--accent)]/30',
      )}
    >
      <span className="font-mono text-xs text-[var(--muted-foreground)]">
        {formatTimestamp(segment.startMs)}
      </span>
      <span className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
        <Badge variant="outline" className="text-[10px]">
          {segment.speakerLabel}
        </Badge>
        <span className="uppercase">{segment.language}</span>
      </span>
      <p className="leading-relaxed">{segment.text}</p>
    </div>
  );
}
