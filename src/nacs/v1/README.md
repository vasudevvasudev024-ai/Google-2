# NEXUS APEX — NACS Core Contract V1 + Provider Registry V1

Portable, platform-independent TypeScript implementation of the **NACS Core Task Contract V1** and **Provider Registry V1** for the original NEXUS APEX multi-agent system (`creative` and `general_automation` tracks).

## Modules

- `contracts/v1.0/schemas/core-task.schema.json` — JSON Schema Draft 2020-12 schema for `NacsCoreTaskContract`.
- `contracts/v1.0/schemas/provider-entry.schema.json` — JSON Schema Draft 2020-12 schema for `ProviderModelEntry`.
- `src/nacs/v1/types.ts` — Strongly typed contract, registry, routing, permission context, and adapter interfaces.
- `src/nacs/v1/security.ts` — Secret leak detection, credential env-var name validation, recursive secret redaction, and model permission-override detection.
- `src/nacs/v1/contract.ts` — Ajv Draft 2020-12 schema validation plus semantic & hybrid-autonomy combination checks.
- `src/nacs/v1/registry.ts` — `ProviderRegistry` managing provider/model descriptors (with credential env-var enforcement) and portable `ProviderAdapter` bindings.
- `src/nacs/v1/router.ts` — Deterministic 6-stage eligibility pipeline and multi-criteria candidate ranker:
  1. `capability_compatibility`
  2. `modality_compatibility`
  3. `lifecycle_and_availability`
  4. `privacy_and_data_handling`
  5. `budget_eligibility`
  6. `permission_eligibility`
- `src/nacs/v1/executor.ts` — `NacsTaskExecutor` enforcing contract validation, workspace-scoped idempotency (`NacsIdempotencyStore`), timeout cancellation (`AbortController`), secret redaction, and full 6-stage eligibility re-evaluation on every fallback attempt.
- `src/nacs/v1/nacs-provider-registry.test.ts` — Mock-provider unit test suite (zero billable live provider calls).

## Running Tests

```bash
npx --yes tsx --test src/nacs/v1/nacs-provider-registry.test.ts
```
