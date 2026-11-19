import crypto from 'node:crypto';
import type {
  ApprovalActionType,
  ApprovalRequest,
  ArtifactManifest,
  HighImpactActionType,
  TaskEnvelope,
  WorkflowRequest,
} from './types';

export interface CapabilityDefinition {
  capability: string;
  track: 'creative' | 'automation';
  requiresHumanApproval: boolean;
  actionType: ApprovalActionType | 'internal_compute';
}

export const KNOWN_CAPABILITY_ALLOWLIST: Record<string, CapabilityDefinition> = {
  'creative.research': { capability: 'creative.research', track: 'creative', requiresHumanApproval: false, actionType: 'internal_compute' },
  'creative.screenplay': { capability: 'creative.screenplay', track: 'creative', requiresHumanApproval: false, actionType: 'internal_compute' },
  'creative.storyboard': { capability: 'creative.storyboard', track: 'creative', requiresHumanApproval: false, actionType: 'internal_compute' },
  'creative.image_gen': { capability: 'creative.image_gen', track: 'creative', requiresHumanApproval: false, actionType: 'internal_compute' },
  'creative.video_gen': { capability: 'creative.video_gen', track: 'creative', requiresHumanApproval: false, actionType: 'internal_compute' },
  'creative.audio_gen': { capability: 'creative.audio_gen', track: 'creative', requiresHumanApproval: false, actionType: 'internal_compute' },
  'creative.edit': { capability: 'creative.edit', track: 'creative', requiresHumanApproval: false, actionType: 'internal_compute' },
  'creative.qa_inspect': { capability: 'creative.qa_inspect', track: 'creative', requiresHumanApproval: false, actionType: 'internal_compute' },
  'creative.publish': { capability: 'creative.publish', track: 'creative', requiresHumanApproval: true, actionType: 'public_publishing' },

  'automation.research': { capability: 'automation.research', track: 'automation', requiresHumanApproval: false, actionType: 'internal_compute' },
  'automation.code': { capability: 'automation.code', track: 'automation', requiresHumanApproval: false, actionType: 'internal_compute' },
  'automation.web_dev': { capability: 'automation.web_dev', track: 'automation', requiresHumanApproval: false, actionType: 'internal_compute' },
  'automation.document': { capability: 'automation.document', track: 'automation', requiresHumanApproval: false, actionType: 'internal_compute' },
  'automation.workflow': { capability: 'automation.workflow', track: 'automation', requiresHumanApproval: false, actionType: 'internal_compute' },
  'automation.external_message': { capability: 'automation.external_message', track: 'automation', requiresHumanApproval: true, actionType: 'external_message' },
  'automation.purchase': { capability: 'automation.purchase', track: 'automation', requiresHumanApproval: true, actionType: 'purchase' },
  'automation.payment': { capability: 'automation.payment', track: 'automation', requiresHumanApproval: true, actionType: 'payment' },
  'automation.destructive': { capability: 'automation.destructive', track: 'automation', requiresHumanApproval: true, actionType: 'destructive_operation' },
  'automation.account_modify': { capability: 'automation.account_modify', track: 'automation', requiresHumanApproval: true, actionType: 'sensitive_account_modification' },
};

const HIGH_IMPACT_ACTION_TYPES: ReadonlySet<string> = new Set<HighImpactActionType>([
  'public_publishing',
  'external_message',
  'purchase',
  'payment',
  'destructive_operation',
  'sensitive_account_modification',
]);

