import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { detectSecretLeaks } from './security';
import type { NacsCapability, NacsCoreTaskContract } from './types';

export interface CoreContractValidationResult {
  valid: boolean;
  contract?: NacsCoreTaskContract;
  errors: string[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CORE_TASK_SCHEMA_PATH = path.resolve(
  __dirname,
  '../../../contracts/v1.0/schemas/core-task.schema.json'
);

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

let compiledCoreValidator: ValidateFunction | null = null;

function getCoreTaskValidator(): ValidateFunction {
  if (!compiledCoreValidator) {
    const schema = JSON.parse(fs.readFileSync(CORE_TASK_SCHEMA_PATH, 'utf-8')) as Record<
      string,
      unknown
    >;
    compiledCoreValidator = ajv.compile(schema);
  }
  return compiledCoreValidator;
}

const CREATIVE_ONLY_CAPABILITIES: ReadonlySet<NacsCapability> = new Set([
  'screenplay',
  'storyboard',
  'media_editing',
]);

const AUTOMATION_ONLY_CAPABILITIES: ReadonlySet<NacsCapability> = new Set([
  'code_generation',
  'web_development',
  'business_workflow',
]);

const HIGH_IMPACT_CAPABILITIES: ReadonlySet<NacsCapability> = new Set([
  'external_publish',
  'external_message',
  'financial_transaction',
  'destructive_action',
]);

export function requiresHumanApprovalByPolicy(task: NacsCoreTaskContract): boolean {
  if (task.permission_requirements.is_irreversible) return true;
  if (task.permission_requirements.is_external_effect) return true;
  if (task.permission_requirements.sensitivity_class === 'critical') return true;
  if (task.required_capabilities.some((cap) => HIGH_IMPACT_CAPABILITIES.has(cap))) {
    return true;
  }
  if (
    task.permission_requirements.required_scopes.some((scope) =>
      [
        'external.publish',
        'external.message',
        'billing.spend',
        'account.modify',
        'system.destructive',
      ].includes(scope)
    )
  ) {
    return true;
  }
  return false;
}

export function validateNacsCoreTaskContract(payload: unknown): CoreContractValidationResult {
  const secretIssues = detectSecretLeaks(payload);
  if (secretIssues.length > 0) {
    return { valid: false, errors: secretIssues };
  }

  const validate = getCoreTaskValidator();
  if (!validate(payload)) {
    const schemaErrors = (validate.errors ?? []).map((err) => {
      const loc = err.instancePath || '$';
      return `${loc}: ${err.message ?? 'schema validation failed'}`;
    });
    return { valid: false, errors: schemaErrors };
  }

  const task = payload as NacsCoreTaskContract;
  const semanticErrors: string[] = [];

  // Track-to-capability combination checks
  if (task.production_track === 'creative') {
    for (const cap of task.required_capabilities) {
      if (AUTOMATION_ONLY_CAPABILITIES.has(cap)) {
        semanticErrors.push(
          `Invalid combination: capability "${cap}" is not permitted on production_track "creative".`
        );
      }
    }
  } else if (task.production_track === 'general_automation') {
    for (const cap of task.required_capabilities) {
      if (CREATIVE_ONLY_CAPABILITIES.has(cap)) {
        semanticErrors.push(
          `Invalid combination: capability "${cap}" is not permitted on production_track "general_automation".`
        );
      }
    }
  }

  // Privacy constraint consistency
  if (
    (task.privacy_constraints.data_sensitivity === 'confidential' ||
      task.privacy_constraints.data_sensitivity === 'restricted') &&
    task.privacy_constraints.allow_model_training
  ) {
    semanticErrors.push(
      `Invalid combination: data_sensitivity "${task.privacy_constraints.data_sensitivity}" cannot enable allow_model_training.`
    );
  }

  if (task.privacy_constraints.pii_present && task.privacy_constraints.allow_model_training) {
    semanticErrors.push(
      'Invalid combination: tasks with pii_present=true cannot enable allow_model_training.'
    );
  }

  // Hybrid autonomy approval requirement consistency
  const mustRequireApproval = requiresHumanApprovalByPolicy(task);
  if (mustRequireApproval && !task.approval_requirement.required) {
    semanticErrors.push(
      'Invalid combination: irreversible, external, critical, or high-impact actions must set approval_requirement.required=true.'
    );
  }

  if (task.approval_requirement.required && task.approval_requirement.status === 'not_required') {
    semanticErrors.push(
      'Invalid combination: approval_requirement.required=true cannot have status="not_required".'
    );
  }

  if (!task.approval_requirement.required && task.approval_requirement.status !== 'not_required') {
    semanticErrors.push(
      `Invalid combination: approval_requirement.required=false must have status="not_required" (received "${task.approval_requirement.status}").`
    );
  }

  if (task.approval_requirement.status === 'approved') {
    if (task.approval_requirement.decision_source !== 'human') {
      semanticErrors.push(
        'Invalid approval: approved tasks must have decision_source="human".'
      );
    }
    if (
      !task.approval_requirement.approved_by ||
      /^(agent|bot|model|llm|auto|system)_/i.test(task.approval_requirement.approved_by)
    ) {
      semanticErrors.push(
        'Invalid approval: approved_by must be a non-agent human identifier.'
      );
    }
    if (!task.approval_requirement.approved_at || !task.approval_requirement.expires_at) {
      semanticErrors.push(
        'Invalid approval: approved status requires approved_at and expires_at timestamps.'
      );
    } else if (
      Date.parse(task.approval_requirement.expires_at) <=
      Date.parse(task.approval_requirement.approved_at)
    ) {
      semanticErrors.push(
        'Invalid approval: expires_at must be strictly later than approved_at.'
      );
    }
  }

  if (semanticErrors.length > 0) {
    return { valid: false, errors: semanticErrors };
  }

  return { valid: true, contract: task, errors: [] };
}
