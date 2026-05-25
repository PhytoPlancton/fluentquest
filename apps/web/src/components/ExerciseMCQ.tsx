import * as React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { UiMcq } from '@/types/review';

interface Props {
  exercise: UiMcq;
  onAnswered?: (correct: boolean) => void;
}

export function ExerciseMCQ({ exercise, onAnswered }: Props) {
  const [selected, setSelected] = React.useState<number | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  const handlePick = (index: number) => {
    if (submitted) return;
    setSelected(index);
  };

  const handleSubmit = () => {
    if (selected === null || submitted) return;
    setSubmitted(true);
    onAnswered?.(selected === exercise.correctIndex);
  };

  const handleReset = () => {
    setSelected(null);
    setSubmitted(false);
  };

  const isCorrect = submitted && selected === exercise.correctIndex;

  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold">{exercise.prompt}</h3>
      <div className="mt-4 space-y-2">
        {exercise.options.map((option, index) => {
          const picked = selected === index;
          const isAnswer = index === exercise.correctIndex;
          const showAsCorrect = submitted && isAnswer;
          const showAsWrong = submitted && picked && !isAnswer;
          return (
            <button
              key={index}
              type="button"
              onClick={() => handlePick(index)}
              disabled={submitted}
              className={cn(
                'w-full rounded-md border px-3 py-2 text-left text-sm transition-colors',
                'hover:bg-[var(--accent)]/40 disabled:hover:bg-transparent',
                picked && !submitted && 'border-[var(--primary)] bg-[var(--accent)]/40',
                showAsCorrect &&
                  'border-emerald-500/60 bg-emerald-500/10 text-emerald-300',
                showAsWrong && 'border-[var(--destructive)] bg-[var(--destructive)]/10',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span>{option}</span>
                {showAsCorrect && <CheckCircle2 className="h-4 w-4" />}
                {showAsWrong && <XCircle className="h-4 w-4" />}
              </div>
            </button>
          );
        })}
      </div>

      {!submitted ? (
        <Button className="mt-4" onClick={handleSubmit} disabled={selected === null}>
          Submit
        </Button>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          <p
            className={cn(
              'text-sm font-medium',
              isCorrect ? 'text-emerald-400' : 'text-[var(--destructive)]',
            )}
          >
            {isCorrect ? 'Correct.' : 'Not quite.'}
          </p>
          {exercise.explanation && (
            <p className="text-sm text-[var(--muted-foreground)]">{exercise.explanation}</p>
          )}
          <Button variant="outline" size="sm" className="w-fit" onClick={handleReset}>
            Try again
          </Button>
        </div>
      )}
    </Card>
  );
}
