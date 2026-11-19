import { KNOWN_CAPABILITY_ALLOWLIST } from '../../contracts/v1.0/ts/policy';
import { validateWorkflowRequest } from '../../contracts/v1.0/ts/validator';
import { validateNacsCoreTaskContract } from '../nacs/v1/contract';
import { ProviderRegistry } from '../nacs/v1/registry';
import { routeTask } from '../nacs/v1/router';
import {
  detectPermissionOverrideAttempt,
  detectSecretLeaks,
  redactSecrets,
} from '../nacs/v1/security';
import type {
  NacsCoreTaskContract,
  ProviderModelEntry,
  SystemPermissionContext,
} from '../nacs/v1/types';
import {
  STAGE_1_SAFETY_LOCKS,
  type ContractValidationApiResponse,
  type ControlPlaneStatusResponse,
  type ProvidersListResponse,
  type RouteDryRunRequest,
  type RouteDryRunResponse,
  type SecurityScanResponse,
} from './governance';

/**
 * Reference blueprint provider catalog registered into the real NACS v1 ProviderRegistry.
 * IMPORTANT:
 * - Only credential_env_var names are referenced (never raw secrets).
 * - Zero live ProviderAdapter instances are bound in Stage 1, so zero external or paid API calls can occur.
 * - Includes diverse privacy, lifecycle, cost, and capability profiles so the 6-stage NACS router
 *   performs genuine deterministic eligibility filtering and multi-criteria ranking.
 */
