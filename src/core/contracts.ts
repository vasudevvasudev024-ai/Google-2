export type ProductionTrack = 'creative' | 'automation';

export type WorkflowState =
  | 'draft'
  | 'queued'
  | 'planning'
  | 'running'
  | 'waiting_approval'
  | 'reviewing'
  | 'failed'
  | 'completed'
  | 'cancelled';

export type PolicyRuleMode = 'approval_required' | 'auto_allow' | 'deny';

export interface WorkflowConstraints {
  language?: string;
  duration_seconds?: number;
  visual_style?: string;
  aspect_ratio?: string;
  target_runtime?: string;
  repository_scope?: string;
  compliance_standard?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface AutonomyPolicy {
  mode: 'hybrid' | 'supervised' | 'autonomous';
  external_publishing: PolicyRuleMode;
  purchases: PolicyRuleMode;
  destructive_actions: PolicyRuleMode;
}

export interface WorkflowBudget {
  currency: string;
  max_spend: number;
  require_approval_over_limit: boolean;
}

export interface WorkflowContract {
  schema_version: string;
  workflow_id: string;
  workspace_id: string;
  project_id: string;
  production_track: ProductionTrack;
  goal: string;
  constraints: WorkflowConstraints;
  requested_outputs: string[];
  autonomy_policy: AutonomyPolicy;
  budget: WorkflowBudget;
}

export type TaskExecutionState =
  | 'pending'
  | 'ready'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TaskContract {
  schema_version: string;
  task_id: string;
  workflow_id: string;
  title: string;
  track: ProductionTrack;
  output_target: string;
  agent_identity: {
    agent_id: string;
    role: string;
    capability_tier: string;
  };
  inputs: Record<string, string | number | boolean | string[]>;
  dependencies: string[];
  execution_state: TaskExecutionState;
  estimated_cost: number;
  policy_triggers: Array<'external_publishing' | 'purchases' | 'destructive_actions'>;
}

export interface AgentResultContract {
  schema_version: string;
  result_id: string;
  task_id: string;
  workflow_id: string;
  agent_id: string;
  status: 'succeeded' | 'needs_correction' | 'blocked' | 'failed';
  summary: string;
  spend_incurred: number;
  duration_ms: number;
  produced_artifact_ids: string[];
  review_notes: string;
  completed_at: string;
}

export type ArtifactReviewStatus = 'pending_review' | 'approved' | 'changes_requested';

export interface ArtifactContract {
  schema_version: string;
  artifact_id: string;
  workflow_id: string;
  task_id: string;
  track: ProductionTrack;
  kind:
    | 'screenplay'
    | 'storyboard'
    | 'images'
    | 'video'
    | 'audio'
    | 'final_render'
    | 'research'
    | 'code'
    | 'documents';
  title: string;
  mime_type: string;
  uri: string;
  preview_text?: string;
  image_url?: string;
  provenance: {
    agent_id: string;
    model_or_tool: string;
    input_hash: string;
    created_at: string;
  };
  review_status: ArtifactReviewStatus;
}

export type ApprovalTriggerReason =
  | 'budget_over_limit'
  | 'external_publishing'
  | 'purchases'
  | 'destructive_actions'
  | 'plan_gate';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalContract {
  schema_version: string;
  approval_id: string;
  workflow_id: string;
  task_id: string;
  trigger_reason: ApprovalTriggerReason;
  requested_action: string;
  estimated_cost: number;
  currency: string;
  status: ApprovalStatus;
  requested_at: string;
  decided_by?: string;
  decided_at?: string;
  decision_note?: string;
}

export interface TransitionEvent {
  id: string;
  from: WorkflowState | 'initial';
  to: WorkflowState;
  label: string;
  actor: string;
  timestamp: string;
  note?: string;
}

export interface WorkflowBundle {
  contract: WorkflowContract;
  state: WorkflowState;
  tasks: TaskContract[];
  results: AgentResultContract[];
  artifacts: ArtifactContract[];
  approvals: ApprovalContract[];
  transitions: TransitionEvent[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateWorkflowContract(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Contract payload must be a JSON object.'] };
  }

  const c = input as Partial<WorkflowContract>;

  if (!c.schema_version || typeof c.schema_version !== 'string') {
    errors.push('schema_version must be a non-empty string.');
  }
  if (!c.workflow_id || typeof c.workflow_id !== 'string' || !c.workflow_id.trim()) {
    errors.push('workflow_id is required.');
  }
  if (!c.workspace_id || typeof c.workspace_id !== 'string' || !c.workspace_id.trim()) {
    errors.push('workspace_id is required.');
  }
  if (!c.project_id || typeof c.project_id !== 'string' || !c.project_id.trim()) {
    errors.push('project_id is required.');
  }
  if (c.production_track !== 'creative' && c.production_track !== 'automation') {
    errors.push('production_track must be either "creative" or "automation".');
  }
  if (!c.goal || typeof c.goal !== 'string' || c.goal.trim().length < 5) {
    errors.push('goal must be at least 5 characters.');
  }
  if (!c.constraints || typeof c.constraints !== 'object') {
    errors.push('constraints must be an object.');
  }
  if (!Array.isArray(c.requested_outputs) || c.requested_outputs.length === 0) {
    errors.push('requested_outputs must include at least one expected output.');
  }
  if (!c.autonomy_policy || typeof c.autonomy_policy !== 'object') {
    errors.push('autonomy_policy is required.');
  } else {
    const validModes = ['hybrid', 'supervised', 'autonomous'];
    if (!validModes.includes(c.autonomy_policy.mode)) {
      errors.push('autonomy_policy.mode must be hybrid, supervised, or autonomous.');
    }
  }
  if (!c.budget || typeof c.budget !== 'object') {
    errors.push('budget configuration is required.');
  } else {
    if (!c.budget.currency || typeof c.budget.currency !== 'string') {
      errors.push('budget.currency is required.');
    }
    if (typeof c.budget.max_spend !== 'number' || Number.isNaN(c.budget.max_spend) || c.budget.max_spend <= 0) {
      errors.push('budget.max_spend must be a positive number.');
    }
    if (typeof c.budget.require_approval_over_limit !== 'boolean') {
      errors.push('budget.require_approval_over_limit must be a boolean.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export const FIVE_CONTRACTS_REFERENCE = [
  {
    id: 'workflow',
    name: 'Workflow Contract',
    controls: 'What the system must accomplish',
    summary: 'Track, constraints, budget, autonomy permissions, and expected outputs.',
    keyFields: ['workflow_id', 'production_track', 'goal', 'constraints', 'requested_outputs', 'autonomy_policy', 'budget'],
  },
  {
    id: 'task',
    name: 'Task Contract',
    controls: 'What each agent must execute',
    summary: 'Agent identity, typed inputs, upstream dependencies, execution state, and policy triggers.',
    keyFields: ['task_id', 'agent_identity', 'inputs', 'dependencies', 'execution_state', 'estimated_cost'],
  },
  {
    id: 'result',
    name: 'Agent Result Contract',
    controls: 'What an agent returns',
    summary: 'Execution status, structured summary, spend incurred, duration, and produced artifact IDs.',
    keyFields: ['result_id', 'task_id', 'status', 'summary', 'spend_incurred', 'produced_artifact_ids'],
  },
  {
    id: 'artifact',
    name: 'Artifact Contract',
    controls: 'How files and generated media are represented',
    summary: 'Typed output format, URI, model/tool provenance, input hash, and human review status.',
    keyFields: ['artifact_id', 'kind', 'uri', 'provenance', 'review_status'],
  },
  {
    id: 'approval',
    name: 'Approval Contract',
    controls: 'Which actions require human authorization',
    summary: 'Policy trigger reason, requested action, estimated cost, and signed authorization decision.',
    keyFields: ['approval_id', 'trigger_reason', 'requested_action', 'estimated_cost', 'status', 'decided_by'],
  },
] as const;
