import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type {
  AgentResult,
  ApprovalRequest,
  ArtifactManifest,
  TaskEnvelope,
  WorkflowRequest,
} from './types';

export type ContractKind =
  | 'workflow-request'
  | 'task-envelope'
  | 'agent-result'
  | 'artifact-manifest'
  | 'approval-request';

export interface ContractValidationResult<T> {
  valid: boolean;
  data?: T;
  errors: string[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCHEMAS_DIR = path.resolve(__dirname, '../schemas');

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
});
addFormats(ajv);

const validators = new Map<ContractKind, ValidateFunction>();

function loadValidator(kind: ContractKind): ValidateFunction {
  const cached = validators.get(kind);
  if (cached) return cached;

  const schemaPath = path.join(SCHEMAS_DIR, `${kind}.schema.json`);
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
  const validate = ajv.compile(schema);
  validators.set(kind, validate);
  return validate;
}

const FORBIDDEN_SECRET_KEY_PATTERN =
  /^(api_?key|secret|password|passwd|private_?key|access_?token|refresh_?token|client_?secret|auth_?token)$/i;

const FORBIDDEN_SECRET_VALUE_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/i,
  /\bsk-[A-Za-z0-9]{16,}\b/,
  /\bAIza[0-9A-Za-z\-_]{20,}\b/,
  /-----BEGIN\s+(?:RSA\s+|EC\s+)?PRIVATE\s+KEY-----/,
];

export function findSecretLeaks(value: unknown, currentPath = '$'): string[] {
  const findings: string[] = [];

  if (typeof value === 'string') {
    for (const pattern of FORBIDDEN_SECRET_VALUE_PATTERNS) {
      if (pattern.test(value)) {
        findings.push(`Potential secret credential pattern detected at ${currentPath}.`);
      }
    }
    return findings;
  }

  if (Array.isArray(value)) {
    value.forEach((item, idx) => {
      findings.push(...findSecretLeaks(item, `${currentPath}[${idx}]`));
    });
    return findings;
  }

  if (value && typeof value === 'object') {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const nextPath = `${currentPath}.${key}`;
      if (FORBIDDEN_SECRET_KEY_PATTERN.test(key) && val !== undefined && val !== '') {
        findings.push(`Forbidden credential field "${key}" at ${nextPath}.`);
      }
      findings.push(...findSecretLeaks(val, nextPath));
    }
  }

  return findings;
}

function validateWithSchema<T>(kind: ContractKind, payload: unknown): ContractValidationResult<T> {
  const secretErrors = findSecretLeaks(payload);
  if (secretErrors.length > 0) {
    return { valid: false, errors: secretErrors };
  }

  const validate = loadValidator(kind);
  const ok = validate(payload);
  if (!ok) {
    const schemaErrors = (validate.errors ?? []).map((err) => {
      const loc = err.instancePath || '$';
      return `${loc}: ${err.message ?? 'schema validation error'}`;
    });
    return { valid: false, errors: schemaErrors };
  }

  return { valid: true, data: payload as T, errors: [] };
}

export function validateWorkflowRequest(payload: unknown): ContractValidationResult<WorkflowRequest> {
  return validateWithSchema<WorkflowRequest>('workflow-request', payload);
}

export function validateTaskEnvelope(payload: unknown): ContractValidationResult<TaskEnvelope> {
  const res = validateWithSchema<TaskEnvelope>('task-envelope', payload);
  if (!res.valid || !res.data) return res;

  if (res.data.attempt > res.data.max_attempts) {
    return {
      valid: false,
      errors: [`attempt (${res.data.attempt}) cannot exceed max_attempts (${res.data.max_attempts}).`],
    };
  }
  return res;
}

export function validateAgentResult(payload: unknown): ContractValidationResult<AgentResult> {
  return validateWithSchema<AgentResult>('agent-result', payload);
}

export function validateArtifactManifest(payload: unknown): ContractValidationResult<ArtifactManifest> {
  return validateWithSchema<ArtifactManifest>('artifact-manifest', payload);
}

export function validateApprovalRequest(payload: unknown): ContractValidationResult<ApprovalRequest> {
  return validateWithSchema<ApprovalRequest>('approval-request', payload);
}
