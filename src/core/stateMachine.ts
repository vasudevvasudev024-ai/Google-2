import type {
  ApprovalContract,
  ApprovalTriggerReason,
  ArtifactContract,
  ProductionTrack,
  TaskContract,
  TaskExecutionState,
  WorkflowBundle,
  WorkflowContract,
  WorkflowState,
} from './contracts';

export interface StateTransitionOption {
  to: WorkflowState;
  label: string;
  actionLabel: string;
  requiresPendingApprovalCleared?: boolean;
}

export const WORKFLOW_STATE_ORDER: WorkflowState[] = [
  'draft',
  'queued',
  'planning',
  'running',
  'waiting_approval',
  'reviewing',
  'failed',
  'completed',
  'cancelled',
];

export const STATE_METADATA: Record<
  WorkflowState,
  { label: string; description: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }
> = {
  draft: {
    label: 'Draft',
    description: 'Contract defined and editable before entering execution queue.',
    tone: 'neutral',
  },
  queued: {
    label: 'Queued',
    description: 'Accepted into execution queue and waiting for planner pickup.',
    tone: 'info',
  },
  planning: {
    label: 'Planning',
    description: 'Decomposing workflow outputs into dependency-ordered agent tasks.',
    tone: 'info',
  },
  running: {
    label: 'Running',
    description: 'Agents actively executing tasks within budget and policy limits.',
    tone: 'info',
  },
  waiting_approval: {
    label: 'Waiting Approval',
    description: 'Execution paused pending human authorization on policy or budget gate.',
    tone: 'warning',
  },
  reviewing: {
    label: 'Reviewing',
    description: 'All required outputs produced; evaluating quality against constraints.',
    tone: 'warning',
  },
  failed: {
    label: 'Failed',
    description: 'Execution halted by task or validation error; eligible for authorized retry.',
    tone: 'danger',
  },
  completed: {
    label: 'Completed',
    description: 'Review passed and all requested artifacts accepted.',
    tone: 'success',
  },
  cancelled: {
    label: 'Cancelled',
    description: 'Workflow terminated prior to completion.',
    tone: 'neutral',
  },
};

export const WORKFLOW_TRANSITIONS: Record<WorkflowState, StateTransitionOption[]> = {
  draft: [
    { to: 'queued', label: 'Queue workflow', actionLabel: 'Queue Workflow' },
    { to: 'cancelled', label: 'Cancel workflow', actionLabel: 'Cancel' },
  ],
  queued: [
    { to: 'planning', label: 'Begin planning', actionLabel: 'Start Planning' },
    { to: 'cancelled', label: 'Cancel workflow', actionLabel: 'Cancel' },
  ],
  planning: [
    { to: 'running', label: 'Begin execution', actionLabel: 'Run Agents' },
    { to: 'waiting_approval', label: 'Pause for plan approval', actionLabel: 'Request Approval' },
    { to: 'failed', label: 'Planning error', actionLabel: 'Mark Failed' },
    { to: 'cancelled', label: 'Cancel workflow', actionLabel: 'Cancel' },
  ],
  running: [
    { to: 'waiting_approval', label: 'Policy or budget gate', actionLabel: 'Request Approval' },
    { to: 'reviewing', label: 'Submit for review', actionLabel: 'Submit Review' },
    { to: 'failed', label: 'Execution error', actionLabel: 'Mark Failed' },
    { to: 'cancelled', label: 'Cancel workflow', actionLabel: 'Cancel' },
  ],
  waiting_approval: [
    {
      to: 'running',
      label: 'Approval granted',
      actionLabel: 'Resume Running',
      requiresPendingApprovalCleared: true,
    },
    { to: 'cancelled', label: 'Cancel workflow', actionLabel: 'Cancel' },
  ],
  reviewing: [
    { to: 'running', label: 'Corrections needed', actionLabel: 'Corrections Needed' },
    { to: 'completed', label: 'Passed', actionLabel: 'Passed' },
    { to: 'failed', label: 'Review failure', actionLabel: 'Mark Failed' },
    { to: 'cancelled', label: 'Cancel workflow', actionLabel: 'Cancel' },
  ],
  failed: [{ to: 'queued', label: 'Authorized retry', actionLabel: 'Authorized Retry' }],
  completed: [],
  cancelled: [],
};

