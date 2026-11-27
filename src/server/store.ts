import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  MAX_ACCOUNT_SLOTS,
  type ActivityEvent,
  type Attachment,
  type AuditEvent,
  type ChatChannel,
  type ChatMessage,
  type Comment,
  type Division,
  type DocumentRecord,
  type ExternalLink,
  type IntegrationConfig,
  type MeetingItem,
  type Milestone,
  type NotificationItem,
  type Project,
  type SavedView,
  type Team,
  type User,
  type WorkDependency,
  type WorkPackage,
  type WorkspaceConfig,
} from '../types/workspace.js';

export { MAX_ACCOUNT_SLOTS };

export interface InviteRecord {
  id: string;
  email: string;
  displayName: string;
  role: User['role'];
  title: string;
  tokenHash: string;
  invitedBy: string;
  expiresAt: string;
  acceptedAt?: string | null;
}

export interface ProcessedWebhook {
  id: string;
  provider: string;
  deliveryId: string;
  receivedAt: string;
}

export interface RevokedTokenRecord {
  jti: string;
  exp: number;
}

export interface WorkspaceDatabase {
  schemaVersion: number;
  workspace: WorkspaceConfig;
  invites: InviteRecord[];
  revokedJtis: RevokedTokenRecord[];
  sessionInvalidBefore: Record<string, number>;
  masterKeyfileHash?: string | null;
  userKeyfileHashes?: Record<string, { hash: string; keyId: string; issuedAt: string }>;
  users: User[];
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
  processedWebhooks: ProcessedWebhook[];
}

const IS_SERVERLESS = Boolean(
  process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME
);
export const DATA_DIR = IS_SERVERLESS
  ? path.join('/tmp', 'truvornex-data')
  : path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'truvornex-db.json');
export const ATTACHMENTS_DIR = path.join(DATA_DIR, 'attachments');

function ensureDirs(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ATTACHMENTS_DIR)) {
    fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
  }
}

export function getActiveSlotCount(db: WorkspaceDatabase): number {
  return db.users.filter((u) => u.state !== 'revoked').length;
}

function createInitialChatChannels(): ChatChannel[] {
  return [
    {
      id: 'ch-general',
      name: 'general',
      topic: 'Workspace announcements, release milestones, and cross-team coordination',
      projectId: null,
      isPrivate: false,
      createdBy: 'usr-marcus',
      createdAt: '2026-11-01T09:00:00Z',
    },
    {
      id: 'ch-ctrl',
      name: 'ctrl-plane-dev',
      topic: 'CTRL-102 outbox replay, RFC-014 partition quotas, and policy engine reviews',
      projectId: 'proj-ctrl',
      isPrivate: false,
      createdBy: 'usr-david',
      createdAt: '2026-11-02T10:00:00Z',
    },
    {
      id: 'ch-edge',
      name: 'edge-telemetry',
      topic: 'EDGE-202 blocker triage, staging cell burst testing, and M3 readiness',
      projectId: 'proj-edge',
      isPrivate: false,
      createdBy: 'usr-hannah',
      createdAt: '2026-11-03T11:00:00Z',
    },
    {
      id: 'ch-qa',
      name: 'qa-verification',
      topic: 'SPEC-022 acceptance evidence enforcement and MR verification queue',
      projectId: 'proj-sdkv',
      isPrivate: false,
      createdBy: 'usr-sofia',
      createdAt: '2026-11-04T09:30:00Z',
    },
    {
      id: 'ch-secr',
      name: 'security-governance',
      topic: 'ADR-003 trust boundaries, MFA enforcement, and restricted security reviews',
      projectId: 'proj-secr',
      isPrivate: true,
      createdBy: 'usr-marcus',
      createdAt: '2026-11-05T08:00:00Z',
      memberIds: ['usr-marcus', 'usr-sofia', 'usr-priya'],
    },
  ];
}

function createInitialChatMessages(): ChatMessage[] {
  return [
    {
      id: 'msg-1',
      channelId: 'ch-general',
      authorId: 'usr-marcus',
      parentMessageId: null,
      body: 'Reminder: Truvornex Engineering Workspace is capped at 8 verified account slots and strictly isolated from the Production Operator Console per ADR-003.',
      mentions: [],
      mentionAll: false,
      reactions: { '✅': ['usr-sofia', 'usr-priya', 'usr-david'] },
      pinned: true,
      edited: false,
      linkedWorkKey: 'SECR-401',
      createdAt: '2026-11-24T09:00:00Z',
      updatedAt: '2026-11-24T09:00:00Z',
    },
    {
      id: 'msg-2',
      channelId: 'ch-general',
      authorId: 'usr-priya',
      parentMessageId: null,
      body: 'Weekly delivery check-in: please review M2 and M3 milestone confidence ahead of Friday ARB. @David @Hannah',
      mentions: ['usr-david', 'usr-hannah'],
      mentionAll: false,
      reactions: { '👍': ['usr-david', 'usr-hannah'] },
      pinned: false,
      edited: false,
      linkedWorkKey: null,
      createdAt: '2026-11-26T08:30:00Z',
      updatedAt: '2026-11-26T08:30:00Z',
    },
    {
      id: 'msg-3',
      channelId: 'ch-ctrl',
      authorId: 'usr-tariq',
      parentMessageId: null,
      body: 'Pushed DFS dependency cycle guard updates for #CTRL-103 (MR !439). @Sofia ready for QA pass whenever you have a slot.',
      mentions: ['usr-sofia'],
      mentionAll: false,
      reactions: { '👀': ['usr-sofia'], '🚀': ['usr-marcus'] },
      pinned: false,
      edited: false,
      linkedWorkKey: 'CTRL-103',
      createdAt: '2026-11-26T09:20:00Z',
      updatedAt: '2026-11-26T09:20:00Z',
    },
    {
      id: 'msg-4',
      channelId: 'ch-ctrl',
      authorId: 'usr-sofia',
      parentMessageId: 'msg-3',
      body: 'Picked up MR !439 in the verification queue — running cycle trace assertions now.',
      mentions: ['usr-tariq'],
      mentionAll: false,
      reactions: { '👍': ['usr-tariq'] },
      pinned: false,
      edited: false,
      linkedWorkKey: 'CTRL-103',
      createdAt: '2026-11-26T09:34:00Z',
      updatedAt: '2026-11-26T09:34:00Z',
    },
    {
      id: 'msg-5',
      channelId: 'ch-edge',
      authorId: 'usr-hannah',
      parentMessageId: null,
      body: 'Flagged #EDGE-202 as Blocked pending upstream RFC-014 partition quota sign-off. @David can we finalize the quota bounds in today’s ARB?',
      mentions: ['usr-david'],
      mentionAll: false,
      reactions: { 'ACK': ['usr-david'] },
      pinned: true,
      edited: false,
      linkedWorkKey: 'EDGE-202',
      createdAt: '2026-11-25T10:45:00Z',
      updatedAt: '2026-11-25T10:45:00Z',
    },
    {
      id: 'msg-6',
      channelId: 'ch-qa',
      authorId: 'usr-sofia',
      parentMessageId: null,
      body: 'SPEC-022 gate check is live: high-risk items require independent reviewer sign-off before transitioning to Accepted (#SDKV-301).',
      mentions: [],
      mentionAll: false,
      reactions: { '✅': ['usr-marcus', 'usr-tariq'] },
      pinned: true,
      edited: false,
      linkedWorkKey: 'SDKV-301',
      createdAt: '2026-11-26T08:15:00Z',
      updatedAt: '2026-11-26T08:15:00Z',
    },
    {
      id: 'msg-7',
      channelId: 'ch-secr',
      authorId: 'usr-marcus',
      parentMessageId: null,
      body: 'Firebase Auth + Firestore security rules verified and deployed for #SECR-401. Cross-project attachment downloads remain gated server-side.',
      mentions: ['usr-sofia'],
      mentionAll: false,
      reactions: { '✅': ['usr-sofia'] },
      pinned: true,
      edited: false,
      linkedWorkKey: 'SECR-401',
      createdAt: '2026-11-26T10:05:00Z',
      updatedAt: '2026-11-26T10:05:00Z',
    },
  ];
}

