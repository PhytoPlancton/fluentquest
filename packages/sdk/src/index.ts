import type {
  ApiHealth,
  ApiPing,
  CEFRLevel,
  Language,
  Role,
  SessionStatus,
} from '@fluentquest/types';

// ── Domain shapes returned by the API ────────────────────────────────────

export interface SdkUser {
  id: string;
  email: string;
  displayName: string;
  level: Partial<Record<Language, CEFRLevel>>;
}

export interface SdkWorkspace {
  id: string;
  name: string;
  slug: string;
  isPersonal: boolean;
  ownerUserId?: string;
  createdAt?: string;
  role?: Role;
}

export interface SdkWorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  isPersonal: boolean;
  role: Role;
}

export interface SdkMember {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  joinedAt: string;
}

export interface SdkInvitation {
  id: string;
  email: string;
  role: Role;
  token?: string;
  expiresAt: string;
  createdAt?: string;
}

export interface SdkInvitationPreview {
  invitation: { email: string; role: Role; expiresAt: string };
  workspace: { id: string; name: string; slug: string } | null;
  invitedBy: { displayName: string; email: string } | null;
}

export interface SdkParticipant {
  userId: string;
  displayName: string;
}

export interface SdkRecordingSession {
  id: string;
  workspaceId: string;
  recordedByUserId: string;
  title: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
  languages: Language[];
  participants: SdkParticipant[];
  audioStorage: 'local' | 's3';
  audioUrl: string | null;
  transcriptionStatus: SessionStatus;
  analysisStatus: SessionStatus;
  createdAt: string;
}

export interface SdkSegment {
  id: string;
  speakerLabel: string;
  assignedUserId: string | null;
  startMs: number;
  endMs: number;
  text: string;
  language: Language;
  markedAt: string | null;
}

// ── SDK error ───────────────────────────────────────────────────────────

export class SdkError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, code: string | undefined, message: string, details?: unknown) {
    super(message);
    this.name = 'SdkError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ── Client ──────────────────────────────────────────────────────────────

export interface SdkConfig {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
}

export interface SignupPayload {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface CreateSessionPayload {
  workspaceId: string;
  title?: string;
  languages?: Language[];
  participants?: SdkParticipant[];
}

export interface InvitePayload {
  email: string;
  role?: 'admin' | 'member';
}

function buildClient(config: SdkConfig) {
  const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const baseUrl = config.baseUrl.replace(/\/+$/, '');

  const headers = (extra?: Record<string, string>): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
    if (config.token) h.Authorization = `Bearer ${config.token}`;
    return h;
  };

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetchImpl(`${baseUrl}${path}`, {
      credentials: 'include',
      ...init,
      headers: { ...headers(), ...(init?.headers as Record<string, string> | undefined) },
    });

    if (res.status === 204) return undefined as T;

    let body: unknown = null;
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      body = await res.json().catch(() => null);
    } else {
      body = await res.text().catch(() => '');
    }

    if (!res.ok) {
      const errObj = (body && typeof body === 'object' ? body : {}) as {
        error?: string;
        issues?: unknown;
      };
      throw new SdkError(
        res.status,
        errObj.error,
        errObj.error ?? `${path} → ${res.status}`,
        errObj.issues,
      );
    }
    return body as T;
  }

  return { request, baseUrl };
}

export interface FluentClient {
  ping(): Promise<ApiPing>;
  health(): Promise<ApiHealth>;

  // auth
  signup(payload: SignupPayload): Promise<{
    user: SdkUser;
    workspace: { id: string; name: string; slug: string };
    token: string;
  }>;
  login(payload: LoginPayload): Promise<{ user: SdkUser; token: string }>;
  logout(): Promise<void>;
  me(): Promise<{ user: SdkUser; workspaces: SdkWorkspaceSummary[] }>;

