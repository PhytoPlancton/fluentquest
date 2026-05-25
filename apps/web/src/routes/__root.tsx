import * as React from 'react';
import { Outlet, createRootRoute } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/sonner';

const RouterDevtools = (import.meta.env.DEV
  ? React.lazy(() =>
      import('@tanstack/router-devtools').then((m) => ({
        default: m.TanStackRouterDevtools,
      })),
    )
  : () => null) as React.ComponentType;

function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster />
      {import.meta.env.DEV && (
        <React.Suspense fallback={null}>
          <RouterDevtools />
        </React.Suspense>
      )}
    </>
  );
}

export const Route = createRootRoute({ component: RootLayout });
