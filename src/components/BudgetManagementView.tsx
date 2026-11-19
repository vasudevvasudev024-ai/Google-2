import { useState } from 'react';
import { AlertTriangle, Lock, ShieldCheck } from 'lucide-react';
import type { WorkflowBundle } from '../core/contracts';
import { calculateWorkflowSpend } from '../core/stateMachine';
import {
  summarizeBudgetPolicy,
  type WorkspaceBudgetPolicy,
} from '../nexus/budget';
import type { NexusDivisionId } from '../nexus/divisions';
import { WorkflowStateLabel } from './StateBadge';

interface BudgetManagementViewProps {
  policy: WorkspaceBudgetPolicy;
  workflows: WorkflowBundle[];
  onUpdatePlatformCap: (nextCapUsd: number) => void;
  onUpdateDivisionCap: (divisionId: NexusDivisionId, nextCapUsd: number) => void;
  onToggleDivisionHardStop: (divisionId: NexusDivisionId) => void;
  onSelectWorkflow: (workflowId: string) => void;
}

export function BudgetManagementView({
  policy,
  workflows,
  onUpdatePlatformCap,
  onUpdateDivisionCap,
  onToggleDivisionHardStop,
  onSelectWorkflow,
}: BudgetManagementViewProps) {
  const [platformCapDraft, setPlatformCapDraft] = useState(
    String(policy.monthly_platform_cap_usd)
  );
  const [capError, setCapError] = useState<string | null>(null);
  const summary = summarizeBudgetPolicy(policy, workflows);

  const handleSavePlatformCap = () => {
    const parsed = Number(platformCapDraft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setCapError('Platform monthly cap must be a positive number.');
      return;
    }
    setCapError(null);
    onUpdatePlatformCap(parsed);
  };

  return (
    <div className="space-y-6">
      {/* Zero-Spend Safety Lock Banner & Top Metrics */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5 max-w-2xl">
            <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">
              Budget Governance & Spend Controls
            </h1>
            <p className="text-sm text-slate-600">
              Allocate monthly spending ceilings across all 7 NEXUS APEX divisions, enforce hard
              stops, and audit contract spend limits before live provider adapters are authorized.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-900 shrink-0">
            <Lock className="h-3.5 w-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>Zero-Spend Safety Lock Active · USD 0.00 Live Billing</span>
          </div>
        </div>

        {/* 4-Column KPI Strip */}
        <div className="grid grid-cols-1 gap-6 border-t border-slate-200 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-semibold text-slate-500">Monthly Platform Ceiling</p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              USD {summary.monthlyPlatformCapUsd.toFixed(2)}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <label htmlFor="platform-cap-input" className="sr-only">
                Monthly platform cap in USD
              </label>
              <input
                id="platform-cap-input"
                type="number"
                min={1}
                step={50}
                value={platformCapDraft}
                onChange={(e) => setPlatformCapDraft(e.target.value)}
                className="w-28 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-900 tabular-nums focus:border-blue-600 focus:bg-white focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSavePlatformCap}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                Update Cap
              </button>
            </div>
            {capError && <p className="mt-1 text-xs text-red-700">{capError}</p>}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500">Allocated to 7 Divisions</p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              USD {summary.totalAllocatedUsd.toFixed(2)}
            </p>
            <p
              className={`mt-1 text-xs font-medium tabular-nums ${
                summary.allocationOverPlatformCap ? 'text-red-700' : 'text-slate-600'
              }`}
            >
              {summary.allocationOverPlatformCap
                ? `Over platform cap by USD ${Math.abs(summary.unallocatedReserveUsd).toFixed(2)}`
                : `Unallocated reserve: USD ${summary.unallocatedReserveUsd.toFixed(2)}`}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500">Live External Spend (Stage 1)</p>
            <p className="mt-1 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
              USD {summary.totalIncurredUsd.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Unknown-cost models: {policy.allow_unknown_cost_providers ? 'Allowed' : 'Blocked'}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500">Workflow Contracts Over Cap</p>
            <p
              className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
                summary.workflowCountOverLimit > 0 ? 'text-amber-700' : 'text-slate-900'
              }`}
            >
              {summary.workflowCountOverLimit} / {workflows.length}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Alert threshold at {policy.alert_threshold_pct}% utilization
            </p>
          </div>
        </div>

        {summary.allocationOverPlatformCap && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900"
          >
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />
            <span>
              Total division allocations (USD {summary.totalAllocatedUsd.toFixed(2)}) exceed the
              monthly platform ceiling (USD {summary.monthlyPlatformCapUsd.toFixed(2)}). Raise the
              platform ceiling or reduce individual division caps.
            </span>
          </div>
        )}
      </section>

      {/* Per-Division Allocation Ledger */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-1 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Division Budget Ceilings & Hard Stops
            </h2>
            <p className="text-xs text-slate-600">
              Per-division monthly limits enforced by Stage 5 NACS budget eligibility before task
              dispatch.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
            <span>require_approval_over_limit: true</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <th className="px-6 py-3">Division</th>
                <th className="px-4 py-3">Monthly Cap (USD)</th>
                <th className="px-4 py-3 text-right">Share of Platform Cap</th>
                <th className="px-4 py-3 text-right">Live Spend</th>
                <th className="px-6 py-3 text-right">Hard-Stop Gate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {policy.allocations.map((alloc) => {
                const sharePct =
                  policy.monthly_platform_cap_usd > 0
                    ? Math.round((alloc.monthly_cap_usd / policy.monthly_platform_cap_usd) * 100)
                    : 0;
                return (
                  <tr key={alloc.division_id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3">
                      <p className="font-semibold text-slate-900">{alloc.division_name}</p>
                      <p className="font-mono text-[11px] text-slate-500">{alloc.division_id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <label htmlFor={`cap-${alloc.division_id}`} className="sr-only">
                        Monthly cap in USD for {alloc.division_name}
                      </label>
                      <input
                        id={`cap-${alloc.division_id}`}
                        type="number"
                        min={0}
                        step={10}
                        value={alloc.monthly_cap_usd}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (Number.isFinite(val) && val >= 0) {
                            onUpdateDivisionCap(alloc.division_id, val);
                          }
                        }}
                        className="w-28 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-900 tabular-nums focus:border-blue-600 focus:bg-white focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums">
                      {sharePct}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums">
                      USD {alloc.incurred_usd.toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={alloc.hard_stop_enabled}
                        aria-label={`Toggle hard stop for ${alloc.division_name}`}
                        onClick={() => onToggleDivisionHardStop(alloc.division_id)}
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                          alloc.hard_stop_enabled
                            ? 'border-emerald-700 bg-emerald-700 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {alloc.hard_stop_enabled ? 'Hard Stop On' : 'Warn Only'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Workflow Contract Spend Ledger */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Workflow Contract Spend Ledger ({workflows.length})
          </h2>
          <p className="text-xs text-slate-600">
            Simulated contract estimates and workflow budget caps (no external billing is triggered).
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <th className="px-6 py-3">Workflow</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3 text-right">Recorded</th>
                <th className="px-4 py-3 text-right">Projected</th>
                <th className="px-4 py-3 text-right">Contract Cap</th>
                <th className="px-6 py-3 text-right">Policy Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {workflows.map((wf) => {
                const spend = calculateWorkflowSpend(wf);
                return (
                  <tr key={wf.contract.workflow_id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3">
                      <button
                        type="button"
                        onClick={() => onSelectWorkflow(wf.contract.workflow_id)}
                        className="text-left font-medium text-slate-900 hover:text-blue-700"
                      >
                        <span className="font-mono font-semibold">{wf.contract.workflow_id}</span>
                        <span className="block text-slate-600 truncate max-w-xs">
                          {wf.contract.goal}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <WorkflowStateLabel state={wf.state} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums">
                      {wf.contract.budget.currency} {spend.incurred}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-slate-900 tabular-nums">
                      {wf.contract.budget.currency} {spend.projectedTotal}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums">
                      {wf.contract.budget.currency} {spend.maxSpend}
                    </td>
                    <td className="px-6 py-3 text-right font-medium">
                      {spend.overLimit ? (
                        <span className="text-amber-700">Approval Required Over Cap</span>
                      ) : (
                        <span className="text-emerald-700">Within Contract Cap</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