function sortKeysRecursively(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysRecursively);
  }
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysRecursively((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export function computeActionPayloadHash(payload: {
  workspace_id: string;
  task_id: string;
  capability: string;
  action_type: string;
  input: Record<string, unknown>;
}): string {
  const canonical = JSON.stringify(sortKeysRecursively(payload));
  const digest = crypto.createHash('sha256').update(canonical).digest('hex');
  return `sha256:${digest}`;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  requiresApproval: boolean;
  reasonCode: string;
  reason: string;
}

export function evaluateTaskExecutionPolicy(
  workflow: WorkflowRequest,
  task: TaskEnvelope,
  approval?: ApprovalRequest,
  nowIso = new Date().toISOString()
): PolicyEvaluationResult {
  // 1. Tenant isolation check
  if (task.workspace_id !== workflow.workspace_id) {
    return {
      allowed: false,
      requiresApproval: false,
      reasonCode: 'TENANT_ISOLATION_VIOLATION',
      reason: `Task workspace "${task.workspace_id}" does not match workflow workspace "${workflow.workspace_id}".`,
    };
  }

  // 2. Default-deny for unknown capabilities/tools
  const capabilityDef = KNOWN_CAPABILITY_ALLOWLIST[task.capability];
  if (!capabilityDef) {
    return {
      allowed: false,
      requiresApproval: false,
      reasonCode: 'UNKNOWN_TOOL_DENIED',
      reason: `Capability "${task.capability}" is not in the NACS allowlist and is denied by default.`,
    };
  }

  // 3. Track boundary check (mixed permits both)
  if (
    workflow.production_track !== 'mixed' &&
    capabilityDef.track !== workflow.production_track
  ) {
    return {
      allowed: false,
      requiresApproval: false,
      reasonCode: 'TRACK_CAPABILITY_MISMATCH',
      reason: `Capability "${task.capability}" (${capabilityDef.track}) is not permitted on "${workflow.production_track}" track.`,
    };
  }

  const effectiveActionType = task.action_type ?? capabilityDef.actionType;
  const isHighRisk = task.risk_level === 'high' || task.risk_level === 'critical';
  const isHighImpact =
    capabilityDef.requiresHumanApproval ||
    HIGH_IMPACT_ACTION_TYPES.has(effectiveActionType) ||
    isHighRisk;

  if (!isHighImpact) {
    return {
      allowed: true,
      requiresApproval: false,
      reasonCode: 'POLICY_ALLOWED',
      reason: 'Low/medium-risk allowlisted capability permitted under hybrid autonomy.',
    };
  }

  // 4. Explicit human approval verification for high-impact / high-risk actions
  if (!approval) {
    return {
      allowed: false,
      requiresApproval: true,
      reasonCode: 'APPROVAL_REQUIRED',
      reason: `High-impact action "${effectiveActionType}" (risk=${task.risk_level}) requires human approval.`,
    };
  }

  if (approval.workspace_id !== task.workspace_id) {
    return {
      allowed: false,
      requiresApproval: true,
      reasonCode: 'APPROVAL_TENANT_MISMATCH',
      reason: 'Approval workspace does not match task workspace.',
    };
  }

  if (approval.task_id !== task.task_id) {
    return {
      allowed: false,
      requiresApproval: true,
      reasonCode: 'APPROVAL_TASK_MISMATCH',
      reason: 'Approval task_id does not match task.',
    };
  }

  // Reject agent-generated approval decisions
  if (
    !approval.decision ||
    approval.decision.decision_source !== 'human' ||
    /^(agent|bot|auto|system)_/i.test(approval.decision.decided_by)
  ) {
    return {
      allowed: false,
      requiresApproval: true,
      reasonCode: 'AGENT_APPROVAL_REJECTED',
      reason: 'Approval decision must originate from a verified human identity.',
    };
  }

  if (approval.status !== 'approved') {
    return {
      allowed: false,
      requiresApproval: true,
      reasonCode: 'APPROVAL_NOT_APPROVED',
      reason: `Approval status is "${approval.status}", not "approved".`,
    };
  }

  // Check expiration timestamp
  if (Date.parse(nowIso) >= Date.parse(approval.expires_at)) {
    return {
      allowed: false,
      requiresApproval: true,
      reasonCode: 'APPROVAL_EXPIRED',
      reason: `Approval "${approval.approval_id}" expired at ${approval.expires_at}.`,
    };
  }

  // Revalidate exact action payload hash binding
  const expectedHash = computeActionPayloadHash({
    workspace_id: task.workspace_id,
    task_id: task.task_id,
    capability: task.capability,
    action_type: approval.action_type,
    input: task.input,
  });

  if (expectedHash !== approval.action_payload_hash) {
    return {
      allowed: false,
      requiresApproval: true,
      reasonCode: 'ACTION_PAYLOAD_HASH_MISMATCH',
      reason: 'Task payload changed after human approval; re-approval is required.',
    };
  }

  return {
    allowed: true,
    requiresApproval: true,
    reasonCode: 'APPROVAL_VERIFIED',
    reason: 'Human approval verified against exact payload hash and expiration.',
  };
}

export interface ArtifactAccessRequester {
  workspace_id: string;
  user_id: string;
  scope: 'workspace_member' | 'public_viewer';
}

export interface ArtifactAccessDecision {
  allowed: boolean;
  reasonCode: string;
  artifact?: Omit<ArtifactManifest, 'storage_uri'> & { storage_uri?: string };
}

export function authorizeArtifactAccess(
  manifest: ArtifactManifest,
  requester: ArtifactAccessRequester
): ArtifactAccessDecision {
  if (requester.workspace_id !== manifest.workspace_id) {
    if (requester.scope === 'public_viewer' && manifest.visibility === 'public_approved') {
      const { storage_uri: _redacted, ...safeView } = manifest;
      return {
        allowed: true,
        reasonCode: 'PUBLIC_ARTIFACT_ALLOWED_URI_REDACTED',
        artifact: safeView,
      };
    }

    return {
      allowed: false,
      reasonCode: 'CROSS_WORKSPACE_ACCESS_DENIED',
    };
  }

  if (requester.scope === 'public_viewer' && manifest.visibility !== 'public_approved') {
    return {
      allowed: false,
      reasonCode: 'PRIVATE_ARTIFACT_DENIED',
    };
  }

  // Never expose internal storage paths to public_viewer even inside same workspace
  if (requester.scope === 'public_viewer') {
    const { storage_uri: _redacted, ...safeView } = manifest;
    return {
      allowed: true,
      reasonCode: 'PUBLIC_ARTIFACT_ALLOWED_URI_REDACTED',
      artifact: safeView,
    };
  }

  return {
    allowed: true,
    reasonCode: 'WORKSPACE_ARTIFACT_ALLOWED',
    artifact: manifest,
  };
}
