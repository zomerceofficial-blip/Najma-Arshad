import {
  AlertOctagon,
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  FileText,
  Flame,
  PauseCircle,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { Priority, ProjectHealth, WorkPackageStatus, WorkPackageType } from '../types/workspace.ts';

export function StatusLabel({ status }: { status: WorkPackageStatus }) {
  const config: Record<
    WorkPackageStatus,
    { color: string; bg: string; icon: typeof Circle }
  > = {
    Draft: {
      color: 'text-[#5E6572] dark:text-[#9CA3AF]',
      bg: 'bg-[#F3F4F6] dark:bg-white/[0.06]',
      icon: FileText,
    },
    Backlog: {
      color: 'text-[#5E6572] dark:text-[#9CA3AF]',
      bg: 'bg-[#F3F4F6] dark:bg-white/[0.06]',
      icon: Circle,
    },
    Ready: {
      color: 'text-[#111215] dark:text-[#E5E7EB]',
      bg: 'bg-[#ECEEF2] dark:bg-white/[0.09]',
      icon: ArrowRight,
    },
    'In Progress': {
      color: 'text-[#111215] dark:text-white',
      bg: 'bg-[#E5E7EB] dark:bg-white/[0.12]',
      icon: Clock,
    },
    'In Review': {
      color: 'text-[#9B6B08] dark:text-[#FCD34D]',
      bg: 'bg-[#FEF7E6] dark:bg-[#F59E0B]/15',
      icon: Eye,
    },
    Verification: {
      color: 'text-[#9B6B08] dark:text-[#FCD34D]',
      bg: 'bg-[#FEF7E6] dark:bg-[#F59E0B]/15',
      icon: ShieldCheck,
    },
    Accepted: {
      color: 'text-[#1F764D] dark:text-[#6EE7B7]',
      bg: 'bg-[#ECF7F1] dark:bg-[#10B981]/15',
      icon: CheckCircle2,
    },
    Closed: {
      color: 'text-[#1F764D] dark:text-[#6EE7B7]',
      bg: 'bg-[#ECF7F1] dark:bg-[#10B981]/15',
      icon: Archive,
    },
    Blocked: {
      color: 'text-[#B42318] dark:text-[#FDA29B]',
      bg: 'bg-[#FEF0EE] dark:bg-[#EF4444]/15',
      icon: AlertOctagon,
    },
    Waiting: {
      color: 'text-[#9B6B08] dark:text-[#FCD34D]',
      bg: 'bg-[#FEF7E6] dark:bg-[#F59E0B]/15',
      icon: PauseCircle,
    },
    Cancelled: {
      color: 'text-[#5E6572] dark:text-[#9CA3AF]',
      bg: 'bg-[#F3F4F6] dark:bg-white/[0.06]',
      icon: XCircle,
    },
    Reopened: {
      color: 'text-[#B42318] dark:text-[#FDA29B]',
      bg: 'bg-[#FEF0EE] dark:bg-[#EF4444]/15',
      icon: RotateCcw,
    },
  };
  const item = config[status] || config.Draft;
  const Icon = item.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-md whitespace-nowrap shrink-0 ${item.bg} ${item.color}`}
    >
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
}

export function PriorityLabel({ priority }: { priority: Priority }) {
  const map: Record<Priority, { color: string; icon: typeof ArrowUp }> = {
    Critical: { color: 'text-[#B42318] dark:text-[#FDA29B]', icon: Flame },
    High: { color: 'text-[#9B6B08] dark:text-[#FCD34D]', icon: ArrowUp },
    Medium: { color: 'text-[#111215] dark:text-[#E5E7EB]', icon: ArrowRight },
    Low: { color: 'text-[#5E6572] dark:text-[#9CA3AF]', icon: ArrowDown },
  };
  const item = map[priority];
  const Icon = item.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap shrink-0 ${item.color}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{priority}</span>
    </span>
  );
}

export function HealthLabel({ health }: { health: ProjectHealth }) {
  const map: Record<ProjectHealth, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
    on_track: {
      label: 'On Track',
      color: 'text-[#1F764D] dark:text-[#6EE7B7]',
      bg: 'bg-[#ECF7F1] dark:bg-[#10B981]/15',
      icon: CheckCircle2,
    },
    at_risk: {
      label: 'At Risk',
      color: 'text-[#9B6B08] dark:text-[#FCD34D]',
      bg: 'bg-[#FEF7E6] dark:bg-[#F59E0B]/15',
      icon: AlertTriangle,
    },
    off_track: {
      label: 'Off Track',
      color: 'text-[#B42318] dark:text-[#FDA29B]',
      bg: 'bg-[#FEF0EE] dark:bg-[#EF4444]/15',
      icon: AlertOctagon,
    },
  };
  const item = map[health];
  const Icon = item.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-md whitespace-nowrap shrink-0 ${item.bg} ${item.color}`}
    >
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span>{item.label}</span>
    </span>
  );
}

export function formatWorkType(type: WorkPackageType): string {
  const labels: Record<WorkPackageType, string> = {
    initiative: 'Initiative',
    epic: 'Epic',
    feature: 'Feature',
    task: 'Task',
    subtask: 'Subtask',
    bug: 'Bug',
    research: 'Research',
    tech_debt: 'Tech Debt',
  };
  return labels[type] || type;
}

export function UserAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const dims = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';
  return (
    <span
      className={`${dims} inline-flex items-center justify-center rounded-lg bg-[#111215] dark:bg-[#222733] text-white font-semibold shrink-0 ring-1 ring-black/10 dark:ring-white/15`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
