import { requiresHumanApprovalByPolicy, validateNacsCoreTaskContract } from './contract';
import { providerModelKey, type ProviderRegistry } from './registry';
import { detectPermissionOverrideAttempt } from './security';
import type {
  DataSensitivity,
  EligibilityStage,
  NacsCoreTaskContract,
  ProviderModelEntry,
  RankedCandidate,
  RankingWeights,
  RejectedCandidate,
  RoutingDecision,
  SystemPermissionContext,
} from './types';

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  quality: 0.35,
  latency: 0.25,
  cost: 0.2,
  reliability: 0.2,
};

const SENSITIVITY_RANK: Record<DataSensitivity, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

interface StageRejection {
  stage: EligibilityStage;
  reason_code: string;
  reason: string;
}

/**
 * Evaluates eligibility strictly in the required 6-stage order:
 * 1. Capability compatibility
 * 2. Modality compatibility
 * 3. Lifecycle and availability
 * 4. Privacy and data-handling compatibility
 * 5. Budget eligibility
 * 6. Permission eligibility
 */
function evaluateCandidateEligibility(
  entry: ProviderModelEntry,
  task: NacsCoreTaskContract,
  permissionContext: SystemPermissionContext
): StageRejection | null {
  // Stage 1: Capability compatibility
  const missingCapabilities = task.required_capabilities.filter(
    (cap) => !entry.supported_capabilities.includes(cap)
  );
  if (missingCapabilities.length > 0) {
    return {
      stage: 'capability_compatibility',
      reason_code: 'UNSUPPORTED_CAPABILITY',
      reason: `Missing required capabilities: ${missingCapabilities.join(', ')}.`,
    };
  }

  // Stage 2: Modality compatibility
  const missingModalities = task.required_modalities.filter(
    (mod) => !entry.supported_modalities.includes(mod)
  );
  if (missingModalities.length > 0) {
    return {
      stage: 'modality_compatibility',
      reason_code: 'UNSUPPORTED_MODALITY',
      reason: `Missing required modalities: ${missingModalities.join(', ')}.`,
    };
  }

  // Stage 3: Lifecycle and availability
  if (entry.lifecycle_status === 'retired') {
    return {
      stage: 'lifecycle_and_availability',
      reason_code: 'MODEL_RETIRED',
      reason: `Model "${entry.model_id}" is retired and cannot be routed.`,
    };
  }
  if (entry.lifecycle_status === 'deprecated' && !permissionContext.allow_deprecated_models) {
    return {
      stage: 'lifecycle_and_availability',
      reason_code: 'MODEL_DEPRECATED',
      reason: `Model "${entry.model_id}" is deprecated and not allowed by policy.`,
    };
  }
  if (entry.lifecycle_status === 'preview' && !permissionContext.allow_preview_models) {
    return {
      stage: 'lifecycle_and_availability',
      reason_code: 'MODEL_PREVIEW_NOT_ALLOWED',
      reason: `Model "${entry.model_id}" is in preview and not enabled in system context.`,
    };
  }

  if (
    entry.availability_status === 'unavailable' ||
    entry.availability_status === 'maintenance'
  ) {
    return {
      stage: 'lifecycle_and_availability',
      reason_code: 'PROVIDER_UNAVAILABLE',
      reason: `Provider model availability is "${entry.availability_status}".`,
    };
  }
  if (
    entry.availability_status === 'degraded' &&
    !permissionContext.allow_degraded_providers
  ) {
    return {
      stage: 'lifecycle_and_availability',
      reason_code: 'PROVIDER_DEGRADED',
      reason: 'Provider health is degraded and degraded routing is disabled.',
    };
  }

  // Stage 4: Privacy and data-handling compatibility
  const requiredSensitivity = SENSITIVITY_RANK[task.privacy_constraints.data_sensitivity];
  const supportedSensitivity = SENSITIVITY_RANK[entry.privacy_handling.max_data_sensitivity];
  if (supportedSensitivity < requiredSensitivity) {
    return {
      stage: 'privacy_and_data_handling',
      reason_code: 'PRIVACY_SENSITIVITY_EXCEEDED',
      reason: `Task requires "${task.privacy_constraints.data_sensitivity}" handling, but model supports up to "${entry.privacy_handling.max_data_sensitivity}".`,
    };
  }

  if (
    task.privacy_constraints.require_zero_data_retention &&
    !entry.privacy_handling.zero_data_retention
  ) {
    return {
      stage: 'privacy_and_data_handling',
      reason_code: 'ZERO_RETENTION_REQUIRED',
      reason: 'Task requires zero data retention, which this model does not guarantee.',
    };
  }

  if (
    !task.privacy_constraints.allow_model_training &&
    entry.privacy_handling.trains_on_customer_data
  ) {
    return {
      stage: 'privacy_and_data_handling',
      reason_code: 'MODEL_TRAINING_PROHIBITED',
      reason: 'Provider trains on customer data, violating allow_model_training=false.',
    };
  }

  if (task.privacy_constraints.pii_present && !entry.privacy_handling.supports_pii) {
    return {
      stage: 'privacy_and_data_handling',
      reason_code: 'PII_NOT_SUPPORTED',
      reason: 'Task contains PII, which this model is not certified to process.',
    };
  }

  if (
    task.privacy_constraints.allowed_regions &&
    task.privacy_constraints.allowed_regions.length > 0
  ) {
    const entryRegions = entry.privacy_handling.regions ?? [];
    const hasAllowedRegion = task.privacy_constraints.allowed_regions.some((r) =>
      entryRegions.includes(r)
    );
    if (!hasAllowedRegion) {
      return {
        stage: 'privacy_and_data_handling',
        reason_code: 'REGION_POLICY_MISMATCH',
        reason: `Model regions [${entryRegions.join(', ')}] do not overlap allowed regions [${task.privacy_constraints.allowed_regions.join(', ')}].`,
      };
    }
  }

  // Stage 5: Budget eligibility
  if (entry.cost.state === 'unknown') {
    if (!task.estimated_cost_limit.allow_unknown_cost) {
      return {
        stage: 'budget_eligibility',
        reason_code: 'UNKNOWN_COST_DISALLOWED',
        reason: 'Model cost is unknown and task policy disallows unknown-cost execution.',
      };
    }
  } else {
    if (entry.cost.currency !== task.estimated_cost_limit.currency) {
      return {
        stage: 'budget_eligibility',
        reason_code: 'BUDGET_CURRENCY_MISMATCH',
        reason: `Model bills in ${entry.cost.currency}, while task budget is denominated in ${task.estimated_cost_limit.currency}.`,
      };
    }
    if (entry.cost.estimated_cost_per_request > task.estimated_cost_limit.max_cost) {
      return {
        stage: 'budget_eligibility',
        reason_code: 'BUDGET_EXCEEDED',
        reason: `Estimated model cost (${entry.cost.currency} ${entry.cost.estimated_cost_per_request}) exceeds max_cost (${task.estimated_cost_limit.currency} ${task.estimated_cost_limit.max_cost}).`,
      };
    }
  }

  // Stage 6: Permission eligibility (system-authoritative only; never overridden by model text)
  if (permissionContext.workspace_id !== task.provenance.workspace_id) {
    return {
      stage: 'permission_eligibility',
      reason_code: 'WORKSPACE_PERMISSION_MISMATCH',
      reason: `System permission context workspace "${permissionContext.workspace_id}" does not match task workspace "${task.provenance.workspace_id}".`,
    };
  }

  if (
    permissionContext.authorized_providers &&
    !permissionContext.authorized_providers.includes(entry.provider_id)
  ) {
    return {
      stage: 'permission_eligibility',
      reason_code: 'PROVIDER_NOT_AUTHORIZED',
      reason: `Provider "${entry.provider_id}" is not in authorized_providers for workspace "${permissionContext.workspace_id}".`,
    };
  }

  const missingSystemScopes = task.permission_requirements.required_scopes.filter(
    (scope) => !permissionContext.granted_scopes.includes(scope)
  );
  if (missingSystemScopes.length > 0) {
    return {
      stage: 'permission_eligibility',
      reason_code: 'MISSING_SYSTEM_PERMISSIONS',
      reason: `Workspace lacks required system permission scopes: ${missingSystemScopes.join(', ')}.`,
    };
  }

  const missingProviderScopes = task.permission_requirements.required_scopes.filter(
    (scope) => !entry.allowed_scopes.includes(scope)
  );
  if (missingProviderScopes.length > 0) {
    return {
      stage: 'permission_eligibility',
      reason_code: 'PROVIDER_SCOPE_UNAUTHORIZED',
      reason: `Provider model is not permitted for required scopes: ${missingProviderScopes.join(', ')}.`,
    };
  }

  // Approval check for sensitive / irreversible / external / high-impact tasks
  const approvalRequired =
    task.approval_requirement.required || requiresHumanApprovalByPolicy(task);
  if (approvalRequired) {
    const nowMs = Date.parse(permissionContext.now_iso ?? new Date().toISOString());
    const sysApproval = permissionContext.human_approval_verified;

    if (!sysApproval || !sysApproval.approved) {
      return {
        stage: 'permission_eligibility',
        reason_code: 'HUMAN_APPROVAL_REQUIRED',
        reason: 'System-verified human approval is required before routing this task.',
      };
    }
    if (/^(agent|bot|model|llm|auto|system)_/i.test(sysApproval.approved_by)) {
      return {
        stage: 'permission_eligibility',
        reason_code: 'NON_HUMAN_APPROVAL_REJECTED',
        reason: 'Approval must originate from a verified human identity.',
      };
    }
    if (Date.parse(sysApproval.expires_at) <= nowMs) {
      return {
        stage: 'permission_eligibility',
        reason_code: 'HUMAN_APPROVAL_EXPIRED',
        reason: `System-verified human approval expired at ${sysApproval.expires_at}.`,
      };
    }
  }

  return null;
}

