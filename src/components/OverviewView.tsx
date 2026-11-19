import {
  ArrowRight,
  Check,
  Film,
  Lock,
  ShieldAlert,
  Terminal,
  X,
} from 'lucide-react';
import {
  FIVE_CONTRACTS_REFERENCE,
  type WorkflowBundle,
  type WorkflowState,
} from '../core/contracts';
import {
  calculateWorkflowSpend,
  getAvailableTransitions,
  STATE_METADATA,
} from '../core/stateMachine';
import { summarizeBudgetPolicy, type WorkspaceBudgetPolicy } from '../nexus/budget';
import { NEXUS_DIVISIONS, summarizeDivisionReadiness } from '../nexus/divisions';
import type { ControlPlaneStatusResponse } from '../nexus/governance';
import { ApprovalStateLabel, WorkflowStateLabel } from './StateBadge';
import type { StudioTab } from './TopNav';
import type { WorkflowSubTab } from './WorkflowWorkspaceView';

interface OverviewViewProps {
  bundle: WorkflowBundle;
  allWorkflows: WorkflowBundle[];
  budgetPolicy: WorkspaceBudgetPolicy;
  controlPlaneStatus: ControlPlaneStatusResponse | null;
  onTransition: (to: WorkflowState) => void;
  onDecideApproval: (approvalId: string, decision: 'approved' | 'rejected') => void;
  onNavigateTab: (tab: StudioTab, workflowSubTab?: WorkflowSubTab) => void;
}

