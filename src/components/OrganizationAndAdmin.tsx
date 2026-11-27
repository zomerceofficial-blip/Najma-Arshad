import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AtSign,
  Bell,
  BellOff,
  CheckCircle2,
  Download,
  KeyRound,
  Lock,
  RefreshCw,
  Shield,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { api, type WorkspaceBootstrapData } from '../lib/api.ts';
import type { AuthSessionResponse, ChatNotificationMode, User, WorkPackage, WorkspaceRole } from '../types/workspace.ts';
import { HealthLabel, PriorityLabel, StatusLabel, UserAvatar } from './StatusLabel.tsx';
import { ConfirmDialog, type ToastMessage } from './ToastAndDialogs.tsx';

interface OrganizationAndAdminProps {
  section:
    | 'activity'
    | 'inbox'
    | 'reports'
    | 'teams'
    | 'members'
    | 'workload'
    | 'settings'
    | 'roles'
    | 'integrations'
    | 'audit';
  data: WorkspaceBootstrapData;
  onRefresh: () => Promise<void>;
  onSelectWorkPackage: (wp: WorkPackage) => void;
  onSessionReplaced: (session: AuthSessionResponse) => void;
  onNotify?: (tone: ToastMessage['tone'], title: string, detail?: string) => void;
  onOpenPreferences?: () => void;
}

const ALL_ROLES: WorkspaceRole[] = [
  'Workspace Owner',
  'Workspace Administrator',
  'Programme Manager',
  'Project Manager',
  'Team Lead',
  'Contributor',
  'Reviewer / QA',
  'Read-only Observer',
  'External Collaborator',
];

