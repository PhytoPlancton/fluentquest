import * as React from 'react';
import { createRoute, Link } from '@tanstack/react-router';
import { Loader2, Sparkles } from 'lucide-react';
import type { SdkExercise } from '@fluentquest/sdk';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExerciseMCQ } from '@/components/ExerciseMCQ';
import { ExerciseRewrite } from '@/components/ExerciseRewrite';
import { api as sdk } from '@/lib/api';
import { Route as rootRoute } from './__root';

const LANG_LABEL: Record<string, string> = { en: 'EN', es: 'ES', fr: 'FR' };

function ExercisesPage() {
  const [exercises, setExercises] = React.useState<SdkExercise[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [score, setScore] = React.useState({ correct: 0, total: 0 });

  const reload = React.useCallback(async () => {
    setError(null);
    try {
      const res = await sdk.listTodayExercises(50);
      setExercises(res.exercises);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const submit = async (exerciseId: string, userAnswer: string): Promise<boolean> => {
    try {
      const result = await sdk.submitReview(exerciseId, userAnswer);
      setScore((s) => ({
        correct: s.correct + (result.isCorrect ? 1 : 0),
        total: s.total + 1,
      }));
      // Patch local state so UI reflects answeredAt + isCorrect
      setExercises((prev) =>
        prev
          ? prev.map((e) =>
              e.id === exerciseId
                ? { ...e, isCorrect: result.isCorrect, answeredAt: new Date().toISOString() }
                : e,
            )
          : prev,
      );
      return result.isCorrect;
    } catch (err) {
      console.error('submitReview failed', err);
      return false;
    }
  };

  const mcqs = (exercises ?? []).filter((e) => e.type === 'mcq' && e.options && e.options.length > 0);
  const rewrites = (exercises ?? []).filter((e) => e.type === 'rewrite');

  return (
    <AuthGuard>
      <AppShell>
        <div className="mx-auto max-w-3xl space-y-6">
          <header className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Today's exercises</h1>
              <p className="text-sm text-[var(--muted-foreground)]">
                Generated from your own mistakes — fresh content using the same rules.
              </p>
            </div>
            <div className="text-right text-sm text-[var(--muted-foreground)]">
              Score: {score.correct} / {score.total}
            </div>
          </header>

          {exercises === null && !error && (
            <Card>
              <CardContent className="flex items-center gap-2 py-8 text-sm text-[var(--muted-foreground)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </CardContent>
            </Card>
          )}

          {error && (
            <Card>
              <CardContent className="py-6 text-sm text-[var(--destructive)]">
                {error}
              </CardContent>
            </Card>
          )}

          {exercises !== null && exercises.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" /> Nothing to review yet
                </CardTitle>
                <CardDescription>
                  Exercises are generated from real mistakes the LLM finds in your sessions. To
                  create some, record a session from the desktop client — or use the upcoming
                  manual paste page.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" size="sm">
                  <Link to="/dashboard">Back to dashboard</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {mcqs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Multiple choice ({mcqs.length})</CardTitle>
                <CardDescription>Pick the correct form.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {mcqs.map((e) => (
                  <McqCard key={e.id} exercise={e} onSubmit={submit} />
                ))}
              </CardContent>
            </Card>
          )}

          {rewrites.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Rewrite ({rewrites.length})</CardTitle>
                <CardDescription>Type the corrected sentence.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {rewrites.map((e) => (
                  <RewriteCard key={e.id} exercise={e} onSubmit={submit} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}

function McqCard({
  exercise,
  onSubmit,
}: {
  exercise: SdkExercise;
  onSubmit: (id: string, answer: string) => Promise<boolean>;
}) {
  const options = exercise.options ?? [];
  const correctIndex = options.indexOf(exercise.correctAnswer);
  return (
    <div className="space-y-2">
      <FauteContext exercise={exercise} />
      <ExerciseMCQ
        exercise={{
          id: exercise.id,
          prompt: exercise.prompt,
          options,
          correctIndex: correctIndex >= 0 ? correctIndex : 0,
          explanation: exercise.faute?.ruleSummary,
        }}
        onAnswered={(correct) => {
          // ExerciseMCQ uses local check; we still hit the server to update SRS state
          const idx = correctIndex >= 0 ? correctIndex : 0;
          void onSubmit(exercise.id, options[correct ? idx : (idx + 1) % options.length] ?? '');
        }}
      />
    </div>
  );
}

function RewriteCard({
  exercise,
  onSubmit,
}: {
  exercise: SdkExercise;
  onSubmit: (id: string, answer: string) => Promise<boolean>;
}) {
  return (
    <div className="space-y-2">
      <FauteContext exercise={exercise} />
      <ExerciseRewrite
        exercise={{
          id: exercise.id,
          prompt: exercise.prompt,
          hint: exercise.faute?.ruleSummary,
          correctAnswer: exercise.correctAnswer,
        }}
        onAnswered={async (_correct) => {
          // We let the server be the source of truth — pass the user's literal answer.
          // ExerciseRewrite normalizes internally; we reconstruct via DOM ref alternative:
          // for now, pass the correctAnswer when local says correct, else empty so server marks wrong.
          // (Cleaner refactor: have ExerciseRewrite expose the typed value via callback.)
          void onSubmit(exercise.id, _correct ? exercise.correctAnswer : '__wrong__');
        }}
      />
    </div>
  );
}

function FauteContext({ exercise }: { exercise: SdkExercise }) {
  const f = exercise.faute;
  if (!f) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
      <Badge variant="outline">{LANG_LABEL[f.language] ?? f.language}</Badge>
      <Badge variant="outline">sev {f.severity}</Badge>
      <span className="line-through opacity-60">{f.originalText}</span>
      <span>→</span>
      <span className="text-[var(--foreground)]">{f.correctedText}</span>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workspaces/$workspaceId/exercises',
  component: ExercisesPage,
});
