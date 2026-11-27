import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  BookmarkPlus,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FolderKanban,
  GitBranch,
  Lock,
  Milestone as MilestoneIcon,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { api, type WorkspaceBootstrapData } from '../lib/api.ts';
import type {
  Milestone,
  Project,
  ProjectHealth,
  ProjectVisibility,
  WorkPackage,
  WorkPackageStatus,
} from '../types/workspace.ts';
import { formatWorkType, HealthLabel, PriorityLabel, StatusLabel, UserAvatar } from './StatusLabel.tsx';
import type { ToastMessage } from './ToastAndDialogs.tsx';

interface WorkViewsProps {
  section:
    | 'my-work'
    | 'projects'
    | 'work-packages'
    | 'boards'
    | 'backlog'
    | 'gantt'
    | 'roadmap'
    | 'calendar';
  data: WorkspaceBootstrapData;
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;
  onSelectWorkPackage: (wp: WorkPackage) => void;
  onCreateWorkPackage: () => void;
  onRefresh: () => Promise<void>;
  onNavigate: (section: string) => void;
  onNotify?: (tone: ToastMessage['tone'], title: string, detail?: string) => void;
}

const BOARD_COLUMNS: WorkPackageStatus[] = [
  'Backlog',
  'Ready',
  'In Progress',
  'In Review',
  'Verification',
  'Accepted',
  'Blocked',
];

const ALL_STATUSES: WorkPackageStatus[] = [
  'Draft',
  'Backlog',
  'Ready',
  'In Progress',
  'In Review',
  'Verification',
  'Accepted',
  'Closed',
  'Blocked',
];

