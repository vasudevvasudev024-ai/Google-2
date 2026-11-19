export type ContractVersion = '1.0';

export type ProductionTrack = 'creative' | 'automation' | 'mixed';

export type WorkflowState =
  | 'draft'
  | 'queued'
  | 'planning'
  | 'running'
  | 'waiting_approval'
  | 'reviewing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type TaskState =
  | 'pending'
  | 'ready'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type HighImpactActionType =
  | 'public_publishing'
  | 'external_message'
  | 'purchase'
  | 'payment'
  | 'destructive_operation'
  | 'sensitive_account_modification';

export type TaskActionType = 'internal_compute' | HighImpactActionType;

export type ApprovalActionType = HighImpactActionType | 'budget_overrun';

export type RequestedOutput =
  | 'research'
  | 'screenplay'
  | 'storyboard'
  | 'images'
  | 'video'
  | 'audio'
  | 'editing'
  | 'qa_report'
  | 'final_render'
  | 'published_release'
  | 'code'
  | 'website'
  | 'documents'
  | 'workflow_automation';

export interface WorkflowRequest {
  contract_version: ContractVersion;
  workflow_id: string;
  workspace_id: string;
  project_id: string;
  production_track: ProductionTrack;
  goal: string;
  constraints: Record<string, string | number | boolean | string[]>;
  requested_outputs: RequestedOutput[];
  autonomy_policy: {
    mode: 'hybrid' | 'supervised';
    unknown_tools: 'deny';
    public_publishing: 'approval_required' | 'deny';
    external_messages: 'approval_required' | 'deny';
    purchases: 'approval_required' | 'deny';
    payments: 'approval_required' | 'deny';
    destructive_operations: 'approval_required' | 'deny';
    sensitive_account_modifications: 'approval_required' | 'deny';
  };
  budget: {
    currency: string;
    max_spend: number;
    require_approval_over_limit: boolean;
  };
}

export interface TaskEnvelope {
  contract_version: ContractVersion;
  task_id: string;
  workflow_id: string;
  workspace_id: string;
  project_id: string;
  agent_id: string;
  capability: string;
  input: Record<string, unknown>;
  expected_output: {
    artifact_type: string;
    format: string;
    schema_ref?: string;
  };
  dependencies: string[];
  idempotency_key: string;
  priority: number;
  attempt: number;
  max_attempts: number;
  risk_level: RiskLevel;
  action_type?: TaskActionType;
  timestamps: {
    created_at: string;
    scheduled_at?: string;
    started_at?: string;
    updated_at: string;
    deadline_at?: string;
  };
}

export interface AgentResult {
  contract_version: ContractVersion;
  task_id: string;
  workspace_id: string;
  status: 'succeeded' | 'failed' | 'blocked' | 'needs_correction' | 'cancelled';
  summary: string;
  structured_output: Record<string, unknown>;
  artifact_ids: string[];
  usage: {
    tokens_input: number;
    tokens_output: number;
    compute_seconds: number;
    cost_amount: number;
    currency: string;
  };
  errors: Array<{
    code: string;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  }>;
}

export interface ArtifactManifest {
  contract_version: ContractVersion;
  artifact_id: string;
  workspace_id: string;
  project_id: string;
  task_id: string;
  artifact_type:
    | 'research'
    | 'screenplay'
    | 'storyboard'
    | 'image'
    | 'video'
    | 'audio'
    | 'edited_cut'
    | 'qa_report'
    | 'final_render'
    | 'code'
    | 'website_bundle'
    | 'document'
    | 'workflow_spec';
  storage_uri: string;
  mime_type: string;
  checksum: string;
  version: number;
  provenance: {
    agent_id: string;
    tool_or_model: string;
    input_hash: string;
    created_at: string;
    parent_artifact_ids?: string[];
  };
  review_status: 'pending_review' | 'approved' | 'changes_requested' | 'rejected';
  visibility: 'private' | 'workspace' | 'public_approved';
}

export interface ApprovalDecision {
  decision_source: 'human';
  decided_by: string;
  decided_at: string;
  reason: string;
}

export interface ApprovalRequest {
  contract_version: ContractVersion;
  approval_id: string;
  workspace_id: string;
  task_id: string;
  action_type: ApprovalActionType;
  action_payload_hash: string;
  risk_level: 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'revoked';
  requested_at: string;
  expires_at: string;
  decision: ApprovalDecision | null;
}
