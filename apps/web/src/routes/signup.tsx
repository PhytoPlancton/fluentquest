import { Link, createRoute } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignupForm } from '@/components/forms/SignupForm';
import { Route as rootRoute } from './__root';

function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription>
            Get started with FluentQuest in under a minute.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm />
          <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
            Already have an account?{' '}
            <Link to="/login" className="text-[var(--foreground)] underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  component: SignupPage,
});