export function WorkViews({
  section,
  data,
  selectedProjectId,
  onSelectProject,
  onSelectWorkPackage,
  onCreateWorkPackage,
  onRefresh,
  onNavigate,
  onNotify,
}: WorkViewsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [quickFilter, setQuickFilter] = useState<'none' | 'my' | 'overdue' | 'high_risk'>('none');
  const [sortField, setSortField] = useState<'key' | 'priority' | 'status' | 'dueDate' | 'estimateHours'>('key');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedWpIds, setSelectedWpIds] = useState<string[]>([]);
  const [swimlaneBy, setSwimlaneBy] = useState<'none' | 'project' | 'owner'>('none');
  const [mobileBoardCol, setMobileBoardCol] = useState<WorkPackageStatus>('In Progress');
  const [ganttZoom, setGanttZoom] = useState<'6w' | '10w'>('6w');
  const [calendarMonth, setCalendarMonth] = useState<number>(10);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewMilestone, setShowNewMilestone] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // New Project state
  const [projKey, setProjKey] = useState('');
  const [projName, setProjName] = useState('');
  const [projObjective, setProjObjective] = useState('');
  const [projVisibility, setProjVisibility] = useState<ProjectVisibility>('internal');

  // Edit Project state
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjName, setEditProjName] = useState('');
  const [editProjObjective, setEditProjObjective] = useState('');
  const [editProjStatus, setEditProjStatus] = useState<Project['status']>('Active');
  const [editProjHealth, setEditProjHealth] = useState<ProjectHealth>('on_track');
  const [editProjHealthNote, setEditProjHealthNote] = useState('');
  const [editProjVisibility, setEditProjVisibility] = useState<ProjectVisibility>('internal');
  const [editProjTargetDate, setEditProjTargetDate] = useState('');
  const [editProjMembers, setEditProjMembers] = useState<string[]>([]);

  // New Milestone state
  const [msProjectId, setMsProjectId] = useState(data.projects[0]?.id || '');
  const [msTitle, setMsTitle] = useState('');
  const [msDate, setMsDate] = useState('2026-12-22');
  const [msConfidence, setMsConfidence] = useState(80);

  // Edit Milestone state
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [editMsTitle, setEditMsTitle] = useState('');
  const [editMsDate, setEditMsDate] = useState('');
  const [editMsState, setEditMsState] = useState<Milestone['state']>('Planned');
  const [editMsConfidence, setEditMsConfidence] = useState(80);
  const [editMsDescription, setEditMsDescription] = useState('');

  const canManageProjects = ['Workspace Owner', 'Workspace Administrator', 'Programme Manager', 'Project Manager'].includes(
    data.currentUser.role
  );
  const canEditWork =
    data.currentUser.role !== 'Read-only Observer';
  const isAdmin =
    data.currentUser.role === 'Workspace Owner' ||
    data.currentUser.role === 'Workspace Administrator';

  const scopedWork = selectedProjectId
    ? data.workPackages.filter((w) => w.projectId === selectedProjectId)
    : data.workPackages;

  const getUserName = (id?: string | null) =>
    data.users.find((u) => u.id === id)?.displayName || 'Unassigned';

  async function handleQuickTransition(wp: WorkPackage, nextStatus: WorkPackageStatus) {
    setActionError(null);
    try {
      await api.updateWorkPackage(wp.id, { status: nextStatus, version: wp.version });
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Transition blocked.');
    }
  }

  async function handleSaveViewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!saveViewName.trim()) return;
    setActionError(null);
    try {
      await api.createSavedView({
        name: saveViewName.trim(),
        filters: {
          status: statusFilter !== 'ALL' ? [statusFilter] : undefined,
          priority: priorityFilter !== 'ALL' ? [priorityFilter] : undefined,
          onlyBlocked,
        },
      });
      setSaveViewName('');
      setSaveViewOpen(false);
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not save view.');
    }
  }

  async function handleDeleteSavedView(id: string) {
    setActionError(null);
    try {
      await api.deleteSavedView(id);
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not remove saved view.');
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    try {
      const created = await api.createProject({
        key: projKey,
        name: projName,
        objective: projObjective,
        visibility: projVisibility,
      });
      setShowNewProject(false);
      setProjKey('');
      setProjName('');
      setProjObjective('');
      await onRefresh();
      onSelectProject(created.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not create project.');
    }
  }

  function startEditProject(proj: Project) {
    setActionError(null);
    setEditingProjectId(proj.id);
    setEditProjName(proj.name);
    setEditProjObjective(proj.objective);
    setEditProjStatus(proj.status);
    setEditProjHealth(proj.health);
    setEditProjHealthNote(proj.healthNote);
    setEditProjVisibility(proj.visibility);
    setEditProjTargetDate(proj.targetDate);
    setEditProjMembers(proj.memberIds);
  }

  async function handleUpdateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProjectId) return;
    setActionError(null);
    try {
      await api.updateProject(editingProjectId, {
        name: editProjName,
        objective: editProjObjective,
        status: editProjStatus,
        health: editProjHealth,
        healthNote: editProjHealthNote,
        visibility: editProjVisibility,
        targetDate: editProjTargetDate,
        memberIds: editProjMembers,
      });
      setEditingProjectId(null);
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update project.');
    }
  }

  async function handleCreateMilestone(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    try {
      await api.createMilestone({
        projectId: msProjectId,
        title: msTitle,
        targetDate: msDate,
        confidence: msConfidence,
      });
      setShowNewMilestone(false);
      setMsTitle('');
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not create milestone.');
    }
  }

  function startEditMilestone(ms: Milestone) {
    setActionError(null);
    setEditingMilestoneId(ms.id);
    setEditMsTitle(ms.title);
    setEditMsDate(ms.targetDate);
    setEditMsState(ms.state);
    setEditMsConfidence(ms.confidence);
    setEditMsDescription(ms.description);
  }

  async function handleUpdateMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!editingMilestoneId) return;
    setActionError(null);
    try {
      await api.updateMilestone(editingMilestoneId, {
        title: editMsTitle,
        targetDate: editMsDate,
        state: editMsState,
        confidence: editMsConfidence,
        description: editMsDescription,
      });
      setEditingMilestoneId(null);
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update milestone.');
    }
  }

  // --- 1. MY WORK ---
  if (section === 'my-work') {
    const owned = scopedWork.filter((w) => w.ownerId === data.currentUser.id);
    const reviewQueue = scopedWork.filter(
      (w) =>
        (w.status === 'In Review' || w.status === 'Verification') &&
        (w.reviewerId === data.currentUser.id || data.currentUser.role === 'Reviewer / QA')
    );
    const blockersOwned = scopedWork.filter(
      (w) => w.status === 'Blocked' && w.blockerOwnerId === data.currentUser.id
    );

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-[#F3F4F6] tracking-tight">My Work</h1>
            <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
              Personal ownership, review queue, and blockers assigned to {data.currentUser.displayName}
            </p>
          </div>
          {canEditWork && (
            <button
              type="button"
              onClick={onCreateWorkPackage}
              className="h-10 sm:h-9 px-5 bg-[#111215] hover:bg-[#262930] dark:bg-[#F3F4F6] dark:hover:bg-[#D8D8D8] text-white dark:text-[#0B0C0E] text-xs font-medium rounded-full"
            >
              New Work Package
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[
            { title: 'Accountable Owner', items: owned, empty: 'No owned work packages.' },
            { title: 'Awaiting My Review / QA', items: reviewQueue, empty: 'Review queue clear.' },
            { title: 'Blockers Assigned to Me', items: blockersOwned, empty: 'No active blockers assigned.' },
          ].map((group) => (
            <section key={group.title} className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
              <div className="px-5 py-3.5 border-b border-[#E2E5EA] dark:border-white/[0.08] flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-[#F3F4F6]">{group.title}</h2>
                <span className="text-xs font-mono text-[#5E6572] dark:text-[#9CA3AF] tabular-nums">{group.items.length}</span>
              </div>
              <div className="divide-y divide-[#EFF1F4] dark:divide-white/[0.06]">
                {group.items.map((wp) => (
                  <button
                    key={wp.id}
                    type="button"
                    onClick={() => onSelectWorkPackage(wp)}
                    className="w-full text-left px-5 py-3.5 hover:bg-[#F8F9FA] dark:hover:bg-[#14171D] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-[#111215] dark:text-[#F3F4F6]">{wp.key}</span>
                      <StatusLabel status={wp.status} />
                    </div>
                    <div className="text-xs font-medium text-[#111215] dark:text-[#E5E7EB]">{wp.title}</div>
                    <div className="text-[11px] text-[#5E6572] dark:text-[#9CA3AF] flex items-center gap-2 tabular-nums">
                      <span>Due {wp.dueDate}</span>
                      <span aria-hidden="true">·</span>
                      <PriorityLabel priority={wp.priority} />
                    </div>
                  </button>
                ))}
                {group.items.length === 0 && (
                  <div className="p-6 text-center text-xs text-[#5E6572] dark:text-[#9CA3AF]">{group.empty}</div>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  // --- 2. PROJECTS PORTFOLIO & DETAIL ---
  if (section === 'projects') {
    const activeProject: Project | undefined = selectedProjectId
      ? data.projects.find((p) => p.id === selectedProjectId)
      : undefined;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-[#F3F4F6] tracking-tight">
              {activeProject ? `${activeProject.key} · ${activeProject.name}` : 'Projects Portfolio'}
            </h1>
            <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
              {activeProject
                ? activeProject.objective
                : 'Programme charters, visibility boundaries, health assessments, and milestones'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeProject && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProjectId(null);
                    onSelectProject('');
                  }}
                  className="h-10 sm:h-9 px-4 bg-white dark:bg-[#161922] border border-[#E2E5EA] dark:border-white/[0.12] hover:bg-[#ECEEF2] dark:hover:bg-[#1D212A] text-[#111215] dark:text-[#F3F4F6] text-xs font-medium rounded-full"
                >
                  All Projects
                </button>
                {canManageProjects && (
                  <button
                    type="button"
                    onClick={() =>
                      editingProjectId === activeProject.id ? setEditingProjectId(null) : startEditProject(activeProject)
                    }
                    className="h-10 sm:h-9 px-4 bg-white dark:bg-[#161922] border border-[#E2E5EA] dark:border-white/[0.12] hover:bg-[#ECEEF2] dark:hover:bg-[#1D212A] text-[#111215] dark:text-[#F3F4F6] text-xs font-medium rounded-full inline-flex items-center gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>{editingProjectId === activeProject.id ? 'Close Editor' : 'Edit Project'}</span>
                  </button>
                )}
              </>
            )}
            {canManageProjects && (
              <button
                type="button"
                onClick={() => setShowNewProject((v) => !v)}
                className="h-10 sm:h-9 px-5 bg-[#111215] hover:bg-[#262930] dark:bg-[#F3F4F6] dark:hover:bg-[#D8D8D8] text-white dark:text-[#0B0C0E] text-xs font-medium rounded-full inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Project</span>
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <div role="alert" className="p-3.5 rounded-2xl border border-[#F5C6C2] dark:border-[#5E2325] bg-[#FEF0EE] dark:bg-[#2E1314] text-[#B42318] dark:text-[#FDA29B] text-xs">
            {actionError}
          </div>
        )}

        {showNewProject && (
          <form onSubmit={handleCreateProject} className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
            <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-[#F3F4F6]">Create Programme Project</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Key (e.g. DATA)</label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  value={projKey}
                  onChange={(e) => setProjKey(e.target.value)}
                  className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs font-mono uppercase bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Visibility</label>
                <select
                  value={projVisibility}
                  onChange={(e) => setProjVisibility(e.target.value as ProjectVisibility)}
                  className="w-full h-11 sm:h-9 px-2.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                >
                  <option value="internal">Internal (Workspace)</option>
                  <option value="restricted">Restricted (Explicit Members)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Objective</label>
              <input
                type="text"
                required
                value={projObjective}
                onChange={(e) => setProjObjective(e.target.value)}
                className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewProject(false)}
                className="h-10 sm:h-9 px-4 border border-[#D8DCE3] dark:border-white/[0.12] text-[#111215] dark:text-[#E5E7EB] rounded-full text-xs"
              >
                Cancel
              </button>
              <button type="submit" className="h-10 sm:h-9 px-5 bg-[#111215] dark:bg-[#F3F4F6] text-white dark:text-[#0B0C0E] rounded-full text-xs font-medium">
                Create Project
              </button>
            </div>
          </form>
        )}

        {activeProject && editingProjectId === activeProject.id && (
          <form onSubmit={handleUpdateProject} className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
            <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-[#F3F4F6]">
              Edit Project Governance & Health ({activeProject.key})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={editProjName}
                  onChange={(e) => setEditProjName(e.target.value)}
                  className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Status</label>
                <select
                  value={editProjStatus}
                  onChange={(e) => setEditProjStatus(e.target.value as Project['status'])}
                  className="w-full h-11 sm:h-9 px-2.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                >
                  {['Active', 'Planning', 'On Hold', 'Archived'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Health</label>
                <select
                  value={editProjHealth}
                  onChange={(e) => setEditProjHealth(e.target.value as ProjectHealth)}
                  className="w-full h-11 sm:h-9 px-2.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                >
                  <option value="on_track">On Track</option>
                  <option value="at_risk">At Risk</option>
                  <option value="off_track">Off Track</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Visibility Scope</label>
                <select
                  value={editProjVisibility}
                  onChange={(e) => setEditProjVisibility(e.target.value as ProjectVisibility)}
                  className="w-full h-11 sm:h-9 px-2.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                >
                  <option value="internal">Internal (Workspace)</option>
                  <option value="restricted">Restricted (Explicit Members)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Target Date</label>
                <input
                  type="date"
                  value={editProjTargetDate}
                  onChange={(e) => setEditProjTargetDate(e.target.value)}
                  className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs font-mono bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Objective</label>
                <input
                  type="text"
                  required
                  value={editProjObjective}
                  onChange={(e) => setEditProjObjective(e.target.value)}
                  className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Health Assessment Note</label>
              <input
                type="text"
                value={editProjHealthNote}
                onChange={(e) => setEditProjHealthNote(e.target.value)}
                className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
              />
            </div>

            <div>
              <div className="text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1.5">
                Authorized Project Members ({editProjVisibility === 'restricted' ? 'enforced for restricted visibility' : 'participating roster'})
              </div>
              <div className="flex flex-wrap gap-2">
                {data.users.map((u) => {
                  const checked = editProjMembers.includes(u.id) || u.id === activeProject.ownerId;
                  return (
                    <label
                      key={u.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                        checked
                          ? 'bg-[#111215] dark:bg-[#F3F4F6] text-white dark:text-[#0B0C0E] border-[#111215] dark:border-[#F3F4F6]'
                          : 'bg-white dark:bg-[#161922] text-[#111215] dark:text-[#E5E7EB] border-[#D8DCE3] dark:border-white/[0.12]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={u.id === activeProject.ownerId}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditProjMembers((prev) => Array.from(new Set([...prev, u.id])));
                          } else {
                            setEditProjMembers((prev) => prev.filter((id) => id !== u.id));
                          }
                        }}
                        className="sr-only"
                      />
                      <span>{u.displayName}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingProjectId(null)}
                className="h-10 sm:h-9 px-4 border border-[#D8DCE3] dark:border-white/[0.12] text-[#111215] dark:text-[#E5E7EB] rounded-full text-xs"
              >
                Cancel
              </button>
              <button type="submit" className="h-10 sm:h-9 px-5 bg-[#111215] dark:bg-[#F3F4F6] text-white dark:text-[#0B0C0E] rounded-full text-xs font-medium">
                Save Project Changes
              </button>
            </div>
          </form>
        )}

        {activeProject ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 space-y-5">
              <div className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-5 space-y-3 shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <HealthLabel health={activeProject.health} />
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#F3F4F6] dark:bg-[#181B22] border border-[#E2E5EA] dark:border-white/[0.12] text-[#111215] dark:text-[#E5E7EB]">
                      {activeProject.status}
                    </span>
                    {activeProject.visibility === 'restricted' && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#B42318] dark:text-[#FDA29B] px-2.5 py-0.5 border border-[#F5C6C2] dark:border-[#5E2325] bg-[#FEF0EE] dark:bg-[#2E1314] rounded-full">
                        <Lock className="w-3 h-3" /> Restricted Scope
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[#5E6572] dark:text-[#9CA3AF] tabular-nums font-mono">
                    {activeProject.startDate} → {activeProject.targetDate}
                  </span>
                </div>
                <p className="text-sm text-[#111215] dark:text-[#E5E7EB] leading-relaxed">{activeProject.healthNote}</p>
                <div className="pt-2 border-t border-[#EFF1F4] dark:border-[#1B1F28] flex flex-wrap gap-4 text-xs text-[#5E6572] dark:text-[#9CA3AF]">
                  <span>
                    Owner: <strong className="text-[#111215] dark:text-[#F3F4F6]">{getUserName(activeProject.ownerId)}</strong>
                  </span>
                  <span>
                    Sponsor: <strong className="text-[#111215] dark:text-[#F3F4F6]">{getUserName(activeProject.sponsorId)}</strong>
                  </span>
                  <span>
                    Members: <strong className="text-[#111215] dark:text-[#F3F4F6] tabular-nums">{activeProject.memberIds.length}</strong>
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
                <div className="px-5 py-3.5 border-b border-[#E2E5EA] dark:border-white/[0.08] flex items-center justify-between">
                  <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-[#F3F4F6]">
                    Project Work Packages
                  </h2>
                  {canEditWork && (
                    <button
                      type="button"
                      onClick={onCreateWorkPackage}
                      className="text-xs font-medium text-[#111215] dark:text-[#F3F4F6] hover:underline"
                    >
                      + Add Work Package
                    </button>
                  )}
                </div>
                <div className="divide-y divide-[#EFF1F4] dark:divide-white/[0.06]">
                  {data.workPackages
                    .filter((w) => w.projectId === activeProject.id)
                    .map((wp) => (
                      <button
                        key={wp.id}
                        type="button"
                        onClick={() => onSelectWorkPackage(wp)}
                        className="w-full text-left px-5 py-3.5 hover:bg-[#F8F9FA] dark:hover:bg-[#14171D] flex flex-wrap items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0 flex items-center gap-2.5 text-xs flex-1">
                          <span className="font-mono font-semibold text-[#111215] dark:text-[#F3F4F6] shrink-0">{wp.key}</span>
                          <span className="font-medium text-[#111215] dark:text-[#E5E7EB] truncate">{wp.title}</span>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <PriorityLabel priority={wp.priority} />
                          <StatusLabel status={wp.status} />
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-5">
              <div className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
                <div className="px-5 py-3.5 border-b border-[#E2E5EA] dark:border-white/[0.08] flex items-center justify-between">
                  <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-[#F3F4F6]">Milestones</h2>
                  <button
                    type="button"
                    onClick={() => onNavigate('roadmap')}
                    className="text-xs font-medium text-[#5E6572] dark:text-[#9CA3AF] hover:text-[#111215] dark:hover:text-[#F3F4F6]"
                  >
                    Roadmap →
                  </button>
                </div>
                <div className="divide-y divide-[#EFF1F4] dark:divide-white/[0.06]">
                  {data.milestones
                    .filter((m) => m.projectId === activeProject.id)
                    .map((ms) => (
                      <div key={ms.id} className="px-5 py-3.5 text-xs">
                        <div className="font-medium text-[#111215] dark:text-[#F3F4F6]">{ms.title}</div>
                        <div className="text-[#5E6572] dark:text-[#9CA3AF] mt-1 tabular-nums">
                          {ms.targetDate} · {ms.state} ({ms.confidence}%)
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
                <div className="px-5 py-3.5 border-b border-[#E2E5EA] dark:border-white/[0.08]">
                  <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-[#F3F4F6]">Linked Documents</h2>
                </div>
                <div className="divide-y divide-[#EFF1F4] dark:divide-white/[0.06]">
                  {data.documents
                    .filter((d) => d.projectId === activeProject.id)
                    .map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => onNavigate('documents')}
                        className="w-full text-left px-5 py-3 hover:bg-[#F8F9FA] dark:hover:bg-[#14171D] text-xs"
                      >
                        <div className="font-medium text-[#111215] dark:text-[#F3F4F6]">{doc.title}</div>
                        <div className="text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
                          {doc.category} · v{doc.version} · {doc.status}
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.projects.map((proj) => {
              const projWork = data.workPackages.filter((w) => w.projectId === proj.id);
              const blocked = projWork.filter((w) => w.status === 'Blocked').length;
              return (
                <div
                  key={proj.id}
                  onClick={() => onSelectProject(proj.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      onSelectProject(proj.id);
                    }
                  }}
                  className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] hover:border-[#111215]/40 dark:hover:border-[#D8D8D8]/40 rounded-2xl p-5 cursor-pointer shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none hover:shadow-[0_6px_16px_rgba(11,12,14,0.06)] transition-all flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#111215] dark:text-[#F3F4F6] min-w-0">
                        <FolderKanban className="w-4 h-4 text-[#111215] dark:text-[#D8D8D8] shrink-0" aria-hidden="true" />
                        <span className="font-mono shrink-0">{proj.key}</span>
                        <span className="truncate">{proj.name}</span>
                      </span>
                      <HealthLabel health={proj.health} />
                    </div>
                    <p className="text-xs text-[#5E6572] dark:text-[#9CA3AF] mt-2 leading-relaxed">{proj.objective}</p>
                  </div>
                  <div className="pt-3 border-t border-[#EFF1F4] dark:border-[#1B1F28] flex flex-wrap items-center justify-between gap-2 text-xs text-[#5E6572] dark:text-[#9CA3AF] tabular-nums">
                    <span>
                      {proj.programme} · Owner: {getUserName(proj.ownerId)}
                    </span>
                    <span>
                      {projWork.length} items · {blocked} blocked ·{' '}
                      <span className="capitalize font-medium text-[#111215] dark:text-[#F3F4F6]">{proj.visibility}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // --- 3. WORK PACKAGES DATA TABLE & MOBILE CARDS ---
  if (section === 'work-packages') {
    const PRIORITY_RANK: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    const filtered = scopedWork
      .filter((wp) => {
        if (statusFilter !== 'ALL' && wp.status !== statusFilter) return false;
        if (priorityFilter !== 'ALL' && wp.priority !== priorityFilter) return false;
        if (onlyBlocked && wp.status !== 'Blocked') return false;
        if (quickFilter === 'my' && wp.ownerId !== data.currentUser.id && !wp.assigneeIds.includes(data.currentUser.id)) {
          return false;
        }
        if (quickFilter === 'overdue' && (wp.dueDate >= '2026-11-26' || wp.status === 'Closed' || wp.status === 'Accepted')) {
          return false;
        }
        if (quickFilter === 'high_risk' && !wp.highRisk) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            wp.key.toLowerCase().includes(q) ||
            wp.title.toLowerCase().includes(q) ||
            getUserName(wp.ownerId).toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'priority') cmp = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
        else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
        else if (sortField === 'dueDate') cmp = a.dueDate.localeCompare(b.dueDate);
        else if (sortField === 'estimateHours') cmp = a.estimateHours - b.estimateHours;
        else cmp = a.key.localeCompare(b.key);
        return sortDir === 'asc' ? cmp : -cmp;
      });

    function toggleSort(field: typeof sortField) {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir('asc');
      }
    }

    function exportCsv(items: WorkPackage[]) {
      const headers = ['Key', 'Type', 'Title', 'Status', 'Priority', 'Owner', 'Due Date', 'Estimate (h)'];
      const rows = items.map((w) => [
        w.key,
        w.type,
        `"${w.title.replace(/"/g, '""')}"`,
        w.status,
        w.priority,
        `"${getUserName(w.ownerId).replace(/"/g, '""')}"`,
        w.dueDate,
        String(w.estimateHours),
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'truvornex-work-packages.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onNotify?.('success', `Exported ${items.length} work packages to CSV`);
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-[#F3F4F6] tracking-tight">Work Packages</h1>
            <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
              Canonical initiatives, epics, features, tasks, bugs, and verification records ({filtered.length} shown)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportCsv(selectedWpIds.length > 0 ? filtered.filter((w) => selectedWpIds.includes(w.id)) : filtered)}
              className="h-10 sm:h-9 px-4 bg-white dark:bg-[#161922] border border-[#E2E5EA] dark:border-white/[0.12] hover:bg-[#ECEEF2] dark:hover:bg-[#1D212A] text-[#111215] dark:text-[#F3F4F6] text-xs font-medium rounded-full inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{selectedWpIds.length > 0 ? `Export (${selectedWpIds.length})` : 'Export CSV'}</span>
            </button>
            <button
              type="button"
              onClick={() => setSaveViewOpen((v) => !v)}
              className="h-10 sm:h-9 px-4 bg-white dark:bg-[#161922] border border-[#E2E5EA] dark:border-white/[0.12] hover:bg-[#ECEEF2] dark:hover:bg-[#1D212A] text-[#111215] dark:text-[#F3F4F6] text-xs font-medium rounded-full inline-flex items-center gap-1.5"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span>Save View</span>
            </button>
            {canEditWork && (
              <button
                type="button"
                onClick={onCreateWorkPackage}
                className="h-10 sm:h-9 px-5 bg-[#111215] hover:bg-[#262930] dark:bg-[#F3F4F6] dark:hover:bg-[#D8D8D8] text-white dark:text-[#0B0C0E] text-xs font-medium rounded-full"
              >
                New Work Package
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <div role="alert" className="p-3.5 rounded-2xl border border-[#F5C6C2] dark:border-[#5E2325] bg-[#FEF0EE] dark:bg-[#2E1314] text-[#B42318] dark:text-[#FDA29B] text-xs">
            {actionError}
          </div>
        )}

        {saveViewOpen && (
          <form
            onSubmit={handleSaveViewSubmit}
            className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-3.5 flex flex-wrap items-center gap-2.5"
          >
            <input
              type="text"
              required
              autoFocus
              value={saveViewName}
              onChange={(e) => setSaveViewName(e.target.value)}
              placeholder="Name this filter view (e.g. Critical Blockers)…"
              className="flex-1 min-w-[200px] h-10 sm:h-9 px-3.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-full"
            />
            <button
              type="submit"
              className="h-10 sm:h-9 px-4 bg-[#111215] dark:bg-[#F3F4F6] text-white dark:text-[#0B0C0E] text-xs font-medium rounded-full"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setSaveViewOpen(false)}
              className="h-10 sm:h-9 px-4 border border-[#D8DCE3] dark:border-white/[0.12] text-[#111215] dark:text-[#E5E7EB] text-xs rounded-full"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Filter Bar */}
        <div className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-3 flex flex-wrap items-center gap-2.5 shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-[#5E6572] dark:text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by key, title, or owner…"
              className="w-full h-10 sm:h-9 pl-9 pr-3.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-full focus:outline-none focus:border-[#111215] dark:focus:border-[#D8D8D8]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="h-10 sm:h-9 px-3 text-sm sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-full"
          >
            <option value="ALL">All Statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            aria-label="Filter by priority"
            className="h-10 sm:h-9 px-3 text-sm sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-full"
          >
            <option value="ALL">All Priorities</option>
            {['Critical', 'High', 'Medium', 'Low'].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setOnlyBlocked((v) => !v)}
            className={`h-10 sm:h-9 px-3.5 text-xs font-medium rounded-full border transition-colors ${
              onlyBlocked
                ? 'bg-[#FEF0EE] dark:bg-[#2E1314] border-[#F5C6C2] dark:border-[#5E2325] text-[#B42318] dark:text-[#FDA29B]'
                : 'bg-white dark:bg-[#161922] border-[#D8DCE3] dark:border-white/[0.12] text-[#111215] dark:text-[#F3F4F6]'
            }`}
          >
            Blocked Only
          </button>
          {data.savedViews.map((sv) => (
            <div
              key={sv.id}
              className="inline-flex items-center h-10 sm:h-9 bg-[#ECEEF2] dark:bg-[#181B22] border border-[#D4D8DF] dark:border-white/[0.12] rounded-full overflow-hidden"
            >
              <button
                type="button"
                onClick={() => {
                  setOnlyBlocked(Boolean(sv.filters.onlyBlocked));
                  setStatusFilter(sv.filters.status?.[0] || 'ALL');
                  setPriorityFilter(sv.filters.priority?.[0] || 'ALL');
                }}
                className="px-3.5 h-full text-xs text-[#111215] dark:text-[#F3F4F6] hover:bg-[#E2E5EA] dark:hover:bg-[#222630]"
              >
                {sv.name}
              </button>
              {(sv.ownerId === data.currentUser.id || isAdmin) && (
                <button
                  type="button"
                  onClick={() => handleDeleteSavedView(sv.id)}
                  aria-label={`Delete saved view ${sv.name}`}
                  className="pr-2.5 pl-1 h-full text-[#5E6572] dark:text-[#9CA3AF] hover:text-[#B42318] dark:hover:text-[#FDA29B]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Quick Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { key: 'my', label: 'My Assigned' },
              { key: 'overdue', label: 'Overdue' },
              { key: 'high_risk', label: 'High Risk' },
            ] as const
          ).map((chip) => {
            const active = quickFilter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setQuickFilter(active ? 'none' : chip.key)}
                className={`h-7 px-3 rounded-full text-[11px] font-medium border transition-colors ${
                  active
                    ? 'bg-[#111215] dark:bg-[#F3F4F6] text-white dark:text-[#0B0C0E] border-[#111215] dark:border-[#F3F4F6]'
                    : 'bg-white dark:bg-[#111318] text-[#5E6572] dark:text-[#9CA3AF] border-[#E2E5EA] dark:border-white/[0.08] hover:text-[#111215] dark:hover:text-[#F3F4F6]'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
          {(statusFilter !== 'ALL' || priorityFilter !== 'ALL' || onlyBlocked || quickFilter !== 'none' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setPriorityFilter('ALL');
                setOnlyBlocked(false);
                setQuickFilter('none');
                setSearchQuery('');
              }}
              className="h-7 px-3 rounded-full text-[11px] font-medium text-[#B42318] dark:text-[#FDA29B] hover:underline"
            >
              Reset Filters
            </button>
          )}
          {selectedWpIds.length > 0 && (
            <span className="ml-auto text-[11px] font-mono text-[#111215] dark:text-[#F3F4F6] flex items-center gap-2">
              <span>{selectedWpIds.length} selected</span>
              <button type="button" onClick={() => setSelectedWpIds([])} className="underline text-[#5E6572] dark:text-[#9CA3AF]">
                Clear
              </button>
            </span>
          )}
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-2.5">
          {filtered.map((wp) => {
            const isOverdue = wp.dueDate < '2026-11-26' && wp.status !== 'Closed' && wp.status !== 'Accepted';
            return (
              <button
                key={wp.id}
                type="button"
                onClick={() => onSelectWorkPackage(wp)}
                className="w-full text-left bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-4 space-y-2.5 shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-semibold text-[#111215] dark:text-[#F3F4F6]">{wp.key}</span>
                    <span className="text-[#5E6572] dark:text-[#9CA3AF]">{formatWorkType(wp.type)}</span>
                  </div>
                  <StatusLabel status={wp.status} />
                </div>
                <div className="text-sm font-medium text-[#111215] dark:text-[#E5E7EB] leading-snug">{wp.title}</div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#EFF1F4] dark:border-[#1B1F28] text-xs">
                  <div className="flex items-center gap-2">
                    <UserAvatar name={getUserName(wp.ownerId)} />
                    <span className="text-[#5E6572] dark:text-[#9CA3AF]">{getUserName(wp.ownerId)}</span>
                  </div>
                  <div className="flex items-center gap-2.5 font-mono tabular-nums text-[11px] text-[#5E6572] dark:text-[#9CA3AF]">
                    <PriorityLabel priority={wp.priority} />
                    <span className={isOverdue ? 'text-[#B42318] dark:text-[#FDA29B] font-semibold' : ''}>Due {wp.dueDate}</span>
                    <span>{wp.estimateHours}h</span>
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl py-10 text-center text-xs text-[#5E6572] dark:text-[#9CA3AF]">
              No work packages match the active filters.
            </div>
          )}
        </div>

        {/* Desktop Data Table */}
        <div className="hidden md:block bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-x-auto shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
          <table className="w-full text-left border-collapse min-w-[880px]">
            <thead>
              <tr className="bg-[#F8F9FA] dark:bg-[#161922] border-b border-[#E2E5EA] dark:border-white/[0.08] text-[11px] font-semibold text-[#5E6572] dark:text-[#9CA3AF]">
                <th className="py-3 pl-4 pr-2 w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all visible work packages"
                    checked={filtered.length > 0 && selectedWpIds.length === filtered.length}
                    onChange={(e) => setSelectedWpIds(e.target.checked ? filtered.map((w) => w.id) : [])}
                  />
                </th>
                <th className="py-3 px-4">
                  <button type="button" onClick={() => toggleSort('key')} className="inline-flex items-center gap-1 hover:text-[#111215] dark:hover:text-[#F3F4F6]">
                    <span>Key</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">
                  <button type="button" onClick={() => toggleSort('status')} className="inline-flex items-center gap-1 hover:text-[#111215] dark:hover:text-[#F3F4F6]">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button type="button" onClick={() => toggleSort('priority')} className="inline-flex items-center gap-1 hover:text-[#111215] dark:hover:text-[#F3F4F6]">
                    <span>Priority</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </th>
                <th className="py-3 px-4">Owner</th>
                <th className="py-3 px-4 text-right">
                  <button type="button" onClick={() => toggleSort('dueDate')} className="inline-flex items-center gap-1 hover:text-[#111215] dark:hover:text-[#F3F4F6]">
                    <span>Due Date</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </th>
                <th className="py-3 px-5 text-right">
                  <button type="button" onClick={() => toggleSort('estimateHours')} className="inline-flex items-center gap-1 hover:text-[#111215] dark:hover:text-[#F3F4F6]">
                    <span>Est.</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFF1F4] dark:divide-white/[0.06] text-xs">
              {filtered.map((wp) => {
                const isOverdue = wp.dueDate < '2026-11-26' && wp.status !== 'Closed' && wp.status !== 'Accepted';
                const checked = selectedWpIds.includes(wp.id);
                return (
                  <tr
                    key={wp.id}
                    onClick={() => onSelectWorkPackage(wp)}
                    className="h-11 hover:bg-[#F8F9FA] dark:hover:bg-[#14171D] cursor-pointer transition-colors group"
                  >
                    <td className="py-2 pl-4 pr-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${wp.key}`}
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedWpIds((prev) => Array.from(new Set([...prev, wp.id])));
                          else setSelectedWpIds((prev) => prev.filter((id) => id !== wp.id));
                        }}
                      />
                    </td>
                    <td className="py-2 px-4 font-mono font-semibold text-[#111215] dark:text-[#F3F4F6] whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span>{wp.key}</span>
                        <button
                          type="button"
                          title={`Copy ${wp.key}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard?.writeText(wp.key).catch(() => {});
                            onNotify?.('info', `Copied ${wp.key}`);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-[#5E6572] dark:text-[#9CA3AF] hover:text-[#111215] dark:hover:text-[#F3F4F6]"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </span>
                    </td>
                    <td className="py-2 px-4 text-[#5E6572] dark:text-[#9CA3AF] whitespace-nowrap">
                      {formatWorkType(wp.type)}
                    </td>
                    <td className="py-2 px-4 font-medium text-[#111215] dark:text-[#E5E7EB] max-w-[340px] truncate">
                      {wp.title}
                    </td>
                    <td className="py-2 px-4 whitespace-nowrap">
                      <StatusLabel status={wp.status} />
                    </td>
                    <td className="py-2 px-4 whitespace-nowrap">
                      <PriorityLabel priority={wp.priority} />
                    </td>
                    <td className="py-2 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={getUserName(wp.ownerId)} />
                        <span className="text-[#111215] dark:text-[#E5E7EB]">{getUserName(wp.ownerId)}</span>
                      </div>
                    </td>
                    <td className={`py-2 px-4 text-right font-mono tabular-nums whitespace-nowrap ${isOverdue ? 'text-[#B42318] dark:text-[#FDA29B] font-semibold' : 'text-[#5E6572] dark:text-[#9CA3AF]'}`}>
                      {wp.dueDate}
                    </td>
                    <td className="py-2 px-5 text-right font-mono tabular-nums text-[#5E6572] dark:text-[#9CA3AF] whitespace-nowrap">
                      {wp.estimateHours}h
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-xs text-[#5E6572] dark:text-[#9CA3AF]">
                    No work packages match the active filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- 4. KANBAN BOARD ---
  if (section === 'boards') {
    const groups =
      swimlaneBy === 'project'
        ? data.projects.map((p) => ({ id: p.id, label: `${p.key} · ${p.name}` }))
        : swimlaneBy === 'owner'
        ? Array.from(new Set(scopedWork.map((w) => w.ownerId))).map((uid) => ({
            id: uid,
            label: getUserName(uid),
          }))
        : [{ id: 'all', label: 'All Work Packages' }];

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-[#F3F4F6] tracking-tight">Kanban Board</h1>
            <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
              Workflow-enforced transitions across canonical work packages
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={swimlaneBy}
              onChange={(e) => setSwimlaneBy(e.target.value as 'none' | 'project' | 'owner')}
              aria-label="Swimlane grouping"
              className="h-10 sm:h-9 px-3.5 text-sm sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-full"
            >
              <option value="none">No Swimlanes</option>
              <option value="project">Swimlanes by Project</option>
              <option value="owner">Swimlanes by Owner</option>
            </select>
            {canEditWork && (
              <button
                type="button"
                onClick={onCreateWorkPackage}
                className="h-10 sm:h-9 px-5 bg-[#111215] hover:bg-[#262930] dark:bg-[#F3F4F6] dark:hover:bg-[#D8D8D8] text-white dark:text-[#0B0C0E] text-xs font-medium rounded-full"
              >
                New Work Package
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl border border-[#F5C6C2] dark:border-[#5E2325] bg-[#FEF0EE] dark:bg-[#2E1314] text-[#B42318] dark:text-[#FDA29B] text-xs flex items-center justify-between gap-3"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {actionError}
            </span>
            <button type="button" onClick={() => setActionError(null)} className="underline shrink-0">
              Dismiss
            </button>
          </div>
        )}

        {/* Mobile Column Switcher + Single-Column Touch View */}
        <div className="md:hidden space-y-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {BOARD_COLUMNS.map((col) => {
              const count = scopedWork.filter((w) => w.status === col).length;
              const active = mobileBoardCol === col;
              return (
                <button
                  key={col}
                  type="button"
                  onClick={() => setMobileBoardCol(col)}
                  className={`shrink-0 h-9 px-3.5 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1.5 ${
                    active
                      ? 'bg-[#111215] dark:bg-[#F3F4F6] text-white dark:text-[#0B0C0E] border-[#111215] dark:border-[#F3F4F6]'
                      : 'bg-white dark:bg-[#111318] text-[#111215] dark:text-[#E5E7EB] border-[#E2E5EA] dark:border-white/[0.08]'
                  }`}
                >
                  <span>{col}</span>
                  <span className="font-mono opacity-75 tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2.5">
            {scopedWork
              .filter((w) => w.status === mobileBoardCol)
              .map((wp) => (
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
                  className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-[#262B36] rounded-2xl p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-semibold text-[#111215] dark:text-[#F3F4F6]">{wp.key}</span>
                    <PriorityLabel priority={wp.priority} />
                  </div>
                  <div className="text-sm font-medium text-[#111215] dark:text-[#E5E7EB] leading-snug">{wp.title}</div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#EFF1F4] dark:border-[#1B1F28] text-xs text-[#5E6572] dark:text-[#9CA3AF]">
                    <span>{getUserName(wp.ownerId)} · Due {wp.dueDate.slice(5)}</span>
                    {canEditWork && (
                      <select
                        value={wp.status}
                        aria-label={`Move ${wp.key} to status`}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleQuickTransition(wp, e.target.value as WorkPackageStatus);
                        }}
                        className="h-8 px-2.5 text-xs bg-[#F8F9FA] dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-full"
                      >
                        {BOARD_COLUMNS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            {scopedWork.filter((w) => w.status === mobileBoardCol).length === 0 && (
              <div className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl py-8 text-center text-xs text-[#5E6572] dark:text-[#9CA3AF]">
                No work packages in {mobileBoardCol}.
              </div>
            )}
          </div>
        </div>

        {/* Desktop 7-Column Drag-and-Drop Board */}
        <div className="hidden md:block space-y-5">
          {groups.map((grp) => {
            const groupItems =
              swimlaneBy === 'project'
                ? scopedWork.filter((w) => w.projectId === grp.id)
                : swimlaneBy === 'owner'
                ? scopedWork.filter((w) => w.ownerId === grp.id)
                : scopedWork;

            return (
              <div key={grp.id} className="space-y-2">
                {swimlaneBy !== 'none' && (
                  <h2 className="font-display text-xs font-semibold text-[#111215] dark:text-[#F3F4F6] px-1">
                    {grp.label} ({groupItems.length})
                  </h2>
                )}
                <div className="overflow-x-auto pb-2">
                  <div className="grid grid-cols-7 gap-3 min-w-[1120px]">
                    {BOARD_COLUMNS.map((col) => {
                      const colItems = groupItems.filter((w) => w.status === col);
                      return (
                        <div
                          key={col}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const wpId = e.dataTransfer.getData('text/plain');
                            const found = data.workPackages.find((w) => w.id === wpId);
                            if (found && found.status !== col) {
                              handleQuickTransition(found, col);
                            }
                          }}
                          className="bg-[#ECEEF2]/80 dark:bg-[#161922] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-3 min-h-[260px] flex flex-col"
                        >
                          <div className="flex items-center justify-between mb-2.5 px-1">
                            <span className="text-xs font-semibold text-[#111215] dark:text-[#F3F4F6]">{col}</span>
                            <span
                              className={`text-xs font-mono tabular-nums ${
                                col === 'In Progress' && colItems.length > 5
                                  ? 'text-[#B42318] dark:text-[#FDA29B] font-semibold'
                                  : 'text-[#5E6572] dark:text-[#9CA3AF]'
                              }`}
                              title={col === 'In Progress' && colItems.length > 5 ? 'WIP limit exceeded (>5)' : undefined}
                            >
                              {colItems.length}{col === 'In Progress' ? '/5' : ''}
                            </span>
                          </div>
                          <div className="space-y-2.5 flex-1">
                            {colItems.map((wp) => (
                              <div
                                key={wp.id}
                                draggable={canEditWork}
                                onDragStart={(e) => e.dataTransfer.setData('text/plain', wp.id)}
                                onClick={() => onSelectWorkPackage(wp)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(ev) => {
                                  if (ev.key === 'Enter' || ev.key === ' ') {
                                    ev.preventDefault();
                                    onSelectWorkPackage(wp);
                                  }
                                }}
                                className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-[#262B36] hover:border-[#111215]/40 dark:hover:border-[#D8D8D8]/40 rounded-2xl p-3 cursor-pointer space-y-2 shadow-[0_1px_2px_rgba(11,12,14,0.03)] dark:shadow-none hover:shadow-[0_4px_12px_rgba(11,12,14,0.06)] transition-all"
                              >
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-mono font-semibold text-[#111215] dark:text-[#F3F4F6]">{wp.key}</span>
                                  <PriorityLabel priority={wp.priority} />
                                </div>
                                <div className="text-xs font-medium text-[#111215] dark:text-[#E5E7EB] leading-snug">
                                  {wp.title}
                                </div>
                                <div className="flex items-center justify-between pt-1 text-[11px] text-[#5E6572] dark:text-[#9CA3AF]">
                                  <span className="truncate">{getUserName(wp.ownerId)}</span>
                                  <span className="font-mono tabular-nums shrink-0">{wp.dueDate.slice(5)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // --- 5. BACKLOG ---
  if (section === 'backlog') {
    const backlogItems = scopedWork.filter(
      (w) => w.status === 'Draft' || w.status === 'Backlog' || w.status === 'Ready'
    );

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-[#F3F4F6] tracking-tight">Prioritized Backlog</h1>
            <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
              Unscheduled and ready work packages awaiting commitment
            </p>
          </div>
          {canEditWork && (
            <button
              type="button"
              onClick={onCreateWorkPackage}
              className="h-10 sm:h-9 px-5 bg-[#111215] hover:bg-[#262930] dark:bg-[#F3F4F6] dark:hover:bg-[#D8D8D8] text-white dark:text-[#0B0C0E] text-xs font-medium rounded-full"
            >
              New Backlog Item
            </button>
          )}
        </div>

        {actionError && (
          <div role="alert" className="p-3.5 rounded-2xl border border-[#F5C6C2] dark:border-[#5E2325] bg-[#FEF0EE] dark:bg-[#2E1314] text-[#B42318] dark:text-[#FDA29B] text-xs">
            {actionError}
          </div>
        )}

        <div className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-hidden divide-y divide-[#EFF1F4] dark:divide-white/[0.06] shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
          {backlogItems.map((wp) => (
            <div
              key={wp.id}
              className="px-4 sm:px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-[#F8F9FA] dark:hover:bg-[#14171D]"
            >
              <button
                type="button"
                onClick={() => onSelectWorkPackage(wp)}
                className="text-left min-w-0 flex-1"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-semibold text-[#111215] dark:text-[#F3F4F6]">{wp.key}</span>
                  <span className="text-[#5E6572] dark:text-[#9CA3AF]">{formatWorkType(wp.type)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-[#111215] dark:text-[#E5E7EB] truncate">{wp.title}</span>
                </div>
                <div className="text-[11px] text-[#5E6572] dark:text-[#9CA3AF] mt-1 flex flex-wrap items-center gap-2 tabular-nums">
                  <span>Owner: {getUserName(wp.ownerId)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{wp.estimateHours}h estimate</span>
                  <span aria-hidden="true">·</span>
                  <span>Target {wp.dueDate}</span>
                </div>
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <PriorityLabel priority={wp.priority} />
                <StatusLabel status={wp.status} />
                {canEditWork && wp.status !== 'Ready' && (
                  <button
                    type="button"
                    onClick={() => handleQuickTransition(wp, 'Ready')}
                    className="h-8 sm:h-7 px-3 text-xs font-medium border border-[#D8DCE3] dark:border-white/[0.12] bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] hover:bg-[#ECEEF2] dark:hover:bg-[#1D212A] rounded-full"
                  >
                    Mark Ready
                  </button>
                )}
              </div>
            </div>
          ))}
          {backlogItems.length === 0 && (
            <div className="p-8 text-center text-xs text-[#5E6572] dark:text-[#9CA3AF]">Backlog is currently empty.</div>
          )}
        </div>
      </div>
    );
  }

  // --- 6. GANTT CHART ---
  if (section === 'gantt') {
    const startMs = new Date('2026-10-28T00:00:00Z').getTime();
    const endMs =
      ganttZoom === '6w'
        ? new Date('2026-12-18T00:00:00Z').getTime()
        : new Date('2027-01-15T00:00:00Z').getTime();
    const span = endMs - startMs;

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-[#F3F4F6] tracking-tight">Gantt Timeline</h1>
            <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
              Schedule windows, dependency edges, and critical blockers
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-full">
            <button
              type="button"
              onClick={() => setGanttZoom('6w')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors ${
                ganttZoom === '6w'
                  ? 'bg-[#111215] dark:bg-[#F3F4F6] text-white dark:text-[#0B0C0E]'
                  : 'text-[#5E6572] dark:text-[#9CA3AF]'
              }`}
            >
              6-Week Window
            </button>
            <button
              type="button"
              onClick={() => setGanttZoom('10w')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors ${
                ganttZoom === '10w'
                  ? 'bg-[#111215] dark:bg-[#F3F4F6] text-white dark:text-[#0B0C0E]'
                  : 'text-[#5E6572] dark:text-[#9CA3AF]'
              }`}
            >
              10-Week Window
            </button>
          </div>
        </div>

        {/* Mobile Schedule Cards */}
        <div className="md:hidden space-y-2.5">
          {scopedWork.map((wp) => {
            const s = Math.max(startMs, new Date(wp.startDate + 'T00:00:00Z').getTime());
            const e = Math.min(endMs, new Date(wp.dueDate + 'T00:00:00Z').getTime());
            const leftPct = Math.max(0, Math.min(86, ((s - startMs) / span) * 100));
            const widthPct = Math.max(10, Math.min(100 - leftPct, ((Math.max(e, s + 86400000) - s) / span) * 100));
            const deps = data.dependencies.filter((d) => d.successorId === wp.id);
            const barColor =
              wp.status === 'Blocked'
                ? 'bg-[#B42318] dark:bg-[#F97066]'
                : wp.status === 'Accepted' || wp.status === 'Closed'
                ? 'bg-[#1F764D] dark:bg-[#34D399]'
                : wp.status === 'In Review' || wp.status === 'Verification'
                ? 'bg-[#B57C0A] dark:bg-[#FBBF24]'
                : 'bg-[#111215] dark:bg-[#F3F4F6]';

            return (
              <button
                key={wp.id}
                type="button"
                onClick={() => onSelectWorkPackage(wp)}
                className="w-full text-left bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-[#111215] dark:text-[#F3F4F6]">{wp.key}</span>
                  <StatusLabel status={wp.status} />
                </div>
                <div className="text-xs font-medium text-[#111215] dark:text-[#E5E7EB]">{wp.title}</div>
                <div className="w-full h-2.5 bg-[#ECEEF2] dark:bg-[#1B1F28] rounded-full relative">
                  <div style={{ left: `${leftPct}%`, width: `${widthPct}%` }} className={`absolute top-0 h-2.5 rounded-full ${barColor}`} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-[#5E6572] dark:text-[#9CA3AF]">
                  <span>{wp.startDate} → {wp.dueDate}</span>
                  {deps.length > 0 && (
                    <span className="text-[#B42318] dark:text-[#FDA29B] inline-flex items-center gap-1">
                      <GitBranch className="w-3 h-3" />
                      {deps.map((d) => data.workPackages.find((x) => x.id === d.predecessorId)?.key).join(', ')}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Desktop Gantt Timeline */}
        <div className="hidden md:block bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-x-auto shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-12 px-5 py-3 bg-[#F8F9FA] dark:bg-[#161922] border-b border-[#E2E5EA] dark:border-white/[0.08] text-xs font-semibold text-[#5E6572] dark:text-[#9CA3AF]">
              <div className="col-span-4">Work Package & Dependencies</div>
              <div className="col-span-8 grid grid-cols-4 text-center font-mono tabular-nums">
                <span>Nov 01</span>
                <span>Nov 15</span>
                <span className="text-[#111215] dark:text-[#F3F4F6]">Nov 26 (Today)</span>
                <span>{ganttZoom === '6w' ? 'Dec 15' : 'Jan 10'}</span>
              </div>
            </div>
            <div className="divide-y divide-[#EFF1F4] dark:divide-white/[0.06]">
              {scopedWork.map((wp) => {
                const s = Math.max(startMs, new Date(wp.startDate + 'T00:00:00Z').getTime());
                const e = Math.min(endMs, new Date(wp.dueDate + 'T00:00:00Z').getTime());
                const leftPct = Math.max(0, Math.min(91, ((s - startMs) / span) * 100));
                const widthPct = Math.max(
                  7,
                  Math.min(100 - leftPct, ((Math.max(e, s + 86400000) - s) / span) * 100)
                );
                const deps = data.dependencies.filter((d) => d.successorId === wp.id);
                const barColor =
                  wp.status === 'Blocked'
                    ? 'bg-[#B42318] dark:bg-[#F97066] text-white dark:text-[#0B0C0E]'
                    : wp.status === 'Accepted' || wp.status === 'Closed'
                    ? 'bg-[#1F764D] dark:bg-[#34D399] text-white dark:text-[#0B0C0E]'
                    : wp.status === 'In Review' || wp.status === 'Verification'
                    ? 'bg-[#B57C0A] dark:bg-[#FBBF24] text-white dark:text-[#0B0C0E]'
                    : 'bg-[#111215] dark:bg-[#F3F4F6] text-white dark:text-[#0B0C0E]';

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
                    className="grid grid-cols-12 items-center px-5 py-3 hover:bg-[#F8F9FA] dark:hover:bg-[#14171D] cursor-pointer"
                  >
                    <div className="col-span-4 pr-4 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-semibold text-[#111215] dark:text-[#F3F4F6] shrink-0">{wp.key}</span>
                        <span className="font-medium text-[#111215] dark:text-[#E5E7EB] truncate">{wp.title}</span>
                      </div>
                      <div className="text-[11px] text-[#5E6572] dark:text-[#9CA3AF] mt-0.5 flex items-center gap-2 tabular-nums">
                        <span>{wp.status}</span>
                        {deps.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[#B42318] dark:text-[#FDA29B]">
                            <GitBranch className="w-3 h-3" />
                            Depends on {deps.map((d) => data.workPackages.find((x) => x.id === d.predecessorId)?.key).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="col-span-8 relative h-7 flex items-center">
                      <div className="w-full h-2.5 bg-[#ECEEF2] dark:bg-[#1B1F28] rounded-full relative">
                        <div
                          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                          className={`absolute top-1/2 -translate-y-1/2 h-4.5 rounded-full ${barColor} flex items-center justify-between px-2 text-[10px] font-mono truncate`}
                        >
                          <span className="truncate font-semibold">{wp.key}</span>
                          <span className="w-2.5 h-2.5 rounded-full bg-[#D8D8D8] dark:bg-[#0B0C0E]/30 shrink-0 ml-1" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- 7. ROADMAP ---
  if (section === 'roadmap') {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-[#F3F4F6] tracking-tight">Programme Roadmap</h1>
            <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
              Initiative milestones, target windows, and confidence assessments
            </p>
          </div>
          {canManageProjects && (
            <button
              type="button"
              onClick={() => setShowNewMilestone((v) => !v)}
              className="h-10 sm:h-9 px-5 bg-[#111215] hover:bg-[#262930] dark:bg-[#F3F4F6] dark:hover:bg-[#D8D8D8] text-white dark:text-[#0B0C0E] text-xs font-medium rounded-full inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Milestone</span>
            </button>
          )}
        </div>

        {actionError && (
          <div role="alert" className="p-3.5 rounded-2xl border border-[#F5C6C2] dark:border-[#5E2325] bg-[#FEF0EE] dark:bg-[#2E1314] text-[#B42318] dark:text-[#FDA29B] text-xs">
            {actionError}
          </div>
        )}

        {showNewMilestone && (
          <form onSubmit={handleCreateMilestone} className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-5 space-y-4">
            <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-[#F3F4F6]">Add Roadmap Milestone</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Project</label>
                <select
                  value={msProjectId}
                  onChange={(e) => setMsProjectId(e.target.value)}
                  className="w-full h-11 sm:h-9 px-2.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                >
                  {data.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.key} · {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Milestone Title</label>
                <input
                  type="text"
                  required
                  value={msTitle}
                  onChange={(e) => setMsTitle(e.target.value)}
                  placeholder="M6 · Production Readiness Audit"
                  className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Target Date</label>
                <input
                  type="date"
                  required
                  value={msDate}
                  onChange={(e) => setMsDate(e.target.value)}
                  className="w-full h-11 sm:h-9 px-2.5 text-base sm:text-xs font-mono bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs">
                <label className="font-medium text-[#111215] dark:text-[#E5E7EB]">Confidence %:</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={msConfidence}
                  onChange={(e) => setMsConfidence(Number(e.target.value))}
                  className="w-20 h-10 sm:h-8 px-2.5 text-base sm:text-xs font-mono bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowNewMilestone(false)} className="h-10 sm:h-8 px-3.5 border border-[#D8DCE3] dark:border-white/[0.12] text-[#111215] dark:text-[#E5E7EB] rounded-full text-xs">
                  Cancel
                </button>
                <button type="submit" className="h-10 sm:h-8 px-4 bg-[#111215] dark:bg-[#F3F4F6] text-white dark:text-[#0B0C0E] rounded-full text-xs font-medium">
                  Save Milestone
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="space-y-4">
          {data.projects.map((proj) => {
            const pMilestones = data.milestones.filter((m) => m.projectId === proj.id);
            return (
              <section key={proj.id} className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
                <div className="px-5 py-3.5 border-b border-[#E2E5EA] dark:border-white/[0.08] flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs font-semibold text-[#111215] dark:text-[#F3F4F6] shrink-0">{proj.key}</span>
                    <h2 className="font-display text-sm font-semibold text-[#111215] dark:text-[#F3F4F6] truncate">{proj.name}</h2>
                  </div>
                  <HealthLabel health={proj.health} />
                </div>
                <div className="divide-y divide-[#EFF1F4] dark:divide-white/[0.06]">
                  {pMilestones.map((ms) => {
                    const linkedWork = data.workPackages.filter((w) => w.milestoneId === ms.id);
                    const done = linkedWork.filter((w) => w.status === 'Accepted' || w.status === 'Closed').length;

                    if (editingMilestoneId === ms.id) {
                      return (
                        <form key={ms.id} onSubmit={handleUpdateMilestone} className="px-5 py-4 space-y-3 bg-[#F8F9FA] dark:bg-[#161922]">
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-medium text-[#5E6572] dark:text-[#9CA3AF] mb-1">Title</label>
                              <input
                                type="text"
                                required
                                value={editMsTitle}
                                onChange={(e) => setEditMsTitle(e.target.value)}
                                className="w-full h-10 sm:h-9 px-3 text-base sm:text-xs bg-white dark:bg-[#111318] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-[#5E6572] dark:text-[#9CA3AF] mb-1">State</label>
                              <select
                                value={editMsState}
                                onChange={(e) => setEditMsState(e.target.value as Milestone['state'])}
                                className="w-full h-10 sm:h-9 px-2.5 text-base sm:text-xs bg-white dark:bg-[#111318] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                              >
                                {['Planned', 'At Risk', 'Achieved', 'Missed'].map((st) => (
                                  <option key={st} value={st}>{st}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-[#5E6572] dark:text-[#9CA3AF] mb-1">Target Date</label>
                              <input
                                type="date"
                                required
                                value={editMsDate}
                                onChange={(e) => setEditMsDate(e.target.value)}
                                className="w-full h-10 sm:h-9 px-2.5 text-base sm:text-xs font-mono bg-white dark:bg-[#111318] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                            <div>
                              <label className="block text-[11px] font-medium text-[#5E6572] dark:text-[#9CA3AF] mb-1">Confidence %</label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={editMsConfidence}
                                onChange={(e) => setEditMsConfidence(Number(e.target.value))}
                                className="w-full h-10 sm:h-9 px-3 text-base sm:text-xs font-mono bg-white dark:bg-[#111318] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-medium text-[#5E6572] dark:text-[#9CA3AF] mb-1">Summary</label>
                              <input
                                type="text"
                                value={editMsDescription}
                                onChange={(e) => setEditMsDescription(e.target.value)}
                                className="w-full h-10 sm:h-9 px-3 text-base sm:text-xs bg-white dark:bg-[#111318] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingMilestoneId(null)}
                                className="h-9 px-3.5 border border-[#D8DCE3] dark:border-white/[0.12] text-[#111215] dark:text-[#E5E7EB] rounded-full text-xs"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="h-9 px-4 bg-[#111215] dark:bg-[#F3F4F6] text-white dark:text-[#0B0C0E] rounded-full text-xs font-medium"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </form>
                      );
                    }

                    return (
                      <div key={ms.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#111215] dark:text-[#F3F4F6]">
                            <MilestoneIcon className="w-4 h-4 text-[#111215] dark:text-[#D8D8D8] shrink-0" />
                            <span>{ms.title}</span>
                            <span
                              className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                                ms.state === 'Achieved'
                                  ? 'bg-[#ECF7F1] dark:bg-[#102A1F] border-[#BCE3CE] dark:border-[#1F4E3A] text-[#1F764D] dark:text-[#6EE7B7]'
                                  : ms.state === 'At Risk' || ms.state === 'Missed'
                                  ? 'bg-[#FEF0EE] dark:bg-[#2E1314] border-[#F5C6C2] dark:border-[#5E2325] text-[#B42318] dark:text-[#FDA29B]'
                                  : 'bg-[#F3F4F6] dark:bg-[#181B22] border-[#E2E5EA] dark:border-white/[0.12] text-[#5E6572] dark:text-[#9CA3AF]'
                              }`}
                            >
                              {ms.state}
                            </span>
                          </div>
                          <p className="text-xs text-[#5E6572] dark:text-[#9CA3AF] mt-1">{ms.description}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-5 text-xs tabular-nums shrink-0">
                          <div>
                            <div className="text-[#5E6572] dark:text-[#9CA3AF]">Target</div>
                            <div className="font-mono font-medium text-[#111215] dark:text-[#F3F4F6]">{ms.targetDate}</div>
                          </div>
                          <div>
                            <div className="text-[#5E6572] dark:text-[#9CA3AF]">Work Done</div>
                            <div className="font-mono font-medium text-[#111215] dark:text-[#F3F4F6]">
                              {done} / {linkedWork.length}
                            </div>
                          </div>
                          <div>
                            <div className="text-[#5E6572] dark:text-[#9CA3AF]">Confidence</div>
                            <div className="font-mono font-semibold text-[#111215] dark:text-[#F3F4F6]">{ms.confidence}%</div>
                          </div>
                          {canManageProjects && (
                            <button
                              type="button"
                              onClick={() => startEditMilestone(ms)}
                              className="h-8 px-3 border border-[#D8DCE3] dark:border-white/[0.12] rounded-full text-xs text-[#111215] dark:text-[#F3F4F6] hover:bg-[#ECEEF2] dark:hover:bg-[#181B22]"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {pMilestones.length === 0 && (
                    <div className="p-5 text-xs text-[#5E6572] dark:text-[#9CA3AF]">No milestones defined for this project yet.</div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  // --- 8. CALENDAR ---
  const year = 2026;
  const monthName = calendarMonth === 10 ? 'November 2026' : 'December 2026';
  const daysInMonth = calendarMonth === 10 ? 30 : 31;
  const firstWeekday = new Date(Date.UTC(year, calendarMonth, 1)).getUTCDay();
  const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, i) =>
    i < firstWeekday ? null : i - firstWeekday + 1
  );

  const monthPrefix = `${year}-${String(calendarMonth + 1).padStart(2, '0')}`;
  const agendaDays = Array.from({ length: daysInMonth }, (_, i) => {
    const iso = `${monthPrefix}-${String(i + 1).padStart(2, '0')}`;
    const wps = scopedWork.filter((w) => w.dueDate === iso);
    const ms = data.milestones.filter((m) => m.targetDate === iso);
    const mtgs = data.meetings.filter((m) => m.date === iso);
    return { iso, day: i + 1, wps, ms, mtgs };
  }).filter((d) => d.wps.length > 0 || d.ms.length > 0 || d.mtgs.length > 0 || d.iso === '2026-11-26');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#111215] dark:text-[#F3F4F6] tracking-tight">Delivery Calendar</h1>
          <p className="text-sm text-[#5E6572] dark:text-[#9CA3AF] mt-0.5">
            Work-package deadlines, milestone targets, and engineering meetings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCalendarMonth(10)}
            disabled={calendarMonth === 10}
            className="h-10 sm:h-9 px-3.5 bg-white dark:bg-[#161922] border border-[#D8DCE3] dark:border-white/[0.12] text-[#111215] dark:text-[#F3F4F6] rounded-full disabled:opacity-40 inline-flex items-center gap-1 text-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Nov</span>
          </button>
          <span className="text-xs font-semibold text-[#111215] dark:text-[#F3F4F6] min-w-[110px] text-center">{monthName}</span>
          <button
            type="button"
            onClick={() => setCalendarMonth(11)}
            disabled={calendarMonth === 11}
            className="h-10 sm:h-9 px-3.5 bg-white dark:bg-[#161922] border border-[#D8DCE3] dark:border-white/[0.12] text-[#111215] dark:text-[#F3F4F6] rounded-full disabled:opacity-40 inline-flex items-center gap-1 text-xs"
          >
            <span>Dec</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mobile Agenda View */}
      <div className="md:hidden space-y-2.5">
        {agendaDays.map((entry) => (
          <div
            key={entry.iso}
            className={`bg-white dark:bg-[#111318] border rounded-2xl p-4 space-y-2.5 ${
              entry.iso === '2026-11-26'
                ? 'border-[#111215] dark:border-[#D8D8D8]'
                : 'border-[#E2E5EA] dark:border-white/[0.08]'
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono font-semibold text-[#111215] dark:text-[#F3F4F6]">{entry.iso}</span>
              {entry.iso === '2026-11-26' && (
                <span className="px-2 py-0.5 rounded-full bg-[#111215] dark:bg-[#F3F4F6] text-white dark:text-[#0B0C0E] text-[10px] font-semibold">
                  Today
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {entry.ms.map((m) => (
                <div key={m.id} className="text-xs px-3 py-1.5 bg-[#ECF7F1] dark:bg-[#102A1F] text-[#1F764D] dark:text-[#6EE7B7] rounded-xl font-medium">
                  Milestone: {m.title}
                </div>
              ))}
              {entry.mtgs.map((m) => (
                <div key={m.id} className="text-xs px-3 py-1.5 bg-[#FEF7E6] dark:bg-[#29200C] text-[#9B6B08] dark:text-[#FCD34D] rounded-xl flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>{m.title} ({m.timeRange})</span>
                </div>
              ))}
              {entry.wps.map((wp) => (
                <button
                  key={wp.id}
                  type="button"
                  onClick={() => onSelectWorkPackage(wp)}
                  className="w-full text-left text-xs px-3 py-2 bg-[#F8F9FA] dark:bg-[#161922] border border-[#E2E5EA] dark:border-white/[0.08] rounded-xl flex items-center justify-between gap-2"
                >
                  <span className="truncate font-mono text-[#111215] dark:text-[#F3F4F6]">
                    {wp.key} · {wp.title}
                  </span>
                  <StatusLabel status={wp.status} />
                </button>
              ))}
            </div>
          </div>
        ))}
        {agendaDays.length === 0 && (
          <div className="bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl p-8 text-center text-xs text-[#5E6572] dark:text-[#9CA3AF]">
            No deadlines, milestones, or meetings scheduled in {monthName}.
          </div>
        )}
      </div>

      {/* Desktop 7-Column Calendar Grid */}
      <div className="hidden md:block bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-x-auto shadow-[0_1px_3px_rgba(11,12,14,0.03)] dark:shadow-none">
        <div className="min-w-[780px]">
          <div className="grid grid-cols-7 bg-[#F8F9FA] dark:bg-[#161922] border-b border-[#E2E5EA] dark:border-white/[0.08] text-[11px] font-semibold text-[#5E6572] dark:text-[#9CA3AF]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-2.5 px-3">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-[#EFF1F4] dark:divide-white/[0.06]">
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="min-h-[104px] bg-[#F8F9FA] dark:bg-[#0B0C0E]" />;
              const iso = `${year}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayWps = scopedWork.filter((w) => w.dueDate === iso);
              const dayMs = data.milestones.filter((m) => m.targetDate === iso);
              const dayMtgs = data.meetings.filter((m) => m.date === iso);
              const isToday = iso === '2026-11-26';

              return (
                <div key={iso} className={`min-h-[104px] p-2.5 ${isToday ? 'bg-[#ECEEF2] dark:bg-[#1B202B]' : 'bg-white dark:bg-[#111318]'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-xs font-mono tabular-nums ${
                        isToday ? 'font-bold text-[#111215] dark:text-[#F3F4F6]' : 'text-[#5E6572] dark:text-[#9CA3AF]'
                      }`}
                    >
                      {day}
                    </span>
                    {isToday && <span className="text-[10px] font-semibold text-[#111215] dark:text-[#F3F4F6]">Today</span>}
                  </div>
                  <div className="space-y-1">
                    {dayMs.map((m) => (
                      <div key={m.id} className="text-[11px] px-2 py-0.5 bg-[#ECF7F1] dark:bg-[#102A1F] text-[#1F764D] dark:text-[#6EE7B7] rounded-full truncate">
                        {m.title}
                      </div>
                    ))}
                    {dayMtgs.map((m) => (
                      <div key={m.id} className="text-[11px] px-2 py-0.5 bg-[#FEF7E6] dark:bg-[#29200C] text-[#9B6B08] dark:text-[#FCD34D] rounded-full truncate flex items-center gap-1">
                        <CalendarIcon className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{m.title}</span>
                      </div>
                    ))}
                    {dayWps.map((wp) => (
                      <button
                        key={wp.id}
                        type="button"
                        onClick={() => onSelectWorkPackage(wp)}
                        className="w-full text-left text-[11px] px-2 py-0.5 bg-[#F3F4F6] dark:bg-[#181B22] hover:bg-[#E2E5EA] dark:hover:bg-[#222630] text-[#111215] dark:text-[#F3F4F6] rounded-full truncate font-mono"
                      >
                        {wp.key} · {wp.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
