import crypto from 'node:crypto';
import type { TaskEnvelope, TaskState, WorkflowRequest, WorkflowState } from './types';

export const ALLOWED_WORKFLOW_TRANSITIONS: Record<WorkflowState, readonly WorkflowState[]> = {
  draft: ['queued', 'cancelled'],
  queued: ['planning', 'cancelled'],
  planning: ['running', 'waiting_approval', 'failed', 'cancelled'],
  running: ['waiting_approval', 'reviewing', 'failed', 'cancelled'],
  waiting_approval: ['running', 'cancelled'],
  reviewing: ['running', 'completed', 'failed', 'cancelled'],
  failed: ['queued'],
  completed: [],
  cancelled: [],
};

export const ALLOWED_TASK_TRANSITIONS: Record<TaskState, readonly TaskState[]> = {
  pending: ['ready', 'cancelled'],
  ready: ['running', 'waiting_approval', 'cancelled'],
  running: ['waiting_approval', 'completed', 'failed', 'cancelled'],
  waiting_approval: ['ready', 'running', 'cancelled'],
  failed: ['ready', 'cancelled'],
  completed: [],
  cancelled: [],
};

export interface StateTransitionResult<TState extends string> {
  ok: boolean;
  state: TState;
  errorCode?: string;
  error?: string;
}

export function canTransitionWorkflowState(from: WorkflowState, to: WorkflowState): boolean {
  return ALLOWED_WORKFLOW_TRANSITIONS[from].includes(to);
}

export function canTransitionTaskState(from: TaskState, to: TaskState): boolean {
  return ALLOWED_TASK_TRANSITIONS[from].includes(to);
}

export interface WorkflowCompletionCheckContext {
  tasks: Array<{ task_id: string; state: TaskState }>;
}

export function transitionWorkflowState(
  from: WorkflowState,
  to: WorkflowState,
  context?: WorkflowCompletionCheckContext
): StateTransitionResult<WorkflowState> {
  if (!canTransitionWorkflowState(from, to)) {
    return {
      ok: false,
      state: from,
      errorCode: 'ILLEGAL_WORKFLOW_TRANSITION',
      error: `Illegal workflow state transition: "${from}" -> "${to}".`,
    };
  }

  if (to === 'completed') {
    const tasks = context?.tasks ?? [];
    if (tasks.length === 0) {
      return {
        ok: false,
        state: from,
        errorCode: 'WORKFLOW_HAS_NO_TASKS',
        error: 'Cannot mark workflow completed without executed tasks.',
      };
    }

    const unfinished = tasks.filter(
      (t) => t.state !== 'completed' && t.state !== 'cancelled'
    );
    if (unfinished.length > 0) {
      return {
        ok: false,
        state: from,
        errorCode: 'UNFINISHED_TASKS_REMAIN',
        error: `Cannot complete workflow with unfinished tasks: ${unfinished
          .map((t) => `${t.task_id}(${t.state})`)
          .join(', ')}.`,
      };
    }

    const completedCount = tasks.filter((t) => t.state === 'completed').length;
    if (completedCount === 0) {
      return {
        ok: false,
        state: from,
        errorCode: 'NO_COMPLETED_TASKS',
        error: 'Cannot complete workflow when zero tasks succeeded.',
      };
    }
  }

  return { ok: true, state: to };
}

export function transitionTaskState(
  from: TaskState,
  to: TaskState,
  dependenciesCompleted = true
): StateTransitionResult<TaskState> {
  if (!canTransitionTaskState(from, to)) {
    return {
      ok: false,
      state: from,
      errorCode: 'ILLEGAL_TASK_TRANSITION',
      error: `Illegal task state transition: "${from}" -> "${to}".`,
    };
  }

  if ((to === 'ready' || to === 'running' || to === 'completed') && !dependenciesCompleted) {
    return {
      ok: false,
      state: from,
      errorCode: 'DEPENDENCIES_UNMET',
      error: `Cannot transition task to "${to}" while upstream dependencies remain incomplete.`,
    };
  }

  return { ok: true, state: to };
}