export function canTransition(from: WorkflowState, to: WorkflowState): boolean {
  return WORKFLOW_TRANSITIONS[from].some((opt) => opt.to === to);
}

export function getAvailableTransitions(bundle: WorkflowBundle): StateTransitionOption[] {
  const options = WORKFLOW_TRANSITIONS[bundle.state];
  const hasPendingApprovals = bundle.approvals.some((a) => a.status === 'pending');

  return options.filter((opt) => {
    if (opt.requiresPendingApprovalCleared && hasPendingApprovals) {
      return false;
    }
    return true;
  });
}

export function calculateWorkflowSpend(bundle: WorkflowBundle): {
  incurred: number;
  projectedTotal: number;
  maxSpend: number;
  overLimit: boolean;
  utilizationPct: number;
} {
  const incurred = bundle.results.reduce((sum, r) => sum + r.spend_incurred, 0);
  const remainingEstimated = bundle.tasks
    .filter((t) => t.execution_state !== 'completed' && t.execution_state !== 'cancelled')
    .reduce((sum, t) => sum + t.estimated_cost, 0);
  const projectedTotal = incurred + remainingEstimated;
  const maxSpend = bundle.contract.budget.max_spend;
  const utilizationPct = maxSpend > 0 ? Math.min(100, Math.round((incurred / maxSpend) * 100)) : 0;

  return {
    incurred,
    projectedTotal,
    maxSpend,
    overLimit: projectedTotal > maxSpend || incurred > maxSpend,
    utilizationPct,
  };
}

export function evaluatePolicyTriggers(
  contract: WorkflowContract,
  task: TaskContract,
  currentSpend: number
): ApprovalTriggerReason[] {
  const triggers: ApprovalTriggerReason[] = [];

  for (const policyKey of task.policy_triggers) {
    if (contract.autonomy_policy[policyKey] === 'approval_required') {
      triggers.push(policyKey);
    }
  }

  if (
    contract.budget.require_approval_over_limit &&
    currentSpend + task.estimated_cost > contract.budget.max_spend
  ) {
    triggers.push('budget_over_limit');
  }

  return triggers;
}

export function transitionWorkflowBundle(
  bundle: WorkflowBundle,
  targetState: WorkflowState,
  actor = 'Operator',
  note?: string,
  timestamp = new Date().toISOString()
): { bundle: WorkflowBundle; error?: string } {
  if (!canTransition(bundle.state, targetState)) {
    return {
      bundle,
      error: `Invalid transition from "${bundle.state}" to "${targetState}" per stateDiagram-v2.`,
    };
  }

  const transitionSpec = WORKFLOW_TRANSITIONS[bundle.state].find((t) => t.to === targetState);
  const hasPendingApprovals = bundle.approvals.some((a) => a.status === 'pending');

  if (transitionSpec?.requiresPendingApprovalCleared && hasPendingApprovals) {
    return {
      bundle,
      error: 'Cannot resume running while pending approval contracts remain undecided.',
    };
  }

  let updatedTasks = bundle.tasks;
  if (targetState === 'cancelled') {
    updatedTasks = bundle.tasks.map((t) =>
      t.execution_state === 'completed' ? t : { ...t, execution_state: 'cancelled' }
    );
  } else if (targetState === 'completed') {
    updatedTasks = bundle.tasks.map((t) => ({ ...t, execution_state: 'completed' }));
  } else if (targetState === 'queued' && bundle.state === 'failed') {
    updatedTasks = bundle.tasks.map((t) =>
      t.execution_state === 'failed' ? { ...t, execution_state: 'ready' } : t
    );
  }

  const nextBundle: WorkflowBundle = {
    ...bundle,
    state: targetState,
    tasks: updatedTasks,
    transitions: [
      ...bundle.transitions,
      {
        id: `tr_${bundle.transitions.length + 1}_${Date.now()}`,
        from: bundle.state,
        to: targetState,
        label: transitionSpec?.label ?? targetState,
        actor,
        timestamp,
        note,
      },
    ],
  };

  return { bundle: nextBundle };
}

