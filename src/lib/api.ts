import type {
  ActivityEvent,
  Attachment,
  AuditEvent,
  AuthProvider,
  AuthSessionResponse,
  ChatChannel,
  ChatMessage,
  ChatNotificationMode,
  Comment,
  Division,
  DocumentRecord,
  ExternalLink,
  IntegrationConfig,
  MeetingItem,
  Milestone,
  NotificationItem,
  Project,
  SavedView,
  Team,
  User,
  UserPresence,
  WorkDependency,
  WorkPackage,
  WorkspaceConfig,
} from '../types/workspace.ts';

export interface WorkspaceBootstrapData {
  workspace: WorkspaceConfig;
  currentUser: User;
  users: User[];
  slotsUsed: number;
  maxSlots: number;
  providers: {
    firebase: boolean;
    supabase: boolean;
  };
  divisions: Division[];
  teams: Team[];
  projects: Project[];
  milestones: Milestone[];
  workPackages: WorkPackage[];
  dependencies: WorkDependency[];
  comments: Comment[];
  documents: DocumentRecord[];
  attachments: Attachment[];
  integrations: IntegrationConfig[];
  externalLinks: ExternalLink[];
  notifications: NotificationItem[];
  auditEvents: AuditEvent[];
  activityEvents: ActivityEvent[];
  meetings: MeetingItem[];
  savedViews: SavedView[];
  chatChannels: ChatChannel[];
  chatMessages: ChatMessage[];
}

export interface SearchResults {
  projects: Project[];
  workPackages: WorkPackage[];
  documents: DocumentRecord[];
  users: User[];
}

// Session token held strictly in memory (never localStorage/sessionStorage)
let memoryToken: string | null = null;
let unauthorizedHandler: ((reason: string) => void) | null = null;

export function setAuthToken(token: string | null): void {
  memoryToken = token;
}

export function getAuthToken(): string | null {
  return memoryToken;
}

export function setUnauthorizedHandler(handler: ((reason: string) => void) | null): void {
  unauthorizedHandler = handler;
}

