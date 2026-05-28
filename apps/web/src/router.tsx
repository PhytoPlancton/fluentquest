import { createRouter } from '@tanstack/react-router';
import { Route as rootRoute } from './routes/__root';
import { Route as indexRoute } from './routes/index';
import { Route as loginRoute } from './routes/login';
import { Route as signupRoute } from './routes/signup';
import { Route as dashboardRoute } from './routes/dashboard';
import { Route as workspaceOverviewRoute } from './routes/workspace-overview';
import { Route as workspaceSessionsRoute } from './routes/workspace-sessions';
import { Route as sessionDetailRoute } from './routes/session-detail';
import { Route as newSessionRoute } from './routes/new-session';
import { Route as exercisesRoute } from './routes/exercises';
import { Route as inviteRoute } from './routes/invite';

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  dashboardRoute,
  workspaceOverviewRoute,
  workspaceSessionsRoute,
  newSessionRoute,
  sessionDetailRoute,
  exercisesRoute,
  inviteRoute,
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