export function resolveApprovalDecision(
  bundle: WorkflowBundle,
  approvalId: string,
  decision: 'approved' | 'rejected',
  decidedBy: string,
  decisionNote?: string,
  timestamp = new Date().toISOString()
): { bundle: WorkflowBundle; error?: string } {
  const target = bundle.approvals.find((a) => a.approval_id === approvalId);
  if (!target) {
    return { bundle, error: `Approval contract "${approvalId}" not found.` };
  }
  if (target.status !== 'pending') {
    return { bundle, error: `Approval contract "${approvalId}" is already ${target.status}.` };
  }

  const updatedApprovals: ApprovalContract[] = bundle.approvals.map((a) =>
    a.approval_id === approvalId
      ? {
          ...a,
          status: decision,
          decided_by: decidedBy,
          decided_at: timestamp,
          decision_note: decisionNote?.trim() || (decision === 'approved' ? 'Authorized by reviewer.' : 'Rejected by reviewer.'),
        }
      : a
  );

  const updatedTasks: TaskContract[] = bundle.tasks.map((t) => {
    if (t.task_id !== target.task_id) return t;
    return {
      ...t,
      execution_state: decision === 'approved' ? 'ready' : 'cancelled',
    };
  });

  let nextBundle: WorkflowBundle = {
    ...bundle,
    approvals: updatedApprovals,
    tasks: updatedTasks,
  };

  const remainingPending = updatedApprovals.some((a) => a.status === 'pending');

  if (bundle.state === 'waiting_approval' && !remainingPending) {
    if (decision === 'approved') {
      const res = transitionWorkflowBundle(
        nextBundle,
        'running',
        decidedBy,
        `Approval ${approvalId} granted: ${target.requested_action}`,
        timestamp
      );
      nextBundle = res.bundle;
    } else {
      const res = transitionWorkflowBundle(
        nextBundle,
        'cancelled',
        decidedBy,
        `Approval ${approvalId} rejected: ${target.requested_action}`,
        timestamp
      );
      nextBundle = res.bundle;
    }
  }

  return { bundle: nextBundle };
}

export function areTaskDependenciesMet(task: TaskContract, allTasks: TaskContract[]): boolean {
  if (task.dependencies.length === 0) return true;
  return task.dependencies.every((depId) => {
    const dep = allTasks.find((t) => t.task_id === depId);
    return dep?.execution_state === 'completed';
  });
}

export function updateTaskExecutionState(
  bundle: WorkflowBundle,
  taskId: string,
  nextTaskState: TaskExecutionState,
  timestamp = new Date().toISOString()
): { bundle: WorkflowBundle; error?: string } {
  const task = bundle.tasks.find((t) => t.task_id === taskId);
  if (!task) {
    return { bundle, error: `Task "${taskId}" not found.` };
  }

  if (nextTaskState === 'completed' && !areTaskDependenciesMet(task, bundle.tasks)) {
    return {
      bundle,
      error: `Cannot complete "${task.title}" before upstream dependencies (${task.dependencies.join(', ')}) complete.`,
    };
  }

  const updatedTasks = bundle.tasks.map((t) =>
    t.task_id === taskId ? { ...t, execution_state: nextTaskState } : t
  );

  let updatedResults = bundle.results;
  let updatedArtifacts = bundle.artifacts;

  if (nextTaskState === 'completed' && !bundle.results.some((r) => r.task_id === taskId)) {
    const newArtifactId = `art_${task.output_target}_${bundle.artifacts.length + 1}`;
    const newResultId = `res_${task.task_id}`;
    updatedResults = [
      ...bundle.results,
      {
        schema_version: '1.0',
        result_id: newResultId,
        task_id: task.task_id,
        workflow_id: bundle.contract.workflow_id,
        agent_id: task.agent_identity.agent_id,
        status: 'succeeded',
        summary: `Completed ${task.title} within contract constraints.`,
        spend_incurred: task.estimated_cost,
        duration_ms: 4200,
        produced_artifact_ids: [newArtifactId],
        review_notes: 'Schema verified against workflow requested_outputs.',
        completed_at: timestamp,
      },
    ];

    const validKind = normalizeArtifactKind(task.output_target, task.track);
    const newArtifact: ArtifactContract = {
      schema_version: '1.0',
      artifact_id: newArtifactId,
      workflow_id: bundle.contract.workflow_id,
      task_id: task.task_id,
      track: task.track,
      kind: validKind,
      title: `${task.title} Output`,
      mime_type: inferMimeType(validKind),
      uri: `relay://artifacts/${bundle.contract.workflow_id}/${newArtifactId}`,
      preview_text: `Generated ${validKind} output for "${bundle.contract.goal}" by ${task.agent_identity.agent_id}.`,
      provenance: {
        agent_id: task.agent_identity.agent_id,
        model_or_tool: task.track === 'creative' ? 'creative-pipeline-v2' : 'automation-runner-v2',
        input_hash: `sha256:${task.task_id.slice(-4)}9f3a`,
        created_at: timestamp,
      },
      review_status: 'pending_review',
    };
    updatedArtifacts = [...bundle.artifacts, newArtifact];
  }

  let nextBundle: WorkflowBundle = {
    ...bundle,
    tasks: updatedTasks,
    results: updatedResults,
    artifacts: updatedArtifacts,
  };

  if (nextTaskState === 'failed' && canTransition(bundle.state, 'failed')) {
    nextBundle = transitionWorkflowBundle(
      nextBundle,
      'failed',
      task.agent_identity.agent_id,
      `Task ${task.task_id} failed during execution.`,
      timestamp
    ).bundle;
  }

  return { bundle: nextBundle };
}

