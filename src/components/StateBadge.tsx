import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  FileEdit,
  Loader2,
  PauseCircle,
  PlayCircle,
  XCircle,
} from 'lucide-react';
import type { ApprovalStatus, ArtifactReviewStatus, TaskExecutionState, WorkflowState } from '../core/contracts';
import { STATE_METADATA } from '../core/stateMachine';

interface WorkflowStateLabelProps {
  state: WorkflowState;
  size?: 'sm' | 'md';
}

export function WorkflowStateLabel({ state, size = 'md' }: WorkflowStateLabelProps) {
  const meta = STATE_METADATA[state];
  const colorClasses: Record<typeof meta.tone, string> = {
    neutral: 'text-slate-700 bg-slate-100 border-slate-200',
    info: 'text-blue-700 bg-blue-50 border-blue-200',
    warning: 'text-amber-800 bg-amber-50 border-amber-200',
    success: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    danger: 'text-red-800 bg-red-50 border-red-200',
  };

  const Icon =
    state === 'draft'
      ? FileEdit
      : state === 'queued'
        ? Clock
        : state === 'planning'
          ? Loader2
          : state === 'running'
            ? PlayCircle
            : state === 'waiting_approval'
              ? PauseCircle
              : state === 'reviewing'
                ? AlertTriangle
                : state === 'completed'
                  ? CheckCircle2
                  : state === 'failed'
                    ? XCircle
                    : Ban;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border font-medium whitespace-nowrap ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      } ${colorClasses[meta.tone]}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
}

export function TaskStateLabel({ state }: { state: TaskExecutionState }) {
  const map: Record<TaskExecutionState, { label: string; cls: string; Icon: typeof Clock }> = {
    pending: { label: 'Pending', cls: 'text-slate-600 bg-slate-100 border-slate-200', Icon: Clock },
    ready: { label: 'Ready', cls: 'text-blue-700 bg-blue-50 border-blue-200', Icon: PlayCircle },
    running: { label: 'Running', cls: 'text-blue-800 bg-blue-50 border-blue-200', Icon: Loader2 },
    waiting_approval: {
      label: 'Waiting Approval',
      cls: 'text-amber-800 bg-amber-50 border-amber-200',
      Icon: PauseCircle,
    },
    completed: { label: 'Completed', cls: 'text-emerald-800 bg-emerald-50 border-emerald-200', Icon: CheckCircle2 },
    failed: { label: 'Failed', cls: 'text-red-800 bg-red-50 border-red-200', Icon: XCircle },
    cancelled: { label: 'Cancelled', cls: 'text-slate-600 bg-slate-100 border-slate-200', Icon: Ban },
  };
  const item = map[state];
  const Icon = item.Icon;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${item.cls}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{item.label}</span>
    </span>
  );
}

export function ApprovalStateLabel({ status }: { status: ApprovalStatus }) {
  const map: Record<ApprovalStatus, { label: string; cls: string; Icon: typeof Clock }> = {
    pending: { label: 'Pending Decision', cls: 'text-amber-800 bg-amber-50 border-amber-200', Icon: PauseCircle },
    approved: { label: 'Approved', cls: 'text-emerald-800 bg-emerald-50 border-emerald-200', Icon: CheckCircle2 },
    rejected: { label: 'Rejected', cls: 'text-red-800 bg-red-50 border-red-200', Icon: XCircle },
  };
  const item = map[status];
  const Icon = item.Icon;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${item.cls}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{item.label}</span>
    </span>
  );
}

export function ArtifactReviewLabel({ status }: { status: ArtifactReviewStatus }) {
  const map: Record<ArtifactReviewStatus, { label: string; cls: string; Icon: typeof Clock }> = {
    pending_review: { label: 'Pending Review', cls: 'text-amber-800 bg-amber-50 border-amber-200', Icon: Clock },
    approved: { label: 'Approved', cls: 'text-emerald-800 bg-emerald-50 border-emerald-200', Icon: CheckCircle2 },
    changes_requested: {
      label: 'Changes Requested',
      cls: 'text-red-800 bg-red-50 border-red-200',
      Icon: AlertTriangle,
    },
  };
  const item = map[status];
  const Icon = item.Icon;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${item.cls}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{item.label}</span>
    </span>
  );
}
