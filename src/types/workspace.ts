export const MAX_ACCOUNT_SLOTS = 8;

export type AuthProvider = 'firebase' | 'supabase';

export type ChatNotificationMode = 'mentions_only' | 'all_messages' | 'muted';

export type UserPresence = 'active' | 'focus' | 'reviewing' | 'away';

export type WorkspaceRole =
  | 'Workspace Owner'
  | 'Workspace Administrator'
  | 'Programme Manager'
  | 'Project Manager'
  | 'Team Lead'
  | 'Contributor'
  | 'Reviewer / QA'
  | 'Read-only Observer'
  | 'External Collaborator';

export type UserState = 'active' | 'suspended' | 'invited' | 'revoked';

export type WorkPackageType =
  | 'initiative'
  | 'epic'
  | 'feature'
  | 'task'
  | 'subtask'
  | 'bug'
  | 'research'
  | 'tech_debt';

export type WorkPackageStatus =
  | 'Draft'
  | 'Backlog'
  | 'Ready'
  | 'In Progress'
  | 'In Review'
  | 'Verification'
  | 'Accepted'
  | 'Closed'
  | 'Blocked'
  | 'Waiting'
  | 'Cancelled'
  | 'Reopened';

export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';

export type ProjectHealth = 'on_track' | 'at_risk' | 'off_track';

export type ProjectVisibility = 'internal' | 'restricted';

export type DependencyType = 'blocks' | 'relates_to';

export interface User {
  id: string;
  idpSubject: string;
  authProvider: AuthProvider;
  displayName: string;
  email: string;
  title: string;
  role: WorkspaceRole;
  state: UserState;
  mfaEnabled: boolean;
  timezone: string;
  joinedAt: string;
  lastActiveAt?: string;
  expiresAt?: string | null;
  presence: UserPresence;
  chatNotificationMode: ChatNotificationMode;
  notifyOnChannelAll: boolean;
  desktopAlerts: boolean;
  channelNotificationModes?: Record<string, ChatNotificationMode>;
  hasKeyfile?: boolean;
  keyfileId?: string | null;
}

export interface ChatChannel {
  id: string;
  name: string;
  topic: string;
  projectId?: string | null;
  isPrivate: boolean;
  createdBy: string;
  createdAt: string;
  memberIds?: string[];
}