export function createSeedDatabase(): WorkspaceDatabase {
  // Seed 6 active team members so 2 of the 8 strict account slots remain open for live Firebase/Supabase logins
  const users: User[] = [
    {
      id: 'usr-marcus',
      idpSubject: 'oidc|trv-002',
      authProvider: 'firebase',
      displayName: 'Marcus Chen',
      email: 'marcus.chen@truvornex.internal',
      title: 'Principal Systems Architect',
      role: 'Workspace Administrator',
      state: 'active',
      mfaEnabled: true,
      timezone: 'America/Los_Angeles',
      joinedAt: '2026-01-14T10:30:00Z',
      lastActiveAt: '2026-11-27T09:00:00Z',
      presence: 'active',
      chatNotificationMode: 'mentions_only',
      notifyOnChannelAll: true,
      desktopAlerts: false,
      channelNotificationModes: {},
    },
    {
      id: 'usr-priya',
      idpSubject: 'oidc|trv-003',
      authProvider: 'firebase',
      displayName: 'Priya Nair',
      email: 'priya.nair@truvornex.internal',
      title: 'Programme Director',
      role: 'Programme Manager',
      state: 'active',
      mfaEnabled: true,
      timezone: 'Europe/London',
      joinedAt: '2026-01-20T08:15:00Z',
      lastActiveAt: '2026-11-27T08:45:00Z',
      presence: 'active',
      chatNotificationMode: 'mentions_only',
      notifyOnChannelAll: true,
      desktopAlerts: false,
      channelNotificationModes: {},
    },
    {
      id: 'usr-david',
      idpSubject: 'oidc|trv-004',
      authProvider: 'supabase',
      displayName: 'David Okafor',
      email: 'david.okafor@truvornex.internal',
      title: 'Control Plane PM',
      role: 'Project Manager',
      state: 'active',
      mfaEnabled: true,
      timezone: 'UTC',
      joinedAt: '2026-02-02T11:00:00Z',
      lastActiveAt: '2026-11-27T08:30:00Z',
      presence: 'focus',
      chatNotificationMode: 'all_messages',
      notifyOnChannelAll: true,
      desktopAlerts: false,
      channelNotificationModes: {},
    },
    {
      id: 'usr-hannah',
      idpSubject: 'oidc|trv-005',
      authProvider: 'firebase',
      displayName: 'Hannah Lindqvist',
      email: 'hannah.lindqvist@truvornex.internal',
      title: 'Ingestion Team Lead',
      role: 'Team Lead',
      state: 'active',
      mfaEnabled: true,
      timezone: 'Europe/Stockholm',
      joinedAt: '2026-02-11T09:45:00Z',
      lastActiveAt: '2026-11-27T08:10:00Z',
      presence: 'active',
      chatNotificationMode: 'mentions_only',
      notifyOnChannelAll: true,
      desktopAlerts: false,
      channelNotificationModes: {},
    },
    {
      id: 'usr-tariq',
      idpSubject: 'oidc|trv-006',
      authProvider: 'supabase',
      displayName: 'Tariq Al-Mansoor',
      email: 'tariq.mansoor@truvornex.internal',
      title: 'Senior Platform Engineer',
      role: 'Contributor',
      state: 'active',
      mfaEnabled: true,
      timezone: 'UTC',
      joinedAt: '2026-03-04T14:20:00Z',
      lastActiveAt: '2026-11-27T07:55:00Z',
      presence: 'focus',
      chatNotificationMode: 'mentions_only',
      notifyOnChannelAll: true,
      desktopAlerts: false,
      channelNotificationModes: {},
    },
    {
      id: 'usr-sofia',
      idpSubject: 'oidc|trv-007',
      authProvider: 'firebase',
      displayName: 'Sofia Alvarez',
      email: 'sofia.alvarez@truvornex.internal',
      title: 'Verification & QA Lead',
      role: 'Reviewer / QA',
      state: 'active',
      mfaEnabled: true,
      timezone: 'America/New_York',
      joinedAt: '2026-03-18T13:00:00Z',
      lastActiveAt: '2026-11-27T09:10:00Z',
      presence: 'reviewing',
      chatNotificationMode: 'mentions_only',
      notifyOnChannelAll: true,
      desktopAlerts: false,
      channelNotificationModes: {},
    },
  ];

  const divisions: Division[] = [
    {
      id: 'div-platform',
      name: 'Platform & Control Plane',
      description: 'Core workspace coordination, policy engine, API gateway and state orchestration.',
      leadId: 'usr-marcus',
    },
    {
      id: 'div-edge',
      name: 'Data, Edge & Telemetry',
      description: 'Regional telemetry ingestion, stream normalization and schema validation.',
      leadId: 'usr-hannah',
    },
    {
      id: 'div-quality',
      name: 'Quality, Security & Architecture',
      description: 'Verification harnesses, threat modeling, identity standards and technical documentation.',
      leadId: 'usr-sofia',
    },
  ];

  const teams: Team[] = [
    {
      id: 'team-ctrl',
      divisionId: 'div-platform',
      name: 'Control Plane Core',
      leadId: 'usr-david',
      memberIds: ['usr-marcus', 'usr-david', 'usr-tariq'],
    },
    {
      id: 'team-edge',
      divisionId: 'div-edge',
      name: 'Ingestion & Routing',
      leadId: 'usr-hannah',
      memberIds: ['usr-hannah', 'usr-tariq', 'usr-priya'],
    },
    {
      id: 'team-verify',
      divisionId: 'div-quality',
      name: 'Verification & Security',
      leadId: 'usr-sofia',
      memberIds: ['usr-sofia', 'usr-marcus', 'usr-david'],
    },
    {
      id: 'team-docs',
      divisionId: 'div-quality',
      name: 'Documentation & Standards',
      leadId: 'usr-priya',
      memberIds: ['usr-priya', 'usr-sofia', 'usr-marcus'],
    },
  ];

  const projects: Project[] = [
    {
      id: 'proj-ctrl',
      key: 'CTRL',
      name: 'Control Plane & Policy Engine',
      programme: 'Truvornex Core v1',
      objective: 'Deliver deterministic policy evaluation, canonical work state, and idempotent event outbox for internal engineering teams.',
      ownerId: 'usr-david',
      sponsorId: 'usr-priya',
      status: 'Active',
      health: 'on_track',
      healthNote: 'Schema freeze achieved ahead of M2; outbox throughput benchmark meets target latency.',
      visibility: 'internal',
      startDate: '2026-10-01',
      targetDate: '2027-01-31',
      participatingTeamIds: ['team-ctrl', 'team-verify'],
      memberIds: ['usr-marcus', 'usr-priya', 'usr-david', 'usr-tariq', 'usr-sofia'],
      linkedDocIds: ['doc-adr-001', 'doc-adr-002', 'doc-rfc-014'],
    },
    {
      id: 'proj-edge',
      key: 'EDGE',
      name: 'Regional Edge Telemetry & Ingestion',
      programme: 'Truvornex Core v1',
      objective: 'Build deterministic event ingestion pipelines and schema conformance adapters across staging cells.',
      ownerId: 'usr-hannah',
      sponsorId: 'usr-priya',
      status: 'Active',
      health: 'at_risk',
      healthNote: 'Backpressure retry policy blocked pending upstream schema contract sign-off (EDGE-202).',
      visibility: 'internal',
      startDate: '2026-10-15',
      targetDate: '2027-02-15',
      participatingTeamIds: ['team-edge', 'team-ctrl'],
      memberIds: ['usr-marcus', 'usr-priya', 'usr-hannah', 'usr-tariq', 'usr-sofia'],
      linkedDocIds: ['doc-spec-022'],
    },
    {
      id: 'proj-sdkv',
      key: 'SDKV',
      name: 'SDK & Verification Harness',
      programme: 'Developer Ecosystem',
      objective: 'Provide automated contract test suites, reproducible acceptance harnesses, and client SDK bindings.',
      ownerId: 'usr-sofia',
      sponsorId: 'usr-marcus',
      status: 'Active',
      health: 'on_track',
      healthNote: 'Partner verification runner passing 94% of baseline contract assertions.',
      visibility: 'internal',
      startDate: '2026-10-20',
      targetDate: '2027-01-20',
      participatingTeamIds: ['team-verify', 'team-docs'],
      memberIds: ['usr-marcus', 'usr-sofia', 'usr-priya', 'usr-david', 'usr-tariq'],
      linkedDocIds: ['doc-spec-022'],
    },
    {
      id: 'proj-secr',
      key: 'SECR',
      name: 'Identity Hardening & Key Custody',
      programme: 'Security & Governance',
      objective: 'Enforce strict Firebase/Supabase Auth verification, separation of duties, and workspace-to-operator trust domain isolation.',
      ownerId: 'usr-marcus',
      sponsorId: 'usr-priya',
      status: 'Active',
      health: 'on_track',
      healthNote: 'Restricted project scope active. Operator console separation audit passed Stage 1.',
      visibility: 'restricted',
      startDate: '2026-11-01',
      targetDate: '2027-01-15',
      participatingTeamIds: ['team-verify'],
      memberIds: ['usr-marcus', 'usr-sofia', 'usr-priya'],
      linkedDocIds: ['doc-adr-003'],
    },
  ];

  const milestones: Milestone[] = [
    {
      id: 'ms-ctrl-1',
      projectId: 'proj-ctrl',
      title: 'M1 · Policy Schema Freeze',
      targetWindow: 'Nov 2026',
      targetDate: '2026-11-18',
      state: 'Achieved',
      confidence: 100,
      ownerId: 'usr-david',
      description: 'Lock canonical JSON schema and RBAC evaluation rules for Control Plane v1.',
    },
    {
      id: 'ms-ctrl-2',
      projectId: 'proj-ctrl',
      title: 'M2 · Outbox & Replay Alpha',
      targetWindow: 'Dec 2026',
      targetDate: '2026-12-12',
      state: 'Planned',
      confidence: 84,
      ownerId: 'usr-tariq',
      description: 'Complete idempotent event outbox and deterministic webhook replay verification.',
    },
    {
      id: 'ms-edge-1',
      projectId: 'proj-edge',
      title: 'M3 · Ingestion Backpressure Gate',
      targetWindow: 'Dec 2026',
      targetDate: '2026-12-05',
      state: 'At Risk',
      confidence: 58,
      ownerId: 'usr-hannah',
      description: 'Verify dead-letter bounds under 5x burst load in staging.',
    },
    {
      id: 'ms-sdkv-1',
      projectId: 'proj-sdkv',
      title: 'M4 · Verification Gate v1',
      targetWindow: 'Dec 2026',
      targetDate: '2026-12-18',
      state: 'Planned',
      confidence: 90,
      ownerId: 'usr-sofia',
      description: 'Acceptance evidence checklist automated in CI pipeline.',
    },
    {
      id: 'ms-secr-1',
      projectId: 'proj-secr',
      title: 'M5 · Trust Domain Isolation Sign-Off',
      targetWindow: 'Dec 2026',
      targetDate: '2026-12-09',
      state: 'Planned',
      confidence: 92,
      ownerId: 'usr-marcus',
      description: 'Confirm zero shared credentials between Engineering Workspace and 8-seat Operator Console.',
    },
  ];

  const workPackages: WorkPackage[] = [
    {
      id: 'wp-101',
      key: 'CTRL-101',
      projectId: 'proj-ctrl',
      type: 'epic',
      title: 'Deterministic Policy Engine & RBAC Evaluator',
      description: 'Implement server-side RBAC + ABAC policy evaluation across workspace, project, and document scopes.',
      status: 'Accepted',
      priority: 'Critical',
      ownerId: 'usr-david',
      assigneeIds: ['usr-tariq', 'usr-marcus'],
      reviewerId: 'usr-sofia',
      creatorId: 'usr-marcus',
      teamId: 'team-ctrl',
      milestoneId: 'ms-ctrl-1',
      startDate: '2026-11-01',
      dueDate: '2026-11-18',
      estimateHours: 40,
      labels: ['security', 'core-api'],
      acceptanceCriteria: '100% of API routes deny unauthenticated callers; restricted project membership enforced on every GET/POST/PATCH.',
      dependenciesConfirmedNone: true,
      evidenceNote: 'MR !412 merged; 48 policy matrix unit tests passing in CI run #8812.',
      highRisk: true,
      securityApprovedBy: 'usr-sofia',
      version: 4,
      createdAt: '2026-10-28T09:00:00Z',
      updatedAt: '2026-11-18T17:20:00Z',
      history: [
        {
          id: 'hist-1',
          field: 'status',
          oldValue: 'Verification',
          newValue: 'Accepted',
          actorId: 'usr-sofia',
          timestamp: '2026-11-18T17:20:00Z',
        },
      ],
    },
    {
      id: 'wp-102',
      key: 'CTRL-102',
      projectId: 'proj-ctrl',
      parentId: 'wp-101',
      type: 'feature',
      title: 'Transactional Outbox & Webhook Replay Controls',
      description: 'Persist domain events atomically alongside state mutations and support idempotent webhook replay.',
      status: 'In Progress',
      priority: 'High',
      ownerId: 'usr-tariq',
      assigneeIds: ['usr-tariq'],
      reviewerId: 'usr-marcus',
      creatorId: 'usr-david',
      teamId: 'team-ctrl',
      milestoneId: 'ms-ctrl-2',
      startDate: '2026-11-16',
      dueDate: '2026-12-06',
      estimateHours: 28,
      labels: ['outbox', 'integrations'],
      acceptanceCriteria: 'Duplicate deliveryId webhooks return 200 idempotent no-op; invalid HMAC signatures return 401 and create audit event.',
      dependenciesConfirmedNone: false,
      evidenceNote: 'Branch feat/ctrl-102-outbox-replay active with unit tests.',
      version: 3,
      createdAt: '2026-11-10T11:00:00Z',
      updatedAt: '2026-11-25T15:10:00Z',
      history: [],
    },
    {
      id: 'wp-103',
      key: 'CTRL-103',
      projectId: 'proj-ctrl',
      type: 'task',
      title: 'Graph Cycle Guard for WorkPackage Dependencies',
      description: 'Validate directed predecessor-successor edges prior to insert so dependency cycles cannot corrupt Gantt planning.',
      status: 'In Review',
      priority: 'High',
      ownerId: 'usr-marcus',
      assigneeIds: ['usr-tariq'],
      reviewerId: 'usr-sofia',
      creatorId: 'usr-david',
      teamId: 'team-ctrl',
      milestoneId: 'ms-ctrl-2',
      startDate: '2026-11-19',
      dueDate: '2026-11-29',
      estimateHours: 12,
      labels: ['planning', 'integrity'],
      acceptanceCriteria: 'Self-edges and transitive cycles A->B->C->A return HTTP 400 with cycle trace.',
      dependenciesConfirmedNone: true,
      evidenceNote: 'MR !439 ready for QA review with cycle traversal tests.',
      version: 2,
      createdAt: '2026-11-18T10:00:00Z',
      updatedAt: '2026-11-26T09:15:00Z',
      history: [],
    },
    {
      id: 'wp-104',
      key: 'CTRL-104',
      projectId: 'proj-ctrl',
      type: 'task',
      title: 'Saved Views & CSV Audit Export Filter Allowlist',
      description: 'Allow engineering leads to save filtered work queues and export sanitized audit logs.',
      status: 'Ready',
      priority: 'Medium',
      ownerId: 'usr-david',
      assigneeIds: ['usr-david'],
      reviewerId: 'usr-sofia',
      creatorId: 'usr-priya',
      teamId: 'team-ctrl',
      milestoneId: 'ms-ctrl-2',
      startDate: '2026-11-27',
      dueDate: '2026-12-10',
      estimateHours: 16,
      labels: ['reporting', 'audit'],
      acceptanceCriteria: 'Export strips secret tokens, includes correlationId, and logs export action to AuditEvent.',
      dependenciesConfirmedNone: true,
      version: 1,
      createdAt: '2026-11-20T14:00:00Z',
      updatedAt: '2026-11-24T11:30:00Z',
      history: [],
    },
    {
      id: 'wp-105',
      key: 'CTRL-105',
      projectId: 'proj-ctrl',
      type: 'tech_debt',
      title: 'Consolidate Optimistic Concurrency ETag Headers',
      description: 'Enforce version match on concurrent document and work package edits.',
      status: 'Backlog',
      priority: 'Low',
      ownerId: 'usr-tariq',
      assigneeIds: [],
      reviewerId: 'usr-marcus',
      creatorId: 'usr-marcus',
      teamId: 'team-ctrl',
      milestoneId: 'ms-ctrl-2',
      startDate: '2026-12-02',
      dueDate: '2026-12-14',
      estimateHours: 8,
      labels: ['tech-debt'],
      acceptanceCriteria: 'Stale version writes return HTTP 409 Conflict with current server revision.',
      dependenciesConfirmedNone: true,
      version: 1,
      createdAt: '2026-11-21T08:00:00Z',
      updatedAt: '2026-11-21T08:00:00Z',
      history: [],
    },
    {
      id: 'wp-201',
      key: 'EDGE-201',
      projectId: 'proj-edge',
      type: 'epic',
      title: 'Regional Frame Normalization & Envelope Validator',
      description: 'Normalize incoming edge telemetry envelopes and reject malformed payloads at ingress.',
      status: 'Verification',
      priority: 'Critical',
      ownerId: 'usr-hannah',
      assigneeIds: ['usr-hannah', 'usr-tariq'],
      reviewerId: 'usr-sofia',
      creatorId: 'usr-hannah',
      teamId: 'team-edge',
      milestoneId: 'ms-edge-1',
      startDate: '2026-11-05',
      dueDate: '2026-11-28',
      estimateHours: 36,
      labels: ['telemetry', 'schema'],
      acceptanceCriteria: 'Zero silent schema drops; invalid packets routed to quarantined DLQ with structured error code.',
      dependenciesConfirmedNone: true,
      evidenceNote: 'Staging replay passed 1.2M frames; awaiting final QA latency report.',
      version: 3,
      createdAt: '2026-11-02T09:00:00Z',
      updatedAt: '2026-11-25T18:00:00Z',
      history: [],
    },
    {
      id: 'wp-202',
      key: 'EDGE-202',
      projectId: 'proj-edge',
      type: 'bug',
      title: 'Dead-Letter Queue Burst Backpressure Stall',
      description: 'When staging cells burst above 5x baseline, consumer retry jitter collapses to 0ms and saturates connections.',
      status: 'Blocked',
      priority: 'Critical',
      ownerId: 'usr-hannah',
      assigneeIds: ['usr-hannah'],
      reviewerId: 'usr-marcus',
      creatorId: 'usr-sofia',
      teamId: 'team-edge',
      milestoneId: 'ms-edge-1',
      startDate: '2026-11-18',
      dueDate: '2026-11-24',
      estimateHours: 14,
      labels: ['reliability', 'incident-prevention'],
      acceptanceCriteria: 'Exponential backoff with full jitter maintains < 2% error budget under 5x synthetic burst.',
      dependenciesConfirmedNone: false,
      blockerReason: 'Awaiting upstream RFC-014 partition key quota sign-off from Control Plane Core.',
      blockerOwnerId: 'usr-david',
      nextReviewDate: '2026-11-27',
      version: 5,
      createdAt: '2026-11-17T12:00:00Z',
      updatedAt: '2026-11-25T10:40:00Z',
      history: [],
    },
    {
      id: 'wp-203',
      key: 'EDGE-203',
      projectId: 'proj-edge',
      type: 'task',
      title: 'Staging Cell Throughput Benchmark Suite',
      description: 'Automated load driver reproducing regional telemetry burst profiles.',
      status: 'Ready',
      priority: 'High',
      ownerId: 'usr-tariq',
      assigneeIds: ['usr-tariq'],
      reviewerId: 'usr-sofia',
      creatorId: 'usr-hannah',
      teamId: 'team-edge',
      milestoneId: 'ms-edge-1',
      startDate: '2026-11-27',
      dueDate: '2026-12-05',
      estimateHours: 20,
      labels: ['benchmark', 'qa'],
      acceptanceCriteria: 'Publishes p50/p95/p99 latency artifact attached to milestone M3.',
      dependenciesConfirmedNone: false,
      version: 1,
      createdAt: '2026-11-19T14:30:00Z',
      updatedAt: '2026-11-24T16:00:00Z',
      history: [],
    },
    {
      id: 'wp-204',
      key: 'EDGE-204',
      projectId: 'proj-edge',
      type: 'research',
      title: 'Evaluate Compaction Window for Historical Snapshots',
      description: 'Compare 15-minute vs 60-minute compaction buckets for analytical reporting queries.',
      status: 'Backlog',
      priority: 'Medium',
      ownerId: 'usr-hannah',
      assigneeIds: [],
      reviewerId: 'usr-marcus',
      creatorId: 'usr-priya',
      teamId: 'team-edge',
      milestoneId: 'ms-edge-1',
      startDate: '2026-12-01',
      dueDate: '2026-12-18',
      estimateHours: 10,
      labels: ['research'],
      acceptanceCriteria: 'Written ADR recommendation with storage/query trade-off matrix.',
      dependenciesConfirmedNone: true,
      version: 1,
      createdAt: '2026-11-22T09:00:00Z',
      updatedAt: '2026-11-22T09:00:00Z',
      history: [],
    },
    {
      id: 'wp-301',
      key: 'SDKV-301',
      projectId: 'proj-sdkv',
      type: 'feature',
      title: 'Acceptance Evidence Verification Runner CLI',
      description: 'Verify every candidate release links signed test reports, docs, and reviewer sign-off.',
      status: 'In Progress',
      priority: 'High',
      ownerId: 'usr-sofia',
      assigneeIds: ['usr-sofia', 'usr-tariq'],
      reviewerId: 'usr-marcus',
      creatorId: 'usr-sofia',
      teamId: 'team-verify',
      milestoneId: 'ms-sdkv-1',
      startDate: '2026-11-12',
      dueDate: '2026-12-03',
      estimateHours: 24,
      labels: ['verification', 'ci'],
      acceptanceCriteria: 'CLI exits non-zero if any Accepted work package lacks reviewer evidence.',
      dependenciesConfirmedNone: true,
      evidenceNote: 'Draft pipeline integrated on truvornex/verification-sdk MR !94.',
      version: 2,
      createdAt: '2026-11-11T10:00:00Z',
      updatedAt: '2026-11-26T08:00:00Z',
      history: [],
    },
    {
      id: 'wp-302',
      key: 'SDKV-302',
      projectId: 'proj-sdkv',
      parentId: 'wp-301',
      type: 'subtask',
      title: 'External Partner Contract Test Fixtures',
      description: 'Sanitized synthetic fixtures allowing external QA collaborators to validate SDK serialization.',
      status: 'In Review',
      priority: 'Medium',
      ownerId: 'usr-sofia',
      assigneeIds: ['usr-sofia'],
      reviewerId: 'usr-marcus',
      creatorId: 'usr-sofia',
      teamId: 'team-verify',
      milestoneId: 'ms-sdkv-1',
      startDate: '2026-11-18',
      dueDate: '2026-11-29',
      estimateHours: 12,
      labels: ['fixtures', 'partner'],
      acceptanceCriteria: 'Fixtures contain zero production identifiers or real customer emails.',
      dependenciesConfirmedNone: true,
      evidenceNote: 'MR !97 fixture scan clean.',
      version: 2,
      createdAt: '2026-11-18T11:00:00Z',
      updatedAt: '2026-11-25T16:45:00Z',
      history: [],
    },
    {
      id: 'wp-303',
      key: 'SDKV-303',
      projectId: 'proj-sdkv',
      type: 'task',
      title: 'Publish OpenAPI v1 Contract Bundle & Changelog',
      description: 'Generate typed SDK documentation from canonical /api/v1 OpenAPI specification.',
      status: 'Draft',
      priority: 'Low',
      ownerId: 'usr-priya',
      assigneeIds: ['usr-priya'],
      reviewerId: 'usr-david',
      creatorId: 'usr-priya',
      teamId: 'team-docs',
      milestoneId: 'ms-sdkv-1',
      startDate: '2026-12-03',
      dueDate: '2026-12-16',
      estimateHours: 8,
      labels: ['docs', 'openapi'],
      acceptanceCriteria: '',
      dependenciesConfirmedNone: true,
      version: 1,
      createdAt: '2026-11-24T13:00:00Z',
      updatedAt: '2026-11-24T13:00:00Z',
      history: [],
    },
    {
      id: 'wp-401',
      key: 'SECR-401',
      projectId: 'proj-secr',
      type: 'initiative',
      title: 'Operator Console Trust Boundary Enforcement',
      description: 'Guarantee the 8-seat production Operator Console remains strictly isolated from Engineering Workspace identities, roles, and APIs.',
      status: 'In Progress',
      priority: 'Critical',
      ownerId: 'usr-marcus',
      assigneeIds: ['usr-marcus', 'usr-sofia'],
      reviewerId: 'usr-priya',
      creatorId: 'usr-marcus',
      teamId: 'team-verify',
      milestoneId: 'ms-secr-1',
      startDate: '2026-11-04',
      dueDate: '2026-12-08',
      estimateHours: 32,
      labels: ['trust-boundary', 'mandatory'],
      acceptanceCriteria: 'API rejects any attempt to provision production operator seats with 403 + AuditEvent.',
      dependenciesConfirmedNone: true,
      highRisk: true,
      evidenceNote: 'Guardrail route tests green on security/isolation branch.',
      version: 3,
      createdAt: '2026-11-03T09:00:00Z',
      updatedAt: '2026-11-26T09:50:00Z',
      history: [],
    },
    {
      id: 'wp-402',
      key: 'SECR-402',
      projectId: 'proj-secr',
      type: 'task',
      title: 'Authorized Attachment Download Gate & Checksum Verify',
      description: 'Prevent unauthenticated or cross-project attachment URL guessing by enforcing project membership on every download.',
      status: 'Closed',
      priority: 'High',
      ownerId: 'usr-marcus',
      assigneeIds: ['usr-marcus'],
      reviewerId: 'usr-sofia',
      creatorId: 'usr-marcus',
      teamId: 'team-verify',
      milestoneId: 'ms-secr-1',
      startDate: '2026-11-06',
      dueDate: '2026-11-20',
      estimateHours: 14,
      labels: ['files', 'security'],
      acceptanceCriteria: 'Cross-project download attempts return 403 Forbidden and emit AuditEvent.',
      dependenciesConfirmedNone: true,
      highRisk: true,
      securityApprovedBy: 'usr-sofia',
      evidenceNote: 'Verified by QA penetration check; SHA-256 checksum recorded.',
      version: 4,
      createdAt: '2026-11-05T10:00:00Z',
      updatedAt: '2026-11-20T18:10:00Z',
      history: [],
    },
  ];

  const dependencies: WorkDependency[] = [
    { id: 'dep-1', predecessorId: 'wp-101', successorId: 'wp-102', type: 'blocks' },
    { id: 'dep-2', predecessorId: 'wp-201', successorId: 'wp-203', type: 'blocks' },
    { id: 'dep-3', predecessorId: 'wp-202', successorId: 'wp-203', type: 'blocks' },
    { id: 'dep-4', predecessorId: 'wp-102', successorId: 'wp-301', type: 'relates_to' },
  ];

  const comments: Comment[] = [
    {
      id: 'cmt-1',
      resourceType: 'work_package',
      resourceId: 'wp-202',
      authorId: 'usr-hannah',
      body: '@David Okafor can we prioritize the RFC-014 partition quota review tomorrow morning so M3 stays on track?',
      mentions: ['usr-david'],
      reactions: { '+1': ['usr-priya', 'usr-tariq'] },
      createdAt: '2026-11-25T10:42:00Z',
    },
    {
      id: 'cmt-2',
      resourceType: 'work_package',
      resourceId: 'wp-103',
      authorId: 'usr-tariq',
      body: 'Added DFS cycle detection with full path reporting in MR !439. Ready for @Sofia Alvarez verification.',
      mentions: ['usr-sofia'],
      reactions: { check: ['usr-sofia'] },
      createdAt: '2026-11-26T09:18:00Z',
    },
    {
      id: 'cmt-3',
      resourceType: 'work_package',
      resourceId: 'wp-401',
      authorId: 'usr-marcus',
      body: 'Confirmed ADR-003 boundary rules: workspace admins are strictly blocked from creating or altering any of the 8 production operator seats.',
      mentions: [],
      reactions: {},
      createdAt: '2026-11-26T09:52:00Z',
    },
  ];

  const documents: DocumentRecord[] = [
    {
      id: 'doc-adr-001',
      slug: 'adr-001-unified-workspace',
      projectId: 'proj-ctrl',
      category: 'ADR',
      title: 'ADR-001 · Build a Unified Workspace, Integrate Specialist Tools',
      status: 'Accepted',
      ownerId: 'usr-marcus',
      labels: ['architecture', 'baseline'],
      version: 2,
      restricted: false,
      linkedWorkIds: ['wp-101', 'wp-102'],
      updatedAt: '2026-11-12T14:00:00Z',
      body: `# ADR-001: Unified Engineering Workspace

## Context
Truvornex engineering teams need a single source of truth for projects, work packages, decisions, milestones and traceability without rebuilding commodity developer tooling.

## Decision
Build Truvornex-specific project/work management, organization directory, knowledge base, workspace chat, and reporting capabilities. Integrate established Git/CI providers (GitLab) via normalized metadata links.

## Consequences
- No custom Git hosting in MVP.
- All external links reference canonical provider IDs rather than duplicating repository blobs.`,
      versions: [
        {
          version: 1,
          body: 'Initial draft proposing unified project control + GitLab integration.',
          editorId: 'usr-marcus',
          summary: 'Initial proposal',
          createdAt: '2026-11-01T10:00:00Z',
        },
        {
          version: 2,
          body: 'Accepted baseline signed off by Architecture Review Board.',
          editorId: 'usr-priya',
          summary: 'Added external ID scoping clarification',
          createdAt: '2026-11-12T14:00:00Z',
        },
      ],
    },
    {
      id: 'doc-adr-002',
      slug: 'adr-002-modular-monolith',
      projectId: 'proj-ctrl',
      category: 'ADR',
      title: 'ADR-002 · Modular Monolith First',
      status: 'Accepted',
      ownerId: 'usr-marcus',
      labels: ['architecture', 'backend'],
      version: 1,
      restricted: false,
      linkedWorkIds: ['wp-101'],
      updatedAt: '2026-11-05T11:30:00Z',
      body: `# ADR-002: Modular Monolith First

## Decision
Use a single modular API with explicit bounded domain modules (identity, organization, projects, work, planning, knowledge, chat, integrations, audit) backed by transactional persistence.

## Guardrails
- Cross-module communication flows through explicit domain services and transactional outbox events.
- Split services only when measured throughput or isolation justifies operational overhead.`,
      versions: [
        {
          version: 1,
          body: 'Initial modular monolith baseline.',
          editorId: 'usr-marcus',
          summary: 'Initial baseline',
          createdAt: '2026-11-05T11:30:00Z',
        },
      ],
    },
    {
      id: 'doc-adr-003',
      slug: 'adr-003-operator-console-isolation',
      projectId: 'proj-secr',
      category: 'ADR',
      title: 'ADR-003 · Workspace and Production Operations Are Separate Trust Domains',
      status: 'Accepted',
      ownerId: 'usr-marcus',
      labels: ['security', 'mandatory-constraint'],
      version: 3,
      restricted: true,
      linkedWorkIds: ['wp-401', 'wp-402'],
      updatedAt: '2026-11-24T16:00:00Z',
      body: `# ADR-003: Mandatory Trust Domain Separation

## Constraint
The Truvornex Engineering Workspace is capped at 8 verified engineering slots and strictly separated from production infrastructure and the eight-person Production Operator Console.

## Enforced Controls
1. No workspace role, API endpoint, or integration may create, modify, or delete any of the 8 production operator seats.
2. Production secrets and regional cell controls are never stored or proxied by the workspace.
3. Access to restricted security specifications requires explicit project membership and verified Firebase or Supabase authentication.`,
      versions: [
        {
          version: 1,
          body: 'Draft trust boundary specification.',
          editorId: 'usr-marcus',
          summary: 'Initial constraint',
          createdAt: '2026-11-03T09:00:00Z',
        },
        {
          version: 2,
          body: 'Added 8-seat operator isolation rule.',
          editorId: 'usr-marcus',
          summary: 'Added 8-seat API prohibition',
          createdAt: '2026-11-15T12:00:00Z',
        },
        {
          version: 3,
          body: 'Finalized restricted project enforcement.',
          editorId: 'usr-sofia',
          summary: 'Verified with QA & Security',
          createdAt: '2026-11-24T16:00:00Z',
        },
      ],
    },
    {
      id: 'doc-rfc-014',
      slug: 'rfc-014-outbox-webhook-replay',
      projectId: 'proj-ctrl',
      category: 'RFC',
      title: 'RFC-014 · Idempotent Event Outbox & Webhook Replay Policy',
      status: 'In Review',
      ownerId: 'usr-tariq',
      labels: ['outbox', 'webhooks'],
      version: 2,
      restricted: false,
      linkedWorkIds: ['wp-102', 'wp-202'],
      updatedAt: '2026-11-25T14:20:00Z',
      body: `# RFC-014: Idempotent Event Outbox & Webhook Replay

## Summary
Defines bounded retry intervals, dead-letter thresholds, and partition key quotas shared between Control Plane Core and Edge Telemetry.

## Open Question
Edge Telemetry requires higher burst quota allocation before M3 benchmark sign-off (linked to EDGE-202).`,
      versions: [
        {
          version: 1,
          body: 'Initial draft.',
          editorId: 'usr-tariq',
          summary: 'Initial RFC draft',
          createdAt: '2026-11-19T10:00:00Z',
        },
        {
          version: 2,
          body: 'Updated partition key quotas.',
          editorId: 'usr-tariq',
          summary: 'Added Edge burst quota section',
          createdAt: '2026-11-25T14:20:00Z',
        },
      ],
    },
    {
      id: 'doc-spec-022',
      slug: 'spec-022-acceptance-evidence',
      projectId: 'proj-sdkv',
      category: 'Specification',
      title: 'SPEC-022 · Verification & Acceptance Evidence Standard',
      status: 'Published',
      ownerId: 'usr-sofia',
      labels: ['qa', 'definition-of-done'],
      version: 1,
      restricted: false,
      linkedWorkIds: ['wp-301', 'wp-302'],
      updatedAt: '2026-11-21T09:15:00Z',
      body: `# SPEC-022: Verification & Acceptance Evidence Standard

## Definition of Done
No work package transitions to Accepted without:
1. Linked implementation evidence (commit, merge request, or artifact).
2. Independent reviewer verification (author cannot self-approve high-risk work).
3. Updated technical documentation or ADR reference where architecture changed.`,
      versions: [
        {
          version: 1,
          body: 'Published standard.',
          editorId: 'usr-sofia',
          summary: 'Published baseline standard',
          createdAt: '2026-11-21T09:15:00Z',
        },
      ],
    },
  ];

  const integrations: IntegrationConfig[] = [
    {
      id: 'int-gitlab',
      provider: 'gitlab',
      name: 'GitLab Enterprise (Self-Managed)',
      description: 'Synchronizes repository references, branches, merge requests, CI/CD pipelines, and release tags without copying repository source.',
      status: 'Connected',
      enabled: true,
      secretRef: 'vault://truvornex/integrations/gitlab-oauth-app',
      webhookSecretSet: true,
      lastSyncAt: '2026-11-26T10:32:00Z',
      endpointUrl: 'https://git.truvornex.internal',
      scopeNote: 'read_api, read_repository (metadata only)',
    },
    {
      id: 'int-mattermost',
      provider: 'mattermost',
      name: 'Mattermost Bridge & Workspace Chat',
      description: 'Bridges project channels and delivers deep-linked notifications honoring Mentions Only vs All Messages user settings.',
      status: 'Connected',
      enabled: true,
      secretRef: 'vault://truvornex/integrations/mattermost-bot-token',
      webhookSecretSet: true,
      lastSyncAt: '2026-11-26T10:28:00Z',
      endpointUrl: 'https://chat.truvornex.internal',
      scopeNote: 'channels:read, incoming_webhooks (deep links only)',
    },
    {
      id: 'int-oidc',
      provider: 'oidc',
      name: 'Firebase & Supabase Auth Federation',
      description: 'Verifies Firebase ID tokens and Supabase JWTs with strict 8-slot workspace capacity governance.',
      status: 'Connected',
      enabled: true,
      secretRef: 'vault://truvornex/auth/idp-federation',
      webhookSecretSet: true,
      lastSyncAt: '2026-11-26T10:05:00Z',
      endpointUrl: 'https://id.truvornex.internal/realms/engineering',
      scopeNote: 'firebase_id_token, supabase_jwt',
    },
    {
      id: 'int-s3',
      provider: 's3',
      name: 'S3-Compatible Attachment Custody',
      description: 'Stores binary attachments with SHA-256 verification and authorization-checked download streaming.',
      status: 'Connected',
      enabled: true,
      secretRef: 'vault://truvornex/storage/s3-workspace-key',
      webhookSecretSet: false,
      lastSyncAt: '2026-11-26T09:40:00Z',
      endpointUrl: 'https://s3.internal.truvornex/truvornex-workspace-files',
      scopeNote: 'scoped bucket read/write',
    },
  ];

  const externalLinks: ExternalLink[] = [
    {
      id: 'ext-1',
      projectId: 'proj-ctrl',
      provider: 'gitlab',
      kind: 'repository',
      externalId: 'gl-repo-101',
      title: 'truvornex/control-plane',
      status: 'Active · main protected',
      url: 'https://git.truvornex.internal/truvornex/control-plane',
      updatedAt: '2026-11-26T09:15:00Z',
      metadata: { defaultBranch: 'main', openMRs: '3', ciStatus: 'Passing' },
    },
    {
      id: 'ext-2',
      projectId: 'proj-edge',
      provider: 'gitlab',
      kind: 'repository',
      externalId: 'gl-repo-102',
      title: 'truvornex/edge-ingestor',
      status: 'Active · main protected',
      url: 'https://git.truvornex.internal/truvornex/edge-ingestor',
      updatedAt: '2026-11-25T18:00:00Z',
      metadata: { defaultBranch: 'main', openMRs: '2', ciStatus: 'Warning' },
    },
    {
      id: 'ext-3',
      projectId: 'proj-sdkv',
      provider: 'gitlab',
      kind: 'repository',
      externalId: 'gl-repo-103',
      title: 'truvornex/verification-sdk',
      status: 'Active · main protected',
      url: 'https://git.truvornex.internal/truvornex/verification-sdk',
      updatedAt: '2026-11-26T08:00:00Z',
      metadata: { defaultBranch: 'main', openMRs: '2', ciStatus: 'Passing' },
    },
    {
      id: 'ext-4',
      workPackageId: 'wp-103',
      projectId: 'proj-ctrl',
      provider: 'gitlab',
      kind: 'merge_request',
      externalId: 'gl-mr-439',
      title: '!439 · Add cycle detection graph guard for work dependencies',
      status: 'Open · Checks Passing',
      url: 'https://git.truvornex.internal/truvornex/control-plane/-/merge_requests/439',
      authorName: 'Tariq Al-Mansoor',
      updatedAt: '2026-11-26T09:15:00Z',
      metadata: { branch: 'feat/ctrl-103-cycle-guard', approvals: '1 / 2' },
    },
    {
      id: 'ext-5',
      workPackageId: 'wp-102',
      projectId: 'proj-ctrl',
      provider: 'gitlab',
      kind: 'merge_request',
      externalId: 'gl-mr-441',
      title: '!441 · Transactional outbox & replay idempotency store',
      status: 'Draft · Pipeline Running',
      url: 'https://git.truvornex.internal/truvornex/control-plane/-/merge_requests/441',
      authorName: 'Tariq Al-Mansoor',
      updatedAt: '2026-11-25T15:10:00Z',
      metadata: { branch: 'feat/ctrl-102-outbox-replay', approvals: '0 / 2' },
    },
    {
      id: 'ext-6',
      workPackageId: 'wp-302',
      projectId: 'proj-sdkv',
      provider: 'gitlab',
      kind: 'merge_request',
      externalId: 'gl-mr-97',
      title: '!97 · Sanitized partner contract test fixtures',
      status: 'Open · Ready for QA',
      url: 'https://git.truvornex.internal/truvornex/verification-sdk/-/merge_requests/97',
      authorName: 'Sofia Alvarez',
      updatedAt: '2026-11-25T16:45:00Z',
      metadata: { branch: 'feat/sdkv-302-fixtures', approvals: '1 / 1' },
    },
    {
      id: 'ext-7',
      workPackageId: 'wp-103',
      projectId: 'proj-ctrl',
      provider: 'gitlab',
      kind: 'pipeline',
      externalId: 'gl-pipe-9042',
      title: 'Pipeline #9042 · control-plane / feat/ctrl-103-cycle-guard',
      status: 'Passed (3m 42s)',
      url: 'https://git.truvornex.internal/truvornex/control-plane/-/pipelines/9042',
      updatedAt: '2026-11-26T09:14:00Z',
      metadata: { tests: '184 passed', coverage: '91.4%' },
    },
    {
      id: 'ext-8',
      workPackageId: 'wp-202',
      projectId: 'proj-edge',
      provider: 'gitlab',
      kind: 'pipeline',
      externalId: 'gl-pipe-9019',
      title: 'Pipeline #9019 · edge-ingestor / burst-stress-suite',
      status: 'Failed (Backpressure timeout)',
      url: 'https://git.truvornex.internal/truvornex/edge-ingestor/-/pipelines/9019',
      updatedAt: '2026-11-25T10:35:00Z',
      metadata: { tests: '41 passed, 2 failed', coverage: '84.0%' },
    },
    {
      id: 'ext-9',
      projectId: 'proj-ctrl',
      provider: 'gitlab',
      kind: 'release',
      externalId: 'gl-rel-0.9.4',
      title: 'v0.9.4-rc2 · Control Plane Policy Engine Baseline',
      status: 'Tagged · Verified',
      url: 'https://git.truvornex.internal/truvornex/control-plane/-/releases/v0.9.4-rc2',
      updatedAt: '2026-11-18T18:00:00Z',
      metadata: { commit: 'a8f31c9', workPackage: 'CTRL-101' },
    },
    {
      id: 'ext-10',
      projectId: 'proj-ctrl',
      provider: 'mattermost',
      kind: 'channel',
      externalId: 'mm-ch-ctrl',
      title: '#ctrl-plane-dev',
      status: 'Synced · 5 members',
      url: 'https://chat.truvornex.internal/truvornex/channels/ctrl-plane-dev',
      updatedAt: '2026-11-26T10:15:00Z',
      metadata: { topic: 'CTRL-102 outbox & RFC-014 review' },
    },
    {
      id: 'ext-11',
      projectId: 'proj-edge',
      provider: 'mattermost',
      kind: 'channel',
      externalId: 'mm-ch-edge',
      title: '#edge-telemetry',
      status: 'Synced · 5 members',
      url: 'https://chat.truvornex.internal/truvornex/channels/edge-telemetry',
      updatedAt: '2026-11-26T09:50:00Z',
      metadata: { topic: 'EDGE-202 blocker triage & M3 benchmark' },
    },
    {
      id: 'ext-12',
      projectId: 'proj-sdkv',
      provider: 'mattermost',
      kind: 'channel',
      externalId: 'mm-ch-verify',
      title: '#qa-verification',
      status: 'Synced · 5 members',
      url: 'https://chat.truvornex.internal/truvornex/channels/qa-verification',
      updatedAt: '2026-11-26T08:40:00Z',
      metadata: { topic: 'SPEC-022 acceptance criteria enforcement' },
    },
  ];

  const notifications: NotificationItem[] = [
    {
      id: 'notif-1',
      recipientId: 'usr-marcus',
      category: 'blocker',
      title: 'EDGE-202 marked Blocked (Overdue)',
      summary: 'Hannah Lindqvist flagged a partition quota dependency blocking EDGE-203 and Milestone M3.',
      resourceType: 'work_package',
      resourceId: 'wp-202',
      securityCritical: false,
      read: false,
      createdAt: '2026-11-25T10:42:00Z',
    },
    {
      id: 'notif-2',
      recipientId: 'usr-marcus',
      category: 'review',
      title: 'Review requested on SECR-401',
      summary: 'Trust-boundary guardrail evidence submitted for owner & admin review.',
      resourceType: 'work_package',
      resourceId: 'wp-401',
      securityCritical: true,
      read: false,
      createdAt: '2026-11-26T09:52:00Z',
    },
  ];

  const auditEvents: AuditEvent[] = [
    {
      id: 'aud-1',
      correlationId: 'corr-9f12a8b1',
      actorId: 'usr-marcus',
      actorName: 'Marcus Chen',
      action: 'project.visibility.updated',
      targetType: 'Project',
      targetId: 'SECR',
      result: 'success',
      details: 'Set project SECR visibility to restricted (3 explicit members).',
      timestamp: '2026-11-01T09:12:00Z',
    },
    {
      id: 'aud-2',
      correlationId: 'corr-7c34e210',
      actorId: 'usr-sofia',
      actorName: 'Sofia Alvarez',
      action: 'work_package.accepted',
      targetType: 'WorkPackage',
      targetId: 'CTRL-101',
      result: 'success',
      details: 'Verified evidence MR !412 and independent security sign-off.',
      timestamp: '2026-11-18T17:20:00Z',
    },
    {
      id: 'aud-3',
      correlationId: 'corr-2a19d77f',
      actorId: 'usr-marcus',
      actorName: 'Marcus Chen',
      action: 'document.updated',
      targetType: 'Document',
      targetId: 'doc-adr-003',
      result: 'success',
      details: 'Published v3 of ADR-003 enforcing 8-slot workspace cap & Operator Console isolation.',
      timestamp: '2026-11-24T16:00:00Z',
    },
  ];

  const activityEvents: ActivityEvent[] = [
    {
      id: 'act-1',
      actorId: 'usr-marcus',
      action: 'updated',
      resourceType: 'work_package',
      resourceId: 'wp-401',
      resourceKey: 'SECR-401',
      resourceTitle: 'Operator Console Trust Boundary Enforcement',
      projectId: 'proj-secr',
      summary: 'Posted guardrail verification evidence and linked ADR-003.',
      timestamp: '2026-11-26T09:52:00Z',
    },
    {
      id: 'act-2',
      actorId: 'usr-tariq',
      action: 'moved to In Review',
      resourceType: 'work_package',
      resourceId: 'wp-103',
      resourceKey: 'CTRL-103',
      resourceTitle: 'Graph Cycle Guard for WorkPackage Dependencies',
      projectId: 'proj-ctrl',
      summary: 'Submitted MR !439 and Pipeline #9042 for QA verification.',
      timestamp: '2026-11-26T09:15:00Z',
    },
    {
      id: 'act-3',
      actorId: 'usr-sofia',
      action: 'submitted review for',
      resourceType: 'work_package',
      resourceId: 'wp-302',
      resourceKey: 'SDKV-302',
      resourceTitle: 'External Partner Contract Test Fixtures',
      projectId: 'proj-sdkv',
      summary: 'Attached sanitized fixtures in MR !97.',
      timestamp: '2026-11-25T16:45:00Z',
    },
    {
      id: 'act-4',
      actorId: 'usr-tariq',
      action: 'revised',
      resourceType: 'document',
      resourceId: 'doc-rfc-014',
      resourceKey: 'RFC-014',
      resourceTitle: 'Idempotent Event Outbox & Webhook Replay Policy',
      projectId: 'proj-ctrl',
      summary: 'Updated partition key quota section (v2).',
      timestamp: '2026-11-25T14:20:00Z',
    },
    {
      id: 'act-5',
      actorId: 'usr-hannah',
      action: 'flagged Blocked on',
      resourceType: 'work_package',
      resourceId: 'wp-202',
      resourceKey: 'EDGE-202',
      resourceTitle: 'Dead-Letter Queue Burst Backpressure Stall',
      projectId: 'proj-edge',
      summary: 'Assigned blocker owner David Okafor with review date 2026-11-27.',
      timestamp: '2026-11-25T10:40:00Z',
    },
  ];

  const meetings: MeetingItem[] = [
    {
      id: 'mtg-1',
      projectId: 'proj-ctrl',
      title: 'Architecture Review Board · RFC-014 Quota Sign-Off',
      date: '2026-11-27',
      timeRange: '14:00 – 14:45 UTC',
      facilitatorId: 'usr-marcus',
      channelRef: '#ctrl-plane-dev',
      agendaSummary: 'Unblock EDGE-202 partition key quota and verify outbox replay bounds.',
    },
    {
      id: 'mtg-2',
      projectId: 'proj-edge',
      title: 'M3 Ingestion Benchmark Readiness Check',
      date: '2026-11-30',
      timeRange: '16:00 – 16:30 UTC',
      facilitatorId: 'usr-hannah',
      channelRef: '#edge-telemetry',
      agendaSummary: 'Review p99 ingestion latency and DLQ error budget.',
    },
    {
      id: 'mtg-3',
      projectId: 'proj-sdkv',
      title: 'Verification Gate v1 & SPEC-022 Dry Run',
      date: '2026-12-02',
      timeRange: '15:00 – 15:45 UTC',
      facilitatorId: 'usr-sofia',
      channelRef: '#qa-verification',
      agendaSummary: 'Validate automated acceptance evidence checks across open MRs.',
    },
  ];

  const savedViews: SavedView[] = [
    {
      id: 'view-1',
      name: 'Blocked & Critical Attention',
      ownerId: 'usr-priya',
      scope: 'workspace',
      filters: { onlyBlocked: true, priority: ['Critical', 'High'] },
    },
    {
      id: 'view-2',
      name: 'QA Review & Verification Queue',
      ownerId: 'usr-sofia',
      scope: 'workspace',
      filters: { status: ['In Review', 'Verification'] },
    },
  ];

  return {
    schemaVersion: 2,
    workspace: {
      id: 'ws-truvornex',
      name: 'Truvornex',
      programmeTitle: 'Truvornex Infrastructure Programme',
      defaultTimezone: 'UTC',
      enforceMfa: true,
      operatorConsoleIsolated: true,
      operatorSeatLimit: 8,
      maxAccountSlots: MAX_ACCOUNT_SLOTS,
      notificationPrefs: {
        batchLowPriority: true,
        emailDigest: true,
        chatDeepLinks: true,
      },
    },
    invites: [],
    revokedJtis: [],
    sessionInvalidBefore: {},
    users,
    divisions,
    teams,
    projects,
    milestones,
    workPackages,
    dependencies,
    comments,
    documents,
    attachments: [],
    integrations,
    externalLinks,
    notifications,
    auditEvents,
    activityEvents,
    meetings,
    savedViews,
    chatChannels: createInitialChatChannels(),
    chatMessages: createInitialChatMessages(),
    processedWebhooks: [],
    masterKeyfileHash: null,
    userKeyfileHashes: {},
  };
}

