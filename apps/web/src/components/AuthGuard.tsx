import * as React from 'react';
import { Navigate } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth-context';

interface Props {
  children: React.ReactNode;
}

export function AuthGuard({ children }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--muted-foreground)]">
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}
