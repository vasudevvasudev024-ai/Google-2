import { useState } from 'react';
import { CheckCircle2, Play, XCircle } from 'lucide-react';
import type { TaskContract, TaskExecutionState, WorkflowBundle } from '../core/contracts';
import { areTaskDependenciesMet } from '../core/stateMachine';
import { TaskStateLabel } from './StateBadge';

interface TasksResultsViewProps {
  bundle: WorkflowBundle;
  onUpdateTaskState: (taskId: string, nextState: TaskExecutionState) => void;
}

export function TasksResultsView({ bundle, onUpdateTaskState }: TasksResultsViewProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string>(bundle.tasks[0]?.task_id ?? '');

  const selectedTask: TaskContract | undefined =
    bundle.tasks.find((t) => t.task_id === selectedTaskId) ?? bundle.tasks[0];
  const selectedResult = selectedTask
    ? bundle.results.find((r) => r.task_id === selectedTask.task_id)
    : undefined;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Task Contract Queue Table */}
      <section className="rounded-xl border border-slate-200 bg-white lg:col-span-7">
        <div className="border-b border-slate-200 px-6 py-4">
          <h1 className="font-display text-lg font-bold text-slate-900">
            Common Task Contracts ({bundle.tasks.length})
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Agent identity, typed inputs, upstream dependencies, and execution state for {bundle.contract.workflow_id}.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-6 py-3">Task & Agent Identity</th>
                <th className="px-4 py-3">Dependencies</th>
                <th className="px-4 py-3">State</th>
                <th className="px-6 py-3 text-right">Est. Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {bundle.tasks.map((task) => {
                const isSelected = task.task_id === selectedTask?.task_id;
                const depsMet = areTaskDependenciesMet(task, bundle.tasks);

                return (
                  <tr
                    key={task.task_id}
                    className={`transition-colors ${
                      isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-6 py-3.5">
                      <button
                        type="button"
                        onClick={() => setSelectedTaskId(task.task_id)}
                        className="text-left focus-visible:outline-2 focus-visible:outline-blue-600"
                      >
                        <p className="font-medium text-slate-900">{task.title}</p>
                        <p className="mt-0.5 font-mono text-xs text-slate-500">
                          {task.agent_identity.agent_id} · {task.output_target}
                        </p>
                      </button>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-600">
                      {task.dependencies.length === 0 ? (
                        <span className="text-slate-400">None</span>
                      ) : (
                        <span>
                          {task.dependencies.join(', ')}
                          {!depsMet ? ' (waiting)' : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <TaskStateLabel state={task.execution_state} />
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-xs font-medium text-slate-900 tabular-nums">
                      {bundle.contract.budget.currency} {task.estimated_cost}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Task & Agent Result Contract Inspector */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
        {selectedTask ? (
          <div className="space-y-6">
            <div className="space-y-2 border-b border-slate-200 pb-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-slate-500">{selectedTask.task_id}</span>
                <TaskStateLabel state={selectedTask.execution_state} />
              </div>
              <h2 className="font-display text-lg font-bold text-slate-900">{selectedTask.title}</h2>
              <p className="text-xs text-slate-600">
                {selectedTask.agent_identity.role} · Tier: {selectedTask.agent_identity.capability_tier}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                {selectedTask.execution_state !== 'completed' &&
                  selectedTask.execution_state !== 'cancelled' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onUpdateTaskState(selectedTask.task_id, 'running')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        <Play className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Run Task</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateTaskState(selectedTask.task_id, 'completed')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Complete Task</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateTaskState(selectedTask.task_id, 'failed')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap"
                      >
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Simulate Fail</span>
                      </button>
                    </>
                  )}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-500">Task Contract Inputs</h3>
              <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800">
                {JSON.stringify(
                  {
                    agent_identity: selectedTask.agent_identity,
                    inputs: selectedTask.inputs,
                    dependencies: selectedTask.dependencies,
                    policy_triggers: selectedTask.policy_triggers,
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-xs font-semibold text-slate-500">Agent Result Contract</h3>
              {selectedResult ? (
                <div className="mt-2 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-medium text-slate-900">
                      {selectedResult.result_id} · {selectedResult.status}
                    </span>
                    <span className="font-mono text-slate-500 tabular-nums">
                      {bundle.contract.budget.currency} {selectedResult.spend_incurred} ·{' '}
                      {(selectedResult.duration_ms / 1000).toFixed(2)}s
                    </span>
                  </div>
                  <p className="text-sm text-slate-800">{selectedResult.summary}</p>
                  <p className="text-xs text-slate-600">Review notes: {selectedResult.review_notes}</p>
                  <p className="font-mono text-xs text-slate-500">
                    Produced artifacts: {selectedResult.produced_artifact_ids.join(', ')}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  No Agent Result returned yet. Run and complete this task to generate its Agent Result and Artifact contracts.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600">No tasks defined for this workflow.</p>
        )}
      </section>
    </div>
  );
}