function normalizeArtifactKind(output: string, track: ProductionTrack): ArtifactContract['kind'] {
  const creativeKinds: ArtifactContract['kind'][] = [
    'screenplay',
    'storyboard',
    'images',
    'video',
    'audio',
    'final_render',
  ];
  const automationKinds: ArtifactContract['kind'][] = ['research', 'code', 'documents'];
  if (creativeKinds.includes(output as ArtifactContract['kind'])) {
    return output as ArtifactContract['kind'];
  }
  if (automationKinds.includes(output as ArtifactContract['kind'])) {
    return output as ArtifactContract['kind'];
  }
  return track === 'creative' ? 'storyboard' : 'documents';
}

function inferMimeType(kind: ArtifactContract['kind']): string {
  switch (kind) {
    case 'screenplay':
    case 'documents':
    case 'research':
      return 'text/markdown';
    case 'code':
      return 'text/typescript';
    case 'storyboard':
    case 'images':
      return 'image/jpeg';
    case 'audio':
      return 'audio/wav';
    case 'video':
    case 'final_render':
      return 'video/mp4';
  }
}

export function scaffoldWorkflowBundle(contract: WorkflowContract): WorkflowBundle {
  const now = new Date().toISOString();
  const isCreative = contract.production_track === 'creative';

  const count = Math.max(contract.requested_outputs.length, 1);
  const baseShare = Math.floor((contract.budget.max_spend / count) * 100) / 100;

  const tasks: TaskContract[] = contract.requested_outputs.map((output, index) => {
    const taskId = `task_${contract.workflow_id}_${index + 1}`;
    const prevTaskId = index > 0 ? [`task_${contract.workflow_id}_${index}`] : [];
    const isFinalStep = index === contract.requested_outputs.length - 1;
    const costShare = isFinalStep
      ? Math.round((contract.budget.max_spend - baseShare * (count - 1)) * 100) / 100
      : baseShare;

    return {
      schema_version: '1.0',
      task_id: taskId,
      workflow_id: contract.workflow_id,
      title: formatOutputTitle(output),
      track: contract.production_track,
      output_target: output,
      agent_identity: {
        agent_id: isCreative ? `agent_creative_${output}` : `agent_auto_${output}`,
        role: isCreative ? `Creative ${formatOutputTitle(output)} Agent` : `Automation ${formatOutputTitle(output)} Agent`,
        capability_tier: isFinalStep ? 'synthesis' : 'execution',
      },
      inputs: {
        goal: contract.goal,
        language: contract.constraints.language ?? 'en',
        ...(index > 0 ? { upstream_artifact: contract.requested_outputs[index - 1] } : {}),
      },
      dependencies: prevTaskId,
      execution_state: index === 0 ? 'ready' : 'pending',
      estimated_cost: costShare,
      policy_triggers: isFinalStep ? ['external_publishing'] : [],
    };
  });

  return {
    contract,
    state: 'draft',
    tasks,
    results: [],
    artifacts: [],
    approvals: [],
    transitions: [
      {
        id: `tr_init_${Date.now()}`,
        from: 'initial',
        to: 'draft',
        label: 'Contract initialized',
        actor: 'Workflow Studio',
        timestamp: now,
        note: `Initialized ${contract.production_track} track workflow (${contract.workflow_id}).`,
      },
    ],
  };
}

function formatOutputTitle(output: string): string {
  return output
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
