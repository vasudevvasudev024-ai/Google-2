import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { ArtifactsApprovalsView } from './components/ArtifactsApprovalsView';
import { ContractJsonView } from './components/ContractJsonView';
import { NewWorkflowModal } from './components/NewWorkflowModal';
import { OverviewView } from './components/OverviewView';
import { StateMachineView } from './components/StateMachineView';
import { TasksResultsView } from './components/TasksResultsView';
import { TopNav, type StudioTab } from './components/TopNav';
import type {
  ArtifactReviewStatus,
  TaskExecutionState,
  WorkflowBundle,
  WorkflowContract,
  WorkflowState,
} from './core/contracts';
import { createInitialWorkflows } from './core/seedData';
import {
  resolveApprovalDecision,
  scaffoldWorkflowBundle,
  transitionWorkflowBundle,
  updateTaskExecutionState,
} from './core/stateMachine';

const STORAGE_KEY = 'relay_contract_studio_workflows_v1';

function loadInitialWorkflows(): WorkflowBundle[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WorkflowBundle[];
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.contract?.workflow_id) {
        return parsed;
      }
    }
  } catch {
    // Fallback to deterministic seed workflows if storage is unavailable
  }
  return createInitialWorkflows();
}

export default function App() {
  const [workflows, setWorkflows] = useState<WorkflowBundle[]>(loadInitialWorkflows);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string>(() => {
    const initial = loadInitialWorkflows();
    return initial[0]?.contract.workflow_id ?? 'wf_demo_001';
  });
  const [activeTab, setActiveTab] = useState<StudioTab>('overview');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows));
    } catch {
      // Ignore quota errors
    }
  }, [workflows]);

  const activeBundle =
    workflows.find((w) => w.contract.workflow_id === activeWorkflowId) ?? workflows[0];

  const updateActiveBundle = (updater: (bundle: WorkflowBundle) => WorkflowBundle) => {
    setWorkflows((prev) =>
      prev.map((w) => (w.contract.workflow_id === activeBundle.contract.workflow_id ? updater(w) : w))
    );
  };

  const handleTransition = (targetState: WorkflowState) => {
    setBannerError(null);
    const result = transitionWorkflowBundle(activeBundle, targetState, 'Studio Operator');
    if (result.error) {
      setBannerError(result.error);
      return;
    }
    updateActiveBundle(() => result.bundle);
  };

  const handleDecideApproval = (
    approvalId: string,
    decision: 'approved' | 'rejected',
    note?: string
  ) => {
    setBannerError(null);
    const result = resolveApprovalDecision(
      activeBundle,
      approvalId,
      decision,
      'Lead Reviewer',
      note
    );
    if (result.error) {
      setBannerError(result.error);
      return;
    }
    updateActiveBundle(() => result.bundle);
  };

  const handleUpdateTaskState = (taskId: string, nextState: TaskExecutionState) => {
    setBannerError(null);
    const result = updateTaskExecutionState(activeBundle, taskId, nextState);
    if (result.error) {
      setBannerError(result.error);
      return;
    }
    updateActiveBundle(() => result.bundle);
  };

  const handleUpdateArtifactReview = (artifactId: string, status: ArtifactReviewStatus) => {
    setBannerError(null);
    updateActiveBundle((bundle) => ({
      ...bundle,
      artifacts: bundle.artifacts.map((art) =>
        art.artifact_id === artifactId ? { ...art, review_status: status } : art
      ),
    }));
  };

  const handleApplyContractJson = (updatedContract: WorkflowContract) => {
    setBannerError(null);
    updateActiveBundle((bundle) => ({
      ...bundle,
      contract: updatedContract,
    }));
  };

  const handleResetActiveToDraft = () => {
    setBannerError(null);
    updateActiveBundle((bundle) => {
      const fresh = scaffoldWorkflowBundle(bundle.contract);
      return {
        ...fresh,
        transitions: [
          ...bundle.transitions,
          {
            id: `tr_reset_${Date.now()}`,
            from: bundle.state,
            to: 'draft',
            label: 'Reset to draft',
            actor: 'Studio Operator',
            timestamp: new Date().toISOString(),
            note: 'Workflow lifecycle reset to draft for replay.',
          },
        ],
      };
    });
  };

  const handleResetDemoData = () => {
    setBannerError(null);
    const seed = createInitialWorkflows();
    setWorkflows(seed);
    setActiveWorkflowId(seed[0].contract.workflow_id);
  };

  const handleCreateWorkflow = (contract: WorkflowContract) => {
    const newBundle = scaffoldWorkflowBundle(contract);
    setWorkflows((prev) => [newBundle, ...prev]);
    setActiveWorkflowId(newBundle.contract.workflow_id);
    setIsNewModalOpen(false);
    setActiveTab('overview');
    setBannerError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenNewWorkflow={() => setIsNewModalOpen(true)}
      />

      {/* Workspace Selector Toolbar */}
      <div className="border-b border-slate-200 bg-white/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Active workflows">
            {workflows.map((wf) => {
              const isCurrent = wf.contract.workflow_id === activeBundle.contract.workflow_id;
              return (
                <button
                  key={wf.contract.workflow_id}
                  type="button"
                  onClick={() => {
                    setActiveWorkflowId(wf.contract.workflow_id);
                    setBannerError(null);
                  }}
                  aria-pressed={isCurrent}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    isCurrent
                      ? 'border-blue-700 bg-blue-50 text-blue-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-mono">{wf.contract.workflow_id}</span>
                  <span aria-hidden="true" className="text-slate-400">·</span>
                  <span>
                    {wf.contract.production_track === 'creative' ? 'Creative Track' : 'Automation Track'}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleResetDemoData}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset Demo Data</span>
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {bannerError && (
          <div
            role="alert"
            className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800"
          >
            <span>{bannerError}</span>
            <button
              type="button"
              onClick={() => setBannerError(null)}
              className="text-red-700 underline hover:text-red-900"
            >
              Dismiss
            </button>
          </div>
        )}

        {activeTab === 'overview' && (
          <OverviewView
            bundle={activeBundle}
            onTransition={handleTransition}
            onDecideApproval={handleDecideApproval}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'state-machine' && (
          <StateMachineView
            bundle={activeBundle}
            onTransition={handleTransition}
            onResetToDraft={handleResetActiveToDraft}
          />
        )}

        {activeTab === 'tasks' && (
          <TasksResultsView
            bundle={activeBundle}
            onUpdateTaskState={handleUpdateTaskState}
          />
        )}

        {activeTab === 'artifacts' && (
          <ArtifactsApprovalsView
            bundle={activeBundle}
            onDecideApproval={handleDecideApproval}
            onUpdateArtifactReview={handleUpdateArtifactReview}
          />
        )}

        {activeTab === 'json' && (
          <ContractJsonView
            bundle={activeBundle}
            onApplyContractJson={handleApplyContractJson}
          />
        )}
      </main>

      <NewWorkflowModal
        open={isNewModalOpen}
        existingIds={workflows.map((w) => w.contract.workflow_id)}
        onClose={() => setIsNewModalOpen(false)}
        onCreate={handleCreateWorkflow}
      />
    </div>
  );
}
