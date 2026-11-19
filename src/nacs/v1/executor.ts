import crypto from 'node:crypto';
import { validateNacsCoreTaskContract } from './contract';
import { providerModelKey, type ProviderRegistry } from './registry';
import { routeTask } from './router';
import { detectPermissionOverrideAttempt, redactSecrets, redactStringSecrets } from './security';
import type {
  ExecutionAttemptRecord,
  NacsCoreTaskContract,
  RankingWeights,
  RoutingDecision,
  SystemPermissionContext,
  TaskExecutionReport,
} from './types';

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function hashTaskForIdempotency(task: NacsCoreTaskContract): string {
  const fingerprint = {
    production_track: task.production_track,
    objective: task.objective,
    structured_inputs: task.structured_inputs,
    required_capabilities: task.required_capabilities,
    required_modalities: task.required_modalities,
    expected_output: task.expected_output,
    privacy_constraints: task.privacy_constraints,
    permission_requirements: task.permission_requirements,
    estimated_cost_limit: task.estimated_cost_limit,
  };
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(sortKeysDeep(fingerprint)))
    .digest('hex');
}

interface IdempotencyEntry {
  payloadHash: string;
  report: TaskExecutionReport;
}

export class NacsIdempotencyStore {
  private readonly store = new Map<string, IdempotencyEntry>();

  private key(workspaceId: string, idempotencyKey: string): string {
    return `${workspaceId}::${idempotencyKey}`;
  }

  lookup(
    workspaceId: string,
    idempotencyKey: string,
    payloadHash: string
  ): { status: 'miss' } | { status: 'hit'; report: TaskExecutionReport } | { status: 'conflict' } {
    const existing = this.store.get(this.key(workspaceId, idempotencyKey));
    if (!existing) return { status: 'miss' };
    if (existing.payloadHash !== payloadHash) return { status: 'conflict' };
    return { status: 'hit', report: structuredClone(existing.report) };
  }

  save(
    workspaceId: string,
    idempotencyKey: string,
    payloadHash: string,
    report: TaskExecutionReport
  ): void {
    this.store.set(this.key(workspaceId, idempotencyKey), {
      payloadHash,
      report: structuredClone(report),
    });
  }
}

export interface ExecuteTaskOptions {
  weights?: RankingWeights;
  maxFallbackAttempts?: number;
  markFailedProviderDegraded?: boolean;
}

