import { RouterProvider } from '@tanstack/react-router';
import { AuthProvider } from './lib/auth-context';
import { router } from './router';

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