function normalizeLegacyDatabase(parsed: Partial<WorkspaceDatabase>): WorkspaceDatabase {
  const seed = createSeedDatabase();
  // If pre-v2 database had > 8 unauthenticated seed users, reset users/projects/refs cleanly to v2 6/8 baseline
  if (!parsed.schemaVersion || parsed.schemaVersion < 2 || !Array.isArray(parsed.users) || parsed.users.length > MAX_ACCOUNT_SLOTS) {
    return seed;
  }

  const users = parsed.users.map((u) => ({
    ...u,
    authProvider: u.authProvider || 'firebase',
    presence: u.presence || 'active',
    chatNotificationMode: u.chatNotificationMode || 'mentions_only',
    notifyOnChannelAll: typeof u.notifyOnChannelAll === 'boolean' ? u.notifyOnChannelAll : true,
    desktopAlerts: typeof u.desktopAlerts === 'boolean' ? u.desktopAlerts : false,
    channelNotificationModes: u.channelNotificationModes || {},
  }));

  return {
    ...seed,
    ...parsed,
    schemaVersion: 2,
    workspace: {
      ...seed.workspace,
      ...(parsed.workspace || {}),
      maxAccountSlots: MAX_ACCOUNT_SLOTS,
    },
    users,
    revokedJtis: Array.isArray(parsed.revokedJtis) ? parsed.revokedJtis : [],
    sessionInvalidBefore:
      parsed.sessionInvalidBefore && typeof parsed.sessionInvalidBefore === 'object' ? parsed.sessionInvalidBefore : {},
    chatChannels: Array.isArray(parsed.chatChannels) && parsed.chatChannels.length > 0
      ? parsed.chatChannels
      : createInitialChatChannels(),
    chatMessages: Array.isArray(parsed.chatMessages) && parsed.chatMessages.length > 0
      ? parsed.chatMessages
      : createInitialChatMessages(),
    masterKeyfileHash: typeof parsed.masterKeyfileHash === 'string' ? parsed.masterKeyfileHash : null,
    userKeyfileHashes:
      parsed.userKeyfileHashes && typeof parsed.userKeyfileHashes === 'object' ? parsed.userKeyfileHashes : {},
  };
}

let cachedDb: WorkspaceDatabase | null = null;

export function getDb(): WorkspaceDatabase {
  if (cachedDb) return cachedDb;
  ensureDirs();
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<WorkspaceDatabase>;
      cachedDb = normalizeLegacyDatabase(parsed);
      if ((parsed.schemaVersion || 0) < 2) {
        saveDb(cachedDb);
      }
      return cachedDb;
    } catch {
      // Fallback to fresh seed if corrupted
    }
  }
  cachedDb = createSeedDatabase();
  saveDb(cachedDb);
  return cachedDb;
}

export function saveDb(db: WorkspaceDatabase): void {
  ensureDirs();
  const tmpFile = `${DB_FILE}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
  cachedDb = db;
}

export function resetDb(): WorkspaceDatabase {
  const fresh = createSeedDatabase();
  saveDb(fresh);
  return fresh;
}
