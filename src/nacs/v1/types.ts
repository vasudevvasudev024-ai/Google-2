export type NacsContractVersion = '1.0';

export type NacsProductionTrack = 'creative' | 'general_automation';

export type NacsCapability =
  | 'research'
  | 'screenplay'
  | 'storyboard'
  | 'image_generation'
  | 'video_generation'
  | 'audio_generation'
  | 'media_editing'
  | 'quality_inspection'
  | 'code_generation'
  | 'web_development'
  | 'document_generation'
  | 'business_workflow'
  | 'structured_reasoning'
  | 'external_publish'
  | 'external_message'
  | 'financial_transaction'
  | 'destructive_action';

export type NacsModality =
  | 'text'
  | 'json'
  | 'code'
  | 'image'
  | 'video'
  | 'audio'
  | 'document';

export type DataSensitivity = 'public' | 'internal' | 'confidential' | 'restricted';

export type PermissionScope =
  | 'model.invoke'
  | 'media.generate'
  | 'repo.read'
  | 'repo.write'
  | 'document.write'
  | 'external.publish'
  | 'external.message'
  | 'billing.spend'
  | 'account.modify'
  | 'system.destructive';

export type CoreExecutionStatus =
  | 'pending'
  | 'validated'
  | 'waiting_approval'
  | 'routed'
  | 'running'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'cancelled';

export interface NacsCoreTaskContract {
  task_id: string;
  contract_version: NacsContractVersion;
  production_track: NacsProductionTrack;
  objective: string;
  structured_inputs: Record<string, unknown>;
  required_capabilities: NacsCapability[];
  required_modalities: NacsModality[];
  expected_output: {
    output_type: string;
    mime_type: string;
    schema_id: string;
    required_fields?: string[];
  };
  privacy_constraints: {
    data_sensitivity: DataSensitivity;
    require_zero_data_retention: boolean;
    allow_model_training: boolean;
    pii_present: boolean;
    allowed_regions?: string[];
  };
  permission_requirements: {
    required_scopes: PermissionScope[];
    sensitivity_class: 'standard' | 'sensitive' | 'critical';
    is_irreversible: boolean;
    is_external_effect: boolean;
  };
  estimated_cost_limit: {
    max_cost: number;
    currency: string;
    allow_unknown_cost: boolean;
  };
  execution_timeout_ms: number;
  approval_requirement: {
    required: boolean;
    status: 'not_required' | 'pending' | 'approved' | 'rejected' | 'expired';
    reason?: string;
    approved_by?: string;
    decision_source?: 'human';
    approved_at?: string;
    expires_at?: string;
  };
  idempotency_key: string;
  execution_status: CoreExecutionStatus;
  provenance: {
    workspace_id: string;
    project_id: string;
    requested_by: string;
    created_at: string;
    parent_task_id?: string;
    correlation_id?: string;
  };
}

export type ProviderLifecycleStatus = 'active' | 'preview' | 'deprecated' | 'retired';
export type ProviderAvailabilityStatus = 'available' | 'degraded' | 'unavailable' | 'maintenance';
export type ProviderPrivacyClassification =
  | 'zero_retention_isolated'
  | 'enterprise_private'
  | 'standard_commercial'
  | 'training_opted_in';

export type ProviderCostInfo =
  | {
      state: 'known';
      estimated_cost_per_request: number;
      currency: string;
      unit?: string;
    }
  | {
      state: 'unknown';
      reason?: string;
    };

export interface ProviderModelEntry {
  contract_version: NacsContractVersion;
  provider_id: string;
  model_id: string;
  supported_capabilities: NacsCapability[];
  supported_modalities: NacsModality[];
  lifecycle_status: ProviderLifecycleStatus;
  availability_status: ProviderAvailabilityStatus;
  privacy_handling: {
    classification: ProviderPrivacyClassification;
    max_data_sensitivity: DataSensitivity;
    zero_data_retention: boolean;
    trains_on_customer_data: boolean;
    supports_pii: boolean;
    regions?: string[];
  };
  cost: ProviderCostInfo;
  quality_score: number;
  reliability_score: number;
  latency: {
    p50_ms: number;
    p95_ms: number;
  };
  timeout_ms: number;
  rate_limit: {
    requests_per_minute: number;
    max_concurrent: number;
    tokens_per_minute?: number;
  };
  allowed_scopes: PermissionScope[];
  credential_env_var: string;
}

export interface SystemPermissionContext {
  workspace_id: string;
  granted_scopes: PermissionScope[];
  authorized_providers?: string[];
  allow_preview_models?: boolean;
  allow_deprecated_models?: boolean;
  allow_degraded_providers?: boolean;
  /**
   * Immutable system-side human approval record. Model-generated text inside
   * task inputs or outputs can never override this authority.
   */
  human_approval_verified?: {
    approved: boolean;
    approved_by: string;
    expires_at: string;
  };
  now_iso?: string;
}

export type EligibilityStage =
  | 'capability_compatibility'
  | 'modality_compatibility'
  | 'lifecycle_and_availability'
  | 'privacy_and_data_handling'
  | 'budget_eligibility'
  | 'permission_eligibility';

export interface RejectedCandidate {
  provider_id: string;
  model_id: string;
  stage: EligibilityStage;
  reason_code: string;
  reason: string;
}

export interface RankingWeights {
  quality: number;
  latency: number;
  cost: number;
  reliability: number;
}

export interface RankedCandidate {
  provider_id: string;
  model_id: string;
  score: number;
  breakdown: {
    quality: number;
    latency: number;
    cost: number;
    reliability: number;
  };
  entry: ProviderModelEntry;
}

export interface RoutingDecision {
  task_id: string;
  routed: boolean;
  selected: RankedCandidate | null;
  ranked_candidates: RankedCandidate[];
  rejected_candidates: RejectedCandidate[];
  failure_reason_code?: string;
  failure_reason?: string;
  decided_at: string;
}

export interface AdapterExecutionRequest {
  task: NacsCoreTaskContract;
  model_entry: ProviderModelEntry;
  timeout_ms: number;
  signal: AbortSignal;
}

export interface AdapterExecutionResponse {
  status: 'succeeded' | 'failed';
  structured_output: Record<string, unknown>;
  summary: string;
  actual_cost?: number;
  currency?: string;
  latency_ms: number;
  error_code?: string;
  error_message?: string;
  retryable?: boolean;
}

export interface ProviderAdapter {
  readonly provider_id: string;
  execute(request: AdapterExecutionRequest): Promise<AdapterExecutionResponse>;
}

export interface ExecutionAttemptRecord {
  attempt_number: number;
  provider_id: string;
  model_id: string;
  status: 'succeeded' | 'failed' | 'timed_out';
  latency_ms: number;
  error_code?: string;
  error_message?: string;
}

export interface TaskExecutionReport {
  task_id: string;
  idempotency_key: string;
  from_idempotency_cache: boolean;
  final_status: CoreExecutionStatus;
  selected_provider_id: string | null;
  selected_model_id: string | null;
  structured_output?: Record<string, unknown>;
  summary: string;
  attempts: ExecutionAttemptRecord[];
  routing_history: RoutingDecision[];
  error_code?: string;
  error_message?: string;
  completed_at: string;
}
