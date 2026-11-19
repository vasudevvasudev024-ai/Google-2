import { useEffect, useState } from 'react';
import { Check, RotateCcw, ShieldCheck } from 'lucide-react';
import {
  validateWorkflowContract,
  type WorkflowBundle,
  type WorkflowContract,
} from '../core/contracts';
import type { ContractValidationApiResponse } from '../nexus/governance';

interface ContractJsonViewProps {
  bundle: WorkflowBundle;
  onApplyContractJson: (updated: WorkflowContract) => void;
}

type ContractInspectTab = 'workflow' | 'task' | 'result' | 'artifact' | 'approval';

function mapStudioContractToNacsWorkflowRequest(contract: WorkflowContract) {
  return {
    contract_version: '1.0',
    workflow_id: contract.workflow_id,
    workspace_id: contract.workspace_id,
    project_id: contract.project_id,
    production_track: contract.production_track,
    goal: contract.goal,
    constraints: contract.constraints,
    requested_outputs: contract.requested_outputs,
    autonomy_policy: {
      mode: contract.autonomy_policy.mode === 'supervised' ? 'supervised' : 'hybrid',
      unknown_tools: 'deny',
      public_publishing:
        contract.autonomy_policy.external_publishing === 'deny' ? 'deny' : 'approval_required',
      external_messages: 'approval_required',
      purchases: contract.autonomy_policy.purchases === 'deny' ? 'deny' : 'approval_required',
      payments: 'approval_required',
      destructive_operations:
        contract.autonomy_policy.destructive_actions === 'deny' ? 'deny' : 'approval_required',
      sensitive_account_modifications: 'approval_required',
    },
    budget: contract.budget,
  };
}

export function ContractJsonView({ bundle, onApplyContractJson }: ContractJsonViewProps) {
  const [inspectTab, setInspectTab] = useState<ContractInspectTab>('workflow');
  const [draftJson, setDraftJson] = useState<string>(() =>
    JSON.stringify(bundle.contract, null, 2)
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [savedNotice, setSavedNotice] = useState<string>('');
  const [serverCheck, setServerCheck] = useState<ContractValidationApiResponse | null>(null);
  const [serverChecking, setServerChecking] = useState(false);

  useEffect(() => {
    setDraftJson(JSON.stringify(bundle.contract, null, 2));
    setErrors([]);
    setSavedNotice('');
    setServerCheck(null);
  }, [bundle.contract]);

  const handleApply = () => {
    setSavedNotice('');
    try {
      const parsed = JSON.parse(draftJson) as unknown;
      const result = validateWorkflowContract(parsed);
      if (!result.valid) {
        setErrors(result.errors);
        return;
      }
      setErrors([]);
      onApplyContractJson(parsed as WorkflowContract);
      setSavedNotice('Workflow contract updated and applied.');
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Invalid JSON syntax.']);
    }
  };

  const handleServerSchemaCheck = async () => {
    setServerChecking(true);
    setErrors([]);
    setSavedNotice('');
    try {
      const parsed = JSON.parse(draftJson) as WorkflowContract;
      const canonical = mapStudioContractToNacsWorkflowRequest(parsed);
      const res = await fetch('/api/nexus/contracts/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract: canonical }),
      });
      if (!res.ok) {
        throw new Error(`Ajv validation endpoint returned HTTP ${res.status}`);
      }
      const data = (await res.json()) as ContractValidationApiResponse;
      setServerCheck(data);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Server schema validation failed.']);
    } finally {
      setServerChecking(false);
    }
  };

  const handleResetEditor = () => {
    setDraftJson(JSON.stringify(bundle.contract, null, 2));
    setErrors([]);
    setSavedNotice('');
    setServerCheck(null);
  };

  const samplePayload =
    inspectTab === 'task'
      ? bundle.tasks[0] ?? { message: 'No tasks yet' }
      : inspectTab === 'result'
        ? bundle.results[0] ?? { message: 'No agent results yet' }
        : inspectTab === 'artifact'
          ? bundle.artifacts[0] ?? { message: 'No artifacts yet' }
          : bundle.approvals[0] ?? { message: 'No approval contracts yet' };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900">
              Live Contract JSON & NACS v1.0 Schema Inspector
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              Edit the active Workflow Contract, verify against the server-side Ajv Draft 2020-12
              schema, or inspect Task, Result, Artifact, and Approval payloads.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Contract schema selector"
            className="flex items-center gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1"
          >
            {(
              [
                { id: 'workflow', label: 'Workflow' },
                { id: 'task', label: 'Task' },
                { id: 'result', label: 'Agent Result' },
                { id: 'artifact', label: 'Artifact' },
                { id: 'approval', label: 'Approval' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={inspectTab === t.id}
                onClick={() => setInspectTab(t.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  inspectTab === t.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {inspectTab === 'workflow' ? (
          <div className="mt-4 space-y-4">
            <label
              htmlFor="workflow-json-editor"
              className="block text-xs font-semibold text-slate-700"
            >
              Workflow Contract Payload ({bundle.contract.workflow_id})
            </label>
            <textarea
              id="workflow-json-editor"
              value={draftJson}
              onChange={(e) => setDraftJson(e.target.value)}
              rows={20}
              spellCheck={false}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
            />

            {errors.length > 0 && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"
              >
                <p className="font-semibold">Contract validation failed:</p>
                <ul className="mt-1 list-disc pl-4 space-y-0.5">
                  {errors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {serverCheck && (
              <div
                className={`rounded-lg border p-3 text-xs ${
                  serverCheck.valid
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-red-200 bg-red-50 text-red-900'
                }`}
              >
                <p className="font-semibold">
                  {serverCheck.valid
                    ? `Passed server-side ${serverCheck.engine} check (${serverCheck.schema})`
                    : `Failed server-side ${serverCheck.engine} check (${serverCheck.schema})`}
                </p>
                {serverCheck.errors.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 font-mono text-[11px] space-y-0.5">
                    {serverCheck.errors.map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {savedNotice && (
              <p className="text-xs font-medium text-emerald-700">{savedNotice}</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleApply}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Apply Contract JSON</span>
              </button>
              <button
                type="button"
                onClick={handleServerSchemaCheck}
                disabled={serverChecking}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap disabled:opacity-50"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                <span>
                  {serverChecking ? 'Validating Schema...' : 'Verify with NACS Ajv Schema'}
                </span>
              </button>
              <button
                type="button"
                onClick={handleResetEditor}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Revert Edits</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-slate-700">
              Active {inspectTab} contract instance from {bundle.contract.workflow_id}
            </p>
            <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-900">
              {JSON.stringify(samplePayload, null, 2)}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
}