export class NacsTaskExecutor {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly idempotencyStore: NacsIdempotencyStore = new NacsIdempotencyStore()
  ) {}

  async executeTask(
    task: NacsCoreTaskContract,
    permissionContext: SystemPermissionContext,
    options: ExecuteTaskOptions = {}
  ): Promise<TaskExecutionReport> {
    const nowIso = permissionContext.now_iso ?? new Date().toISOString();

    // 1. Validate contract first
    const validation = validateNacsCoreTaskContract(task);
    if (!validation.valid) {
      return {
        task_id: task?.task_id ?? 'unknown',
        idempotency_key: task?.idempotency_key ?? 'unknown',
        from_idempotency_cache: false,
        final_status: 'rejected',
        selected_provider_id: null,
        selected_model_id: null,
        summary: 'Task rejected due to invalid NACS Core Contract.',
        attempts: [],
        routing_history: [],
        error_code: 'INVALID_NACS_CONTRACT',
        error_message: redactStringSecrets(validation.errors.join('; ')),
        completed_at: nowIso,
      };
    }

    // 2. Check idempotency store before any routing/execution
    const payloadHash = hashTaskForIdempotency(task);
    const idemCheck = this.idempotencyStore.lookup(
      task.provenance.workspace_id,
      task.idempotency_key,
      payloadHash
    );

    if (idemCheck.status === 'hit') {
      return {
        ...idemCheck.report,
        from_idempotency_cache: true,
      };
    }

    if (idemCheck.status === 'conflict') {
      return {
        task_id: task.task_id,
        idempotency_key: task.idempotency_key,
        from_idempotency_cache: false,
        final_status: 'rejected',
        selected_provider_id: null,
        selected_model_id: null,
        summary: 'Duplicate idempotency_key used with a conflicting task payload.',
        attempts: [],
        routing_history: [],
        error_code: 'IDEMPOTENCY_KEY_CONFLICT',
        error_message: `idempotency_key "${task.idempotency_key}" is already bound to a different task payload in workspace "${task.provenance.workspace_id}".`,
        completed_at: nowIso,
      };
    }

    // 3. Execute with full eligibility re-evaluation on every fallback attempt
    const maxAttempts = Math.max(1, (options.maxFallbackAttempts ?? 2) + 1);
    const excludeKeys = new Set<string>();
    const routingHistory: RoutingDecision[] = [];
    const attempts: ExecutionAttemptRecord[] = [];

    for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber++) {
      // Always re-run full 6-stage eligibility filtering for primary & every fallback
      const routing = routeTask(this.registry, task, permissionContext, {
        weights: options.weights,
        excludeKeys,
      });
      routingHistory.push(routing);

      if (!routing.routed || !routing.selected) {
        const finalReport: TaskExecutionReport = {
          task_id: task.task_id,
          idempotency_key: task.idempotency_key,
          from_idempotency_cache: false,
          final_status: attempts.length > 0 ? 'failed' : 'rejected',
          selected_provider_id: null,
          selected_model_id: null,
          summary:
            attempts.length > 0
              ? 'All eligible providers failed or timed out; no further eligible fallback candidates remain.'
              : 'Task could not be routed to any eligible provider.',
          attempts,
          routing_history: routingHistory,
          error_code:
            attempts.length > 0 ? 'ALL_ELIGIBLE_PROVIDERS_FAILED' : routing.failure_reason_code,
          error_message: redactStringSecrets(
            routing.failure_reason ?? 'No eligible providers available.'
          ),
          completed_at: new Date().toISOString(),
        };
        return finalReport;
      }

      const candidate = routing.selected;
      const adapter = this.registry.getAdapter(candidate.provider_id);
      if (!adapter) {
        const key = providerModelKey(candidate.provider_id, candidate.model_id);
        excludeKeys.add(key);
        attempts.push({
          attempt_number: attemptNumber,
          provider_id: candidate.provider_id,
          model_id: candidate.model_id,
          status: 'failed',
          latency_ms: 0,
          error_code: 'ADAPTER_NOT_REGISTERED',
          error_message: `No ProviderAdapter registered for "${candidate.provider_id}".`,
        });
        continue;
      }

      const effectiveTimeoutMs = Math.min(task.execution_timeout_ms, candidate.entry.timeout_ms);
      const controller = new AbortController();
      const startedAt = Date.now();

      try {
        const response = await runWithTimeout(
          () =>
            adapter.execute({
              task,
              model_entry: candidate.entry,
              timeout_ms: effectiveTimeoutMs,
              signal: controller.signal,
            }),
          effectiveTimeoutMs,
          controller
        );

        const elapsedMs = Date.now() - startedAt;

        if (response.status === 'succeeded') {
          // Ensure model-generated text cannot smuggle permission override directives
          const sanitizedOutput = redactSecrets(response.structured_output);
          const sanitizedSummary = redactStringSecrets(response.summary);

          if (detectPermissionOverrideAttempt(sanitizedOutput)) {
            excludeKeys.add(providerModelKey(candidate.provider_id, candidate.model_id));
            attempts.push({
              attempt_number: attemptNumber,
              provider_id: candidate.provider_id,
              model_id: candidate.model_id,
              status: 'failed',
              latency_ms: elapsedMs,
              error_code: 'MODEL_PERMISSION_OVERRIDE_REJECTED',
              error_message:
                'Model output attempted to override system permissions and was rejected.',
            });
            continue;
          }

          attempts.push({
            attempt_number: attemptNumber,
            provider_id: candidate.provider_id,
            model_id: candidate.model_id,
            status: 'succeeded',
            latency_ms: response.latency_ms ?? elapsedMs,
          });

          const successReport: TaskExecutionReport = {
            task_id: task.task_id,
            idempotency_key: task.idempotency_key,
            from_idempotency_cache: false,
            final_status: 'completed',
            selected_provider_id: candidate.provider_id,
            selected_model_id: candidate.model_id,
            structured_output: sanitizedOutput,
            summary: sanitizedSummary,
            attempts,
            routing_history: routingHistory,
            completed_at: new Date().toISOString(),
          };

          this.idempotencyStore.save(
            task.provenance.workspace_id,
            task.idempotency_key,
            payloadHash,
            successReport
          );
          return successReport;
        }

        // Provider returned explicit failure
        const key = providerModelKey(candidate.provider_id, candidate.model_id);
        excludeKeys.add(key);
        if (options.markFailedProviderDegraded) {
          this.registry.setAvailability(candidate.provider_id, candidate.model_id, 'degraded');
        }
        attempts.push({
          attempt_number: attemptNumber,
          provider_id: candidate.provider_id,
          model_id: candidate.model_id,
          status: 'failed',
          latency_ms: response.latency_ms ?? elapsedMs,
          error_code: response.error_code ?? 'PROVIDER_EXECUTION_FAILED',
          error_message: redactStringSecrets(
            response.error_message ?? 'Provider returned failure status.'
          ),
        });
      } catch (err) {
        const elapsedMs = Date.now() - startedAt;
        const isTimeout = err instanceof TimeoutError;
        const key = providerModelKey(candidate.provider_id, candidate.model_id);
        excludeKeys.add(key);

        if (options.markFailedProviderDegraded) {
          this.registry.setAvailability(candidate.provider_id, candidate.model_id, 'degraded');
        }

        attempts.push({
          attempt_number: attemptNumber,
          provider_id: candidate.provider_id,
          model_id: candidate.model_id,
          status: isTimeout ? 'timed_out' : 'failed',
          latency_ms: elapsedMs,
          error_code: isTimeout ? 'PROVIDER_TIMEOUT' : 'PROVIDER_EXCEPTION',
          error_message: redactStringSecrets(
            err instanceof Error ? err.message : 'Unexpected provider error.'
          ),
        });
      }
    }

    return {
      task_id: task.task_id,
      idempotency_key: task.idempotency_key,
      from_idempotency_cache: false,
      final_status: 'failed',
      selected_provider_id: null,
      selected_model_id: null,
      summary: 'Exhausted maximum fallback attempts without a successful execution.',
      attempts,
      routing_history: routingHistory,
      error_code: 'MAX_FALLBACK_ATTEMPTS_EXHAUSTED',
      error_message: 'All attempted eligible providers failed or timed out.',
      completed_at: new Date().toISOString(),
    };
  }
}

class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Provider adapter execution timed out after ${timeoutMs}ms.`);
    this.name = 'TimeoutError';
  }
}

async function runWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  controller: AbortController
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