export interface ChatMessage {
  id: string;
  channelId: string;
  authorId: string;
  parentMessageId?: string | null;
  body: string;
  mentions: string[];
  mentionAll?: boolean;
  reactions: Record<string, string[]>;
  pinned: boolean;
  edited: boolean;
  linkedWorkKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Division {
  id: string;
  name: string;
  description: string;
  leadId: string;
}

export interface Team {
  id: string;
  divisionId: string;
  name: string;
  leadId: string;
  memberIds: string[];
}

export interface Project {
  id: string;
  key: string;
  name: string;
  programme: string;
  objective: string;
  ownerId: string;
  sponsorId: string;
  status: 'Active' | 'Planning' | 'On Hold' | 'Archived';
  health: ProjectHealth;
  healthNote: string;
  visibility: ProjectVisibility;
  startDate: string;
  targetDate: string;
  participatingTeamIds: string[];
  memberIds: string[];
  linkedDocIds: string[];
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  targetWindow: string;
  targetDate: string;
  state: 'Planned' | 'At Risk' | 'Achieved' | 'Missed';
  confidence: number;
  ownerId: string;
  description: string;
}

export interface WorkDependency {
  id: string;
  predecessorId: string;
  successorId: string;
  type: DependencyType;
}

export interface WorkFieldChange {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  actorId: string;
  timestamp: string;
}

export interface WorkPackage {
  id: string;
  key: string;
  projectId: string;
  parentId?: string | null;
  type: WorkPackageType;
  title: string;
  description: string;
  status: WorkPackageStatus;
  priority: Priority;
  ownerId: string;
  assigneeIds: string[];
  reviewerId?: string | null;
  creatorId: string;
  teamId?: string | null;
  milestoneId?: string | null;
  startDate: string;
  dueDate: string;
  estimateHours: number;
  labels: string[];
  acceptanceCriteria: string;
  dependenciesConfirmedNone: boolean;
  blockerReason?: string;
  blockerOwnerId?: string | null;
  nextReviewDate?: string;
  blockerExceptionReason?: string;
  evidenceNote?: string;
  highRisk?: boolean;
  securityApprovedBy?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  history: WorkFieldChange[];
}

export interface Comment {
  id: string;
  resourceType: 'work_package' | 'document';
  resourceId: string;
  authorId: string;
  body: string;
  mentions: string[];
  reactions: Record<string, string[]>;
  createdAt: string;
}

export interface DocumentVersion {
  version: number;
  body: string;
  editorId: string;
  summary: string;
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  slug: string;
  projectId?: string | null;
  category: 'ADR' | 'RFC' | 'Specification' | 'Runbook' | 'Announcement';
  title: string;
  body: string;
  status: 'Draft' | 'In Review' | 'Accepted' | 'Published' | 'Superseded';
  ownerId: string;
  labels: string[];
  version: number;
  restricted: boolean;
  linkedWorkIds: string[];
  updatedAt: string;
  versions: DocumentVersion[];
}

export interface Attachment {
  id: string;
  parentType: 'work_package' | 'document';
  parentId: string;
  projectId: string;
  fileName: string;
  mediaType: string;
  sizeBytes: number;
  checksumSha256: string;
  uploadedBy: string;
  uploadedAt: string;
  storageKey: string;
}

export interface IntegrationConfig {
  id: string;
  provider: 'gitlab' | 'mattermost' | 'oidc' | 's3';
  name: string;
  description: string;
  status: 'Connected' | 'Degraded' | 'Disabled';
  enabled: boolean;
  secretRef: string;
  webhookSecretSet: boolean;
  lastSyncAt: string;
  endpointUrl: string;
  scopeNote: string;
}

export interface ExternalLink {
  id: string;
  workPackageId?: string | null;
  projectId: string;
  provider: 'gitlab' | 'mattermost';
  kind: 'repository' | 'branch' | 'merge_request' | 'pipeline' | 'release' | 'channel';
  externalId: string;
  title: string;
  status: string;
  url: string;
  authorName?: string;
  updatedAt: string;
  metadata?: Record<string, string>;
}

export interface NotificationItem {
  id: string;
  recipientId: string;
  category: 'assignment' | 'mention' | 'review' | 'blocker' | 'access' | 'integration' | 'announcement' | 'chat';
  title: string;
  summary: string;
  resourceType?: 'work_package' | 'project' | 'document' | 'integration' | 'member' | 'chat_channel';
  resourceId?: string;
  securityCritical: boolean;
  read: boolean;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  correlationId: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  result: 'success' | 'denied';
  details: string;
  timestamp: string;
}

export interface ActivityEvent {
  id: string;
  actorId: string;
  action: string;
  resourceType: 'work_package' | 'project' | 'document' | 'milestone' | 'integration';
  resourceId: string;
  resourceKey?: string;
  resourceTitle: string;
  projectId?: string;
  summary: string;
  timestamp: string;
}

export interface MeetingItem {
  id: string;
  projectId?: string | null;
  title: string;
  date: string;
  timeRange: string;
  facilitatorId: string;
  channelRef: string;
  agendaSummary: string;
}

export interface SavedView {
  id: string;
  name: string;
  ownerId: string;
  scope: 'workspace' | 'project';
  filters: {
    status?: WorkPackageStatus[];
    priority?: Priority[];
    projectId?: string;
    onlyBlocked?: boolean;
  };
}

export interface WorkspaceConfig {
  id: string;
  name: string;
  programmeTitle: string;
  defaultTimezone: string;
  enforceMfa: boolean;
  operatorConsoleIsolated: boolean;
  operatorSeatLimit: number;
  maxAccountSlots: number;
  notificationPrefs: {
    batchLowPriority: boolean;
    emailDigest: boolean;
    chatDeepLinks: boolean;
  };
}

export interface AuthSessionResponse {
  authenticated: boolean;
  keyfileRequired?: boolean;
  keyfileConfigured?: boolean;
  pendingToken?: string;
  user: User | null;
  token?: string;
  slotsUsed: number;
  maxSlots: number;
  providers: {
    firebase: boolean;
    supabase: boolean;
  };
}
