import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { AgentDivisionsView } from './components/AgentDivisionsView';
import { BudgetManagementView } from './components/BudgetManagementView';
import { ContractJsonView } from './components/ContractJsonView';
import { NewWorkflowModal } from './components/NewWorkflowModal';
import { OverviewView } from './components/OverviewView';
import { SecurityControlsView } from './components/SecurityControlsView';
import { NexusSidebar, TopNav, type StudioTab } from './components/TopNav';
import {
  WorkflowWorkspaceView,
  type WorkflowSubTab,
} from './components/WorkflowWorkspaceView';
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
import type { PermissionScope, ProviderModelEntry } from './nacs/v1/types';
import {
  createInitialBudgetPolicy,
  toggleDivisionHardStop,
  updateDivisionCap,
  updatePlatformCap,
  type WorkspaceBudgetPolicy,
} from './nexus/budget';
import type { NexusDivisionId } from './nexus/divisions';
import {
  STAGE_1_DEFAULT_GRANTED_SCOPES,
  type ControlPlaneStatusResponse,
  type ProvidersListResponse,
} from './nexus/governance';

const WORKFLOW_STORAGE_KEY = 'relay_contract_studio_workflows_v1';
const BUDGET_STORAGE_KEY = 'nexus_apex_budget_policy_v1';

