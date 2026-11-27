import { ArrowRight, Calendar, FolderKanban, GitBranch, Milestone as MilestoneIcon } from 'lucide-react';
import type { WorkspaceBootstrapData } from '../lib/api.ts';
import type { WorkPackage } from '../types/workspace.ts';
import { HealthLabel, PriorityLabel, StatusLabel, UserAvatar } from './StatusLabel.tsx';

interface OverviewDashboardProps {
  data: WorkspaceBootstrapData;
  selectedProjectId: string;
  onSelectWorkPackage: (wp: WorkPackage) => void;
  onNavigate: (nav: string, projectId?: string) => void;
  onCreateWorkPackage: () => void;
}

const REFERENCE_TODAY = '2026-11-26';

export function OverviewDashboard({
  data,
  selectedProjectId,
  onSelectWorkPackage,
  onNavigate,
  onCreateWorkPackage,
}: OverviewDashboardProps) {
  const scopedWork = selectedProjectId
    ? data.workPackages.filter((w) => w.projectId === selectedProjectId)
    : data.workPackages;

  const scopedMilestones = selectedProjectId
    ? data.milestones.filter((m) => m.projectId === selectedProjectId)
    : data.milestones;

  const activeProjects = data.projects.filter((p) => p.status === 'Active');
  const openWork = scopedWork.filter(
    (w) => w.status !== 'Closed' && w.status !== 'Accepted' && w.status !== 'Cancelled'
  );
  const completedWork = scopedWork.filter(
    (w) => w.status === 'Accepted' || w.status === 'Closed'
  );
  const blockedWork = scopedWork.filter((w) => w.status === 'Blocked');
  const overdueWork = openWork.filter((w) => w.dueDate < REFERENCE_TODAY);
  const activeMembers = data.users.filter((u) => u.state === 'active');

  const myWork = scopedWork.filter(
    (w) =>
      (w.ownerId === data.currentUser.id ||
        w.assigneeIds.includes(data.currentUser.id) ||
        w.reviewerId === data.currentUser.id) &&
      w.status !== 'Closed'
  );

  const backlogPreview = scopedWork.filter(
    (w) => w.status === 'Draft' || w.status === 'Backlog' || w.status === 'Ready'
  );

  const boardColumns: Array<{ label: string; statuses: WorkPackage['status'][] }> = [
    { label: 'Ready', statuses: ['Ready'] },
    { label: 'In Progress', statuses: ['In Progress'] },
    { label: 'In Review / QA', statuses: ['In Review', 'Verification'] },
    { label: 'Blocked', statuses: ['Blocked'] },
  ];

  const timelineStart = new Date('2026-11-01T00:00:00Z').getTime();
  const timelineEnd = new Date('2026-12-20T00:00:00Z').getTime();
  const totalSpan = timelineEnd - timelineStart;
  const ganttRows = scopedWork.slice(0, 7);

  const getUserName = (id: string) =>
    data.users.find((u) => u.id === id)?.displayName || 'Unassigned';

  const getProjectKey = (id: string) =>
    data.projects.find((p) => p.id === id)?.key || 'TRV';

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-white tracking-tight">
            Programme Overview
          </h1>
          <p className="text-xs sm:text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-1">
            {data.workspace.programmeTitle} · Canonical delivery health, timeline dependencies, and engineering activity
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onNavigate('gantt')}
            className="flex-1 sm:flex-initial h-9 px-3.5 text-xs font-medium text-[#111215] dark:text-[#E5E7EB] bg-white dark:bg-[#111318] border border-[#E5E7EB] dark:border-white/[0.1] rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-white/[0.06] transition-colors whitespace-nowrap"
          >
            Open Full Gantt
          </button>
          {data.currentUser.role !== 'Read-only Observer' && (
            <button
              type="button"
              onClick={onCreateWorkPackage}
              className="flex-1 sm:flex-initial h-9 px-4 text-xs font-medium text-white dark:text-[#0B0C0E] bg-[#111215] hover:bg-[#262930] dark:bg-white dark:hover:bg-[#E5E7EB] rounded-lg transition-colors whitespace-nowrap"
            >
              New Work Package
            </button>
          )}
        </div>
      </div>

      {/* Unified 6-Column Metric Strip */}
      <section
        aria-label="Programme summary metrics"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 bg-white dark:bg-[#111318] border border-[#E5E7EB] dark:border-white/[0.08] rounded-xl overflow-hidden divide-x divide-y lg:divide-y-0 divide-[#E5E7EB] dark:divide-white/[0.08]"
      >
        {[
          {
            label: 'Active Projects',
            value: activeProjects.length,
            sub: `${data.projects.filter((p) => p.health === 'at_risk').length} at risk`,
            onClick: () => onNavigate('projects'),
          },
          {
            label: 'Open Work Packages',
            value: openWork.length,
            sub: `${scopedWork.filter((w) => w.status === 'In Progress').length} in progress`,
            onClick: () => onNavigate('work-packages'),
          },
          {
            label: 'Completed Period',
            value: completedWork.length,
            sub: 'Accepted & closed',
            tone: 'text-[#1F764D] dark:text-[#6EE7B7]',
            onClick: () => onNavigate('reports'),
          },
          {
            label: 'Blocked',
            value: blockedWork.length,
            sub: blockedWork.length > 0 ? 'Requires owner review' : 'No active blockers',
            tone: blockedWork.length > 0 ? 'text-[#B42318] dark:text-[#FDA29B]' : 'text-[#111215] dark:text-white',
            onClick: () => onNavigate('work-packages'),
          },
          {
            label: 'Overdue',
            value: overdueWork.length,
            sub: `Before ${REFERENCE_TODAY}`,
            tone: overdueWork.length > 0 ? 'text-[#B42318] dark:text-[#FDA29B]' : 'text-[#111215] dark:text-white',
            onClick: () => onNavigate('calendar'),
          },
          {
            label: 'Directory Seats',
            value: `${activeMembers.length}/${data.maxSlots}`,
            sub: `${data.teams.length} teams active`,
            onClick: () => onNavigate('members'),
          },
        ].map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={kpi.onClick}
            className="text-left p-4 hover:bg-[#F9FAFB] dark:hover:bg-white/[0.03] transition-colors"
          >
            <div className="text-[11px] font-medium text-[#5E6572] dark:text-[#9CA3AF] truncate">{kpi.label}</div>
            <div className={`mt-1.5 text-2xl font-display font-semibold tabular-nums ${kpi.tone || 'text-[#111215] dark:text-white'}`}>
              {kpi.value}
            </div>
            <div className="mt-1 text-[11px] text-[#6B7280] dark:text-[#6B7280] truncate">{kpi.sub}</div>
          </button>
        ))}
      </section>

      {/* Main Timeline / Gantt + Roadmap & Milestones */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <section
          aria-label="Timeline and dependency overview"
          className="xl:col-span-8 bg-white dark:bg-[#111318] border border-[#E5E7EB] dark:border-white/[0.08] rounded-xl overflow-hidden flex flex-col"
        >
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] dark:border-white/[0.08] flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-white">
                Programme Timeline & Dependencies
              </h2>
              <p className="text-xs text-[#5E6572] dark:text-[#9CA3AF]">
                Nov 01 – Dec 20, 2026 · {data.dependencies.length} directed edges tracked
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('gantt')}
              className="text-xs font-medium text-[#111215] dark:text-[#E5E7EB] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>Full Gantt</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="md:hidden divide-y divide-[#F1F3F5] dark:divide-white/[0.06]">
            {ganttRows.map((wp) => {
              const s = Math.max(timelineStart, new Date(wp.startDate + 'T00:00:00Z').getTime());
              const e = Math.min(timelineEnd, new Date(wp.dueDate + 'T00:00:00Z').getTime());
              const leftPct = Math.max(0, Math.min(86, ((s - timelineStart) / totalSpan) * 100));
              const widthPct = Math.max(
                10,
                Math.min(100 - leftPct, ((Math.max(e, s + 86400000) - s) / totalSpan) * 100)
              );
              const barColor =
                wp.status === 'Blocked'
                  ? 'bg-[#B42318] dark:bg-[#F97066]'
                  : wp.status === 'Accepted' || wp.status === 'Closed'
                  ? 'bg-[#1F764D] dark:bg-[#34D399]'
                  : wp.status === 'In Review' || wp.status === 'Verification'
                  ? 'bg-[#B57C0A] dark:bg-[#FBBF24]'
                  : 'bg-[#111215] dark:bg-white';

              return (
                <button
                  key={wp.id}
                  type="button"
                  onClick={() => onSelectWorkPackage(wp)}
                  className="w-full text-left px-4 py-3 space-y-2 hover:bg-[#F9FAFB] dark:hover:bg-white/[0.03]"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-semibold text-[#111215] dark:text-white">{wp.key}</span>
                    <span className="text-[11px] font-mono tabular-nums text-[#5E6572] dark:text-[#9CA3AF]">
                      {wp.startDate.slice(5)} → {wp.dueDate.slice(5)}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-[#111215] dark:text-[#E5E7EB] truncate">{wp.title}</div>
                  <div className="w-full h-1.5 bg-[#ECEEF2] dark:bg-white/[0.08] rounded-full relative">
                    <div style={{ left: `${leftPct}%`, width: `${widthPct}%` }} className={`absolute top-0 h-1.5 rounded-full ${barColor}`} />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-12 px-5 py-2.5 bg-[#F9FAFB] dark:bg-white/[0.03] border-b border-[#E5E7EB] dark:border-white/[0.08] text-[11px] font-medium text-[#5E6572] dark:text-[#9CA3AF] tabular-nums">
                <div className="col-span-5">Work Package</div>
                <div className="col-span-7 grid grid-cols-5 text-center">
                  <span>Nov 01</span>
                  <span>Nov 15</span>
                  <span className="text-[#111215] dark:text-white font-semibold">Nov 26</span>
                  <span>Dec 08</span>
                  <span>Dec 20</span>
                </div>
              </div>

              <div className="divide-y divide-[#F1F3F5] dark:divide-white/[0.06] relative">
                {ganttRows.map((wp) => {
                  const s = Math.max(timelineStart, new Date(wp.startDate + 'T00:00:00Z').getTime());
                  const e = Math.min(timelineEnd, new Date(wp.dueDate + 'T00:00:00Z').getTime());
                  const leftPct = Math.max(0, Math.min(90, ((s - timelineStart) / totalSpan) * 100));
                  const widthPct = Math.max(
                    8,
                    Math.min(100 - leftPct, ((Math.max(e, s + 86400000) - s) / totalSpan) * 100)
                  );
                  const barColor =
                    wp.status === 'Blocked'
                      ? 'bg-[#B42318] dark:bg-[#F97066]'
                      : wp.status === 'Accepted' || wp.status === 'Closed'
                      ? 'bg-[#1F764D] dark:bg-[#34D399]'
                      : wp.status === 'In Review' || wp.status === 'Verification'
                      ? 'bg-[#B57C0A] dark:bg-[#FBBF24]'
                      : 'bg-[#111215] dark:bg-[#E5E7EB]';

                  const blockers = data.dependencies.filter(
                    (d) => d.successorId === wp.id && d.type === 'blocks'
                  );

                  return (
                    <div
                      key={wp.id}
                      onClick={() => onSelectWorkPackage(wp)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault();
                          onSelectWorkPackage(wp);
                        }
                      }}
                      className="grid grid-cols-12 items-center px-5 py-3 hover:bg-[#F9FAFB] dark:hover:bg-white/[0.03] cursor-pointer transition-colors"
                    >
                      <div className="col-span-5 pr-3 min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-semibold text-[#111215] dark:text-white shrink-0">
                            {wp.key}
                          </span>
                          <span className="text-[#111215] dark:text-[#E5E7EB] font-medium truncate">{wp.title}</span>
                        </div>
                        <div className="text-[11px] text-[#5E6572] dark:text-[#9CA3AF] mt-0.5 flex items-center gap-1.5 tabular-nums">
                          <span>{wp.status}</span>
                          <span aria-hidden="true">·</span>
                          <span>Due {wp.dueDate}</span>
                          {blockers.length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#B42318] dark:text-[#FDA29B] inline-flex items-center gap-0.5">
                                <GitBranch className="w-3 h-3" aria-hidden="true" />
                                {blockers.length} pred
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="col-span-7 relative h-6 flex items-center">
                        <div className="w-full h-2 bg-[#ECEEF2] dark:bg-white/[0.07] rounded-full relative">
                          <div
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            className={`absolute top-1/2 -translate-y-1/2 h-2.5 rounded-full ${barColor}`}
                            title={`${wp.key}: ${wp.startDate} to ${wp.dueDate} (${wp.status})`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Roadmap & Milestones */}
        <section
          aria-label="Roadmap and milestones"
          className="xl:col-span-4 bg-white dark:bg-[#111318] border border-[#E5E7EB] dark:border-white/[0.08] rounded-xl overflow-hidden flex flex-col"
        >
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] dark:border-white/[0.08] flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-white">
                Roadmap & Milestones
              </h2>
              <p className="text-xs text-[#5E6572] dark:text-[#9CA3AF]">Target windows & delivery confidence</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('roadmap')}
              className="text-xs font-medium text-[#111215] dark:text-[#E5E7EB] hover:underline whitespace-nowrap"
            >
              View Roadmap
            </button>
          </div>
          <div className="divide-y divide-[#F1F3F5] dark:divide-white/[0.06] flex-1">
            {scopedMilestones.map((ms) => (
              <div key={ms.id} className="px-5 py-3.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#111215] dark:text-white">
                    <MilestoneIcon className="w-3.5 h-3.5 text-[#5E6572] dark:text-[#9CA3AF] shrink-0" aria-hidden="true" />
                    <span className="truncate">{ms.title}</span>
                  </div>
                  <div className="text-[11px] text-[#5E6572] dark:text-[#9CA3AF] mt-1 flex items-center gap-1.5 tabular-nums">
                    <span className="font-mono">{getProjectKey(ms.projectId)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{ms.targetDate}</span>
                    <span aria-hidden="true">·</span>
                    <span>{getUserName(ms.ownerId)}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`text-xs font-mono font-semibold tabular-nums ${
                      ms.state === 'Achieved'
                        ? 'text-[#1F764D] dark:text-[#6EE7B7]'
                        : ms.state === 'At Risk'
                        ? 'text-[#9B6B08] dark:text-[#FCD34D]'
                        : 'text-[#111215] dark:text-white'
                    }`}
                  >
                    {ms.confidence}%
                  </div>
                  <div className="text-[11px] text-[#5E6572] dark:text-[#9CA3AF]">{ms.state}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Kanban Board Preview (Flat Hairline Lanes — Zero Nested Card Boxes) + Backlog Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <section
          aria-label="Board preview"
          className="xl:col-span-7 bg-white dark:bg-[#111318] border border-[#E5E7EB] dark:border-white/[0.08] rounded-xl overflow-hidden flex flex-col"
        >
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] dark:border-white/[0.08] flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-white">
                Execution Board Preview
              </h2>
              <p className="text-xs text-[#5E6572] dark:text-[#9CA3AF]">Canonical work packages across active stages</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('boards')}
              className="text-xs font-medium text-[#111215] dark:text-[#E5E7EB] hover:underline whitespace-nowrap"
            >
              Open Board
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-[#E5E7EB] dark:divide-white/[0.08] flex-1">
            {boardColumns.map((col) => {
              const items = scopedWork.filter((w) => col.statuses.includes(w.status));
              return (
                <div key={col.label} className="p-3 bg-[#FAFAFB] dark:bg-white/[0.015] flex flex-col gap-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#E5E7EB] dark:border-white/[0.07]">
                    <span className="text-[11px] font-semibold text-[#111215] dark:text-[#E5E7EB]">{col.label}</span>
                    <span className="text-[11px] font-mono text-[#5E6572] dark:text-[#9CA3AF] tabular-nums">
                      {items.length}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {items.slice(0, 3).map((wp) => (
                      <button
                        key={wp.id}
                        type="button"
                        onClick={() => onSelectWorkPackage(wp)}
                        className="w-full text-left p-2.5 bg-white dark:bg-[#151821] border border-[#E5E7EB] dark:border-white/[0.08] rounded-lg hover:border-[#111215]/30 dark:hover:border-white/25 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-1.5 text-[11px]">
                          <span className="font-mono font-semibold text-[#111215] dark:text-white">{wp.key}</span>
                          <PriorityLabel priority={wp.priority} />
                        </div>
                        <div className="mt-1 text-xs font-medium text-[#111215] dark:text-[#E5E7EB] line-clamp-2">
                          {wp.title}
                        </div>
                        <div className="mt-1.5 text-[11px] text-[#5E6572] dark:text-[#9CA3AF] truncate">
                          {getUserName(wp.ownerId)}
                        </div>
                      </button>
                    ))}
                    {items.length === 0 && (
                      <div className="text-xs text-[#5E6572] dark:text-[#6B7280] py-6 text-center">No items</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Backlog Preview */}
        <section
          aria-label="Backlog preview"
          className="xl:col-span-5 bg-white dark:bg-[#111318] border border-[#E5E7EB] dark:border-white/[0.08] rounded-xl overflow-hidden flex flex-col"
        >
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] dark:border-white/[0.08] flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-white">
                Prioritized Backlog
              </h2>
              <p className="text-xs text-[#5E6572] dark:text-[#9CA3AF]">Draft, backlog, and ready items</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('backlog')}
              className="text-xs font-medium text-[#111215] dark:text-[#E5E7EB] hover:underline whitespace-nowrap"
            >
              Open Backlog
            </button>
          </div>
          <div className="divide-y divide-[#F1F3F5] dark:divide-white/[0.06] flex-1">
            {backlogPreview.slice(0, 5).map((wp) => (
              <button
                key={wp.id}
                type="button"
                onClick={() => onSelectWorkPackage(wp)}
                className="w-full text-left px-5 py-3 hover:bg-[#F9FAFB] dark:hover:bg-white/[0.03] transition-colors flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-semibold text-[#111215] dark:text-white">{wp.key}</span>
                    <span className="text-[#111215] dark:text-[#E5E7EB] font-medium truncate">{wp.title}</span>
                  </div>
                  <div className="text-[11px] text-[#5E6572] dark:text-[#9CA3AF] mt-0.5 flex items-center gap-1.5">
                    <span>{getUserName(wp.ownerId)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums font-mono">{wp.estimateHours}h est</span>
                  </div>
                </div>
                <StatusLabel status={wp.status} />
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* My Assigned Work + Recent Activity Feed + Project Health */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section
          aria-label="My assigned work"
          className="lg:col-span-5 bg-white dark:bg-[#111318] border border-[#E5E7EB] dark:border-white/[0.08] rounded-xl overflow-hidden"
        >
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] dark:border-white/[0.08] flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-white">
              My Work & Upcoming Deadlines
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('my-work')}
              className="text-xs font-medium text-[#111215] dark:text-[#E5E7EB] hover:underline"
            >
              View All
            </button>
          </div>
          <div className="divide-y divide-[#F1F3F5] dark:divide-white/[0.06]">
            {myWork.slice(0, 5).map((wp) => (
              <button
                key={wp.id}
                type="button"
                onClick={() => onSelectWorkPackage(wp)}
                className="w-full text-left px-5 py-3 hover:bg-[#F9FAFB] dark:hover:bg-white/[0.03] flex items-center justify-between gap-3 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-semibold text-[#111215] dark:text-white">{wp.key}</span>
                    <span className="font-medium text-[#111215] dark:text-[#E5E7EB] truncate">{wp.title}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#5E6572] dark:text-[#9CA3AF] flex items-center gap-1.5 tabular-nums">
                    <Calendar className="w-3 h-3" aria-hidden="true" />
                    <span>Due {wp.dueDate}</span>
                    <span aria-hidden="true">·</span>
                    <PriorityLabel priority={wp.priority} />
                  </div>
                </div>
                <StatusLabel status={wp.status} />
              </button>
            ))}
            {myWork.length === 0 && (
              <div className="p-6 text-center text-xs text-[#5E6572] dark:text-[#9CA3AF]">
                No open items currently assigned to {data.currentUser.displayName}.
              </div>
            )}
          </div>
        </section>

        <section
          aria-label="Recent activity"
          className="lg:col-span-4 bg-white dark:bg-[#111318] border border-[#E5E7EB] dark:border-white/[0.08] rounded-xl overflow-hidden"
        >
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] dark:border-white/[0.08] flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-white">Recent Activity</h2>
            <button
              type="button"
              onClick={() => onNavigate('activity')}
              className="text-xs font-medium text-[#111215] dark:text-[#E5E7EB] hover:underline"
            >
              Full Log
            </button>
          </div>
          <div className="divide-y divide-[#F1F3F5] dark:divide-white/[0.06]">
            {data.activityEvents.slice(0, 5).map((act) => {
              const actor = getUserName(act.actorId);
              return (
                <div key={act.id} className="px-5 py-3 text-xs">
                  <div className="flex items-start gap-2.5">
                    <UserAvatar name={actor} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[#111215] dark:text-[#E5E7EB] leading-snug">
                        <span className="font-medium">{actor}</span> {act.action}{' '}
                        <button
                          type="button"
                          onClick={() => {
                            if (act.resourceType === 'work_package') {
                              const found = data.workPackages.find((w) => w.id === act.resourceId);
                              if (found) onSelectWorkPackage(found);
                            } else if (act.resourceType === 'document') {
                              onNavigate('documents');
                            } else if (act.resourceType === 'project') {
                              onNavigate('projects', act.resourceId);
                            }
                          }}
                          className="font-mono font-semibold text-[#111215] dark:text-white underline decoration-[#D8D8D8] dark:decoration-[#5E6572] hover:decoration-[#111215] dark:hover:decoration-white"
                        >
                          {act.resourceKey || act.resourceTitle}
                        </button>
                      </p>
                      <p className="text-[#5E6572] dark:text-[#9CA3AF] mt-0.5 line-clamp-1">{act.summary}</p>
                      <p className="text-[11px] text-[#7D8490] dark:text-[#6B7280] mt-0.5 tabular-nums font-mono">
                        {new Date(act.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section
          aria-label="Project portfolio health"
          className="lg:col-span-3 bg-white dark:bg-[#111318] border border-[#E5E7EB] dark:border-white/[0.08] rounded-xl overflow-hidden"
        >
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] dark:border-white/[0.08] flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-white">Portfolio Health</h2>
            <button
              type="button"
              onClick={() => onNavigate('projects')}
              className="text-xs font-medium text-[#111215] dark:text-[#E5E7EB] hover:underline"
            >
              Projects
            </button>
          </div>
          <div className="divide-y divide-[#F1F3F5] dark:divide-white/[0.06]">
            {data.projects.map((proj) => (
              <button
                key={proj.id}
                type="button"
                onClick={() => onNavigate('projects', proj.id)}
                className="w-full text-left px-5 py-3.5 hover:bg-[#F9FAFB] dark:hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111215] dark:text-white truncate">
                    <FolderKanban className="w-3.5 h-3.5 text-[#5E6572] dark:text-[#9CA3AF] shrink-0" aria-hidden="true" />
                    <span className="font-mono">{proj.key}</span>
                    <span className="truncate">{proj.name}</span>
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <HealthLabel health={proj.health} />
                  <span className="text-[11px] text-[#5E6572] dark:text-[#9CA3AF] capitalize">{proj.visibility}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