function normalizeWeights(weights: RankingWeights): RankingWeights {
  const sum = weights.quality + weights.latency + weights.cost + weights.reliability;
  if (sum <= 0) {
    return DEFAULT_RANKING_WEIGHTS;
  }
  return {
    quality: weights.quality / sum,
    latency: weights.latency / sum,
    cost: weights.cost / sum,
    reliability: weights.reliability / sum,
  };
}

function rankEligibleCandidates(
  eligible: ProviderModelEntry[],
  task: NacsCoreTaskContract,
  rawWeights: RankingWeights
): RankedCandidate[] {
  if (eligible.length === 0) return [];

  const weights = normalizeWeights(rawWeights);
  const latencies = eligible.map((e) => e.latency.p95_ms);
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);

  const knownCosts = eligible
    .filter((e) => e.cost.state === 'known')
    .map((e) => (e.cost.state === 'known' ? e.cost.estimated_cost_per_request : 0));
  const minCost = knownCosts.length > 0 ? Math.min(...knownCosts) : 0;
  const maxCost =
    knownCosts.length > 0
      ? Math.max(...knownCosts, task.estimated_cost_limit.max_cost)
      : task.estimated_cost_limit.max_cost;

  const ranked: RankedCandidate[] = eligible.map((entry) => {
    const qualityScore = entry.quality_score;
    const reliabilityScore = entry.reliability_score;

    const latencyScore =
      maxLatency === minLatency
        ? 1
        : 1 - (entry.latency.p95_ms - minLatency) / (maxLatency - minLatency);

    let costScore: number;
    if (entry.cost.state === 'unknown') {
      // Unknown cost receives conservative neutral-low score when explicitly allowed
      costScore = 0.25;
    } else if (maxCost === minCost) {
      costScore = 1;
    } else {
      costScore = 1 - (entry.cost.estimated_cost_per_request - minCost) / (maxCost - minCost);
    }

    const totalScore = Number(
      (
        qualityScore * weights.quality +
        latencyScore * weights.latency +
        costScore * weights.cost +
        reliabilityScore * weights.reliability
      ).toFixed(6)
    );

    return {
      provider_id: entry.provider_id,
      model_id: entry.model_id,
      score: totalScore,
      breakdown: {
        quality: Number(qualityScore.toFixed(4)),
        latency: Number(latencyScore.toFixed(4)),
        cost: Number(costScore.toFixed(4)),
        reliability: Number(reliabilityScore.toFixed(4)),
      },
      entry,
    };
  });

  // Deterministic sort: highest score first, then provider_id ASC, then model_id ASC
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const pCmp = a.provider_id.localeCompare(b.provider_id);
    if (pCmp !== 0) return pCmp;
    return a.model_id.localeCompare(b.model_id);
  });

  return ranked;
}

