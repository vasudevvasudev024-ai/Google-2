import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { detectSecretLeaks, isSafeEnvVarName } from './security';
import type {
  ProviderAdapter,
  ProviderAvailabilityStatus,
  ProviderLifecycleStatus,
  ProviderModelEntry,
} from './types';

export interface ProviderEntryValidationResult {
  valid: boolean;
  entry?: ProviderModelEntry;
  errors: string[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROVIDER_ENTRY_SCHEMA_PATH = path.resolve(
  __dirname,
  '../../../contracts/v1.0/schemas/provider-entry.schema.json'
);

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

let compiledProviderValidator: ValidateFunction | null = null;

function getProviderValidator(): ValidateFunction {
  if (!compiledProviderValidator) {
    const schema = JSON.parse(fs.readFileSync(PROVIDER_ENTRY_SCHEMA_PATH, 'utf-8')) as Record<
      string,
      unknown
    >;
    compiledProviderValidator = ajv.compile(schema);
  }
  return compiledProviderValidator;
}

export function validateProviderModelEntry(payload: unknown): ProviderEntryValidationResult {
  const secretIssues = detectSecretLeaks(payload);
  if (secretIssues.length > 0) {
    return { valid: false, errors: secretIssues };
  }

  const validate = getProviderValidator();
  if (!validate(payload)) {
    const schemaErrors = (validate.errors ?? []).map((err) => {
      const loc = err.instancePath || '$';
      return `${loc}: ${err.message ?? 'provider entry schema validation failed'}`;
    });
    return { valid: false, errors: schemaErrors };
  }

  const entry = payload as ProviderModelEntry;
  const semanticErrors: string[] = [];

  if (!isSafeEnvVarName(entry.credential_env_var)) {
    semanticErrors.push(
      `credential_env_var "${entry.credential_env_var}" must be an environment variable name only, never a raw secret.`
    );
  }

  if (entry.latency.p95_ms < entry.latency.p50_ms) {
    semanticErrors.push(
      `latency.p95_ms (${entry.latency.p95_ms}) cannot be less than latency.p50_ms (${entry.latency.p50_ms}).`
    );
  }

  if (
    entry.privacy_handling.classification === 'zero_retention_isolated' &&
    (!entry.privacy_handling.zero_data_retention || entry.privacy_handling.trains_on_customer_data)
  ) {
    semanticErrors.push(
      'Invalid privacy classification: zero_retention_isolated requires zero_data_retention=true and trains_on_customer_data=false.'
    );
  }

  if (semanticErrors.length > 0) {
    return { valid: false, errors: semanticErrors };
  }

  return { valid: true, entry, errors: [] };
}

export function providerModelKey(providerId: string, modelId: string): string {
  return `${providerId}::${modelId}`;
}

export class ProviderRegistry {
  private readonly entries = new Map<string, ProviderModelEntry>();
  private readonly adapters = new Map<string, ProviderAdapter>();

  registerModel(entry: ProviderModelEntry): void {
    const check = validateProviderModelEntry(entry);
    if (!check.valid) {
      throw new Error(`Invalid ProviderModelEntry: ${check.errors.join('; ')}`);
    }
    const key = providerModelKey(entry.provider_id, entry.model_id);
    this.entries.set(key, structuredClone(entry));
  }

  registerAdapter(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.provider_id, adapter);
  }

  getAdapter(providerId: string): ProviderAdapter | undefined {
    return this.adapters.get(providerId);
  }

  getModel(providerId: string, modelId: string): ProviderModelEntry | undefined {
    const entry = this.entries.get(providerModelKey(providerId, modelId));
    return entry ? structuredClone(entry) : undefined;
  }

  listModels(): ProviderModelEntry[] {
    return Array.from(this.entries.values())
      .map((entry) => structuredClone(entry))
      .sort((a, b) => {
        const providerCmp = a.provider_id.localeCompare(b.provider_id);
        return providerCmp !== 0 ? providerCmp : a.model_id.localeCompare(b.model_id);
      });
  }

  setAvailability(
    providerId: string,
    modelId: string,
    availability: ProviderAvailabilityStatus
  ): void {
    const key = providerModelKey(providerId, modelId);
    const existing = this.entries.get(key);
    if (!existing) {
      throw new Error(`Provider model not found: ${key}`);
    }
    this.entries.set(key, { ...existing, availability_status: availability });
  }

  setLifecycleStatus(
    providerId: string,
    modelId: string,
    lifecycle: ProviderLifecycleStatus
  ): void {
    const key = providerModelKey(providerId, modelId);
    const existing = this.entries.get(key);
    if (!existing) {
      throw new Error(`Provider model not found: ${key}`);
    }
    this.entries.set(key, { ...existing, lifecycle_status: lifecycle });
  }
}
