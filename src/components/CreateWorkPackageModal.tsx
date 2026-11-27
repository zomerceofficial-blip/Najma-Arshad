import React, { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { api, type WorkspaceBootstrapData } from '../lib/api.ts';
import type { Priority, WorkPackage, WorkPackageStatus, WorkPackageType } from '../types/workspace.ts';

interface CreateWorkPackageModalProps {
  open: boolean;
  data: WorkspaceBootstrapData;
  defaultProjectId: string;
  prefill?: { title?: string; description?: string } | null;
  onClose: () => void;
  onCreated: (wp: WorkPackage) => Promise<void>;
}

export function CreateWorkPackageModal({
  open,
  data,
  defaultProjectId,
  prefill,
  onClose,
  onCreated,
}: CreateWorkPackageModalProps) {
  const [projectId, setProjectId] = useState(defaultProjectId || data.projects[0]?.id || '');
  const [type, setType] = useState<WorkPackageType>('task');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<WorkPackageStatus>('Draft');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [ownerId, setOwnerId] = useState(data.currentUser.id);
  const [milestoneId, setMilestoneId] = useState('');
  const [startDate, setStartDate] = useState('2026-11-26');
  const [dueDate, setDueDate] = useState('2026-12-12');
  const [estimateHours, setEstimateHours] = useState(8);
  const [labelsInput, setLabelsInput] = useState('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
  const [dependenciesConfirmedNone, setDependenciesConfirmedNone] = useState(true);
  const [highRisk, setHighRisk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setProjectId(defaultProjectId || data.projects[0]?.id || '');
      setMilestoneId('');
      setError(null);
      if (prefill?.title) setTitle(prefill.title);
      if (prefill?.description) setDescription(prefill.description);
    }
  }, [open, defaultProjectId, data.projects, prefill]);

  if (!open) return null;

  const projectMilestones = data.milestones.filter((m) => m.projectId === (projectId || data.projects[0]?.id));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const labels = labelsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const created = await api.createWorkPackage({
        projectId: projectId || data.projects[0]?.id,
        type,
        title,
        description,
        status,
        priority,
        ownerId,
        milestoneId: milestoneId || null,
        startDate,
        dueDate,
        estimateHours,
        labels,
        acceptanceCriteria,
        dependenciesConfirmedNone,
        highRisk,
      });
      setTitle('');
      setDescription('');
      setAcceptanceCriteria('');
      setLabelsInput('');
      setMilestoneId('');
      await onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create work package.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0B0C0E]/50 dark:bg-black/75 backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-wp-title"
    >
      <div className="w-full max-w-[640px] bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.1] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
        <div className="px-5 sm:px-6 py-4 bg-[#F8F9FA] dark:bg-[#161922] border-b border-[#E2E5EA] dark:border-white/[0.08] flex items-center justify-between shrink-0">
          <h2 id="create-wp-title" className="font-display text-sm font-semibold text-[#111215] dark:text-white">
            New Work Package
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-lg border border-[#E2E5EA] dark:border-white/[0.12] bg-white dark:bg-[#111318] hover:bg-[#ECEEF2] dark:hover:bg-white/[0.06] text-[#111215] dark:text-[#F3F4F6] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div role="alert" className="p-3.5 rounded-2xl border border-[#F5C6C2] dark:border-[#5E2325] bg-[#FEF0EE] dark:bg-[#2E1314] text-[#B42318] dark:text-[#FDA29B] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Project</label>
              <select
                value={projectId || data.projects[0]?.id || ''}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setMilestoneId('');
                }}
                className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-white dark:bg-[#14171D] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-[#2C313E] rounded-xl"
              >
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.key} · {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as WorkPackageType)}
                className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-white dark:bg-[#14171D] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-[#2C313E] rounded-xl"
              >
                <option value="initiative">Initiative</option>
                <option value="epic">Epic</option>
                <option value="feature">Feature</option>
                <option value="task">Task</option>
                <option value="subtask">Subtask</option>
                <option value="bug">Bug</option>
                <option value="research">Research Item</option>
                <option value="tech_debt">Technical Debt</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Initial Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as WorkPackageStatus)}
                className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-white dark:bg-[#14171D] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-[#2C313E] rounded-xl"
              >
                <option value="Draft">Draft</option>
                <option value="Backlog">Backlog</option>
                <option value="Ready">Ready</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB]">Title</label>
              <span className="text-[10px] font-mono text-[#5E6572] dark:text-[#9CA3AF] tabular-nums">{title.length}/160</span>
            </div>
            <input
              type="text"
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Concise engineering work summary…"
              className="w-full h-11 sm:h-10 px-3.5 text-base sm:text-sm bg-white dark:bg-[#14171D] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-[#2C313E] rounded-xl"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB]">Problem Statement & Scope</label>
              <span className="text-[10px] font-mono text-[#5E6572] dark:text-[#9CA3AF] tabular-nums">{description.length}/2000</span>
            </div>
            <textarea
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Context, constraints, and technical scope…"
              className="w-full p-3 text-base sm:text-xs bg-white dark:bg-[#14171D] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-[#2C313E] rounded-2xl"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Accountable Owner</label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-white dark:bg-[#14171D] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-[#2C313E] rounded-xl"
              >
                {data.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-white dark:bg-[#14171D] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-[#2C313E] rounded-xl"
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs font-mono bg-white dark:bg-[#14171D] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-[#2C313E] rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs font-mono bg-white dark:bg-[#14171D] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-[#2C313E] rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Milestone (Optional)</label>
              <select
                value={milestoneId}
                onChange={(e) => setMilestoneId(e.target.value)}
                className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-white dark:bg-[#14171D] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-[#2C313E] rounded-xl"
              >
                <option value="">No milestone</option>
                {projectMilestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({m.targetDate})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">Labels (comma-separated)</label>
              <input
                type="text"
                value={labelsInput}
                onChange={(e) => setLabelsInput(e.target.value)}
                placeholder="security, api, reliability"
                className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-white dark:bg-[#14171D] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-[#2C313E] rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#111215] dark:text-[#E5E7EB] mb-1">
              Acceptance Criteria (Required before Ready)
            </label>
            <textarea
              rows={2}
              value={acceptanceCriteria}
              onChange={(e) => setAcceptanceCriteria(e.target.value)}
              placeholder="Objective evidence required for reviewer acceptance…"
              className="w-full p-3 text-base sm:text-xs bg-white dark:bg-[#14171D] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-[#2C313E] rounded-2xl"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-[#EFF1F4] dark:border-[#1B1F28]">
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#111215] dark:text-[#E5E7EB]">
              <label className="inline-flex items-center gap-1.5">
                <span>Estimate (h):</span>
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={estimateHours}
                  onChange={(e) => setEstimateHours(Number(e.target.value))}
                  className="w-20 h-9 sm:h-8 px-2 text-base sm:text-xs font-mono bg-white dark:bg-[#14171D] text-[#111215] dark:text-[#F3F4F6] border border-[#D8DCE3] dark:border-[#2C313E] rounded-xl"
                />
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer min-h-[36px]">
                <input
                  type="checkbox"
                  checked={dependenciesConfirmedNone}
                  onChange={(e) => setDependenciesConfirmedNone(e.target.checked)}
                />
                <span>No unknown blockers</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer min-h-[36px]">
                <input
                  type="checkbox"
                  checked={highRisk}
                  onChange={(e) => setHighRisk(e.target.checked)}
                />
                <span>High-risk change</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-11 sm:h-9 px-4 border border-[#D8DCE3] dark:border-white/[0.12] text-[#111215] dark:text-[#E5E7EB] hover:bg-[#ECEEF2] dark:hover:bg-white/[0.06] rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="h-11 sm:h-9 px-5 bg-[#111215] hover:bg-[#262930] dark:bg-white dark:hover:bg-[#E5E7EB] text-white dark:text-[#0B0C0E] text-xs font-medium rounded-lg"
              >
                {submitting ? 'Creating…' : 'Create Work Package'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
