import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Copy,
  CopyPlus,
  Download,
  ExternalLink as ExternalIcon,
  GitBranch,
  GitMerge,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { api, safeHttpUrl, type WorkspaceBootstrapData } from '../lib/api.ts';
import type { Priority, WorkPackage, WorkPackageStatus } from '../types/workspace.ts';
import { formatWorkType, PriorityLabel, StatusLabel, UserAvatar } from './StatusLabel.tsx';
import { ConfirmDialog, type ToastMessage } from './ToastAndDialogs.tsx';

interface WorkPackageDrawerProps {
  workPackage: WorkPackage | null;
  data: WorkspaceBootstrapData;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onDuplicate?: (title: string, description: string) => void;
  onNotify?: (tone: ToastMessage['tone'], title: string, detail?: string) => void;
}

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
  'Waiting',
  'Cancelled',
  'Reopened',
];

export function WorkPackageDrawer({
  workPackage,
  data,
  onClose,
  onRefresh,
  onDuplicate,
  onNotify,
}: WorkPackageDrawerProps) {
  const [status, setStatus] = useState<WorkPackageStatus>('Draft');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [ownerId, setOwnerId] = useState('');
  const [reviewerId, setReviewerId] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimateHours, setEstimateHours] = useState(8);
  const [labelsInput, setLabelsInput] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
  const [evidenceNote, setEvidenceNote] = useState('');
  const [dependenciesConfirmedNone, setDependenciesConfirmedNone] = useState(false);
  const [blockerReason, setBlockerReason] = useState('');
  const [blockerOwnerId, setBlockerOwnerId] = useState('');
  const [nextReviewDate, setNextReviewDate] = useState('');
  const [blockerExceptionReason, setBlockerExceptionReason] = useState('');
  const [highRisk, setHighRisk] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [newPredId, setNewPredId] = useState('');
  const [newDepType, setNewDepType] = useState<'blocks' | 'relates_to'>('blocks');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workPackage) {
      setStatus(workPackage.status);
      setPriority(workPackage.priority);
      setOwnerId(workPackage.ownerId);
      setReviewerId(workPackage.reviewerId || '');
      setMilestoneId(workPackage.milestoneId || '');
      setStartDate(workPackage.startDate);
      setDueDate(workPackage.dueDate);
      setEstimateHours(workPackage.estimateHours);
      setLabelsInput(workPackage.labels.join(', '));
      setTitle(workPackage.title);
      setDescription(workPackage.description);
      setAcceptanceCriteria(workPackage.acceptanceCriteria);
      setEvidenceNote(workPackage.evidenceNote || '');
      setDependenciesConfirmedNone(workPackage.dependenciesConfirmedNone);
      setBlockerReason(workPackage.blockerReason || '');
      setBlockerOwnerId(workPackage.blockerOwnerId || '');
      setNextReviewDate(workPackage.nextReviewDate || '');
      setBlockerExceptionReason(workPackage.blockerExceptionReason || '');
      setHighRisk(Boolean(workPackage.highRisk));
      setConfirmDelete(false);
      setError(null);
      setNotice(null);
      setNewPredId('');
    }
  }, [workPackage]);

  useEffect(() => {
    if (!workPackage) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [workPackage, onClose]);

  if (!workPackage) return null;

  const project = data.projects.find((p) => p.id === workPackage.projectId);
  const projectMilestones = data.milestones.filter((m) => m.projectId === workPackage.projectId);
  const predecessors = data.dependencies.filter((d) => d.successorId === workPackage.id);
  const successors = data.dependencies.filter((d) => d.predecessorId === workPackage.id);
  const wpComments = data.comments.filter(
    (c) => c.resourceType === 'work_package' && c.resourceId === workPackage.id
  );
  const wpAttachments = data.attachments.filter(
    (a) => a.parentType === 'work_package' && a.parentId === workPackage.id
  );
  const wpLinks = data.externalLinks.filter((l) => l.workPackageId === workPackage.id);

  const unresolvedBlockingPredecessors = predecessors
    .filter((d) => d.type === 'blocks')
    .map((d) => data.workPackages.find((w) => w.id === d.predecessorId))
    .filter((w): w is WorkPackage => Boolean(w && w.status !== 'Accepted' && w.status !== 'Closed'));

  const canApproveSecurity =
    ['Workspace Owner', 'Workspace Administrator', 'Programme Manager', 'Project Manager', 'Team Lead', 'Reviewer / QA'].includes(
      data.currentUser.role
    ) && data.currentUser.id !== workPackage.creatorId;

  const canDelete = ['Workspace Owner', 'Workspace Administrator', 'Programme Manager', 'Project Manager'].includes(
    data.currentUser.role
  );

  const getUserName = (id?: string | null) =>
    data.users.find((u) => u.id === id)?.displayName || 'Unassigned';

  const getWpKey = (id: string) =>
    data.workPackages.find((w) => w.id === id)?.key || id;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!workPackage) return;
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const labels = labelsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await api.updateWorkPackage(workPackage.id, {
        title,
        description,
        status,
        priority,
        ownerId,
        reviewerId: reviewerId || null,
        milestoneId: milestoneId || null,
        startDate,
        dueDate,
        estimateHours,
        labels,
        acceptanceCriteria,
        evidenceNote,
        dependenciesConfirmedNone,
        highRisk,
        blockerReason: status === 'Blocked' ? blockerReason : workPackage.blockerReason,
        blockerOwnerId: status === 'Blocked' ? blockerOwnerId || null : workPackage.blockerOwnerId,
        nextReviewDate: status === 'Blocked' ? nextReviewDate : workPackage.nextReviewDate,
        blockerExceptionReason: blockerExceptionReason.trim() || workPackage.blockerExceptionReason,
        version: workPackage.version,
      });
      await onRefresh();
      setNotice('Work package updated and audit trail recorded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSecurityApprove() {
    if (!workPackage) return;
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      await api.updateWorkPackage(workPackage.id, {
        approveSecurity: true,
        version: workPackage.version,
      });
      await onRefresh();
      setNotice('Independent security & reviewer sign-off recorded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record sign-off.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!workPackage) return;
    setError(null);
    setSaving(true);
    try {
      await api.deleteWorkPackage(workPackage.id);
      await onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete work package.');
      setSaving(false);
    }
  }

  async function handleAddDependency() {
    if (!workPackage || !newPredId) return;
    setError(null);
    setNotice(null);
    try {
      await api.createDependency({
        predecessorId: newPredId,
        successorId: workPackage.id,
        type: newDepType,
      });
      setNewPredId('');
      await onRefresh();
      setNotice('Dependency added (verified cycle-free).');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add dependency.');
    }
  }

  async function handleRemoveDependency(depId: string) {
    setError(null);
    try {
      await api.deleteDependency(depId);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove dependency.');
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!workPackage || !commentBody.trim()) return;
    setError(null);
    try {
      await api.addComment(workPackage.id, commentBody);
      setCommentBody('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post comment.');
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !workPackage) return;
    setError(null);
    setNotice(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        await api.uploadAttachment({
          parentType: 'work_package',
          parentId: workPackage.id,
          projectId: workPackage.projectId,
          fileName: file.name,
          mediaType: file.type || 'text/plain',
          contentBase64: base64,
        });
        await onRefresh();
        setNotice(`Attached ${file.name} with SHA-256 verification.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed.');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  const candidatePredecessors = data.workPackages.filter((w) => w.id !== workPackage.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-[#0B0C0E]/50 dark:bg-black/75 backdrop-blur-[2px] p-0 sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wp-drawer-title"
    >
      <div className="w-full max-w-[740px] bg-white dark:bg-[#111318] h-[92dvh] sm:h-full border border-[#E2E5EA] dark:border-white/[0.08] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Drawer Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#E2E5EA] dark:border-white/[0.08] flex items-center justify-between gap-3 bg-[#F8F9FA] dark:bg-[#161922] shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs text-[#5E6572] dark:text-[#9CA3AF]">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(workPackage.key).catch(() => {});
                  onNotify?.('info', `Copied ${workPackage.key} to clipboard`);
                }}
                title="Copy work package key"
                className="font-mono font-semibold text-[#111215] dark:text-[#F3F4F6] hover:underline inline-flex items-center gap-1"
              >
                <span>{workPackage.key}</span>
                <Copy className="w-3 h-3 opacity-60" />
              </button>
              <span aria-hidden="true">·</span>
              <span className="truncate max-w-[140px] sm:max-w-none">{project?.name}</span>
              <span aria-hidden="true">·</span>
              <span>{formatWorkType(workPackage.type)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">v{workPackage.version}</span>
              {(title !== workPackage.title ||
                description !== workPackage.description ||
                status !== workPackage.status ||
                priority !== workPackage.priority ||
                acceptanceCriteria !== workPackage.acceptanceCriteria) && (
                <span className="px-2 py-0.5 rounded-full bg-[#FEF7E6] dark:bg-[#29200C] text-[#9B6B08] dark:text-[#FCD34D] text-[10px] font-medium">
                  Unsaved edits
                </span>
              )}
            </div>
            <h2 id="wp-drawer-title" className="font-display text-sm sm:text-base font-semibold text-[#111215] dark:text-[#F3F4F6] mt-0.5 truncate">
              {workPackage.title}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusLabel status={workPackage.status} />
            {onDuplicate && (
              <button
                type="button"
                onClick={() => onDuplicate(`${workPackage.title} (Copy)`, workPackage.description)}
                title="Duplicate Work Package"
                aria-label="Duplicate work package"
                className="w-9 h-9 rounded-full border border-[#E2E5EA] dark:border-white/[0.12] bg-white dark:bg-[#181B22] hover:bg-[#ECEEF2] dark:hover:bg-[#232833] flex items-center justify-center text-[#111215] dark:text-[#F3F4F6]"
              >
                <CopyPlus className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close detail panel"
              className="w-9 h-9 rounded-full border border-[#E2E5EA] dark:border-white/[0.12] bg-white dark:bg-[#181B22] hover:bg-[#ECEEF2] dark:hover:bg-[#232833] flex items-center justify-center text-[#111215] dark:text-[#F3F4F6]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-2xl border border-[#F5C6C2] dark:border-[#5E2325] bg-[#FEF0EE] dark:bg-[#2E1314] text-[#B42318] dark:text-[#FDA29B] text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          {notice && (
            <div className="p-3.5 rounded-2xl border border-[#BCE3CE] dark:border-[#1F4E3A] bg-[#ECF7F1] dark:bg-[#102A1F] text-[#1F764D] dark:text-[#6EE7B7] text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{notice}</span>
            </div>
          )}

          {/* Primary Edit & Workflow Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-11 sm:h-10 px-3.5 text-base sm:text-sm bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl focus:outline-none focus:border-[#111215] dark:focus:border-[#D8D8D8]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as WorkPackageStatus)}
                  className="w-full h-11 sm:h-9 px-2.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full h-11 sm:h-9 px-2.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                >
                  {(['Critical', 'High', 'Medium', 'Low'] as Priority[]).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Accountable Owner</label>
                <select
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  className="w-full h-11 sm:h-9 px-2.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                >
                  {data.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Designated Reviewer</label>
                <select
                  value={reviewerId}
                  onChange={(e) => setReviewerId(e.target.value)}
                  className="w-full h-11 sm:h-9 px-2.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                >
                  <option value="">Unassigned</option>
                  {data.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-11 sm:h-9 px-2.5 text-base sm:text-xs font-mono bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full h-11 sm:h-9 px-2.5 text-base sm:text-xs font-mono bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Estimate (Hours)</label>
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={estimateHours}
                  onChange={(e) => setEstimateHours(Number(e.target.value))}
                  className="w-full h-11 sm:h-9 px-2.5 text-base sm:text-xs font-mono bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Milestone</label>
                <select
                  value={milestoneId}
                  onChange={(e) => setMilestoneId(e.target.value)}
                  className="w-full h-11 sm:h-9 px-2.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                >
                  <option value="">None</option>
                  {projectMilestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Labels (comma-separated)</label>
                <input
                  type="text"
                  value={labelsInput}
                  onChange={(e) => setLabelsInput(e.target.value)}
                  placeholder="security, architecture, release"
                  className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                />
              </div>
              <div className="flex flex-col justify-end gap-2 pb-1">
                <label className="inline-flex items-center gap-2 text-xs text-[#111215] dark:text-[#E5E7EB] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dependenciesConfirmedNone}
                    onChange={(e) => setDependenciesConfirmedNone(e.target.checked)}
                    className="rounded border-[#D8DCE3] dark:border-white/[0.12]"
                  />
                  <span>Confirmed no unknown dependencies (Ready gate)</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-[#111215] dark:text-[#E5E7EB] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={highRisk}
                    onChange={(e) => setHighRisk(e.target.checked)}
                    className="rounded border-[#D8DCE3] dark:border-white/[0.12]"
                  />
                  <span>High-risk change (requires separate security sign-off)</span>
                </label>
              </div>
            </div>

            {highRisk && (
              <div className="p-3.5 rounded-2xl border border-[#E2E5EA] dark:border-white/[0.08] bg-[#F8F9FA] dark:bg-[#161922] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-semibold text-[#111215] dark:text-[#F3F4F6]">High-Risk Separation of Duties: </span>
                  {workPackage.securityApprovedBy ? (
                    <span className="text-[#1F764D] dark:text-[#6EE7B7] font-medium">
                      Signed off by {getUserName(workPackage.securityApprovedBy)}
                    </span>
                  ) : (
                    <span className="text-[#9B6B08] dark:text-[#FCD34D]">
                      Awaiting independent reviewer / security sign-off
                    </span>
                  )}
                </div>
                {!workPackage.securityApprovedBy && canApproveSecurity && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSecurityApprove}
                    className="h-8 px-3.5 bg-[#111215] dark:bg-[#F3F4F6] text-white dark:text-[#0B0C0E] rounded-full text-xs font-medium inline-flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Grant Security Sign-Off</span>
                  </button>
                )}
              </div>
            )}

            {unresolvedBlockingPredecessors.length > 0 && (
              <div className="p-3.5 rounded-2xl border border-[#F0D9A6] dark:border-[#523E14] bg-[#FEF7E6] dark:bg-[#29200C] space-y-2 text-xs">
                <div className="font-semibold text-[#9B6B08] dark:text-[#FCD34D]">
                  Unresolved Predecessors: {unresolvedBlockingPredecessors.map((w) => w.key).join(', ')}
                </div>
                <input
                  type="text"
                  value={blockerExceptionReason}
                  onChange={(e) => setBlockerExceptionReason(e.target.value)}
                  placeholder="Optional authorized exception reason to enter Ready/In Progress…"
                  className="w-full h-10 sm:h-9 px-3 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                />
              </div>
            )}

            {status === 'Blocked' && (
              <div className="p-4 rounded-2xl border border-[#F5C6C2] dark:border-[#5E2325] bg-[#FEF0EE] dark:bg-[#2E1314] space-y-3">
                <div className="text-xs font-semibold text-[#B42318] dark:text-[#FDA29B]">
                  Blocker Governance Fields (Required)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Blocker Owner</label>
                    <select
                      value={blockerOwnerId}
                      onChange={(e) => setBlockerOwnerId(e.target.value)}
                      className="w-full h-11 sm:h-9 px-2.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                    >
                      <option value="">Select owner…</option>
                      {data.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Next Review Date</label>
                    <input
                      type="date"
                      value={nextReviewDate}
                      onChange={(e) => setNextReviewDate(e.target.value)}
                      className="w-full h-11 sm:h-9 px-2.5 text-base sm:text-xs font-mono bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Blocker Reason</label>
                  <input
                    type="text"
                    value={blockerReason}
                    onChange={(e) => setBlockerReason(e.target.value)}
                    placeholder="Explain what is blocking resolution…"
                    className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">
                Problem Statement & Scope
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-2xl focus:outline-none focus:border-[#111215] dark:focus:border-[#D8D8D8]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">
                Acceptance Criteria (Required before Ready)
              </label>
              <textarea
                rows={2}
                value={acceptanceCriteria}
                onChange={(e) => setAcceptanceCriteria(e.target.value)}
                placeholder="Measurable verification conditions…"
                className="w-full p-3 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-2xl focus:outline-none focus:border-[#111215] dark:focus:border-[#D8D8D8]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">
                Implementation & Verification Evidence (Required for In Review / Accepted)
              </label>
              <input
                type="text"
                value={evidenceNote}
                onChange={(e) => setEvidenceNote(e.target.value)}
                placeholder="MR reference, test run ID, or verification summary…"
                className="w-full h-11 sm:h-9 px-3.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl focus:outline-none focus:border-[#111215] dark:focus:border-[#D8D8D8]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#EFF1F4] dark:border-[#1B1F28]">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#5E6572] dark:text-[#9CA3AF]">
                <PriorityLabel priority={priority} />
                <span aria-hidden="true">·</span>
                <span>Creator: {getUserName(workPackage.creatorId)}</span>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="h-10 sm:h-9 px-3.5 border border-[#F5C6C2] dark:border-[#5E2325] text-[#B42318] dark:text-[#FDA29B] rounded-full text-xs hover:bg-[#FEF0EE] dark:hover:bg-[#2E1314]"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 sm:h-9 px-5 bg-[#111215] hover:bg-[#262930] dark:bg-[#F3F4F6] dark:hover:bg-[#D8D8D8] disabled:opacity-60 text-white dark:text-[#0B0C0E] text-xs font-medium rounded-full transition-colors"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>

          {/* Dependencies */}
          <div className="pt-5 border-t border-[#E2E5EA] dark:border-white/[0.08] space-y-3">
            <h3 className="font-display text-xs font-semibold text-[#111215] dark:text-[#F3F4F6] flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-[#111215] dark:text-[#D8D8D8]" aria-hidden="true" />
              <span>Directed Dependencies (Cycle-Checked)</span>
            </h3>

            <div className="space-y-1.5 text-xs">
              {predecessors.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between px-3.5 py-2.5 bg-[#F8F9FA] dark:bg-[#161922] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl"
                >
                  <span>
                    <span className="font-mono font-semibold text-[#111215] dark:text-[#F3F4F6]">
                      {getWpKey(d.predecessorId)}
                    </span>{' '}
                    <span className="text-[#5E6572] dark:text-[#9CA3AF]">({d.type})</span> →{' '}
                    <span className="font-mono font-semibold text-[#111215] dark:text-[#F3F4F6]">{workPackage.key}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDependency(d.id)}
                    aria-label="Remove dependency"
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[#5E6572] dark:text-[#9CA3AF] hover:text-[#B42318] dark:hover:text-[#FDA29B]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {successors.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between px-3.5 py-2.5 bg-[#F8F9FA] dark:bg-[#161922] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl"
                >
                  <span>
                    <span className="font-mono font-semibold text-[#111215] dark:text-[#F3F4F6]">{workPackage.key}</span>{' '}
                    <span className="text-[#5E6572] dark:text-[#9CA3AF]">({d.type})</span> →{' '}
                    <span className="font-mono font-semibold text-[#111215] dark:text-[#F3F4F6]">
                      {getWpKey(d.successorId)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDependency(d.id)}
                    aria-label="Remove dependency"
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[#5E6572] dark:text-[#9CA3AF] hover:text-[#B42318] dark:hover:text-[#FDA29B]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {predecessors.length === 0 && successors.length === 0 && (
                <p className="text-xs text-[#5E6572] dark:text-[#9CA3AF]">No linked dependencies.</p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <select
                value={newPredId}
                onChange={(e) => setNewPredId(e.target.value)}
                className="flex-1 min-w-0 h-11 sm:h-9 px-2.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
              >
                <option value="">Select predecessor work package…</option>
                {candidatePredecessors.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.key} · {w.title}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <select
                  value={newDepType}
                  onChange={(e) => setNewDepType(e.target.value as 'blocks' | 'relates_to')}
                  className="h-11 sm:h-9 px-2.5 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-xl"
                >
                  <option value="blocks">blocks</option>
                  <option value="relates_to">relates_to</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddDependency}
                  disabled={!newPredId}
                  className="h-11 sm:h-9 px-3.5 bg-white dark:bg-[#181B22] border border-[#D8DCE3] dark:border-white/[0.12] hover:bg-[#ECEEF2] dark:hover:bg-[#232833] text-[#111215] dark:text-[#F3F4F6] disabled:opacity-50 text-xs font-medium rounded-full inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Predecessor</span>
                </button>
              </div>
            </div>
          </div>

          {/* Linked Engineering Artifacts */}
          <div className="pt-5 border-t border-[#E2E5EA] dark:border-white/[0.08] space-y-2.5">
            <h3 className="font-display text-xs font-semibold text-[#111215] dark:text-[#F3F4F6] flex items-center gap-1.5">
              <GitMerge className="w-3.5 h-3.5 text-[#111215] dark:text-[#D8D8D8]" aria-hidden="true" />
              <span>Linked Engineering Traceability</span>
            </h3>
            {wpLinks.length > 0 ? (
              <div className="divide-y divide-[#EFF1F4] dark:divide-white/[0.06] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-hidden">
                {wpLinks.map((link) => {
                  const href = safeHttpUrl(link.url);
                  return (
                    <div key={link.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="font-medium text-[#111215] dark:text-[#F3F4F6] truncate">{link.title}</div>
                        <div className="text-[11px] text-[#5E6572] dark:text-[#9CA3AF]">
                          {link.provider} · {link.kind} · {link.status}
                        </div>
                      </div>
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-mono text-[#111215] dark:text-[#D8D8D8] inline-flex items-center gap-1 shrink-0 hover:underline"
                        >
                          {link.externalId}
                          <ExternalIcon className="w-3 h-3" aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="text-[11px] font-mono text-[#111215] dark:text-[#D8D8D8] shrink-0">
                          {link.externalId}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[#5E6572] dark:text-[#9CA3AF]">No linked merge requests or pipeline runs yet.</p>
            )}
          </div>

          {/* Attachments */}
          <div className="pt-5 border-t border-[#E2E5EA] dark:border-white/[0.08] space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xs font-semibold text-[#111215] dark:text-[#F3F4F6] flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-[#111215] dark:text-[#D8D8D8]" aria-hidden="true" />
                <span>Attachments ({wpAttachments.length})</span>
              </h3>
              <label className="h-9 sm:h-8 px-3.5 bg-white dark:bg-[#181B22] border border-[#D8DCE3] dark:border-white/[0.12] hover:bg-[#ECEEF2] dark:hover:bg-[#232833] text-[#111215] dark:text-[#F3F4F6] rounded-full text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer">
                <Plus className="w-3.5 h-3.5" />
                <span>Upload File</span>
                <input type="file" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            {wpAttachments.length > 0 && (
              <div className="divide-y divide-[#EFF1F4] dark:divide-white/[0.06] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl overflow-hidden">
                {wpAttachments.map((att) => (
                  <div key={att.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-medium text-[#111215] dark:text-[#F3F4F6] truncate">{att.fileName}</div>
                      <div className="text-[11px] text-[#5E6572] dark:text-[#9CA3AF] font-mono tabular-nums">
                        {(att.sizeBytes / 1024).toFixed(1)} KB · sha256:{att.checksumSha256.slice(0, 12)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => api.downloadAttachment(att.id, att.fileName)}
                      className="h-8 sm:h-7 px-3 border border-[#D8DCE3] dark:border-white/[0.12] text-[#111215] dark:text-[#F3F4F6] rounded-full hover:bg-[#ECEEF2] dark:hover:bg-[#181B22] inline-flex items-center gap-1 text-xs shrink-0"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="pt-5 border-t border-[#E2E5EA] dark:border-white/[0.08] space-y-3">
            <h3 className="font-display text-xs font-semibold text-[#111215] dark:text-[#F3F4F6] flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#111215] dark:text-[#D8D8D8]" aria-hidden="true" />
              <span>Discussion ({wpComments.length})</span>
            </h3>
            <div className="space-y-3">
              {wpComments.map((c) => {
                const author = getUserName(c.authorId);
                return (
                  <div key={c.id} className="p-3.5 bg-[#F8F9FA] dark:bg-[#161922] border border-[#E2E5EA] dark:border-white/[0.08] rounded-2xl space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={author} />
                        <span className="font-medium text-[#111215] dark:text-[#F3F4F6]">{author}</span>
                      </div>
                      <span className="text-[11px] font-mono text-[#5E6572] dark:text-[#9CA3AF] tabular-nums">
                        {new Date(c.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-[#111215] dark:text-[#E5E7EB] leading-relaxed">{c.body}</p>
                    <div className="flex items-center gap-1.5 pt-1">
                      {(['ACK', '+1', 'Verified'] as const).map((label) => {
                        const voters = c.reactions[label] || [];
                        const active = voters.includes(data.currentUser.id);
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={async () => {
                              await api.reactComment(c.id, label);
                              await onRefresh();
                            }}
                            className={`h-6 px-2.5 rounded-full text-[11px] font-mono border transition-colors ${
                              active
                                ? 'bg-[#111215] dark:bg-[#F3F4F6] text-white dark:text-[#0B0C0E] border-transparent'
                                : 'bg-white dark:bg-[#111318] border-[#D8DCE3] dark:border-white/[0.12] text-[#5E6572] dark:text-[#9CA3AF]'
                            }`}
                          >
                            {label} {voters.length > 0 ? voters.length : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <form onSubmit={handleAddComment} className="flex items-center gap-2">
              <input
                type="text"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Write a comment or @mention a teammate…"
                className="flex-1 h-11 sm:h-9 px-4 text-base sm:text-xs bg-white dark:bg-[#161922] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-white/[0.12] rounded-full focus:outline-none focus:border-[#111215] dark:focus:border-[#D8D8D8]"
              />
              <button
                type="submit"
                className="h-11 sm:h-9 px-4 bg-[#111215] hover:bg-[#262930] dark:bg-[#F3F4F6] dark:hover:bg-[#D8D8D8] text-white dark:text-[#0B0C0E] text-xs font-medium rounded-full inline-flex items-center gap-1.5 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Post</span>
              </button>
            </form>
          </div>

          {/* Field History */}
          {workPackage.history.length > 0 && (
            <div className="pt-5 border-t border-[#E2E5EA] dark:border-white/[0.08] space-y-2">
              <h3 className="font-display text-xs font-semibold text-[#111215] dark:text-[#F3F4F6]">Change History</h3>
              <div className="divide-y divide-[#EFF1F4] dark:divide-white/[0.06] text-xs">
                {workPackage.history.map((h) => (
                  <div key={h.id} className="py-1.5 flex items-center justify-between gap-2 text-[#5E6572] dark:text-[#9CA3AF]">
                    <span>
                      <strong className="text-[#111215] dark:text-[#F3F4F6]">{getUserName(h.actorId)}</strong> changed{' '}
                      <span className="font-mono">{h.field}</span> from{' '}
                      <span className="line-through">{h.oldValue}</span> to{' '}
                      <strong className="text-[#111215] dark:text-[#F3F4F6]">{h.newValue}</strong>
                    </span>
                    <span className="font-mono text-[11px] tabular-nums shrink-0">
                      {new Date(h.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${workPackage.key}?`}
        description={`Are you sure you want to permanently remove "${workPackage.title}" and its dependency edges? This action is recorded in the audit log.`}
        confirmLabel="Delete Work Package"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await handleDelete();
          onNotify?.('info', `Deleted ${workPackage.key}`);
        }}
      />
    </div>
  );
}
