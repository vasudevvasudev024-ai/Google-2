import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Lock,
  Play,
  Search,
  Server,
  Shield,
  XCircle,
} from 'lucide-react';
import type { PermissionScope, ProviderModelEntry } from '../nacs/v1/types';
import {
  NEXUS_DIVISIONS,
  type AgentRuntimeBinding,
  type DivisionAgentSpec,
  type NexusDivisionId,
} from '../nexus/divisions';
import type { RouteDryRunResponse } from '../nexus/governance';

interface AgentDivisionsViewProps {
  providers: ProviderModelEntry[];
  liveAdaptersBound: number;
  grantedScopes: PermissionScope[];
  allowPreviewModels: boolean;
  onNavigateSecurity: () => void;
}

const BINDING_META: Record<
  AgentRuntimeBinding,
  { label: string; textClass: string; Icon: typeof Shield }
> = {
  policy_engine_local: {
    label: 'Policy Engine Local',
    textClass: 'text-emerald-700',
    Icon: CheckCircle2,
  },
  adapter_unbound: {
    label: 'Adapter Unbound (Blueprint)',
    textClass: 'text-slate-600',
    Icon: Cpu,
  },
  approval_gated: {
    label: 'Approval Gated (Blocked)',
    textClass: 'text-amber-700',
    Icon: Lock,
  },
};

