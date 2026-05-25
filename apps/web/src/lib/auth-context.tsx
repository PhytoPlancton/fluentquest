import * as React from 'react';
import type { SdkUser, SdkWorkspaceSummary } from '@fluentquest/sdk';
import { api } from './api';

interface AuthState {
  user: SdkUser | null;
  workspaces: SdkWorkspaceSummary[];
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  refresh: () => Promise<void>;
  setUser: (user: SdkUser | null, workspaces?: SdkWorkspaceSummary[]) => void;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({
    user: null,
    workspaces: [],
    loading: true,
    error: null,
  });

  const refresh = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.me();
      setState({
        user: data.user,
        workspaces: data.workspaces,
        loading: false,
        error: null,
      });
    } catch {
      setState({ user: null, workspaces: [], loading: false, error: null });
    }
  }, []);

  const setUser = React.useCallback(
    (user: SdkUser | null, workspaces: SdkWorkspaceSummary[] = []) => {
      setState({ user, workspaces, loading: false, error: null });
    },
    [],
  );

  const logout = React.useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    setState({ user: null, workspaces: [], loading: false, error: null });
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = React.useMemo<AuthContextValue>(
    () => ({ ...state, refresh, setUser, logout }),
    [state, refresh, setUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