export function safeHttpUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (memoryToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${memoryToken}`);
  }
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
    const isAuthRoute = url.startsWith('/api/v1/auth/');
    if (res.status === 401 && !isAuthRoute && unauthorizedHandler) {
      memoryToken = null;
      unauthorizedHandler(message);
    }
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  getAuthStatus: () => request<AuthSessionResponse>('/api/v1/auth/status'),

  exchangeAuth: (payload: { provider: AuthProvider; token: string; inviteToken?: string }) =>
    request<AuthSessionResponse>('/api/v1/auth/exchange', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verifyKeyfile: (pendingToken: string, keyData: unknown) =>
    request<AuthSessionResponse>('/api/v1/auth/verify-keyfile', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pendingToken}`,
      },
      body: JSON.stringify({ keyData }),
    }),

  logout: () => request<{ ok: boolean }>('/api/v1/auth/logout', { method: 'POST' }),

  switchAccount: (targetUserId: string) =>
    request<AuthSessionResponse>('/api/v1/auth/switch-account', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    }),

  bootstrap: () => request<WorkspaceBootstrapData>('/api/v1/bootstrap'),

  updatePreferences: (payload: {
    chatNotificationMode?: ChatNotificationMode;
    notifyOnChannelAll?: boolean;
    desktopAlerts?: boolean;
    presence?: UserPresence;
    timezone?: string;
    channelNotificationModes?: Record<string, ChatNotificationMode>;
  }) =>
    request<User>('/api/v1/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  createChatChannel: (payload: { name: string; topic?: string; projectId?: string | null; isPrivate?: boolean }) =>
    request<ChatChannel>('/api/v1/chat/channels', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  sendChatMessage: (channelId: string, payload: { body: string; parentMessageId?: string | null }) =>
    request<ChatMessage>(`/api/v1/chat/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateChatMessage: (messageId: string, payload: { body?: string; pinned?: boolean }) =>
    request<ChatMessage>(`/api/v1/chat/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteChatMessage: (messageId: string) =>
    request<{ ok: boolean }>(`/api/v1/chat/messages/${messageId}`, {
      method: 'DELETE',
    }),

  reactChatMessage: (messageId: string, label: '👍' | '✅' | '👀' | '🚀' | 'ACK') =>
    request<ChatMessage>(`/api/v1/chat/messages/${messageId}/react`, {
      method: 'POST',
      body: JSON.stringify({ label }),
    }),

  markChatChannelRead: (channelId: string) =>
    request<{ ok: boolean }>(`/api/v1/chat/channels/${channelId}/read`, { method: 'POST' }),

  search: (q: string) => request<SearchResults>(`/api/v1/search?q=${encodeURIComponent(q)}`),

  createProject: (payload: Partial<Project>) =>
    request<Project>('/api/v1/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProject: (id: string, payload: Partial<Project>) =>
    request<Project>(`/api/v1/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  createWorkPackage: (payload: Partial<WorkPackage>) =>
    request<WorkPackage>('/api/v1/work-packages', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateWorkPackage: (id: string, payload: Partial<WorkPackage> & { approveSecurity?: boolean }) =>
    request<WorkPackage>(`/api/v1/work-packages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteWorkPackage: (id: string) =>
    request<{ ok: boolean }>(`/api/v1/work-packages/${id}`, {
      method: 'DELETE',
    }),

  addComment: (workPackageId: string, body: string) =>
    request<Comment>(`/api/v1/work-packages/${workPackageId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  addDocumentComment: (documentId: string, body: string) =>
    request<Comment>(`/api/v1/documents/${documentId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  reactComment: (commentId: string, label: 'ACK' | '+1' | 'Verified') =>
    request<Comment>(`/api/v1/comments/${commentId}/react`, {
      method: 'POST',
      body: JSON.stringify({ label }),
    }),

  createDependency: (payload: { predecessorId: string; successorId: string; type: 'blocks' | 'relates_to' }) =>
    request<{ id: string; predecessorId: string; successorId: string; type: 'blocks' | 'relates_to' }>(
      '/api/v1/dependencies',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  deleteDependency: (id: string) =>
    request<{ ok: boolean }>(`/api/v1/dependencies/${id}`, { method: 'DELETE' }),

  createMilestone: (payload: Partial<Milestone>) =>
    request<Milestone>('/api/v1/milestones', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateMilestone: (id: string, payload: Partial<Milestone>) =>
    request<Milestone>(`/api/v1/milestones/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  createDocument: (payload: Partial<DocumentRecord>) =>
    request<DocumentRecord>('/api/v1/documents', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateDocument: (id: string, payload: Partial<DocumentRecord> & { summary?: string }) =>
    request<DocumentRecord>(`/api/v1/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  createMeeting: (payload: Partial<MeetingItem>) =>
    request<MeetingItem>('/api/v1/meetings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  uploadAttachment: (payload: {
    parentType: 'work_package' | 'document';
    parentId: string;
    projectId: string;
    fileName: string;
    mediaType: string;
    contentBase64: string;
  }) =>
    request<Attachment>('/api/v1/attachments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  downloadAttachment: async (id: string, fileName: string) => {
    const headers = new Headers();
    if (memoryToken) headers.set('Authorization', `Bearer ${memoryToken}`);
    const res = await fetch(`/api/v1/attachments/${id}/download`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Download denied' }));
      throw new Error(err.error || 'Download failed');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  inviteMember: (payload: {
    email: string;
    displayName: string;
    title: string;
    role: User['role'];
    expiresAt?: string;
  }) =>
    request<{ user: User; inviteToken: string }>('/api/v1/members/invite', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateMember: (id: string, payload: { role?: User['role']; state?: User['state']; expiresAt?: string | null }) =>
    request<User>(`/api/v1/members/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  removeMember: (id: string) =>
    request<{ ok: boolean; slotsUsed: number; maxSlots: number }>(`/api/v1/members/${id}`, {
      method: 'DELETE',
    }),

  issueMemberKeyfile: (id: string) =>
    request<{
      filename: string;
      keyId: string;
      issuedAt: string;
      keyData: Record<string, unknown>;
      user: User;
    }>(`/api/v1/members/${id}/keyfile`, {
      method: 'POST',
    }),

  markNotificationRead: (id: string) =>
    request<{ ok: boolean }>(`/api/v1/notifications/${id}/read`, { method: 'POST' }),

  markAllNotificationsRead: () =>
    request<{ ok: boolean }>('/api/v1/notifications/read-all', { method: 'POST' }),

  updateIntegration: (id: string, payload: { enabled?: boolean; rotateSecret?: boolean }) =>
    request<IntegrationConfig>(`/api/v1/integrations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  testWebhook: (id: string, payload: { simulateInvalidSignature?: boolean; deliveryId?: string }) =>
    request<{ ok: boolean; idempotentDuplicate?: boolean; deliveryId: string; message: string }>(
      `/api/v1/integrations/${id}/test-webhook`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  updateWorkspace: (payload: Partial<WorkspaceConfig>) =>
    request<WorkspaceConfig>('/api/v1/workspace', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  exportAudit: async () => {
    const headers = new Headers();
    if (memoryToken) headers.set('Authorization', `Bearer ${memoryToken}`);
    const res = await fetch('/api/v1/audit/export', { headers });
    if (!res.ok) throw new Error('Failed to export audit log');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'truvornex-audit-log.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  createSavedView: (payload: { name: string; filters: Record<string, unknown> }) =>
    request<SavedView>('/api/v1/saved-views', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteSavedView: (id: string) =>
    request<{ ok: boolean }>(`/api/v1/saved-views/${id}`, { method: 'DELETE' }),
};
