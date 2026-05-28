import * as React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { UiRewriteExercise } from '@/types/review';

interface Props {
  exercise: UiRewriteExercise;
  onAnswered?: (correct: boolean, userAnswer: string) => void | Promise<void>;
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.!?,;:]$/g, '');
}

function tokens(value: string): string[] {
  return normalize(value).split(' ').filter(Boolean);
}

interface DiffToken {
  text: string;
  status: 'match' | 'expected' | 'unexpected';
}

function diffWords(actual: string, expected: string): DiffToken[] {
  const a = tokens(actual);
  const e = tokens(expected);
  const out: DiffToken[] = [];
  const max = Math.max(a.length, e.length);
  for (let i = 0; i < max; i += 1) {
    const ai = a[i];
    const ei = e[i];
    if (ai === undefined && ei !== undefined) {
      out.push({ text: ei, status: 'expected' });
    } else if (ei === undefined && ai !== undefined) {
      out.push({ text: ai, status: 'unexpected' });
    } else if (ai === ei) {
      out.push({ text: ai as string, status: 'match' });
    } else {
      if (ai !== undefined) out.push({ text: ai, status: 'unexpected' });
      if (ei !== undefined) out.push({ text: ei, status: 'expected' });
    }
  }
  return out;
}

export function ExerciseRewrite({ exercise, onAnswered }: Props) {
  const [value, setValue] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  const isCorrect = submitted && normalize(value) === normalize(exercise.correctAnswer);
  const diff = submitted && !isCorrect ? diffWords(value, exercise.correctAnswer) : null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitted) return;
    setSubmitted(true);
    void onAnswered?.(normalize(value) === normalize(exercise.correctAnswer), value);
  };

  const handleReset = () => {
    setValue('');
    setSubmitted(false);
  };

  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold">{exercise.prompt}</h3>
      {exercise.hint && (
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">Hint: {exercise.hint}</p>
      )}
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Type your answer…"
          disabled={submitted}
        />
        {!submitted ? (
          <Button type="submit" disabled={value.trim().length === 0}>
            Check
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              {isCorrect ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400">Correct.</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-[var(--destructive)]" />
                  <span className="text-[var(--destructive)]">Not quite.</span>
                </>
              )}
            </div>
            {!isCorrect && (
              <div className="rounded-md border border-dashed border-[var(--border)] p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  Expected
                </p>
                <p className="mt-1 leading-relaxed">{exercise.correctAnswer}</p>
                {diff && (
                  <p className="mt-2 flex flex-wrap gap-1 text-xs">
                    {diff.map((tok, i) => (
                      <span
                        key={`${tok.text}-${i}`}
                        className={cn(
                          'rounded px-1.5 py-0.5',
                          tok.status === 'match' && 'bg-[var(--muted)] text-[var(--muted-foreground)]',
                          tok.status === 'expected' &&
                            'bg-emerald-500/15 text-emerald-300',
                          tok.status === 'unexpected' &&
                            'bg-[var(--destructive)]/15 text-[var(--destructive)] line-through',
                        )}
                      >
                        {tok.text}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            )}
            <Button type="button" variant="outline" size="sm" onClick={handleReset}>
              Try again
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}