export interface RouteTaskOptions {
  weights?: RankingWeights;
  excludeKeys?: ReadonlySet<string>;
}

export function routeTask(
  registry: ProviderRegistry,
  task: NacsCoreTaskContract,
  permissionContext: SystemPermissionContext,
  options: RouteTaskOptions = {}
): RoutingDecision {
  const decidedAt = permissionContext.now_iso ?? new Date().toISOString();

  // Validate contract before routing
  const contractCheck = validateNacsCoreTaskContract(task);
  if (!contractCheck.valid) {
    return {
      task_id: task?.task_id ?? 'unknown',
      routed: false,
      selected: null,
      ranked_candidates: [],
      rejected_candidates: [],
      failure_reason_code: 'INVALID_NACS_CONTRACT',
      failure_reason: contractCheck.errors.join('; '),
      decided_at: decidedAt,
    };
  }

  // Ensure model-generated text / untrusted inputs cannot override system permissions
  if (detectPermissionOverrideAttempt(task.structured_inputs)) {
    return {
      task_id: task.task_id,
      routed: false,
      selected: null,
      ranked_candidates: [],
      rejected_candidates: [],
      failure_reason_code: 'PERMISSION_OVERRIDE_ATTEMPT_BLOCKED',
      failure_reason:
        'Untrusted task inputs attempted to override system permissions or approval policy.',
      decided_at: decidedAt,
    };
  }

  const allModels = registry.listModels();
  const eligible: ProviderModelEntry[] = [];
  const rejected: RejectedCandidate[] = [];
  const excludeKeys = options.excludeKeys ?? new Set<string>();

  for (const entry of allModels) {
    const key = providerModelKey(entry.provider_id, entry.model_id);
    if (excludeKeys.has(key)) {
      rejected.push({
        provider_id: entry.provider_id,
        model_id: entry.model_id,
        stage: 'lifecycle_and_availability',
        reason_code: 'CANDIDATE_EXCLUDED_AFTER_FAILURE',
        reason: 'Candidate was excluded after a prior failed or timed-out attempt.',
      });
      continue;
    }

    const rejection = evaluateCandidateEligibility(entry, task, permissionContext);
    if (rejection) {
      rejected.push({
        provider_id: entry.provider_id,
        model_id: entry.model_id,
        stage: rejection.stage,
        reason_code: rejection.reason_code,
        reason: rejection.reason,
      });
    } else {
      eligible.push(entry);
    }
  }

  if (eligible.length === 0) {
    return {
      task_id: task.task_id,
      routed: false,
      selected: null,
      ranked_candidates: [],
      rejected_candidates: rejected,
      failure_reason_code: 'NO_ELIGIBLE_PROVIDER',
      failure_reason:
        allModels.length === 0
          ? 'Provider registry contains no registered models.'
          : 'All registered models failed one or more eligibility gates.',
      decided_at: decidedAt,
    };
  }

  const ranked = rankEligibleCandidates(
    eligible,
    task,
    options.weights ?? DEFAULT_RANKING_WEIGHTS
  );

  return {
    task_id: task.task_id,
    routed: true,
    selected: ranked[0],
    ranked_candidates: ranked,
    rejected_candidates: rejected,
    decided_at: decidedAt,
  };
}