export function OrganizationAndAdmin({
  section,
  data,
  onRefresh,
  onSelectWorkPackage,
  onSessionReplaced,
  onNotify,
  onOpenPreferences,
}: OrganizationAndAdminProps) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invEmail, setInvEmail] = useState('');
  const [invName, setInvName] = useState('');
  const [invTitle, setInvTitle] = useState('');
  const [invRole, setInvRole] = useState<WorkspaceRole>('Contributor');
  const [invExpiry, setInvExpiry] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<User | null>(null);
  const [activityFilter, setActivityFilter] = useState('');
  const [webhookStatusMsg, setWebhookStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [programmeTitle, setProgrammeTitle] = useState(data.workspace.programmeTitle);
  const [defaultTz, setDefaultTz] = useState(data.workspace.defaultTimezone);
  const [batchLowPriority, setBatchLowPriority] = useState(data.workspace.notificationPrefs.batchLowPriority);
  const [emailDigest, setEmailDigest] = useState(data.workspace.notificationPrefs.emailDigest);
  const [chatDeepLinks, setChatDeepLinks] = useState(data.workspace.notificationPrefs.chatDeepLinks);

  useEffect(() => {
    setProgrammeTitle(data.workspace.programmeTitle);
    setDefaultTz(data.workspace.defaultTimezone);
    setBatchLowPriority(data.workspace.notificationPrefs.batchLowPriority);
    setEmailDigest(data.workspace.notificationPrefs.emailDigest);
    setChatDeepLinks(data.workspace.notificationPrefs.chatDeepLinks);
  }, [data.workspace]);

  const isAdmin =
    data.currentUser.role === 'Workspace Owner' ||
    data.currentUser.role === 'Workspace Administrator';

  const getUserName = (id: string) =>
    data.users.find((u) => u.id === id)?.displayName || 'System';

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGeneratedToken(null);
    try {
      const res = await api.inviteMember({
        email: invEmail,
        displayName: invName,
        title: invTitle || 'Engineer',
        role: invRole,
        expiresAt: invExpiry || undefined,
      });
      setGeneratedToken(res.inviteToken);
      setInvEmail('');
      setInvName('');
      setInvTitle('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed.');
    }
  }

  async function handleTestBoundaryRejection() {
    setError(null);
    try {
      await api.inviteMember({
        email: 'operator-test@truvornex.internal',
        displayName: 'Operator Seat Test',
        title: 'Production Operator',
        role: 'production_operator' as unknown as WorkspaceRole,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Boundary check rejected.');
      await onRefresh();
    }
  }

  async function handleMemberPatch(userId: string, patch: { role?: WorkspaceRole; state?: 'active' | 'suspended' | 'revoked' }) {
    setError(null);
    try {
      await api.updateMember(userId, patch);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Member update failed.');
    }
  }

  async function handleSwitchIdentity(userId: string) {
    setError(null);
    try {
      const session = await api.switchAccount(userId);
      onSessionReplaced(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not switch identity.');
    }
  }

  if (section === 'activity') {
    const filtered = data.activityEvents.filter((a) => {
      if (!activityFilter.trim()) return true;
      const q = activityFilter.toLowerCase();
      return (
        a.summary.toLowerCase().includes(q) ||
        a.resourceTitle.toLowerCase().includes(q) ||
        getUserName(a.actorId).toLowerCase().includes(q)
      );
    });

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-[#F3F4F6] tracking-tight">Activity Stream</h1>
            <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
              Generated from committed domain events across projects, work packages, and documents
            </p>
          </div>
          <input
            type="text"
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
            placeholder="Filter by actor, key, or summary…"
            className="h-10 sm:h-9 px-4 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-full w-full sm:w-64"
          />
        </div>

        <div className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-hidden divide-y divide-[#EFF1F4] dark:divide-white/[0.06] shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
          {filtered.map((act) => (
            <div key={act.id} className="px-4 sm:px-5 py-3.5 flex flex-wrap items-start justify-between gap-2 sm:gap-4 text-xs">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <UserAvatar name={getUserName(act.actorId)} />
                <div className="min-w-0">
                  <p className="text-[#111215] dark:text-[#E5E7EB]">
                    <strong>{getUserName(act.actorId)}</strong> {act.action}{' '}
                    <button
                      type="button"
                      onClick={() => {
                        if (act.resourceType === 'work_package') {
                          const found = data.workPackages.find((w) => w.id === act.resourceId);
                          if (found) onSelectWorkPackage(found);
                        }
                      }}
                      className="font-mono font-semibold text-[#111215] dark:text-[#F3F4F6] underline decoration-[#D8D8D8] dark:decoration-[#5E6572] hover:decoration-[#111215] dark:hover:decoration-[#F3F4F6]"
                    >
                      {act.resourceKey || act.resourceTitle}
                    </button>
                  </p>
                  <p className="text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">{act.summary}</p>
                </div>
              </div>
              <span className="font-mono text-[11px] text-[#5E6572] dark:text-[#9CA3AF] tabular-nums shrink-0">
                {new Date(act.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === 'inbox') {
    const currentChatMode: ChatNotificationMode = data.currentUser.chatNotificationMode || 'mentions_only';
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-[#F3F4F6] tracking-tight">Inbox & Notifications</h1>
            <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
              Assignments, mentions, chat alerts, review requests, blockers, and mandatory security alerts
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await api.markAllNotificationsRead();
              await onRefresh();
              onNotify?.('info', 'All inbox notifications marked as read');
            }}
            className="h-9 px-4 bg-white dark:bg-[#161922] border border-[#D8DCE3] dark:border-white/[0.12] hover:bg-[#ECEEF2] dark:hover:bg-[#1D212A] text-[#111215] dark:text-[#F3F4F6] text-xs font-medium rounded-full"
          >
            Mark All Read
          </button>
        </div>

        {/* Chat Alert Delivery Setting Banner */}
        <div className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-[#111215] dark:text-[#F3F4F6]">
              Workspace Chat Alert Rule
            </div>
            <p className="text-[11px] text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
              Choose whether workspace chat triggers inbox alerts on <strong>Mentions Only</strong> or <strong>All Messages</strong>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 bg-[#F3F4F6] dark:bg-[#161922] p-1 rounded-full border border-[#E2E5EA] dark:border-white/[0.08]">
            {(
              [
                { id: 'mentions_only', label: 'Mentions Only', icon: AtSign },
                { id: 'all_messages', label: 'All Messages', icon: Bell },
                { id: 'muted', label: 'Muted', icon: BellOff },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const active = currentChatMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={async () => {
                    await api.updatePreferences({ chatNotificationMode: opt.id });
                    await onRefresh();
                    onNotify?.('success', `Chat notifications set to ${opt.label}`);
                  }}
                  className={`h-8 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                    active
                      ? 'bg-[#111215] dark:bg-[#F3F4F6] text-white dark:text-[#0B0C0E]'
                      : 'text-[#5E6572] dark:text-[#9CA3AF] hover:text-[#111215] dark:hover:text-[#F3F4F6]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-hidden divide-y divide-[#EFF1F4] dark:divide-white/[0.06] shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
          {data.notifications.map((n) => (
            <div
              key={n.id}
              className={`px-5 py-4 flex items-start justify-between gap-4 ${
                n.read ? 'bg-white dark:bg-[#111318]' : 'bg-[#F5F6F8] dark:bg-[#141821]'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-[#111215] dark:text-[#F3F4F6]">{n.title}</span>
                  <span className="text-[#5E6572] dark:text-[#9CA3AF] capitalize">· {n.category}</span>
                  {n.securityCritical && (
                    <span className="text-[#B42318] dark:text-[#FDA29B] font-medium">· Mandatory Security Event</span>
                  )}
                </div>
                <p className="text-xs text-[#5E6572] dark:text-[#9CA3AF]">{n.summary}</p>
                <div className="text-[11px] font-mono text-[#7D8490] dark:text-[#6B7280] tabular-nums">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {n.resourceType === 'work_package' && n.resourceId && (
                  <button
                    type="button"
                    onClick={() => {
                      const wp = data.workPackages.find((w) => w.id === n.resourceId);
                      if (wp) onSelectWorkPackage(wp);
                    }}
                    className="h-7 px-3 bg-white dark:bg-[#181B22] border border-[#D8DCE3] dark:border-white/[0.12] rounded-full text-xs font-medium text-[#111215] dark:text-[#F3F4F6] hover:bg-[#ECEEF2] dark:hover:bg-[#232833]"
                  >
                    Open Task
                  </button>
                )}
                {!n.read && (
                  <button
                    type="button"
                    onClick={async () => {
                      await api.markNotificationRead(n.id);
                      await onRefresh();
                    }}
                    className="h-7 px-3 bg-[#111215] dark:bg-[#F3F4F6] text-white dark:text-[#0B0C0E] rounded-full text-xs"
                  >
                    Mark Read
                  </button>
                )}
              </div>
            </div>
          ))}
          {data.notifications.length === 0 && (
            <div className="p-8 text-center text-xs text-[#5E6572] dark:text-[#9CA3AF]">Inbox is clear.</div>
          )}
        </div>
      </div>
    );
  }

  if (section === 'reports') {
    const statusCounts = [
      'Draft',
      'Backlog',
      'Ready',
      'In Progress',
      'In Review',
      'Verification',
      'Accepted',
      'Closed',
      'Blocked',
    ].map((st) => ({
      status: st,
      count: data.workPackages.filter((w) => w.status === st).length,
    }));
    const maxCount = Math.max(1, ...statusCounts.map((s) => s.count));
    const bugs = data.workPackages.filter((w) => w.type === 'bug');
    const reviewQueue = data.workPackages.filter(
      (w) => w.status === 'In Review' || w.status === 'Verification'
    );

    return (
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-[#F3F4F6] tracking-tight">Delivery & Quality Reports</h1>
          <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
            Aggregate programme metrics derived from canonical work-package and milestone records
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
            <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-[#F3F4F6]">
              Work Packages by Lifecycle State
            </h2>
            <div className="space-y-2.5">
              {statusCounts.map((row) => (
                <div key={row.status} className="grid grid-cols-12 items-center gap-3 text-xs">
                  <div className="col-span-4 text-[#111215] dark:text-[#E5E7EB] font-medium">{row.status}</div>
                  <div className="col-span-6 h-3 bg-[#ECEEF2] dark:bg-[#1B1F28] rounded-full overflow-hidden">
                    <div
                      style={{ width: `${(row.count / maxCount) * 100}%` }}
                      className="h-full bg-[#111215] dark:bg-[#F3F4F6] rounded-full"
                    />
                  </div>
                  <div className="col-span-2 text-right font-mono tabular-nums text-[#5E6572] dark:text-[#9CA3AF]">
                    {row.count}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
            <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-[#F3F4F6]">Project Health & Defects</h2>
            <div className="divide-y divide-[#EFF1F4] dark:divide-white/[0.06]">
              {data.projects.map((p) => {
                const pBugs = bugs.filter((b) => b.projectId === p.id).length;
                const pBlocked = data.workPackages.filter(
                  (w) => w.projectId === p.id && w.status === 'Blocked'
                ).length;
                return (
                  <div key={p.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-mono font-semibold text-[#111215] dark:text-[#F3F4F6]">{p.key}</span>{' '}
                      <span className="font-medium text-[#111215] dark:text-[#E5E7EB]">{p.name}</span>
                      <div className="text-[11px] text-[#5E6572] dark:text-[#9CA3AF] mt-0.5 tabular-nums">
                        {pBugs} open defects · {pBlocked} blocked
                      </div>
                    </div>
                    <HealthLabel health={p.health} />
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
          <div className="px-5 py-3.5 border-b border-[#E2E5EA] dark:border-white/[0.08]">
            <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-[#F3F4F6]">
              Active Review & Verification Queue ({reviewQueue.length})
            </h2>
          </div>
          <div className="divide-y divide-[#EFF1F4] dark:divide-white/[0.06]">
            {reviewQueue.map((wp) => (
              <button
                key={wp.id}
                type="button"
                onClick={() => onSelectWorkPackage(wp)}
                className="w-full text-left px-5 py-3.5 hover:bg-[#F8F9FA] dark:hover:bg-[#14171D] flex items-center justify-between gap-4 text-xs"
              >
                <div>
                  <span className="font-mono font-semibold text-[#111215] dark:text-[#F3F4F6]">{wp.key}</span>{' '}
                  <span className="font-medium text-[#111215] dark:text-[#E5E7EB]">{wp.title}</span>
                  <div className="text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
                    Reviewer: {getUserName(wp.reviewerId || '')} · Due {wp.dueDate}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <PriorityLabel priority={wp.priority} />
                  <StatusLabel status={wp.status} />
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (section === 'teams') {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-[#F3F4F6] tracking-tight">Divisions & Teams</h1>
          <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
            Organizational ownership boundaries across the Truvornex programme
          </p>
        </div>
        <div className="space-y-4">
          {data.divisions.map((div) => {
            const divTeams = data.teams.filter((t) => t.divisionId === div.id);
            return (
              <section key={div.id} className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
                <div className="px-5 py-4 border-b border-[#E2E5EA] dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-[#F3F4F6]">{div.name}</h2>
                    <p className="text-xs text-[#5E6572] dark:text-[#9CA3AF]">{div.description}</p>
                  </div>
                  <span className="text-xs text-[#5E6572] dark:text-[#9CA3AF]">
                    Division Lead: <strong className="text-[#111215] dark:text-[#F3F4F6]">{getUserName(div.leadId)}</strong>
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#EFF1F4] dark:divide-white/[0.06]">
                  {divTeams.map((team) => (
                    <div key={team.id} className="p-5 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#111215] dark:text-[#F3F4F6] flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[#111215] dark:text-[#D8D8D8]" />
                          {team.name}
                        </span>
                        <span className="text-[#5E6572] dark:text-[#9CA3AF] tabular-nums">{team.memberIds.length} members</span>
                      </div>
                      <div className="text-xs text-[#5E6572] dark:text-[#9CA3AF]">
                        Lead: {getUserName(team.leadId)}
                      </div>
                      <div className="flex flex-wrap gap-2.5 pt-1">
                        {team.memberIds.map((uid) => (
                          <span key={uid} className="inline-flex items-center gap-1.5 text-xs text-[#111215] dark:text-[#E5E7EB]">
                            <UserAvatar name={getUserName(uid)} />
                            <span>{getUserName(uid)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  if (section === 'members') {
    const slotPct = Math.min(100, Math.round((data.slotsUsed / data.maxSlots) * 100));
    const slotsOpen = Math.max(0, data.maxSlots - data.slotsUsed);

    function handleExportMembersCsv() {
      const headers = ['ID', 'Display Name', 'Email', 'Role', 'State', 'Provider', 'Presence', 'Joined'];
      const rows = data.users.map((u) => [
        u.id,
        `"${u.displayName.replace(/"/g, '""')}"`,
        u.email,
        `"${u.role}"`,
        u.state,
        u.authProvider || 'firebase',
        u.presence || 'active',
        u.joinedAt.slice(0, 10),
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'truvornex-members.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onNotify?.('success', 'Exported members roster CSV');
    }

    async function handleIssueKeyfile(member: User) {
      setError(null);
      try {
        const res = await api.issueMemberKeyfile(member.id);
        const blob = new Blob([JSON.stringify(res.keyData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        onNotify?.('success', `Issued ${res.filename}`, `Key ID ${res.keyId} assigned to ${member.displayName}.`);
        await onRefresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to issue key file.';
        setError(msg);
        onNotify?.('error', 'Key issuance failed', msg);
      }
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-white tracking-tight">Account Directory</h1>
            <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
              Strict {data.maxSlots}-slot directory for accounts provisioned by the Workspace Owner in Firebase Auth or Supabase
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportMembersCsv}
              className="h-9 px-3.5 bg-white dark:bg-[#111318] border border-[#E5E7EB] dark:border-white/[0.1] hover:bg-[#F3F4F6] dark:hover:bg-white/[0.06] text-[#111215] dark:text-[#E5E7EB] text-xs font-medium rounded-lg inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                disabled={slotsOpen === 0}
                onClick={() => {
                  setInviteOpen((v) => !v);
                  setError(null);
                }}
                className="h-9 px-4 bg-[#111215] hover:bg-[#262930] dark:bg-white dark:hover:bg-[#E5E7EB] disabled:opacity-45 text-white dark:text-[#0B0C0E] text-xs font-medium rounded-lg inline-flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{slotsOpen === 0 ? 'All 8 Slots Full' : 'Authorize Account'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 8-Slot Capacity Meter */}
        <div className="bg-white dark:bg-[#111318] border border-[#E5E7EB] dark:border-white/[0.08] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#111215] dark:text-white">
                Directory Seat Allocation (Strict Max {data.maxSlots} Accounts · Self-Signup Disabled)
              </span>
              <span className="font-mono font-semibold tabular-nums text-[#111215] dark:text-white">
                {data.slotsUsed} / {data.maxSlots} occupied ({slotsOpen} open)
              </span>
            </div>
            <div className="w-full h-2 bg-[#ECEEF2] dark:bg-white/[0.08] rounded-full overflow-hidden">
              <div
                style={{ width: `${slotPct}%` }}
                className={`h-full rounded-full transition-all ${
                  slotsOpen === 0 ? 'bg-[#B42318] dark:bg-[#F97066]' : 'bg-[#111215] dark:bg-white'
                }`}
              />
            </div>
          </div>
          <div className="text-[11px] text-[#5E6572] dark:text-[#9CA3AF] shrink-0">
            Providers:{' '}
            <span className="font-mono text-[#111215] dark:text-white">
              Firebase{data.providers.supabase ? ' + Supabase' : ' (Supabase env optional)'}
            </span>
          </div>
        </div>

        {error && (
          <div role="alert" className="p-3.5 rounded-xl border border-[#F5C6C2] dark:border-[#5E2325] bg-[#FEF0EE] dark:bg-[#2E1314] text-[#B42318] dark:text-[#FDA29B] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {generatedToken && (
          <div className="p-4 rounded-xl border border-[#BCE3CE] dark:border-[#1F4E3A] bg-[#ECF7F1] dark:bg-[#102A1F] text-[#1F764D] dark:text-[#6EE7B7] text-xs space-y-1">
            <div className="font-semibold">Account slot authorized & audited</div>
            <div>
              The provisioned Firebase/Supabase email can now sign in directly, or bind using token:{' '}
              <code className="font-mono bg-white dark:bg-[#0D0F13] px-2.5 py-0.5 rounded-md border border-[#BCE3CE] dark:border-[#1F4E3A]">
                {generatedToken}
              </code>
            </div>
          </div>
        )}

        {inviteOpen && isAdmin && (
          <form onSubmit={handleInvite} className="bg-white dark:bg-[#111318] border border-[#E5E7EB] dark:border-white/[0.08] rounded-xl p-5 space-y-4">
            <div>
              <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-white">Authorize Pre-Provisioned Account</h2>
              <p className="text-xs text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
                Register the email of an account you created in Firebase Auth or Supabase to assign it one of the {data.maxSlots} directory slots.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={invName}
                  onChange={(e) => setInvName(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-[#14171E] text-[#111215] dark:text-white border border-[#D8DCE3] dark:border-white/[0.12] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Email (Firebase / Supabase)</label>
                <input
                  type="email"
                  required
                  value={invEmail}
                  onChange={(e) => setInvEmail(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-[#14171E] text-[#111215] dark:text-white border border-[#D8DCE3] dark:border-white/[0.12] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Title</label>
                <input
                  type="text"
                  value={invTitle}
                  onChange={(e) => setInvTitle(e.target.value)}
                  placeholder="Platform Engineer"
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-[#14171E] text-[#111215] dark:text-white border border-[#D8DCE3] dark:border-white/[0.12] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Workspace Role</label>
                <select
                  value={invRole}
                  onChange={(e) => setInvRole(e.target.value as WorkspaceRole)}
                  className="w-full h-9 px-2.5 text-xs bg-white dark:bg-[#14171E] text-[#111215] dark:text-white border border-[#D8DCE3] dark:border-white/[0.12] rounded-lg"
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Expiry (Optional)</label>
                <input
                  type="date"
                  value={invExpiry}
                  onChange={(e) => setInvExpiry(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs font-mono bg-white dark:bg-[#14171E] text-[#111215] dark:text-white border border-[#D8DCE3] dark:border-white/[0.12] rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setInviteOpen(false)} className="h-9 px-3.5 border border-[#D8DCE3] dark:border-white/[0.12] text-[#111215] dark:text-[#E5E7EB] rounded-lg text-xs">
                Cancel
              </button>
              <button type="submit" className="h-9 px-4 bg-[#111215] dark:bg-white text-white dark:text-[#0B0C0E] rounded-lg text-xs font-medium">
                Authorize Slot
              </button>
            </div>
          </form>
        )}

        {/* Mobile Member Cards */}
        <div className="md:hidden space-y-2.5">
          {data.users.map((u) => {
            const canSwitchTarget =
              u.state === 'active' &&
              u.id !== data.currentUser.id &&
              !(u.role === 'Workspace Owner' && data.currentUser.role !== 'Workspace Owner');

            return (
              <div key={u.id} className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UserAvatar name={u.displayName} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#111215] dark:text-[#F3F4F6] truncate">
                        {u.displayName}
                        {u.id === data.currentUser.id && (
                          <span className="ml-1.5 text-xs text-[#5E6572] dark:text-[#9CA3AF] font-normal">(You)</span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#5E6572] dark:text-[#9CA3AF] font-mono truncate">{u.email}</div>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium capitalize shrink-0 ${
                      u.state === 'active'
                        ? 'text-[#1F764D] dark:text-[#6EE7B7]'
                        : u.state === 'invited'
                        ? 'text-[#9B6B08] dark:text-[#FCD34D]'
                        : 'text-[#B42318] dark:text-[#FDA29B]'
                    }`}
                  >
                    {u.state}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  {isAdmin && u.id !== data.currentUser.id ? (
                    <select
                      value={u.role}
                      aria-label={`Role for ${u.displayName}`}
                      onChange={(e) => handleMemberPatch(u.id, { role: e.target.value as WorkspaceRole })}
                      className="h-9 px-3 text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-full"
                    >
                      {ALL_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-[#111215] dark:text-[#F3F4F6] font-medium">{u.role}</span>
                  )}
                  <span className="text-[11px] font-mono text-[#5E6572] dark:text-[#9CA3AF] tabular-nums">
                    {u.mfaEnabled ? 'MFA Active' : 'MFA Pending'}
                    {u.expiresAt ? ` · Exp ${u.expiresAt.slice(0, 10)}` : ''}
                  </span>
                </div>

                {isAdmin && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-[#EFF1F4] dark:border-[#1B1F28]">
                    {(u.role !== 'Workspace Owner' || data.currentUser.role === 'Workspace Owner') && (
                      <button
                        type="button"
                        onClick={() => handleIssueKeyfile(u)}
                        className="h-9 px-3 border border-[#D8DCE3] dark:border-white/[0.12] rounded-full text-xs text-[#111215] dark:text-[#F3F4F6] inline-flex items-center gap-1"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>{u.hasKeyfile ? 'Rotate Key (.json)' : 'Issue Key (.json)'}</span>
                      </button>
                    )}
                    {u.id !== data.currentUser.id && canSwitchTarget && (
                      <button
                        type="button"
                        onClick={() => handleSwitchIdentity(u.id)}
                        className="flex-1 h-9 px-3 border border-[#D8DCE3] dark:border-white/[0.12] rounded-full text-xs text-[#111215] dark:text-[#F3F4F6]"
                      >
                        Test View As
                      </button>
                    )}
                    {u.id !== data.currentUser.id && u.state === 'active' && (
                      <button
                        type="button"
                        onClick={() => handleMemberPatch(u.id, { state: 'suspended' })}
                        className="flex-1 h-9 px-3 border border-[#F5C6C2] dark:border-[#5E2325] text-[#B42318] dark:text-[#FDA29B] rounded-full text-xs"
                      >
                        Suspend
                      </button>
                    )}
                    {u.id !== data.currentUser.id && (u.state === 'suspended' || u.state === 'revoked') && (
                      <button
                        type="button"
                        onClick={() => handleMemberPatch(u.id, { state: 'active' })}
                        className="flex-1 h-9 px-3 border border-[#BCE3CE] dark:border-[#1F4E3A] text-[#1F764D] dark:text-[#6EE7B7] rounded-full text-xs"
                      >
                        Restore
                      </button>
                    )}
                    {u.id !== data.currentUser.id && u.role !== 'Workspace Owner' && (
                      <button
                        type="button"
                        onClick={() => setRemoveTarget(u)}
                        className="h-9 px-3 border border-[#F5C6C2] dark:border-[#5E2325] text-[#B42318] dark:text-[#FDA29B] rounded-full text-xs inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Free Slot</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop Members Table */}
        <div className="hidden md:block bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-x-auto shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-[#F8F9FA] dark:bg-[#161922] border-b border-[#E2E5EA] dark:border-white/[0.08] text-[11px] font-semibold text-[#5E6572] dark:text-[#9CA3AF]">
                <th className="py-3 px-5">Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">State</th>
                <th className="py-3 px-4">MFA / Expiry</th>
                {isAdmin && <th className="py-3 px-5 text-right">Governance Controls</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFF1F4] dark:divide-white/[0.06] text-xs">
              {data.users.map((u) => {
                const canSwitchTarget =
                  u.state === 'active' &&
                  u.id !== data.currentUser.id &&
                  !(u.role === 'Workspace Owner' && data.currentUser.role !== 'Workspace Owner');

                return (
                  <tr key={u.id} className="h-12">
                    <td className="py-2 px-5">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={u.displayName} />
                        <div>
                          <div className="font-medium text-[#111215] dark:text-[#F3F4F6]">
                            {u.displayName}
                            {u.id === data.currentUser.id && (
                              <span className="ml-1.5 text-[11px] text-[#5E6572] dark:text-[#9CA3AF] font-normal">(You)</span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#5E6572] dark:text-[#9CA3AF] font-mono">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-4">
                      {isAdmin && u.id !== data.currentUser.id ? (
                        <select
                          value={u.role}
                          aria-label={`Role for ${u.displayName}`}
                          onChange={(e) => handleMemberPatch(u.id, { role: e.target.value as WorkspaceRole })}
                          className="h-8 px-2.5 text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-full"
                        >
                          {ALL_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[#111215] dark:text-[#F3F4F6] font-medium">{u.role}</span>
                      )}
                    </td>
                    <td className="py-2 px-4">
                      <span
                        className={`font-medium capitalize ${
                          u.state === 'active'
                            ? 'text-[#1F764D] dark:text-[#6EE7B7]'
                            : u.state === 'invited'
                            ? 'text-[#9B6B08] dark:text-[#FCD34D]'
                            : 'text-[#B42318] dark:text-[#FDA29B]'
                        }`}
                      >
                        {u.state}
                      </span>
                    </td>
                      <td className="py-2 px-4 text-[#5E6572] dark:text-[#9CA3AF] font-mono tabular-nums text-[11px]">
                      <span className="capitalize">{u.authProvider || 'firebase'}</span> · {u.mfaEnabled ? 'MFA Active' : 'MFA Pending'}
                      {u.expiresAt ? ` · Exp ${u.expiresAt.slice(0, 10)}` : ''}
                    </td>
                    {isAdmin && (
                      <td className="py-2 px-5 text-right space-x-2 whitespace-nowrap">
                        {(u.role !== 'Workspace Owner' || data.currentUser.role === 'Workspace Owner') && (
                          <button
                            type="button"
                            onClick={() => handleIssueKeyfile(u)}
                            className="h-7 px-3 border border-[#D8DCE3] dark:border-white/[0.12] rounded-full hover:bg-[#ECEEF2] dark:hover:bg-[#181B22] text-[#111215] dark:text-[#F3F4F6] inline-flex items-center gap-1"
                          >
                            <KeyRound className="w-3 h-3" />
                            <span>{u.hasKeyfile ? 'Rotate Key' : 'Issue Key'}</span>
                          </button>
                        )}
                        {u.state === 'active' && u.id !== data.currentUser.id && (
                          <>
                            {canSwitchTarget && (
                              <button
                                type="button"
                                onClick={() => handleSwitchIdentity(u.id)}
                                className="h-7 px-3 border border-[#D8DCE3] dark:border-white/[0.12] rounded-full hover:bg-[#ECEEF2] dark:hover:bg-[#181B22] text-[#111215] dark:text-[#F3F4F6]"
                              >
                                Test View As
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleMemberPatch(u.id, { state: 'suspended' })}
                              className="h-7 px-3 border border-[#F5C6C2] dark:border-[#5E2325] text-[#B42318] dark:text-[#FDA29B] rounded-full hover:bg-[#FEF0EE] dark:hover:bg-[#2E1314]"
                            >
                              Suspend
                            </button>
                          </>
                        )}
                        {(u.state === 'suspended' || u.state === 'revoked') && (
                          <button
                            type="button"
                            onClick={() => handleMemberPatch(u.id, { state: 'active' })}
                            className="h-7 px-3 border border-[#BCE3CE] dark:border-[#1F4E3A] text-[#1F764D] dark:text-[#6EE7B7] rounded-full hover:bg-[#ECF7F1] dark:hover:bg-[#102A1F]"
                          >
                            Restore
                          </button>
                        )}
                        {u.id !== data.currentUser.id && u.role !== 'Workspace Owner' && (
                          <button
                            type="button"
                            onClick={() => setRemoveTarget(u)}
                            className="h-7 px-3 border border-[#F5C6C2] dark:border-[#5E2325] text-[#B42318] dark:text-[#FDA29B] rounded-full hover:bg-[#FEF0EE] dark:hover:bg-[#2E1314]"
                          >
                            Free Slot
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <ConfirmDialog
          open={Boolean(removeTarget)}
          title={removeTarget ? `Remove ${removeTarget.displayName}?` : 'Remove Member?'}
          description={
            removeTarget
              ? `Removing ${removeTarget.email} will immediately revoke their session and free 1 of ${data.maxSlots} workspace account slots.`
              : ''
          }
          confirmLabel="Remove & Free Slot"
          destructive
          onCancel={() => setRemoveTarget(null)}
          onConfirm={async () => {
            if (!removeTarget) return;
            await api.removeMember(removeTarget.id);
            const name = removeTarget.displayName;
            setRemoveTarget(null);
            await onRefresh();
            onNotify?.('info', `Removed ${name} — 1 account slot freed`);
          }}
        />
      </div>
    );
  }

  if (section === 'workload') {
    const activeUsers = data.users.filter((u) => u.state === 'active');
    return (
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-[#F3F4F6] tracking-tight">Team Workload</h1>
          <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
            Committed open estimates and active assignments to prevent overload
          </p>
        </div>
        <div className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-hidden divide-y divide-[#EFF1F4] dark:divide-white/[0.06] shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
          {activeUsers.map((u) => {
            const assigned = data.workPackages.filter(
              (w) =>
                (w.ownerId === u.id || w.assigneeIds.includes(u.id)) &&
                w.status !== 'Closed' &&
                w.status !== 'Accepted'
            );
            const totalHours = assigned.reduce((acc, w) => acc + w.estimateHours, 0);
            const pct = Math.min(100, Math.round((totalHours / 80) * 100));
            return (
              <div key={u.id} className="px-5 py-4 grid grid-cols-1 md:grid-cols-12 items-center gap-4 text-xs">
                <div className="md:col-span-4 flex items-center gap-2.5">
                  <UserAvatar name={u.displayName} />
                  <div>
                    <div className="font-medium text-[#111215] dark:text-[#F3F4F6]">{u.displayName}</div>
                    <div className="text-[11px] text-[#5E6572] dark:text-[#9CA3AF]">{u.title}</div>
                  </div>
                </div>
                <div className="md:col-span-5 h-3 bg-[#ECEEF2] dark:bg-[#1B1F28] rounded-full overflow-hidden">
                  <div
                    style={{ width: `${pct}%` }}
                    className={`h-full rounded-full ${pct > 85 ? 'bg-[#B42318] dark:bg-[#F97066]' : 'bg-[#111215] dark:bg-[#F3F4F6]'}`}
                  />
                </div>
                <div className="md:col-span-3 text-right font-mono tabular-nums text-[#5E6572] dark:text-[#9CA3AF]">
                  <strong className="text-[#111215] dark:text-[#F3F4F6]">{totalHours}h</strong> across {assigned.length} open items
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (section === 'settings') {
    return (
      <div className="space-y-5 max-w-3xl">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-[#F3F4F6] tracking-tight">Workspace Settings</h1>
          <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
            Programme defaults, timezone configuration, and notification policies
          </p>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            try {
              await api.updateWorkspace({
                programmeTitle,
                defaultTimezone: defaultTz,
                notificationPrefs: { batchLowPriority, emailDigest, chatDeepLinks },
              });
              await onRefresh();
              setWebhookStatusMsg('Workspace settings saved and audited.');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Save failed.');
            }
          }}
          className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none"
        >
          {error && (
            <div className="p-3.5 rounded-2xl border border-[#F5C6C2] dark:border-[#5E2325] bg-[#FEF0EE] dark:bg-[#2E1314] text-[#B42318] dark:text-[#FDA29B] text-xs">{error}</div>
          )}
          {webhookStatusMsg && (
            <div className="p-3.5 rounded-2xl border border-[#BCE3CE] dark:border-[#1F4E3A] bg-[#ECF7F1] dark:bg-[#102A1F] text-[#1F764D] dark:text-[#6EE7B7] text-xs">{webhookStatusMsg}</div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Programme Title</label>
            <input
              type="text"
              value={programmeTitle}
              onChange={(e) => setProgrammeTitle(e.target.value)}
              disabled={!isAdmin}
              className="w-full h-10 px-3.5 text-sm bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Default Timezone</label>
            <select
              value={defaultTz}
              onChange={(e) => setDefaultTz(e.target.value)}
              disabled={!isAdmin}
              className="w-full h-10 px-3 text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
            >
              <option value="UTC">UTC</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="America/New_York">America/New_York</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
            </select>
          </div>

          <div className="pt-3 border-t border-[#EFF1F4] dark:border-[#1B1F28] space-y-2.5">
            <div className="text-xs font-semibold text-[#111215] dark:text-[#F3F4F6]">Notification Policies</div>
            <label className="flex items-center gap-2 text-xs text-[#111215] dark:text-[#E5E7EB]">
              <input
                type="checkbox"
                checked={batchLowPriority}
                onChange={(e) => setBatchLowPriority(e.target.checked)}
                disabled={!isAdmin}
              />
              <span>Batch low-priority comment and status updates</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-[#111215] dark:text-[#E5E7EB]">
              <input
                type="checkbox"
                checked={emailDigest}
                onChange={(e) => setEmailDigest(e.target.checked)}
                disabled={!isAdmin}
              />
              <span>Send authenticated link-only email digests (never include restricted content)</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-[#111215] dark:text-[#E5E7EB]">
              <input
                type="checkbox"
                checked={chatDeepLinks}
                onChange={(e) => setChatDeepLinks(e.target.checked)}
                disabled={!isAdmin}
              />
              <span>Deliver Mattermost channel deep links on review requests and blockers</span>
            </label>
            <div className="flex items-center gap-2 text-xs text-[#5E6572] dark:text-[#9CA3AF] pt-1">
              <Lock className="w-3.5 h-3.5 text-[#B42318] dark:text-[#FDA29B]" />
              <span>Security, access revocation, and high-risk approval events cannot be disabled.</span>
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end">
              <button type="submit" className="h-9 px-5 bg-[#111215] hover:bg-[#262930] dark:bg-[#F3F4F6] dark:hover:bg-[#D8D8D8] text-white dark:text-[#0B0C0E] text-xs font-medium rounded-full">
                Save Workspace Settings
              </button>
            </div>
          )}
        </form>

        <div className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-[#F3F4F6]">
              Personal Presence & Chat Alert Preferences
            </h2>
            <p className="text-xs text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
              Current rule: <strong className="text-[#111215] dark:text-[#F3F4F6]">{(data.currentUser.chatNotificationMode || 'mentions_only').replace('_', ' ')}</strong> · Presence:{' '}
              <strong className="capitalize text-[#111215] dark:text-[#F3F4F6]">{data.currentUser.presence || 'active'}</strong>
            </p>
          </div>
          {onOpenPreferences && (
            <button
              type="button"
              onClick={onOpenPreferences}
              className="h-9 px-4 bg-[#111215] dark:bg-[#F3F4F6] text-white dark:text-[#0B0C0E] text-xs font-medium rounded-full"
            >
              Configure My Alerts
            </button>
          )}
        </div>
      </div>
    );
  }

  if (section === 'roles') {
    const matrix = [
      { role: 'Workspace Owner', scope: 'Full workspace governance, owner delegation, audit export' },
      { role: 'Workspace Administrator', scope: 'Members, integrations, workspace settings, audit logs' },
      { role: 'Programme Manager', scope: 'Cross-project roadmap, health, milestones, reports' },
      { role: 'Project Manager', scope: 'Project configuration, milestones, work assignment' },
      { role: 'Team Lead', scope: 'Team planning, backlog triage, review approvals' },
      { role: 'Contributor', scope: 'Create/edit work packages, author documents, post comments' },
      { role: 'Reviewer / QA', scope: 'Verify evidence and accept/reject completed work' },
      { role: 'Read-only Observer', scope: 'Read internal projects and documentation' },
      { role: 'External Collaborator', scope: 'Time-limited access to explicitly assigned non-restricted projects' },
    ];

    return (
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-[#F3F4F6] tracking-tight">Roles, Access & Trust Boundaries</h1>
          <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
            Server-enforced RBAC + ABAC policy matrix and mandatory Operator Console separation (ADR-003)
          </p>
        </div>

        <div className="bg-white dark:bg-[#111318] border border-[#F5C6C2] dark:border-[#5E2325] rounded-2xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#B42318] dark:text-[#FDA29B]">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Mandatory Boundary: Separate 8-Seat Production Operator Console</span>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={handleTestBoundaryRejection}
                className="h-8 px-4 border border-[#F5C6C2] dark:border-[#5E2325] bg-[#FEF0EE] dark:bg-[#2E1314] hover:bg-[#FDE2DF] dark:hover:bg-[#3B181A] text-[#B42318] dark:text-[#FDA29B] text-xs font-medium rounded-full"
              >
                Verify Operator Seat Rejection
              </button>
            )}
          </div>
          <p className="text-xs text-[#111215] dark:text-[#E5E7EB] leading-relaxed">
            This engineering workspace enforces strict isolation from Truvornex production infrastructure.
            No workspace role, API endpoint, or administrator can provision, modify, or inspect the eight
            authorized seats on the Production Operator Console.
          </p>
          {error && (
            <div role="alert" className="p-3 rounded-2xl bg-[#FEF0EE] dark:bg-[#2E1314] border border-[#F5C6C2] dark:border-[#5E2325] text-[#B42318] dark:text-[#FDA29B] text-xs">
              Server Guardrail Confirmed: {error}
            </div>
          )}
        </div>

        {/* Mobile Roles Cards */}
        <div className="md:hidden space-y-2.5">
          {matrix.map((row) => (
            <div key={row.role} className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#111215] dark:text-[#F3F4F6]">{row.role}</span>
                <span className="font-mono tabular-nums text-[#5E6572] dark:text-[#9CA3AF]">
                  {data.users.filter((u) => u.role === row.role).length} assigned
                </span>
              </div>
              <p className="text-xs text-[#5E6572] dark:text-[#9CA3AF] leading-relaxed">{row.scope}</p>
            </div>
          ))}
        </div>

        {/* Desktop Roles Table */}
        <div className="hidden md:block bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-x-auto shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8F9FA] dark:bg-[#161922] border-b border-[#E2E5EA] dark:border-white/[0.08] text-[11px] font-semibold text-[#5E6572] dark:text-[#9CA3AF]">
                <th className="py-3 px-5">Workspace Role</th>
                <th className="py-3 px-4">Enforced Capabilities</th>
                <th className="py-3 px-5 text-right">Assigned Members</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFF1F4] dark:divide-white/[0.06] text-xs">
              {matrix.map((row) => (
                <tr key={row.role} className="h-11">
                  <td className="py-2 px-5 font-semibold text-[#111215] dark:text-[#F3F4F6]">{row.role}</td>
                  <td className="py-2 px-4 text-[#5E6572] dark:text-[#9CA3AF]">{row.scope}</td>
                  <td className="py-2 px-5 text-right font-mono tabular-nums text-[#111215] dark:text-[#F3F4F6]">
                    {data.users.filter((u) => u.role === row.role).length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section === 'integrations') {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-[#F3F4F6] tracking-tight">Integrations & Webhook Controls</h1>
          <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
            Vault secret references (never raw tokens), independent circuit breakers, and idempotent webhook verification
          </p>
        </div>

        {webhookStatusMsg && (
          <div className="p-3.5 rounded-2xl border border-[#BCE3CE] dark:border-[#1F4E3A] bg-[#ECF7F1] dark:bg-[#102A1F] text-[#1F764D] dark:text-[#6EE7B7] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{webhookStatusMsg}</span>
          </div>
        )}
        {error && (
          <div role="alert" className="p-3.5 rounded-2xl border border-[#F5C6C2] dark:border-[#5E2325] bg-[#FEF0EE] dark:bg-[#2E1314] text-[#B42318] dark:text-[#FDA29B] text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.integrations.map((int) => (
            <div key={int.id} className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-5 space-y-3 shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-[#F3F4F6]">{int.name}</h2>
                  <p className="text-xs text-[#5E6572] dark:text-[#9CA3AF] mt-1 leading-relaxed">{int.description}</p>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                    int.enabled
                      ? 'bg-[#ECF7F1] dark:bg-[#102A1F] border-[#BCE3CE] dark:border-[#1F4E3A] text-[#1F764D] dark:text-[#6EE7B7]'
                      : 'bg-[#F3F4F6] dark:bg-[#181B22] border-[#E2E5EA] dark:border-white/[0.12] text-[#5E6572] dark:text-[#9CA3AF]'
                  }`}
                >
                  {int.status}
                </span>
              </div>

              <div className="text-xs font-mono text-[#5E6572] dark:text-[#9CA3AF] space-y-1 pt-2 border-t border-[#EFF1F4] dark:border-[#1B1F28]">
                <div>Endpoint: {int.endpointUrl}</div>
                <div>Secret Ref: {int.secretRef}</div>
                <div>Scope: {int.scopeNote}</div>
                <div className="tabular-nums">Last Sync: {new Date(int.lastSyncAt).toLocaleString()}</div>
              </div>

              {isAdmin && (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await api.updateIntegration(int.id, { enabled: !int.enabled });
                      await onRefresh();
                    }}
                    className="h-8 px-3.5 bg-white dark:bg-[#161922] border border-[#D8DCE3] dark:border-white/[0.12] hover:bg-[#ECEEF2] dark:hover:bg-[#1D212A] text-[#111215] dark:text-[#F3F4F6] rounded-full text-xs font-medium"
                  >
                    {int.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.updateIntegration(int.id, { rotateSecret: true });
                      await onRefresh();
                      setWebhookStatusMsg(`Rotated credential reference for ${int.name}.`);
                    }}
                    className="h-8 px-3.5 bg-white dark:bg-[#161922] border border-[#D8DCE3] dark:border-white/[0.12] hover:bg-[#ECEEF2] dark:hover:bg-[#1D212A] text-[#111215] dark:text-[#F3F4F6] rounded-full text-xs font-medium inline-flex items-center gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Rotate Secret Ref</span>
                  </button>
                  {int.webhookSecretSet && (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          setError(null);
                          const res = await api.testWebhook(int.id, { deliveryId: 'demo-replay-001' });
                          setWebhookStatusMsg(`${int.name}: ${res.message}`);
                          await onRefresh();
                        }}
                        className="h-8 px-3.5 bg-[#111215] hover:bg-[#262930] dark:bg-[#F3F4F6] dark:hover:bg-[#D8D8D8] text-white dark:text-[#0B0C0E] rounded-full text-xs font-medium inline-flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Test Idempotent Replay</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setWebhookStatusMsg(null);
                          try {
                            await api.testWebhook(int.id, { simulateInvalidSignature: true });
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Rejected');
                            await onRefresh();
                          }
                        }}
                        className="h-8 px-3.5 bg-white dark:bg-[#161922] border border-[#F5C6C2] dark:border-[#5E2325] text-[#B42318] dark:text-[#FDA29B] hover:bg-[#FEF0EE] dark:hover:bg-[#2E1314] rounded-full text-xs font-medium"
                      >
                        Test Bad Signature
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-[#F3F4F6] tracking-tight">Security & Audit Log</h1>
          <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
            Append-only audit trail with correlation IDs for authentication, access, visibility, and integration events
          </p>
        </div>
        {data.auditEvents.length > 0 && (
          <button
            type="button"
            onClick={() => api.exportAudit()}
            className="h-10 sm:h-9 px-4 bg-white dark:bg-[#161922] border border-[#D8DCE3] dark:border-white/[0.12] hover:bg-[#ECEEF2] dark:hover:bg-[#1D212A] text-[#111215] dark:text-[#F3F4F6] text-xs font-medium rounded-full inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Audit JSON</span>
          </button>
        )}
      </div>

      {data.auditEvents.length === 0 ? (
        <div className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-8 text-center text-xs text-[#5E6572] dark:text-[#9CA3AF]">
          <Shield className="w-6 h-6 text-[#5E6572] dark:text-[#9CA3AF] mx-auto mb-2" />
          Audit logs are restricted to Workspace Owners, Workspace Administrators, and Programme Managers.
        </div>
      ) : (
        <>
          {/* Mobile Audit Cards */}
          <div className="md:hidden space-y-2.5">
            {data.auditEvents.map((ev) => (
              <div key={ev.id} className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-[#111215] dark:text-[#F3F4F6]">{ev.action}</span>
                  <span
                    className={`font-medium ${
                      ev.result === 'success' ? 'text-[#1F764D] dark:text-[#6EE7B7]' : 'text-[#B42318] dark:text-[#FDA29B]'
                    }`}
                  >
                    {ev.result}
                  </span>
                </div>
                <p className="text-[#111215] dark:text-[#E5E7EB] leading-relaxed">{ev.details}</p>
                <div className="text-[11px] font-mono text-[#5E6572] dark:text-[#9CA3AF] space-y-0.5 break-all">
                  <div>Actor: {ev.actorName} · Target: {ev.targetType}:{ev.targetId}</div>
                  <div>{new Date(ev.timestamp).toLocaleString()} · {ev.correlationId}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Audit Table */}
          <div className="hidden md:block bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-x-auto shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
            <table className="w-full text-left border-collapse min-w-[860px]">
              <thead>
                <tr className="bg-[#F8F9FA] dark:bg-[#161922] border-b border-[#E2E5EA] dark:border-white/[0.08] text-[11px] font-semibold text-[#5E6572] dark:text-[#9CA3AF]">
                  <th className="py-3 px-5">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target</th>
                  <th className="py-3 px-4">Result</th>
                  <th className="py-3 px-4">Correlation ID</th>
                  <th className="py-3 px-5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFF1F4] dark:divide-white/[0.06] text-xs">
                {data.auditEvents.map((ev) => (
                  <tr key={ev.id} className="h-11">
                    <td className="py-2 px-5 font-mono text-[11px] text-[#5E6572] dark:text-[#9CA3AF] tabular-nums whitespace-nowrap">
                      {new Date(ev.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 px-4 font-medium text-[#111215] dark:text-[#F3F4F6] whitespace-nowrap">{ev.actorName}</td>
                    <td className="py-2 px-4 font-mono font-semibold text-[#111215] dark:text-[#F3F4F6] whitespace-nowrap">{ev.action}</td>
                    <td className="py-2 px-4 font-mono text-[#5E6572] dark:text-[#9CA3AF] whitespace-nowrap">
                      {ev.targetType}:{ev.targetId}
                    </td>
                    <td className="py-2 px-4 whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          ev.result === 'success' ? 'text-[#1F764D] dark:text-[#6EE7B7]' : 'text-[#B42318] dark:text-[#FDA29B]'
                        }`}
                      >
                        {ev.result}
                      </span>
                    </td>
                    <td className="py-2 px-4 font-mono text-[11px] text-[#5E6572] dark:text-[#9CA3AF] whitespace-nowrap">
                      {ev.correlationId}
                    </td>
                    <td className="py-2 px-5 text-[#111215] dark:text-[#E5E7EB] max-w-[320px] truncate">{ev.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