  // workspaces
  listWorkspaces(): Promise<{ workspaces: SdkWorkspaceSummary[] }>;
  createWorkspace(name: string): Promise<{ workspace: SdkWorkspace }>;
  getWorkspace(id: string): Promise<{ workspace: SdkWorkspace; role: Role; memberCount: number }>;
  renameWorkspace(id: string, name: string): Promise<{ workspace: SdkWorkspace }>;
  deleteWorkspace(id: string): Promise<void>;

  // members
  listMembers(workspaceId: string): Promise<{ members: SdkMember[] }>;
  removeMember(workspaceId: string, userId: string): Promise<void>;
  updateMemberRole(
    workspaceId: string,
    userId: string,
    role: 'admin' | 'member',
  ): Promise<{ role: Role }>;

  // invitations
  listInvitations(workspaceId: string): Promise<{ invitations: SdkInvitation[] }>;
  createInvitation(workspaceId: string, payload: InvitePayload): Promise<{ invitation: SdkInvitation }>;
  revokeInvitation(workspaceId: string, invitationId: string): Promise<void>;
  getInvitation(token: string): Promise<SdkInvitationPreview>;
  acceptInvitation(token: string): Promise<{ workspaceId: string; alreadyMember: boolean }>;

  // recording sessions
  listSessions(workspaceId: string, limit?: number): Promise<{ sessions: SdkRecordingSession[] }>;
  createRecordingSession(payload: CreateSessionPayload): Promise<{ session: SdkRecordingSession }>;
  getRecordingSession(id: string): Promise<{
    session: SdkRecordingSession;
    segments: SdkSegment[];
  }>;
  endRecordingSession(id: string): Promise<{ session: SdkRecordingSession }>;
}

export function createClient(config: SdkConfig): FluentClient {
  const { request } = buildClient(config);

  return {
    ping: () => request<ApiPing>('/v1/ping'),
    health: () => request<ApiHealth>('/v1/health'),

    signup: (payload) =>
      request('/v1/auth/signup', { method: 'POST', body: JSON.stringify(payload) }),
    login: (payload) =>
      request('/v1/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
    logout: () => request<void>('/v1/auth/logout', { method: 'POST' }),
    me: () => request('/v1/auth/me'),

    listWorkspaces: () => request('/v1/workspaces'),
    createWorkspace: (name) =>
      request('/v1/workspaces', { method: 'POST', body: JSON.stringify({ name }) }),
    getWorkspace: (id) => request(`/v1/workspaces/${id}`),
    renameWorkspace: (id, name) =>
      request(`/v1/workspaces/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    deleteWorkspace: (id) => request<void>(`/v1/workspaces/${id}`, { method: 'DELETE' }),

    listMembers: (workspaceId) => request(`/v1/workspaces/${workspaceId}/members`),
    removeMember: (workspaceId, userId) =>
      request<void>(`/v1/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' }),
    updateMemberRole: (workspaceId, userId, role) =>
      request(`/v1/workspaces/${workspaceId}/members/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),

    listInvitations: (workspaceId) => request(`/v1/workspaces/${workspaceId}/invitations`),
    createInvitation: (workspaceId, payload) =>
      request(`/v1/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    revokeInvitation: (workspaceId, invitationId) =>
      request<void>(`/v1/workspaces/${workspaceId}/invitations/${invitationId}`, {
        method: 'DELETE',
      }),
    getInvitation: (token) => request(`/v1/invitations/${token}`),
    acceptInvitation: (token) =>
      request(`/v1/invitations/${token}/accept`, { method: 'POST' }),

    listSessions: (workspaceId, limit) =>
      request(
        `/v1/sessions?workspaceId=${encodeURIComponent(workspaceId)}${
          limit ? `&limit=${limit}` : ''
        }`,
      ),
    createRecordingSession: (payload) =>
      request('/v1/sessions', { method: 'POST', body: JSON.stringify(payload) }),
    getRecordingSession: (id) => request(`/v1/sessions/${id}`),
    endRecordingSession: (id) => request(`/v1/sessions/${id}/end`, { method: 'POST' }),
  };
}
