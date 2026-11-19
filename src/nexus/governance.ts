import type {
  NacsCapability,
  NacsModality,
  PermissionScope,
  ProviderModelEntry,
  RoutingDecision,
} from '../nacs/v1/types';

export interface SafetyLockItem {
  id: string;
  label: string;
  enforced: boolean;
  mechanism: string;
  scope: string;
}

export interface CapabilityPolicyEntry {
  capability: string;
  track: 'creative' | 'automation';
  requiresHumanApproval: boolean;
  actionType: string;
}

export interface ControlPlaneStatusResponse {
  platform: 'NEXUS APEX';
  contract_version: '1.0';
  execution_mode: 'stage_1_control_plane_offline';
  paid_api_calls_enabled: false;
  external_publishing_enabled: false;
  registered_provider_models: number;
  allowlisted_capabilities: number;
  safety_locks: SafetyLockItem[];
  capability_allowlist: CapabilityPolicyEntry[];
  checked_at: string;
}

export interface ProvidersListResponse {
  providers: ProviderModelEntry[];
  live_adapters_bound: number;
  note: string;
}

export interface RouteDryRunRequest {
  division_id: string;
  agent_id: string;
  production_track: 'creative' | 'general_automation';
  objective: string;
  required_capabilities: NacsCapability[];
  required_modalities: NacsModality[];
  required_scopes: PermissionScope[];
  max_cost_usd: number;
  data_sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
  require_zero_data_retention: boolean;
  pii_present: boolean;
  human_approval_required: boolean;
  granted_scopes: PermissionScope[];
  human_approval_verified: boolean;
  allow_preview_models: boolean;
}

export interface RouteDryRunResponse {
  mode: 'offline_dry_run';
  paid_calls_executed: 0;
  decision: RoutingDecision;
  contract_valid: boolean;
  contract_errors: string[];
}

export interface SecurityScanResponse {
  engine: 'nacs-v1-security';
  secret_leaks_detected: string[];
  permission_override_detected: boolean;
  redacted_preview: unknown;
  clean: boolean;
  scanned_at: string;
}

export interface ContractValidationApiResponse {
  engine: 'ajv-draft-2020-12';
  schema: 'workflow-request.schema.json';
  valid: boolean;
  errors: string[];
  validated_at: string;
}

export const ALL_PERMISSION_SCOPES: readonly PermissionScope[] = [
  'model.invoke',
  'media.generate',
  'repo.read',
  'repo.write',
  'document.write',
  'external.publish',
  'external.message',
  'billing.spend',
  'account.modify',
  'system.destructive',
];

export const STAGE_1_DEFAULT_GRANTED_SCOPES: PermissionScope[] = [
  'model.invoke',
  'media.generate',
  'repo.read',
  'document.write',
];

export const STAGE_1_SAFETY_LOCKS: readonly SafetyLockItem[] = [
  {
    id: 'zero_paid_calls',
    label: 'Zero Paid API Calls Lock',
    enforced: true,
    mechanism: 'No live provider adapters bound; billing.spend scope revoked by default.',
    scope: 'Platform-wide (Stage 1)',
  },
  {
    id: 'default_deny_tools',
    label: 'Default-Deny Capability Allowlist',
    enforced: true,
    mechanism: 'contracts/v1.0/ts/policy.ts rejects any unlisted capability with UNKNOWN_TOOL_DENIED.',
    scope: 'All 7 Divisions',
  },
  {
    id: 'human_approval_binding',
    label: 'SHA-256 Human Approval Binding',
    enforced: true,
    mechanism: 'Rejects agent_* identities, expired tokens, and post-approval payload tampering.',
    scope: 'High-impact & external actions',
  },
  {
    id: 'secret_hygiene_redaction',
    label: 'Secret Hygiene & Env-Var-Only Registry',
    enforced: true,
    mechanism: 'src/nacs/v1/security.ts blocks raw API keys/tokens in contracts, provider entries, and outputs.',
    scope: 'Control Plane & Contracts',
  },
  {
    id: 'prompt_override_defense',
    label: 'Permission-Override Injection Guard',
    enforced: true,
    mechanism: 'Untrusted inputs or model outputs attempting privilege escalation are blocked deterministically.',
    scope: 'Router & Executor',
  },
];

export function isHighRiskScope(scope: PermissionScope): boolean {
  return (
    scope === 'external.publish' ||
    scope === 'external.message' ||
    scope === 'billing.spend' ||
    scope === 'account.modify' ||
    scope === 'system.destructive'
  );
}
