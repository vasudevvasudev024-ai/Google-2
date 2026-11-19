import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import {
  validateWorkflowContract,
  type ProductionTrack,
  type WorkflowContract,
} from '../core/contracts';

interface NewWorkflowModalProps {
  open: boolean;
  existingIds: string[];
  onClose: () => void;
  onCreate: (contract: WorkflowContract) => void;
}

const CREATIVE_OUTPUTS = ['screenplay', 'storyboard', 'images', 'video', 'audio', 'final_render'];
const AUTOMATION_OUTPUTS = ['research', 'code', 'documents'];

export function NewWorkflowModal({ open, existingIds, onClose, onCreate }: NewWorkflowModalProps) {
  const [track, setTrack] = useState<ProductionTrack>('automation');
  const [goal, setGoal] = useState('');
  const [language, setLanguage] = useState('en');
  const [currency, setCurrency] = useState('USD');
  const [maxSpend, setMaxSpend] = useState('250');
  const [outputs, setOutputs] = useState<string[]>(AUTOMATION_OUTPUTS);
  const [errors, setErrors] = useState<string[]>([]);

  if (!open) return null;

  const handleTrackSwitch = (nextTrack: ProductionTrack) => {
    setTrack(nextTrack);
    setOutputs(nextTrack === 'creative' ? [...CREATIVE_OUTPUTS] : [...AUTOMATION_OUTPUTS]);
    setCurrency(nextTrack === 'creative' ? 'INR' : 'USD');
  };

  const toggleOutput = (output: string) => {
    setOutputs((prev) =>
      prev.includes(output) ? prev.filter((item) => item !== output) : [...prev, output]
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const nextNum = existingIds.length + 1;
    const workflowId = `wf_custom_${String(nextNum).padStart(3, '0')}`;
    const parsedSpend = Number(maxSpend);

    const candidate: WorkflowContract = {
      schema_version: '1.0',
      workflow_id: workflowId,
      workspace_id: 'workspace_demo',
      project_id: track === 'creative' ? `project_creative_${nextNum}` : `project_automation_${nextNum}`,
      production_track: track,
      goal: goal.trim(),
      constraints:
        track === 'creative'
          ? {
              language: language.trim() || 'hi',
              duration_seconds: 180,
              visual_style: 'cinematic fantasy',
              aspect_ratio: '16:9',
            }
          : {
              language: language.trim() || 'en',
              target_runtime: 'Node 22 LTS',
              compliance_standard: 'strict-typescript',
            },
      requested_outputs: outputs,
      autonomy_policy: {
        mode: 'hybrid',
        external_publishing: 'approval_required',
        purchases: 'approval_required',
        destructive_actions: 'approval_required',
      },
      budget: {
        currency: currency.trim() || 'USD',
        max_spend: parsedSpend,
        require_approval_over_limit: true,
      },
    };

    const validation = validateWorkflowContract(candidate);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors([]);
    setGoal('');
    onCreate(candidate);
  };

  const availableOutputs = track === 'creative' ? CREATIVE_OUTPUTS : AUTOMATION_OUTPUTS;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-workflow-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <h2 id="new-workflow-title" className="font-display text-lg font-bold text-slate-900">
            Create Workflow Contract
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create workflow dialog"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <span className="block text-xs font-semibold text-slate-700">Production Track</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTrackSwitch('creative')}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                  track === 'creative'
                    ? 'border-blue-700 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="block font-semibold">Creative Track</span>
                <span className="block text-slate-500">Screenplay, storyboard, media</span>
              </button>
              <button
                type="button"
                onClick={() => handleTrackSwitch('automation')}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                  track === 'automation'
                    ? 'border-blue-700 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="block font-semibold">Automation Track</span>
                <span className="block text-slate-500">Research, code, documents</span>
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="wf-goal" className="block text-xs font-semibold text-slate-700">
              Workflow Goal
            </label>
            <input
              id="wf-goal"
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={
                track === 'creative'
                  ? 'e.g., Create a three-minute Marathi folklore short'
                  : 'e.g., Generate OAuth2 audit script and runbook'
              }
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="wf-lang" className="block text-xs font-semibold text-slate-700">
                Language
              </label>
              <input
                id="wf-lang"
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="wf-currency" className="block text-xs font-semibold text-slate-700">
                Currency
              </label>
              <input
                id="wf-currency"
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="wf-budget" className="block text-xs font-semibold text-slate-700">
                Max Spend
              </label>
              <input
                id="wf-budget"
                type="number"
                min={1}
                value={maxSpend}
                onChange={(e) => setMaxSpend(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700">Requested Outputs</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {availableOutputs.map((out) => {
                const checked = outputs.includes(out);
                return (
                  <button
                    key={out}
                    type="button"
                    onClick={() => toggleOutput(out)}
                    aria-pressed={checked}
                    className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors ${
                      checked
                        ? 'border-blue-700 bg-blue-700 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {out}
                  </button>
                );
              })}
            </div>
          </div>

          {errors.length > 0 && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <ul className="list-disc pl-4 space-y-0.5">
                {errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Create Workflow
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