export function OverviewView({
  bundle,
  allWorkflows,
  budgetPolicy,
  controlPlaneStatus,
  onTransition,
  onDecideApproval,
  onNavigateTab,
}: OverviewViewProps) {
  const { contract, state, tasks, results, artifacts, approvals } = bundle;
  const spend = calculateWorkflowSpend(bundle);
  const availableTransitions = getAvailableTransitions(bundle);
  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  const completedTasksCount = tasks.filter((t) => t.execution_state === 'completed').length;
  const divisionSummary = summarizeDivisionReadiness();
  const budgetSummary = summarizeBudgetPolicy(budgetPolicy, allWorkflows);

  const contractCounts: Record<string, string> = {
    workflow: `${contract.production_track === 'creative' ? 'Creative' : 'Automation'} track`,
    task: `${completedTasksCount} / ${tasks.length} tasks done`,
    result: `${results.length} agent results`,
    artifact: `${artifacts.length} artifacts tracked`,
    approval: `${pendingApprovals.length} pending`,
  };

  const handleOpenContractDestination = (contractId: string) => {
    switch (contractId) {
      case 'workflow':
        onNavigateTab('contracts');
        return;
      case 'task':
      case 'result':
        onNavigateTab('workflows', 'tasks');
        return;
      case 'artifact':
      case 'approval':
        onNavigateTab('workflows', 'artifacts');
        return;
      default:
        onNavigateTab('workflows', 'state-machine');
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Control Plane Status Strip */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              NEXUS APEX Multi-Agent Control Plane · NACS Contract v
              {controlPlaneStatus?.contract_version ?? '1.0'}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
              Governance, Divisions & Workflow Execution
            </h1>
          </div>

          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-800 shrink-0">
            <Lock className="h-3.5 w-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>Stage 1 Safety Lock: Zero Paid Calls · External Actions Human-Gated</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 border-t border-slate-200 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-semibold text-slate-500">Enterprise Divisions</p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {divisionSummary.totalDivisions} Divisions
            </p>
            <p className="mt-1 text-xs text-slate-600 tabular-nums">
              {divisionSummary.localPolicyEngines} local policy engines ·{' '}
              {divisionSummary.unboundBlueprints} unbound blueprints
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500">NACS Provider Registry</p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {controlPlaneStatus?.registered_provider_models ?? 6} Models
            </p>
            <p className="mt-1 text-xs text-slate-600 tabular-nums">
              {controlPlaneStatus?.allowlisted_capabilities ?? 19} allowlisted capabilities · 0 live
              adapters
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500">Platform Budget Allocation</p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              USD {budgetSummary.totalAllocatedUsd.toFixed(0)} /{' '}
              {budgetSummary.monthlyPlatformCapUsd.toFixed(0)}
            </p>
            <p className="mt-1 text-xs text-emerald-700 font-medium tabular-nums">
              USD 0.00 live external spend incurred
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500">Pending Human Approvals</p>
            <p
              className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
                pendingApprovals.length > 0 ? 'text-amber-700' : 'text-slate-900'
              }`}
            >
              {pendingApprovals.length} Open
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {pendingApprovals.length > 0
                ? 'Execution paused until reviewer signs off'
                : 'No blocked approval gates on active workflow'}
            </p>
          </div>
        </div>
      </section>

      {/* Active Workflow Contract Hero Panel */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                {contract.production_track === 'creative' ? (
                  <Film className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                ) : (
                  <Terminal className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                )}
                {contract.production_track === 'creative' ? 'Creative Track' : 'Automation Track'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{contract.workflow_id}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{contract.project_id}</span>
              <span aria-hidden="true">·</span>
              <span>Schema {contract.schema_version}</span>
            </div>

            <h2 className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl [text-wrap:balance]">
              {contract.goal}
            </h2>

            <p className="text-sm leading-relaxed text-slate-600">
              {STATE_METADATA[state].description}
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end shrink-0">
            <WorkflowStateLabel state={state} />
            <div className="flex flex-wrap items-center gap-2">
              {availableTransitions.map((opt) => {
                const isPrimary =
                  opt.to === 'completed' ||
                  opt.to === 'running' ||
                  opt.to === 'reviewing' ||
                  opt.to === 'planning' ||
                  opt.to === 'queued';
                const isDanger = opt.to === 'failed' || opt.to === 'cancelled';

                return (
                  <button
                    key={opt.to}
                    type="button"
                    onClick={() => onTransition(opt.to)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                      isPrimary
                        ? 'bg-blue-700 text-white hover:bg-blue-800'
                        : isDanger
                          ? 'border border-red-200 bg-white text-red-700 hover:bg-red-50'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{opt.actionLabel}</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                );
              })}
              {availableTransitions.length === 0 && pendingApprovals.length > 0 && (
                <span className="text-xs font-medium text-amber-800">
                  Resolve pending approval below to resume execution
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Structured Contract Breakdown Grid */}
        <div className="mt-6 grid grid-cols-1 gap-6 border-t border-slate-200 pt-6 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="text-xs font-semibold text-slate-500">Track & Expected Outputs</h3>
            <p className="mt-1.5 text-sm font-medium text-slate-900">
              {contract.production_track === 'creative'
                ? 'Screenplay, storyboard, media'
                : 'Research, code, documents'}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-600">
              {contract.requested_outputs.join(' · ')}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-500">Contract Constraints</h3>
            <dl className="mt-1.5 space-y-1 text-xs text-slate-700">
              {Object.entries(contract.constraints).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">{key}</dt>
                  <dd className="font-mono font-medium text-slate-900 tabular-nums">
                    {String(val)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-500">Workflow Budget Cap</h3>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                {contract.budget.currency} {spend.incurred}
              </span>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                Cap: {contract.budget.currency} {spend.maxSpend}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded bg-slate-100">
              <div
                className={`h-full transition-all ${spend.overLimit ? 'bg-amber-600' : 'bg-blue-700'}`}
                style={{ width: `${Math.min(100, spend.utilizationPct)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-600 tabular-nums">
              Projected total: {contract.budget.currency} {spend.projectedTotal}
              {spend.overLimit ? ' (Approval required over limit)' : ' (Within budget)'}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-500">Autonomy Policy</h3>
            <dl className="mt-1.5 space-y-1 text-xs text-slate-700">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">mode</dt>
                <dd className="font-mono font-medium text-slate-900">
                  {contract.autonomy_policy.mode}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">external_publishing</dt>
                <dd className="font-mono text-slate-800">
                  {contract.autonomy_policy.external_publishing}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">purchases</dt>
                <dd className="font-mono text-slate-800">{contract.autonomy_policy.purchases}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">destructive_actions</dt>
                <dd className="font-mono text-slate-800">
                  {contract.autonomy_policy.destructive_actions}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Active Approval Gate Action Panel */}
      {pendingApprovals.length > 0 && (
        <section
          aria-label="Pending human approvals"
          className="rounded-xl border border-amber-200 bg-amber-50/50 p-6"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-950">
            <ShieldAlert className="h-4 w-4 text-amber-700" aria-hidden="true" />
            <h2>Human Authorization Required ({pendingApprovals.length})</h2>
          </div>

          <div className="mt-4 divide-y divide-amber-200/80">
            {pendingApprovals.map((appr) => (
              <div
                key={appr.approval_id}
                className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <ApprovalStateLabel status={appr.status} />
                    <span className="font-mono text-slate-800">{appr.approval_id}</span>
                    <span aria-hidden="true">·</span>
                    <span>Trigger: {appr.trigger_reason}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      Est. {appr.currency} {appr.estimated_cost}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-900">{appr.requested_action}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onDecideApproval(appr.approval_id, 'approved')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Approve & Resume</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDecideApproval(appr.approval_id, 'rejected')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Seven-Division Multi-Agent Architecture Overview */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Seven-Division Architecture Readiness
            </h2>
            <p className="text-xs text-slate-600">
              Blueprint agent coverage, monthly USD ceilings, and NACS capability boundaries across
              all NEXUS APEX divisions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('agents')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 whitespace-nowrap"
          >
            <span>Open Agent Divisions & Router</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <th className="px-6 py-3">Division</th>
                <th className="px-4 py-3">Agents</th>
                <th className="px-4 py-3">Runtime State</th>
                <th className="px-4 py-3">Approval Policy</th>
                <th className="px-6 py-3 text-right">Monthly Cap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {NEXUS_DIVISIONS.map((div) => {
                const alloc = budgetPolicy.allocations.find((a) => a.division_id === div.id);
                const localCount = div.agents.filter(
                  (a) => a.runtime_binding === 'policy_engine_local'
                ).length;
                const gatedCount = div.agents.filter(
                  (a) => a.runtime_binding === 'approval_gated'
                ).length;
                const unboundCount = div.agents.filter(
                  (a) => a.runtime_binding === 'adapter_unbound'
                ).length;

                const statusParts: string[] = [];
                if (localCount > 0) statusParts.push(`${localCount} local engine`);
                if (unboundCount > 0) statusParts.push(`${unboundCount} blueprint`);
                if (gatedCount > 0) statusParts.push(`${gatedCount} approval-gated`);

                return (
                  <tr key={div.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3">
                      <p className="font-semibold text-slate-900">{div.name}</p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {div.nacsCapabilities.slice(0, 3).join(' · ')}
                        {div.nacsCapabilities.length > 3
                          ? ` +${div.nacsCapabilities.length - 3}`
                          : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-800 tabular-nums">
                      {div.agents.length}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{statusParts.join(' · ')}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-md">{div.approvalPolicy}</td>
                    <td className="px-6 py-3 text-right font-mono font-medium text-slate-900 tabular-nums">
                      USD {(alloc?.monthly_cap_usd ?? div.defaultMonthlyCapUsd).toFixed(0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Five Core Contracts Ledger */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              NACS Five Contracts Architecture
            </h2>
            <p className="text-xs text-slate-600">
              Shared JSON Schema Draft 2020-12 contract boundaries governing workflow intent, agent
              execution, outputs, and human authorization.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('workflows', 'state-machine')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 whitespace-nowrap"
          >
            <span>Inspect State Machine</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="divide-y divide-slate-200">
          {FIVE_CONTRACTS_REFERENCE.map((item, idx) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-medium text-slate-500 tabular-nums">
                    0{idx + 1}.
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900">{item.name}</h3>
                  <span aria-hidden="true" className="text-slate-400">
                    ·
                  </span>
                  <span className="text-xs font-medium text-slate-700">{item.controls}</span>
                </div>
                <p className="text-xs text-slate-600">{item.summary}</p>
                <p className="font-mono text-[11px] text-slate-500">
                  {item.keyFields.join(' · ')}
                </p>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <span className="font-mono text-xs text-slate-700 tabular-nums">
                  {contractCounts[item.id]}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenContractDestination(item.id)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                >
                  Open
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