export function buildReferenceProviderEntries(): ProviderModelEntry[] {
  return [
    {
      contract_version: '1.0',
      provider_id: 'nexus_ref_enterprise_reasoning',
      model_id: 'zdr-reasoner-v1',
      supported_capabilities: [
        'research',
        'screenplay',
        'code_generation',
        'web_development',
        'document_generation',
        'business_workflow',
        'structured_reasoning',
        'quality_inspection',
      ],
      supported_modalities: ['text', 'json', 'code', 'document'],
      lifecycle_status: 'active',
      availability_status: 'available',
      privacy_handling: {
        classification: 'zero_retention_isolated',
        max_data_sensitivity: 'restricted',
        zero_data_retention: true,
        trains_on_customer_data: false,
        supports_pii: true,
        regions: ['us', 'eu'],
      },
      cost: {
        state: 'known',
        estimated_cost_per_request: 0.32,
        currency: 'USD',
        unit: 'request',
      },
      quality_score: 0.94,
      reliability_score: 0.98,
      latency: { p50_ms: 420, p95_ms: 980 },
      timeout_ms: 15000,
      rate_limit: { requests_per_minute: 120, max_concurrent: 16, tokens_per_minute: 240000 },
      allowed_scopes: ['model.invoke', 'repo.read', 'document.write'],
      credential_env_var: 'NEXUS_REASONING_API_KEY',
    },
    {
      contract_version: '1.0',
      provider_id: 'nexus_ref_fast_draft',
      model_id: 'compact-draft-v1',
      supported_capabilities: [
        'research',
        'screenplay',
        'document_generation',
        'business_workflow',
        'structured_reasoning',
        'quality_inspection',
      ],
      supported_modalities: ['text', 'json', 'document'],
      lifecycle_status: 'active',
      availability_status: 'available',
      privacy_handling: {
        classification: 'enterprise_private',
        max_data_sensitivity: 'confidential',
        zero_data_retention: true,
        trains_on_customer_data: false,
        supports_pii: false,
        regions: ['us', 'eu'],
      },
      cost: {
        state: 'known',
        estimated_cost_per_request: 0.08,
        currency: 'USD',
        unit: 'request',
      },
      quality_score: 0.84,
      reliability_score: 0.97,
      latency: { p50_ms: 160, p95_ms: 390 },
      timeout_ms: 10000,
      rate_limit: { requests_per_minute: 240, max_concurrent: 32, tokens_per_minute: 480000 },
      allowed_scopes: ['model.invoke', 'document.write'],
      credential_env_var: 'NEXUS_FAST_DRAFT_API_KEY',
    },
    {
      contract_version: '1.0',
      provider_id: 'nexus_ref_creative_media',
      model_id: 'multimodal-studio-v1',
      supported_capabilities: [
        'screenplay',
        'storyboard',
        'image_generation',
        'video_generation',
        'audio_generation',
        'media_editing',
      ],
      supported_modalities: ['text', 'json', 'image', 'video', 'audio'],
      lifecycle_status: 'active',
      availability_status: 'available',
      privacy_handling: {
        classification: 'zero_retention_isolated',
        max_data_sensitivity: 'internal',
        zero_data_retention: true,
        trains_on_customer_data: false,
        supports_pii: false,
        regions: ['us'],
      },
      cost: {
        state: 'known',
        estimated_cost_per_request: 0.85,
        currency: 'USD',
        unit: 'request',
      },
      quality_score: 0.92,
      reliability_score: 0.95,
      latency: { p50_ms: 1200, p95_ms: 2800 },
      timeout_ms: 30000,
      rate_limit: { requests_per_minute: 40, max_concurrent: 6 },
      allowed_scopes: ['model.invoke', 'media.generate'],
      credential_env_var: 'NEXUS_MEDIA_STUDIO_API_KEY',
    },
    {
      contract_version: '1.0',
      provider_id: 'nexus_ref_external_dispatch',
      model_id: 'gated-channel-v1',
      supported_capabilities: ['external_publish', 'external_message', 'document_generation'],
      supported_modalities: ['text', 'json', 'document'],
      lifecycle_status: 'active',
      availability_status: 'available',
      privacy_handling: {
        classification: 'enterprise_private',
        max_data_sensitivity: 'confidential',
        zero_data_retention: true,
        trains_on_customer_data: false,
        supports_pii: true,
        regions: ['us', 'eu'],
      },
      cost: {
        state: 'known',
        estimated_cost_per_request: 0.12,
        currency: 'USD',
        unit: 'request',
      },
      quality_score: 0.88,
      reliability_score: 0.99,
      latency: { p50_ms: 220, p95_ms: 510 },
      timeout_ms: 12000,
      rate_limit: { requests_per_minute: 60, max_concurrent: 8 },
      allowed_scopes: ['model.invoke', 'external.publish', 'external.message', 'document.write'],
      credential_env_var: 'NEXUS_DISPATCH_GATEWAY_TOKEN',
    },
    {
      contract_version: '1.0',
      provider_id: 'nexus_ref_preview_lab',
      model_id: 'experimental-preview-v0',
      supported_capabilities: ['research', 'code_generation', 'storyboard', 'image_generation'],
      supported_modalities: ['text', 'code', 'image', 'json'],
      lifecycle_status: 'preview',
      availability_status: 'available',
      privacy_handling: {
        classification: 'standard_commercial',
        max_data_sensitivity: 'internal',
        zero_data_retention: false,
        trains_on_customer_data: false,
        supports_pii: false,
        regions: ['us'],
      },
      cost: {
        state: 'unknown',
        reason: 'Preview pricing unverified; rejected unless unknown cost explicitly allowed.',
      },
      quality_score: 0.96,
      reliability_score: 0.82,
      latency: { p50_ms: 700, p95_ms: 1900 },
      timeout_ms: 20000,
      rate_limit: { requests_per_minute: 20, max_concurrent: 4 },
      allowed_scopes: ['model.invoke', 'media.generate', 'repo.read'],
      credential_env_var: 'NEXUS_PREVIEW_LAB_API_KEY',
    },
    {
      contract_version: '1.0',
      provider_id: 'nexus_ref_legacy_retired',
      model_id: 'deprecated-gen0',
      supported_capabilities: ['research', 'screenplay', 'code_generation', 'document_generation'],
      supported_modalities: ['text', 'json', 'code'],
      lifecycle_status: 'retired',
      availability_status: 'unavailable',
      privacy_handling: {
        classification: 'training_opted_in',
        max_data_sensitivity: 'public',
        zero_data_retention: false,
        trains_on_customer_data: true,
        supports_pii: false,
        regions: ['us'],
      },
      cost: {
        state: 'known',
        estimated_cost_per_request: 0.05,
        currency: 'USD',
        unit: 'request',
      },
      quality_score: 0.65,
      reliability_score: 0.72,
      latency: { p50_ms: 950, p95_ms: 2400 },
      timeout_ms: 10000,
      rate_limit: { requests_per_minute: 30, max_concurrent: 4 },
      allowed_scopes: ['model.invoke'],
      credential_env_var: 'NEXUS_LEGACY_API_KEY',
    },
  ];
}

export class NexusControlPlane {
  private readonly registry: ProviderRegistry;

  constructor() {
    this.registry = new ProviderRegistry();
    for (const entry of buildReferenceProviderEntries()) {
      this.registry.registerModel(entry);
    }
  }

  getStatus(): ControlPlaneStatusResponse {
    return {
      platform: 'NEXUS APEX',
      contract_version: '1.0',
      execution_mode: 'stage_1_control_plane_offline',
      paid_api_calls_enabled: false,
      external_publishing_enabled: false,
      registered_provider_models: this.registry.listModels().length,
      allowlisted_capabilities: Object.keys(KNOWN_CAPABILITY_ALLOWLIST).length,
      safety_locks: [...STAGE_1_SAFETY_LOCKS],
      capability_allowlist: Object.values(KNOWN_CAPABILITY_ALLOWLIST),
      checked_at: new Date().toISOString(),
    };
  }

