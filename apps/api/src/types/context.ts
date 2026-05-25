import type {
  AuthSessionHydrated,
  Role,
  SessionHydrated,
  UserHydrated,
  WorkspaceHydrated,
} from '@fluentquest/db';

export interface AppVariables {
  user: UserHydrated;
  authSession: AuthSessionHydrated;
  workspace: WorkspaceHydrated;
  membershipRole: Role;
  recordingSession: SessionHydrated;
}

export interface AppEnv {
  Variables: AppVariables;
}