function loadInitialWorkflows(): WorkflowBundle[] {
  try {
    const raw = window.localStorage.getItem(WORKFLOW_STORAGE_KEY);
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

function loadInitialBudgetPolicy(): WorkspaceBudgetPolicy {
  try {
    const raw = window.localStorage.getItem(BUDGET_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WorkspaceBudgetPolicy;
      if (parsed && Array.isArray(parsed.allocations) && parsed.allocations.length === 7) {
        return {
          ...parsed,
          zero_spend_safety_lock: true,
        };
      }
    }
  } catch {
    // Fallback to default budget policy
  }
  return createInitialBudgetPolicy('workspace_demo');
}

export default function App() {
  const [workflows, setWorkflows] = useState<WorkflowBundle[]>(loadInitialWorkflows);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string>(() => {
    const initial = loadInitialWorkflows();
    return initial[0]?.contract.workflow_id ?? 'wf_demo_001';
  });
  const [activeTab, setActiveTab] = useState<StudioTab>('overview');
  const [workflowSubTab, setWorkflowSubTab] = useState<WorkflowSubTab>('state-machine');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const [budgetPolicy, setBudgetPolicy] = useState<WorkspaceBudgetPolicy>(loadInitialBudgetPolicy);
  const [grantedScopes, setGrantedScopes] = useState<PermissionScope[]>(
    STAGE_1_DEFAULT_GRANTED_SCOPES
  );
  const [allowPreviewModels, setAllowPreviewModels] = useState(false);
  const [controlPlaneStatus, setControlPlaneStatus] =
    useState<ControlPlaneStatusResponse | null>(null);
  const [providers, setProviders] = useState<ProviderModelEntry[]>([]);
  const [liveAdaptersBound, setLiveAdaptersBound] = useState(0);

  useEffect(() => {
    try {
      window.localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(workflows));
    } catch {
      // Ignore quota errors
    }
  }, [workflows]);

  useEffect(() => {
    try {
      window.localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(budgetPolicy));
    } catch {
      // Ignore quota errors
    }
  }, [budgetPolicy]);

  useEffect(() => {
    let active = true;
    async function loadControlPlane() {
      try {
        const [statusRes, providersRes] = await Promise.all([
          fetch('/api/nexus/status'),
          fetch('/api/nexus/providers'),
        ]);
        if (active && statusRes.ok) {
          const statusData = (await statusRes.json()) as ControlPlaneStatusResponse;
          setControlPlaneStatus(statusData);
        }
        if (active && providersRes.ok) {
          const providersData = (await providersRes.json()) as ProvidersListResponse;
          setProviders(providersData.providers);
          setLiveAdaptersBound(providersData.live_adapters_bound);
        }
      } catch {
        // UI degrades gracefully if control plane API is unreachable
      }
    }
    loadControlPlane();
    return () => {
      active = false;
    };
  }, []);

  const activeBundle =
    workflows.find((w) => w.contract.workflow_id === activeWorkflowId) ?? workflows[0];

  const totalPendingApprovals = workflows.reduce(
    (sum, wf) => sum + wf.approvals.filter((a) => a.status === 'pending').length,
    0
  );

  const updateActiveBundle = (updater: (bundle: WorkflowBundle) => WorkflowBundle) => {
    setWorkflows((prev) =>
      prev.map((w) =>
        w.contract.workflow_id === activeBundle.contract.workflow_id ? updater(w) : w
      )
    );
  };

  const handleNavigateTab = (tab: StudioTab, subTab?: WorkflowSubTab) => {
    setActiveTab(tab);
    if (subTab) {
      setWorkflowSubTab(subTab);
    }
    setBannerError(null);
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
    setBudgetPolicy(createInitialBudgetPolicy('workspace_demo'));
    setGrantedScopes(STAGE_1_DEFAULT_GRANTED_SCOPES);
    setAllowPreviewModels(false);
  };

  const handleCreateWorkflow = (contract: WorkflowContract) => {
    const newBundle = scaffoldWorkflowBundle(contract);
    setWorkflows((prev) => [newBundle, ...prev]);
    setActiveWorkflowId(newBundle.contract.workflow_id);
    setIsNewModalOpen(false);
    setActiveTab('overview');
    setBannerError(null);
  };

  const handleToggleScope = (scope: PermissionScope) => {
    if (scope === 'billing.spend') return;
    setGrantedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const handleUpdatePlatformCap = (nextCapUsd: number) => {
    const res = updatePlatformCap(budgetPolicy, nextCapUsd);
    if (res.error) {
      setBannerError(res.error);
      return;
    }
    setBannerError(null);
    setBudgetPolicy(res.policy);
  };

  const handleUpdateDivisionCap = (divisionId: NexusDivisionId, nextCapUsd: number) => {
    const res = updateDivisionCap(budgetPolicy, divisionId, nextCapUsd);
    if (res.error) {
      setBannerError(res.error);
      return;
    }
    setBannerError(null);
    setBudgetPolicy(res.policy);
  };

  const handleToggleDivisionHardStop = (divisionId: NexusDivisionId) => {
    setBudgetPolicy((prev) => toggleDivisionHardStop(prev, divisionId));
  };

  const showWorkflowSwitcher =
    activeTab === 'overview' || activeTab === 'workflows' || activeTab === 'contracts';

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <NexusSidebar
        activeTab={activeTab}
        pendingApprovalCount={totalPendingApprovals}
        onSelectTab={(tab) => handleNavigateTab(tab)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopNav
          activeTab={activeTab}
          activeWorkflowId={activeBundle.contract.workflow_id}
          pendingApprovalCount={totalPendingApprovals}
          onSelectTab={(tab) => handleNavigateTab(tab)}
          onOpenNewWorkflow={() => setIsNewModalOpen(true)}
        />

        {/* Active Workflow Context Toolbar */}
        {showWorkflowSwitcher && (
          <div className="border-b border-slate-200 bg-white/80">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
              <div
                className="flex flex-wrap items-center gap-2"
                role="group"
                aria-label="Active workflows"
              >
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
                      <span aria-hidden="true" className="text-slate-400">
                        ·
                      </span>
                      <span>
                        {wf.contract.production_track === 'creative'
                          ? 'Creative Track'
                          : 'Automation Track'}
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
                <span>Reset Workspace State</span>
              </button>
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
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
              allWorkflows={workflows}
              budgetPolicy={budgetPolicy}
              controlPlaneStatus={controlPlaneStatus}
              onTransition={handleTransition}
              onDecideApproval={handleDecideApproval}
              onNavigateTab={handleNavigateTab}
            />
          )}

          {activeTab === 'agents' && (
            <AgentDivisionsView
              providers={providers}
              liveAdaptersBound={liveAdaptersBound}
              grantedScopes={grantedScopes}
              allowPreviewModels={allowPreviewModels}
              onNavigateSecurity={() => handleNavigateTab('security')}
            />
          )}

          {activeTab === 'workflows' && (
            <WorkflowWorkspaceView
              key={`${activeBundle.contract.workflow_id}-${workflowSubTab}`}
              bundle={activeBundle}
              initialSubTab={workflowSubTab}
              onTransition={handleTransition}
              onResetToDraft={handleResetActiveToDraft}
              onUpdateTaskState={handleUpdateTaskState}
              onDecideApproval={handleDecideApproval}
              onUpdateArtifactReview={handleUpdateArtifactReview}
            />
          )}

          {activeTab === 'security' && (
            <SecurityControlsView
              safetyLocks={controlPlaneStatus?.safety_locks ?? []}
              capabilityAllowlist={controlPlaneStatus?.capability_allowlist ?? []}
              grantedScopes={grantedScopes}
              allowPreviewModels={allowPreviewModels}
              onToggleScope={handleToggleScope}
              onTogglePreviewModels={() => setAllowPreviewModels((prev) => !prev)}
            />
          )}

          {activeTab === 'budget' && (
            <BudgetManagementView
              policy={budgetPolicy}
              workflows={workflows}
              onUpdatePlatformCap={handleUpdatePlatformCap}
              onUpdateDivisionCap={handleUpdateDivisionCap}
              onToggleDivisionHardStop={handleToggleDivisionHardStop}
              onSelectWorkflow={(wfId) => {
                setActiveWorkflowId(wfId);
                handleNavigateTab('overview');
              }}
            />
          )}

          {activeTab === 'contracts' && (
            <ContractJsonView
              bundle={activeBundle}
              onApplyContractJson={handleApplyContractJson}
            />
          )}
        </main>
      </div>

      <NewWorkflowModal
        open={isNewModalOpen}
        existingIds={workflows.map((w) => w.contract.workflow_id)}
        onClose={() => setIsNewModalOpen(false)}
        onCreate={handleCreateWorkflow}
      />
    </div>
  );
}