export interface DependencyValidationResult {
  valid: boolean;
  errors: string[];
  topologicalOrder: string[];
}

export function validateTaskGraph(
  workflow: WorkflowRequest,
  tasks: TaskEnvelope[]
): DependencyValidationResult {
  const errors: string[] = [];
  const taskMap = new Map<string, TaskEnvelope>();

  for (const task of tasks) {
    if (taskMap.has(task.task_id)) {
      errors.push(`Duplicate task_id "${task.task_id}" in workflow graph.`);
      continue;
    }
    if (task.workflow_id !== workflow.workflow_id) {
      errors.push(`Task "${task.task_id}" workflow_id "${task.workflow_id}" mismatches "${workflow.workflow_id}".`);
    }
    if (task.workspace_id !== workflow.workspace_id) {
      errors.push(`Cross-workspace task "${task.task_id}" rejected (expected "${workflow.workspace_id}").`);
    }
    if (task.project_id !== workflow.project_id) {
      errors.push(`Cross-project task "${task.task_id}" rejected (expected "${workflow.project_id}").`);
    }
    taskMap.set(task.task_id, task);
  }

  for (const task of tasks) {
    for (const depId of task.dependencies) {
      if (depId === task.task_id) {
        errors.push(`Task "${task.task_id}" cannot depend on itself.`);
      } else if (!taskMap.has(depId)) {
        errors.push(`Task "${task.task_id}" references missing dependency "${depId}".`);
      }
    }
  }

  // Kahn's / DFS topological cycle check
  const visitState = new Map<string, 'visiting' | 'visited'>();
  const order: string[] = [];

  const dfs = (id: string) => {
    const state = visitState.get(id);
    if (state === 'visiting') {
      errors.push(`Dependency cycle detected involving task "${id}".`);
      return;
    }
    if (state === 'visited') return;

    visitState.set(id, 'visiting');
    const task = taskMap.get(id);
    if (task) {
      for (const depId of task.dependencies) {
        if (taskMap.has(depId)) {
          dfs(depId);
        }
      }
    }
    visitState.set(id, 'visited');
    order.push(id);
  };

  for (const task of tasks) {
    if (!visitState.has(task.task_id)) {
      dfs(task.task_id);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    topologicalOrder: errors.length === 0 ? order : [],
  };
}

export interface IdempotencyRegistrationResult {
  accepted: boolean;
  errorCode?: string;
  error?: string;
}

export class IdempotencyRegistry {
  private readonly records = new Map<string, { taskId: string; payloadHash: string }>();

  private buildCompositeKey(workspaceId: string, idempotencyKey: string): string {
    return `${workspaceId}::${idempotencyKey}`;
  }

  private hashEnvelopeInput(task: TaskEnvelope): string {
    return crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          workflow_id: task.workflow_id,
          capability: task.capability,
          input: task.input,
        })
      )
      .digest('hex');
  }

  register(task: TaskEnvelope): IdempotencyRegistrationResult {
    const composite = this.buildCompositeKey(task.workspace_id, task.idempotency_key);
    const existing = this.records.get(composite);
    const payloadHash = this.hashEnvelopeInput(task);

    if (existing) {
      return {
        accepted: false,
        errorCode: 'DUPLICATE_IDEMPOTENCY_KEY',
        error: `Duplicate idempotency_key "${task.idempotency_key}" in workspace "${task.workspace_id}" (already bound to task "${existing.taskId}").`,
      };
    }

    this.records.set(composite, { taskId: task.task_id, payloadHash });
    return { accepted: true };
  }

  has(workspaceId: string, idempotencyKey: string): boolean {
    return this.records.has(this.buildCompositeKey(workspaceId, idempotencyKey));
  }
}