export function AgentDivisionsView({
  providers,
  liveAdaptersBound,
  grantedScopes,
  allowPreviewModels,
  onNavigateSecurity,
}: AgentDivisionsViewProps) {
  const [selectedDivision, setSelectedDivision] = useState<NexusDivisionId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>(NEXUS_DIVISIONS[0].agents[0].agent_id);
  const [simulateHumanApproval, setSimulateHumanApproval] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<RouteDryRunResponse | null>(null);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunError, setDryRunError] = useState<string | null>(null);

  const visibleDivisions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return NEXUS_DIVISIONS.filter((div) =>
      selectedDivision === 'all' ? true : div.id === selectedDivision
    )
      .map((div) => ({
        ...div,
        agents: div.agents.filter((agent) => {
          if (!q) return true;
          return (
            agent.name.toLowerCase().includes(q) ||
            agent.role.toLowerCase().includes(q) ||
            agent.agent_id.toLowerCase().includes(q) ||
            agent.required_capabilities.some((c) => c.toLowerCase().includes(q)) ||
            div.name.toLowerCase().includes(q)
          );
        }),
      }))
      .filter((div) => div.agents.length > 0);
  }, [selectedDivision, searchQuery]);

  const allAgents = useMemo(() => NEXUS_DIVISIONS.flatMap((d) => d.agents), []);
  const selectedAgent: DivisionAgentSpec =
    allAgents.find((a) => a.agent_id === selectedAgentId) ?? allAgents[0];

  const handleRunDryRun = async (agent: DivisionAgentSpec) => {
    setSelectedAgentId(agent.agent_id);
    setDryRunLoading(true);
    setDryRunError(null);
    try {
      const response = await fetch('/api/nexus/route-dry-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          division_id: agent.division_id,
          agent_id: agent.agent_id,
          production_track: agent.production_track,
          objective: `Stage 1 offline routing check for ${agent.name} (${agent.role})`,
          required_capabilities: agent.required_capabilities,
          required_modalities: agent.required_modalities,
          required_scopes: agent.required_scopes,
          max_cost_usd: agent.estimated_task_cap_usd,
          data_sensitivity: agent.data_sensitivity,
          require_zero_data_retention:
            agent.data_sensitivity === 'confidential' || agent.data_sensitivity === 'restricted',
          pii_present: agent.data_sensitivity === 'restricted',
          human_approval_required: agent.human_approval_required,
          granted_scopes: grantedScopes,
          human_approval_verified: simulateHumanApproval,
          allow_preview_models: allowPreviewModels,
        }),
      });
      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || `Control plane returned HTTP ${response.status}`);
      }
      const data = (await response.json()) as RouteDryRunResponse;
      setDryRunResult(data);
    } catch (err) {
      setDryRunError(
        err instanceof Error
          ? err.message
          : 'Unable to reach NACS control plane endpoint /api/nexus/route-dry-run.'
      );
    } finally {
      setDryRunLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Division Architecture Header & Honest Runtime Status */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5 max-w-2xl">
            <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">
              Seven-Division Agent Registry & NACS Router
            </h1>
            <p className="text-sm text-slate-600">
              Inspect agent blueprints across Research, Creator, Production, Marketing, Growth,
              Business Intelligence, and Security. External provider adapters remain unbound in
              Stage 1 to enforce zero paid API calls.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 shrink-0">
            <div className="tabular-nums">
              <span className="text-slate-500">Registered Blueprints:</span>{' '}
              <span className="font-mono font-semibold text-slate-900">{allAgents.length}</span>
            </div>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <div className="tabular-nums">
              <span className="text-slate-500">Live External Adapters:</span>{' '}
              <span className="font-mono font-semibold text-slate-900">{liveAdaptersBound}</span>
            </div>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <div className="tabular-nums">
              <span className="text-slate-500">Registry Models:</span>{' '}
              <span className="font-mono font-semibold text-slate-900">{providers.length}</span>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="tablist"
            aria-label="Filter agents by division"
            className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedDivision === 'all'}
              onClick={() => setSelectedDivision('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                selectedDivision === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All 7 Divisions
            </button>
            {NEXUS_DIVISIONS.map((div) => (
              <button
                key={div.id}
                type="button"
                role="tab"
                aria-selected={selectedDivision === div.id}
                onClick={() => setSelectedDivision(div.id)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedDivision === div.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {div.shortName}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72">
            <label htmlFor="agent-search-input" className="sr-only">
              Search agents or NACS capabilities
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="agent-search-input"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter agent, role, or capability..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Main Split: Agent Roster + Live 6-Stage NACS Routing Dry-Run */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Roster Column */}
        <section className="rounded-xl border border-slate-200 bg-white lg:col-span-7">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Division Agent Roster
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Select any agent blueprint to inspect its NACS contract constraints and run a
              deterministic 6-stage provider eligibility check.
            </p>
          </div>

          {visibleDivisions.length === 0 ? (
            <div className="px-6 py-10 text-center space-y-2">
              <p className="text-sm font-medium text-slate-900">No matching agents found</p>
              <p className="text-xs text-slate-500">
                Try clearing your filter or switching back to All 7 Divisions.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedDivision('all');
                  setSearchQuery('');
                }}
                className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {visibleDivisions.map((div) => (
                <div key={div.id} className="p-6 space-y-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                    <div>
                      <h3 className="font-display text-sm font-bold text-slate-900">{div.name}</h3>
                      <p className="text-xs text-slate-600">{div.mandate}</p>
                    </div>
                    <span className="font-mono text-xs text-slate-500 whitespace-nowrap tabular-nums">
                      Cap: USD {div.defaultMonthlyCapUsd}/mo
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {div.agents.map((agent) => {
                      const isSelected = agent.agent_id === selectedAgent.agent_id;
                      const binding = BINDING_META[agent.runtime_binding];
                      const BindingIcon = binding.Icon;

                      return (
                        <div
                          key={agent.agent_id}
                          className={`flex flex-col gap-3 py-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                            isSelected ? 'bg-blue-50/40 -mx-3 px-3 rounded-lg' : ''
                          }`}
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAgentId(agent.agent_id);
                                  setDryRunResult(null);
                                  setDryRunError(null);
                                }}
                                className="text-left text-sm font-semibold text-slate-900 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
                              >
                                {agent.name}
                              </button>
                              <span aria-hidden="true" className="text-slate-300">
                                ·
                              </span>
                              <span className="font-mono text-xs text-slate-500">
                                {agent.agent_id}
                              </span>
                            </div>

                            <p className="text-xs text-slate-600">{agent.role}</p>

                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span
                                className={`inline-flex items-center gap-1 font-medium ${binding.textClass}`}
                              >
                                <BindingIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span>{binding.label}</span>
                              </span>
                              <span aria-hidden="true" className="text-slate-300">
                                ·
                              </span>
                              <span className="font-mono text-slate-500">
                                {agent.required_capabilities.join(', ')}
                              </span>
                              <span aria-hidden="true" className="text-slate-300">
                                ·
                              </span>
                              <span className="font-mono text-slate-600 tabular-nums">
                                Max USD {agent.estimated_task_cap_usd.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center shrink-0">
                            <button
                              type="button"
                              onClick={() => handleRunDryRun(agent)}
                              disabled={dryRunLoading}
                              aria-label={`Run 6-stage routing dry-run for ${agent.name}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap disabled:opacity-50"
                            >
                              <Play className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                              <span>Dry-Run Route</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right Column: Live NACS 6-Stage Routing Dry-Run Inspector */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 space-y-5 self-start">
          <div className="border-b border-slate-200 pb-4 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-slate-500">{selectedAgent.agent_id}</span>
              <span className="font-mono text-xs text-slate-600">
                Offline Dry-Run · 0 Paid Calls
              </span>
            </div>
            <h2 className="font-display text-lg font-bold text-slate-900">{selectedAgent.name}</h2>
            <p className="text-xs text-slate-600">{selectedAgent.binding_note}</p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-slate-500">Track</dt>
              <dd className="mt-0.5 font-mono font-medium text-slate-900">
                {selectedAgent.production_track}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Data Sensitivity</dt>
              <dd className="mt-0.5 font-mono font-medium text-slate-900">
                {selectedAgent.data_sensitivity}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Required Scopes</dt>
              <dd className="mt-0.5 font-mono text-slate-800">
                {selectedAgent.required_scopes.join(', ')}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Task Cost Cap</dt>
              <dd className="mt-0.5 font-mono font-medium text-slate-900 tabular-nums">
                USD {selectedAgent.estimated_task_cap_usd.toFixed(2)}
              </dd>
            </div>
          </dl>

          <div className="space-y-3 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="sim-human-approval"
                className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer"
              >
                <input
                  id="sim-human-approval"
                  type="checkbox"
                  checked={simulateHumanApproval}
                  onChange={(e) => setSimulateHumanApproval(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                <span>Include verified human approval token in dry-run</span>
              </label>
              <button
                type="button"
                onClick={onNavigateSecurity}
                className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
              >
                Edit Scopes
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleRunDryRun(selectedAgent)}
              disabled={dryRunLoading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors disabled:opacity-50"
            >
              <Server className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {dryRunLoading ? 'Running NACS 6-Stage Router...' : 'Run 6-Stage Routing Check'}
              </span>
            </button>
          </div>

          {dryRunError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"
            >
              {dryRunError}
            </div>
          )}

          {dryRunResult && (
            <div className="space-y-4 border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900">
                  NACS v1 Routing Decision
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold ${
                    dryRunResult.decision.routed ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {dryRunResult.decision.routed ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Eligible Route Found</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Blocked ({dryRunResult.decision.failure_reason_code})</span>
                    </>
                  )}
                </span>
              </div>

              {dryRunResult.decision.selected ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-semibold text-slate-900">
                      {dryRunResult.decision.selected.provider_id} /{' '}
                      {dryRunResult.decision.selected.model_id}
                    </span>
                    <span className="font-mono font-semibold text-emerald-800 tabular-nums">
                      Score {dryRunResult.decision.selected.score.toFixed(3)}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[11px] font-mono text-slate-700 tabular-nums">
                    <div>Q: {dryRunResult.decision.selected.breakdown.quality}</div>
                    <div>L: {dryRunResult.decision.selected.breakdown.latency}</div>
                    <div>C: {dryRunResult.decision.selected.breakdown.cost}</div>
                    <div>R: {dryRunResult.decision.selected.breakdown.reliability}</div>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Env var reference only:{' '}
                    <span className="font-mono text-slate-800">
                      {dryRunResult.decision.selected.entry.credential_env_var}
                    </span>{' '}
                    · Paid calls executed: {dryRunResult.paid_calls_executed}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
                  <span>{dryRunResult.decision.failure_reason}</span>
                </div>
              )}

              {dryRunResult.decision.rejected_candidates.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-700">
                    6-Stage Eligibility Rejections ({dryRunResult.decision.rejected_candidates.length})
                  </h3>
                  <ul className="divide-y divide-slate-100 border-t border-slate-100 max-h-60 overflow-y-auto">
                    {dryRunResult.decision.rejected_candidates.map((rej) => (
                      <li key={`${rej.provider_id}-${rej.model_id}`} className="py-2 space-y-0.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono font-medium text-slate-800">
                            {rej.model_id}
                          </span>
                          <span className="font-mono text-[11px] text-red-700">
                            {rej.reason_code}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Stage: <span className="font-mono">{rej.stage}</span> · {rej.reason}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Registered NACS v1 Provider Models Table (Env-Var-Only) */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-1 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              NACS Provider Registry v1 Catalog ({providers.length} Blueprint Entries)
            </h2>
            <p className="text-xs text-slate-600">
              Evaluated offline by <span className="font-mono">src/nacs/v1/router.ts</span>.
              Only credential environment variable names are stored; zero live adapters are bound.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <th className="px-6 py-3">Provider & Model</th>
                <th className="px-4 py-3">Lifecycle & Health</th>
                <th className="px-4 py-3">Privacy & ZDR</th>
                <th className="px-4 py-3">Credential Env Var</th>
                <th className="px-4 py-3 text-right">p95 Latency</th>
                <th className="px-6 py-3 text-right">Est. Cost / Req</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {providers.map((p) => (
                <tr key={`${p.provider_id}::${p.model_id}`} className="hover:bg-slate-50/70">
                  <td className="px-6 py-3">
                    <p className="font-mono font-semibold text-slate-900">{p.model_id}</p>
                    <p className="font-mono text-[11px] text-slate-500">{p.provider_id}</p>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    <span
                      className={
                        p.lifecycle_status === 'active'
                          ? 'text-emerald-700 font-medium'
                          : p.lifecycle_status === 'retired'
                            ? 'text-red-700 font-medium'
                            : 'text-amber-700 font-medium'
                      }
                    >
                      {p.lifecycle_status}
                    </span>
                    <span className="text-slate-400"> · </span>
                    <span className="text-slate-600">{p.availability_status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <span className="font-mono">{p.privacy_handling.max_data_sensitivity}</span>
                    <span className="text-slate-400"> · </span>
                    <span>{p.privacy_handling.zero_data_retention ? 'ZDR' : 'No ZDR'}</span>
                    <span className="text-slate-400"> · </span>
                    <span>{p.privacy_handling.supports_pii ? 'PII OK' : 'No PII'}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">{p.credential_env_var}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums">
                    {p.latency.p95_ms} ms
                  </td>
                  <td className="px-6 py-3 text-right font-mono font-medium text-slate-900 tabular-nums">
                    {p.cost.state === 'known'
                      ? `${p.cost.currency} ${p.cost.estimated_cost_per_request.toFixed(2)}`
                      : 'Unknown'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
