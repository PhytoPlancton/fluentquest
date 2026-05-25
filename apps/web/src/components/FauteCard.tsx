import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { UiFaute } from '@/types/review';

interface Props {
  faute: UiFaute;
  /** Optional async loader for the deep rule explanation (e.g. LLM call). */
  loadRuleDeep?: (fauteId: string) => Promise<string>;
}

const severityLabel: Record<number, string> = {
  1: 'Minor',
  2: 'Light',
  3: 'Notable',
  4: 'Serious',
  5: 'Critical',
};

export function FauteCard({ faute, loadRuleDeep }: Props) {
  const [expanded, setExpanded] = React.useState(false);
  const [deep, setDeep] = React.useState<string | undefined>(faute.ruleDeep);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleToggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !deep && loadRuleDeep) {
      setLoading(true);
      setError(null);
      try {
        const result = await loadRuleDeep(faute.id);
        setDeep(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load deep rule');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {faute.category}
            </Badge>
            <Badge variant={faute.severity >= 4 ? 'destructive' : 'secondary'}>
              {severityLabel[faute.severity] ?? `S${faute.severity}`}
            </Badge>
            {faute.speakerLabel && (
              <Badge variant="outline" className="text-[10px]">
                {faute.speakerLabel}
              </Badge>
            )}
          </div>
          <p className="text-sm leading-relaxed">
            <span className="text-[var(--destructive)] line-through">{faute.originalText}</span>{' '}
            <span aria-hidden="true">→</span>{' '}
            <span className="font-semibold text-[var(--foreground)]">
              {faute.correctedText}
            </span>
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">{faute.ruleSummary}</p>
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-3 -ml-2"
        onClick={() => void handleToggle()}
        disabled={loading}
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {loading ? 'Loading…' : expanded ? 'Hide details' : 'Approfondir'}
      </Button>

      {expanded && (
        <div className="mt-3 rounded-md border border-dashed border-[var(--border)] bg-[var(--card)]/60 p-3 text-sm leading-relaxed">
          {error ? (
            <p className="text-[var(--destructive)]">{error}</p>
          ) : deep ? (
            <p className="whitespace-pre-line">{deep}</p>
          ) : (
            <p className="text-[var(--muted-foreground)]">
              No additional explanation available yet.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
