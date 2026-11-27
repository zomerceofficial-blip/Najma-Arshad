import crypto from 'crypto';
import type {
  ActivityEvent,
  NotificationItem,
  User,
  WorkDependency,
  WorkPackage,
  WorkPackageStatus,
} from '../types/workspace.js';
import { canApproveWork } from './security.js';
import type { WorkspaceDatabase } from './store.js';

export function detectDependencyCycle(
  dependencies: WorkDependency[],
  predecessorId: string,
  successorId: string
): string[] | null {
  if (predecessorId === successorId) {
    return [predecessorId, successorId];
  }
  // If adding predecessor -> successor creates a cycle, there must already be a path successor -> ... -> predecessor
  const adj = new Map<string, string[]>();
  for (const dep of dependencies) {
    if (!adj.has(dep.predecessorId)) adj.set(dep.predecessorId, []);
    adj.get(dep.predecessorId)!.push(dep.successorId);
  }
  const visited = new Set<string>();
  const path: string[] = [];

  function dfs(current: string): boolean {
    if (current === predecessorId) {
      path.push(current);
      return true;
    }
    if (visited.has(current)) return false;
    visited.add(current);
    path.push(current);
    const nexts = adj.get(current) || [];
    for (const nxt of nexts) {
      if (dfs(nxt)) return true;
    }
    path.pop();
    return false;
  }

  if (dfs(successorId)) {
    return [predecessorId, ...path];
  }
  return null;
}

export function validateWorkPackageTransition(params: {
  db: WorkspaceDatabase;
  actor: User;
  existing: WorkPackage;
  next: WorkPackage;
}): string | null {
  const { db, actor, existing, next } = params;
  const targetStatus: WorkPackageStatus = next.status;

  if (targetStatus === existing.status) {
    return null;
  }

  // Gate 1: Entering Ready or active execution requires defined scope, owner, priority, acceptance criteria, and dependency confirmation
  if (
    targetStatus === 'Ready' ||
    targetStatus === 'In Progress' ||
    targetStatus === 'In Review' ||
    targetStatus === 'Verification' ||
    targetStatus === 'Accepted'
  ) {
    if (!next.title?.trim() || !next.description?.trim()) {
      return 'Title and problem statement are required before entering Ready or active execution.';
    }
    if (!next.ownerId) {
      return 'An accountable owner is required.';
    }
    if (!next.acceptanceCriteria?.trim()) {
      return 'Acceptance criteria are required before a task can enter Ready.';
    }
    const hasDeps = db.dependencies.some((d) => d.successorId === next.id || d.predecessorId === next.id);
    if (!hasDeps && !next.dependenciesConfirmedNone) {
      return 'Record dependencies or confirm none are known before entering Ready.';
    }

    // Check unresolved blocking predecessors when transitioning into Ready or In Progress
    if (targetStatus === 'Ready' || targetStatus === 'In Progress') {
      const blockingDeps = db.dependencies.filter(
        (d) => d.successorId === next.id && d.type === 'blocks'
      );
      const unresolvedBlockers = blockingDeps
        .map((d) => db.workPackages.find((wp) => wp.id === d.predecessorId))
        .filter((wp): wp is WorkPackage => Boolean(wp && wp.status !== 'Accepted' && wp.status !== 'Closed'));

      if (unresolvedBlockers.length > 0 && !next.blockerExceptionReason?.trim()) {
        return `Blocked by unresolved predecessor(s): ${unresolvedBlockers.map((b) => b.key).join(', ')}. Resolve predecessor or record an authorized exception.`;
      }
    }
  }

  // Gate 2: Blocked requires reason, blocker owner, and next review date
  if (targetStatus === 'Blocked') {
    if (!next.blockerReason?.trim() || !next.blockerOwnerId || !next.nextReviewDate?.trim()) {
      return 'Blocked work requires a reason, a blocker owner, and a next review date.';
    }
  }

  // Gate 3: In Review requires implementation evidence
  if (targetStatus === 'In Review') {
    const hasLink = db.externalLinks.some((l) => l.workPackageId === next.id);
    if (!next.evidenceNote?.trim() && !hasLink) {
      return 'Moving to In Review requires implementation evidence (evidence note or linked merge request/branch).';
    }
  }

  // Gate 4: Accepted / Closed requires reviewer/QA authority + separation of duties on high-risk changes
  if (targetStatus === 'Accepted' || targetStatus === 'Closed') {
    if (!canApproveWork(actor.role)) {
      return 'Only a Reviewer/QA, Team Lead, Project Manager, or Workspace Admin may accept or close work.';
    }
    const hasLink = db.externalLinks.some((l) => l.workPackageId === next.id);
    if (!next.evidenceNote?.trim() && !hasLink) {
      return 'Acceptance requires verification evidence.';
    }
    if (next.highRisk && next.creatorId === actor.id && !next.securityApprovedBy) {
      return 'Separation of duties: task creator cannot unilaterally accept a high-risk work package without separate reviewer/security approval.';
    }
  }

  return null;
}

export function emitActivity(db: WorkspaceDatabase, event: Omit<ActivityEvent, 'id' | 'timestamp'>): void {
  db.activityEvents.unshift({
    id: `act-${crypto.randomBytes(5).toString('hex')}`,
    timestamp: new Date().toISOString(),
    ...event,
  });
  if (db.activityEvents.length > 250) {
    db.activityEvents.length = 250;
  }
}

export function emitNotification(
  db: WorkspaceDatabase,
  notif: Omit<NotificationItem, 'id' | 'read' | 'createdAt'>
): void {
  db.notifications.unshift({
    id: `notif-${crypto.randomBytes(5).toString('hex')}`,
    read: false,
    createdAt: new Date().toISOString(),
    ...notif,
  });
  if (db.notifications.length > 200) {
    db.notifications.length = 200;
  }
}

export function nextWorkPackageKey(db: WorkspaceDatabase, projectId: string): string {
  const project = db.projects.find((p) => p.id === projectId);
  const prefix = project ? project.key : 'TRV';
  const existingNums = db.workPackages
    .filter((wp) => wp.projectId === projectId)
    .map((wp) => {
      const m = wp.key.match(/-(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    });
  const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 101;
  return `${prefix}-${nextNum}`;
}

export const WORK_PACKAGE_TYPES = new Set([
  'initiative',
  'epic',
  'feature',
  'task',
  'subtask',
  'bug',
  'research',
  'tech_debt',
]);

export const WORK_PACKAGE_STATUSES = new Set([
  'Draft',
  'Backlog',
  'Ready',
  'In Progress',
  'In Review',
  'Verification',
  'Accepted',
  'Closed',
  'Blocked',
  'Waiting',
  'Cancelled',
  'Reopened',
]);

export const PRIORITIES = new Set(['Critical', 'High', 'Medium', 'Low']);

export function isValidIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function sanitizeLabels(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .filter((item): item is string => typeof item === 'string')
        .map((s) => s.trim().slice(0, 32))
        .filter(Boolean)
    )
  ).slice(0, 12);
}

