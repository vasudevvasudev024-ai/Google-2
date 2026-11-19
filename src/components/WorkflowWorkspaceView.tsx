import { useState } from 'react';
import type {
  ArtifactReviewStatus,
  TaskExecutionState,
  WorkflowBundle,
  WorkflowState,
} from '../core/contracts';
import { ArtifactsApprovalsView } from './ArtifactsApprovalsView';
import { StateMachineView } from './StateMachineView';
import { TasksResultsView } from './TasksResultsView';

export type WorkflowSubTab = 'state-machine' | 'tasks' | 'artifacts';

interface WorkflowWorkspaceViewProps {
  bundle: WorkflowBundle;
  initialSubTab?: WorkflowSubTab;
  onTransition: (to: WorkflowState) => void;
  onResetToDraft: () => void;
  onUpdateTaskState: (taskId: string, nextState: TaskExecutionState) => void;
  onDecideApproval: (approvalId: string, decision: 'approved' | 'rejected', note?: string) => void;
  onUpdateArtifactReview: (artifactId: string, status: ArtifactReviewStatus) => void;
}

export function WorkflowWorkspaceView({
  bundle,
  initialSubTab = 'state-machine',
  onTransition,
  onResetToDraft,
  onUpdateTaskState,
  onDecideApproval,
  onUpdateArtifactReview,
}: WorkflowWorkspaceViewProps) {
  const [subTab, setSubTab] = useState<WorkflowSubTab>(initialSubTab);

  const pendingApprovals = bundle.approvals.filter((a) => a.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">
            Workflow Visibility & Lifecycle Governance
          </h1>
          <p className="text-xs text-slate-600">
            Active contract <span className="font-mono text-slate-800">{bundle.contract.workflow_id}</span>{' '}
            · Step through state transitions, inspect task DAGs, and authorize human approval gates.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Workflow views"
          className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'state-machine'}
            onClick={() => setSubTab('state-machine')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              subTab === 'state-machine'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            State Machine
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'tasks'}
            onClick={() => setSubTab('tasks')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              subTab === 'tasks'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tasks & Results ({bundle.tasks.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'artifacts'}
            onClick={() => setSubTab('artifacts')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              subTab === 'artifacts'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Artifacts & Approvals{pendingApprovals > 0 ? ` (${pendingApprovals} pending)` : ''}
          </button>
        </div>
      </div>

      {subTab === 'state-machine' && (
        <StateMachineView
          bundle={bundle}
          onTransition={onTransition}
          onResetToDraft={onResetToDraft}
        />
      )}

      {subTab === 'tasks' && (
        <TasksResultsView bundle={bundle} onUpdateTaskState={onUpdateTaskState} />
      )}

      {subTab === 'artifacts' && (
        <ArtifactsApprovalsView
          bundle={bundle}
          onDecideApproval={onDecideApproval}
          onUpdateArtifactReview={onUpdateArtifactReview}
        />
      )}
    </div>
  );
}
