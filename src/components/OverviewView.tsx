import { ArrowRight, Check, Film, ShieldAlert, Terminal, X } from 'lucide-react';
import { FIVE_CONTRACTS_REFERENCE, type WorkflowBundle, type WorkflowState } from '../core/contracts';
import { calculateWorkflowSpend, getAvailableTransitions, STATE_METADATA } from '../core/stateMachine';
import type { StudioTab } from './TopNav';
import { ApprovalStateLabel, WorkflowStateLabel } from './StateBadge';

interface OverviewViewProps {
  bundle: WorkflowBundle;
  onTransition: (to: WorkflowState) => void;
  onDecideApproval: (approvalId: string, decision: 'approved' | 'rejected') => void;
  onNavigateTab: (tab: StudioTab) => void;
}

export function OverviewView({
  bundle,
  onTransition,
  onDecideApproval,
  onNavigateTab,
}: OverviewViewProps) {
  const { contract, state, tasks, results, artifacts, approvals } = bundle;
  const spend = calculateWorkflowSpend(bundle);
  const availableTransitions = getAvailableTransitions(bundle);
  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  const completedTasksCount = tasks.filter((t) => t.execution_state === 'completed').length;

  const contractCounts: Record<string, string> = {
    workflow: `${contract.production_track === 'creative' ? 'Creative' : 'Automation'} track`,
    task: `${completedTasksCount} / ${tasks.length} tasks done`,
    result: `${results.length} agent results`,
    artifact: `${artifacts.length} artifacts tracked`,
    approval: `${pendingApprovals.length} pending`,
  };

  const contractDestination: Record<string, StudioTab> = {
    workflow: 'json',
    task: 'tasks',
    result: 'tasks',
    artifact: 'artifacts',
    approval: 'artifacts',
  };

  return (
    <div className="space-y-8">
      {/* Primary Workflow Contract Hero Panel */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3 max-w-2xl">
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

            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl [text-wrap:balance]">
              {contract.goal}
            </h1>

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
            <h2 className="text-xs font-semibold text-slate-500">Track & Expected Outputs</h2>
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
            <h2 className="text-xs font-semibold text-slate-500">Contract Constraints</h2>
            <dl className="mt-1.5 space-y-1 text-xs text-slate-700">
              {Object.entries(contract.constraints).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">{key}</dt>
                  <dd className="font-mono font-medium text-slate-900 tabular-nums">{String(val)}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-slate-500">Budget & Spend</h2>
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
            <h2 className="text-xs font-semibold text-slate-500">Autonomy Policy</h2>
            <dl className="mt-1.5 space-y-1 text-xs text-slate-700">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">mode</dt>
                <dd className="font-mono font-medium text-slate-900">{contract.autonomy_policy.mode}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">external_publishing</dt>
                <dd className="font-mono text-slate-800">{contract.autonomy_policy.external_publishing}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">purchases</dt>
                <dd className="font-mono text-slate-800">{contract.autonomy_policy.purchases}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">destructive_actions</dt>
                <dd className="font-mono text-slate-800">{contract.autonomy_policy.destructive_actions}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Active Approval Gate Action Panel (when pending approvals exist) */}
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

      {/* Five Core Contracts Ledger */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Five Contracts Architecture
            </h2>
            <p className="text-xs text-slate-600">
              Shared contract boundaries governing workflow intent, agent execution, outputs, and human authorization.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('state-machine')}
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
                  <span aria-hidden="true" className="text-slate-400">·</span>
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
                  onClick={() => onNavigateTab(contractDestination[item.id])}
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
