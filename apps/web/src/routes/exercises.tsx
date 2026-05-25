import * as React from 'react';
import { createRoute } from '@tanstack/react-router';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExerciseMCQ } from '@/components/ExerciseMCQ';
import { ExerciseRewrite } from '@/components/ExerciseRewrite';
import type { UiMcq, UiRewriteExercise } from '@/types/review';
import { Route as rootRoute } from './__root';

const PLACEHOLDER_MCQ: UiMcq[] = [
  {
    id: 'mcq-1',
    prompt: 'Choose the correct form: "He ___ tennis every Saturday."',
    options: ['play', 'plays', 'is playing', 'playing'],
    correctIndex: 1,
    explanation: 'Third-person singular in the present simple → add -s.',
  },
  {
    id: 'mcq-2',
    prompt: 'Which sentence is correct?',
    options: [
      'I have went to the store yesterday.',
      'I went to the store yesterday.',
      'I have gone to the store yesterday.',
      'I goed to the store yesterday.',
    ],
    correctIndex: 1,
    explanation:
      'A specific past time ("yesterday") requires the simple past, not the present perfect.',
  },
];

const PLACEHOLDER_REWRITE: UiRewriteExercise[] = [
  {
    id: 'rw-1',
    prompt: 'Rewrite correctly: "She don\'t like coffee."',
    hint: 'Third-person singular auxiliary.',
    correctAnswer: "She doesn't like coffee",
  },
  {
    id: 'rw-2',
    prompt: 'Rewrite correctly: "I have went home."',
    hint: 'Past participle of "go".',
    correctAnswer: 'I have gone home',
  },
];

function ExercisesPage() {
  const [score, setScore] = React.useState({ correct: 0, total: 0 });

  const onAnswered = (correct: boolean) => {
    setScore((s) => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className="mx-auto max-w-3xl space-y-6">
          <header className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Today's exercises</h1>
              <p className="text-sm text-[var(--muted-foreground)]">
                Placeholder queue — the real SRS scheduler ships with M9.
              </p>
            </div>
            <div className="text-right text-sm text-[var(--muted-foreground)]">
              Score: {score.correct} / {score.total}
            </div>
          </header>

          <Card>
            <CardHeader>
              <CardTitle>Multiple choice</CardTitle>
              <CardDescription>Pick the correct form.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {PLACEHOLDER_MCQ.map((m) => (
                <ExerciseMCQ key={m.id} exercise={m} onAnswered={onAnswered} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rewrite</CardTitle>
              <CardDescription>Type the corrected sentence.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {PLACEHOLDER_REWRITE.map((r) => (
                <ExerciseRewrite key={r.id} exercise={r} onAnswered={onAnswered} />
              ))}
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </AuthGuard>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workspaces/$workspaceId/exercises',
  component: ExercisesPage,
});