  listProviders(): ProvidersListResponse {
    return {
      providers: this.registry.listModels(),
      live_adapters_bound: 0,
      note: 'Blueprint descriptors registered in NACS ProviderRegistry v1. Zero live provider adapters are bound in Stage 1.',
    };
  }

  evaluateRouteDryRun(req: RouteDryRunRequest): RouteDryRunResponse {
    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const isExternalOrCritical =
      req.human_approval_required ||
      req.required_capabilities.some((c) =>
        ['external_publish', 'external_message', 'financial_transaction', 'destructive_action'].includes(c)
      ) ||
      req.required_scopes.some((s) =>
        ['external.publish', 'external.message', 'billing.spend', 'account.modify', 'system.destructive'].includes(s)
      );

    const task: NacsCoreTaskContract = {
      task_id: `dryrun_${req.division_id}_${Date.now()}`,
      contract_version: '1.0',
      production_track: req.production_track,
      objective: req.objective.trim() || `Dry-run routing evaluation for ${req.agent_id}`,
      structured_inputs: {
        division_id: req.division_id,
        agent_id: req.agent_id,
        mode: 'offline_dry_run',
      },
      required_capabilities: req.required_capabilities,
      required_modalities: req.required_modalities,
      expected_output: {
        output_type: 'routing_dry_run_artifact',
        mime_type: 'application/json',
        schema_id: 'https://nexus-apex.contracts/v1.0/outputs/dry-run',
      },
      privacy_constraints: {
        data_sensitivity: req.data_sensitivity,
        require_zero_data_retention: req.require_zero_data_retention,
        allow_model_training: false,
        pii_present: req.pii_present,
        allowed_regions: ['us', 'eu'],
      },
      permission_requirements: {
        required_scopes: req.required_scopes,
        sensitivity_class: isExternalOrCritical
          ? 'critical'
          : req.data_sensitivity === 'confidential' || req.data_sensitivity === 'restricted'
            ? 'sensitive'
            : 'standard',
        is_irreversible: isExternalOrCritical,
        is_external_effect: isExternalOrCritical,
      },
      estimated_cost_limit: {
        max_cost: req.max_cost_usd,
        currency: 'USD',
        allow_unknown_cost: false,
      },
      execution_timeout_ms: 10000,
      approval_requirement: isExternalOrCritical
        ? req.human_approval_verified
          ? {
              required: true,
              status: 'approved',
              reason: 'Simulated human authorization in dry-run check.',
              approved_by: 'human_studio_reviewer',
              decision_source: 'human',
              approved_at: nowIso,
              expires_at: expiresIso,
            }
          : {
              required: true,
              status: 'pending',
              reason: 'High-impact capability requires human approval.',
            }
        : {
            required: false,
            status: 'not_required',
          },
      idempotency_key: `idem_dryrun_${req.agent_id}_${Date.now()}`,
      execution_status: 'pending',
      provenance: {
        workspace_id: 'workspace_demo',
        project_id: `division_${req.division_id}`,
        requested_by: 'human_studio_operator',
        created_at: nowIso,
      },
    };

    const contractValidation = validateNacsCoreTaskContract(task);
    const permissionContext: SystemPermissionContext = {
      workspace_id: 'workspace_demo',
      granted_scopes: req.granted_scopes,
      allow_preview_models: req.allow_preview_models,
      allow_deprecated_models: false,
      allow_degraded_providers: false,
      now_iso: nowIso,
      ...(req.human_approval_verified
        ? {
            human_approval_verified: {
              approved: true,
              approved_by: 'human_studio_reviewer',
              expires_at: expiresIso,
            },
          }
        : {}),
    };

    const decision = routeTask(this.registry, task, permissionContext);
    return {
      mode: 'offline_dry_run',
      paid_calls_executed: 0,
      decision,
      contract_valid: contractValidation.valid,
      contract_errors: contractValidation.errors,
    };
  }

  scanPayloadSecurity(payload: unknown): SecurityScanResponse {
    const leaks = Array.from(new Set(detectSecretLeaks(payload)));
    const overrideDetected = detectPermissionOverrideAttempt(payload);
    const redacted = redactSecrets(payload);

    return {
      engine: 'nacs-v1-security',
      secret_leaks_detected: leaks,
      permission_override_detected: overrideDetected,
      redacted_preview: redacted,
      clean: leaks.length === 0 && !overrideDetected,
      scanned_at: new Date().toISOString(),
    };
  }

  validateWorkflowContractSchema(payload: unknown): ContractValidationApiResponse {
    const result = validateWorkflowRequest(payload);
    return {
      engine: 'ajv-draft-2020-12',
      schema: 'workflow-request.schema.json',
      valid: result.valid,
      errors: result.errors,
      validated_at: new Date().toISOString(),
    };
  }
}
