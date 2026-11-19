import { useEffect, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import {
  validateWorkflowContract,
  type WorkflowBundle,
  type WorkflowContract,
} from '../core/contracts';

interface ContractJsonViewProps {
  bundle: WorkflowBundle;
  onApplyContractJson: (updated: WorkflowContract) => void;
}

type ContractInspectTab = 'workflow' | 'task' | 'result' | 'artifact' | 'approval';

export function ContractJsonView({ bundle, onApplyContractJson }: ContractJsonViewProps) {
  const [inspectTab, setInspectTab] = useState<ContractInspectTab>('workflow');
  const [draftJson, setDraftJson] = useState<string>(() => JSON.stringify(bundle.contract, null, 2));
  const [errors, setErrors] = useState<string[]>([]);
  const [savedNotice, setSavedNotice] = useState<string>('');

  useEffect(() => {
    setDraftJson(JSON.stringify(bundle.contract, null, 2));
    setErrors([]);
    setSavedNotice('');
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

  const handleResetEditor = () => {
    setDraftJson(JSON.stringify(bundle.contract, null, 2));
    setErrors([]);
    setSavedNotice('');
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
              Live Contract JSON & Schema Inspector
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              Edit the active Workflow Contract directly or inspect live Task, Agent Result, Artifact, and Approval payloads.
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
            <label htmlFor="workflow-json-editor" className="block text-xs font-semibold text-slate-700">
              Workflow Contract Payload ({bundle.contract.workflow_id})
            </label>
            <textarea
              id="workflow-json-editor"
              value={draftJson}
              onChange={(e) => setDraftJson(e.target.value)}
              rows={22}
              spellCheck={false}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
            />

            {errors.length > 0 && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <p className="font-semibold">Contract validation failed:</p>
                <ul className="mt-1 list-disc pl-4 space-y-0.5">
                  {errors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
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
