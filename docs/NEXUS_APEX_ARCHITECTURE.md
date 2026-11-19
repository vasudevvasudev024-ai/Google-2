# NEXUS APEX — Production Multi-Agent Architecture & Stage 1 Audit

## 1. Repository Audit Baseline

### Preserved & Verified Modules
- **`/contracts/v1.0/`**: Canonical JSON Schema Draft 2020-12 definitions (`workflow-request`, `task-envelope`, `agent-result`, `artifact-manifest`, `approval-request`, `core-task`, `provider-entry`), Ajv validator with secret leak scanning, workflow & task state machines, DAG cycle checker, `IdempotencyRegistry`, default-deny capability allowlist, SHA-256 payload-bound approval verification, and tenant-isolated artifact access control.
- **`/src/nacs/v1/`**: Portable NACS Core Task Contract V1 + Provider Registry V1 runtime (`types.ts`, `security.ts`, `contract.ts`, `registry.ts`, `router.ts`, `executor.ts`) implementing deterministic 6-stage eligibility filtering, weighted multi-criteria candidate ranking, timeout cancellation (`AbortController`), recursive secret redaction, and permission-override defense.
- **`/src/core/`**: Client-side workflow lifecycle engine (`contracts.ts`, `stateMachine.ts`, `seedData.ts`) powering interactive state machine transitions, approval gating, and workflow scaffolding.

### Stage 1 Gaps Addressed
1. **Express Control Plane Gateway (`server.ts` + `src/nexus/controlPlane.ts`)**: Bridged the previously unexposed server-side NACS v1 and Contracts v1.0 engines via `/api/nexus/*` endpoints while enforcing zero paid API calls and zero secret exposure.
2. **Seven-Division Architecture (`src/nexus/divisions.ts`)**: Formalized Research, Creator, Production, Marketing, Growth, Business Intelligence, and Security divisions with explicit capability/modality/scope bindings and honest runtime binding statuses (`policy_engine_local`, `adapter_unbound`, `approval_gated`).
3. **Budget & Security Governance (`src/nexus/budget.ts`, `src/nexus/governance.ts`)**: Added per-division monthly ceilings, hard-stop enforcement toggles, zero-spend Stage 1 safety locks, live secret-hygiene/override scanning, and server-side Ajv 2020 contract verification.

## 2. Seven-Division Multi-Agent Topology

| Division | Primary Track | NACS Capabilities | Stage 1 Runtime Status |
| :--- | :--- | :--- | :--- |
| **Research** | Cross-track | `research`, `structured_reasoning`, `document_generation` | Blueprint (Adapter Unbound) |
| **Creator** | Creative | `screenplay`, `storyboard`, `document_generation` | Blueprint (Adapter Unbound) |
| **Production** | Cross-track | `image_generation`, `video_generation`, `audio_generation`, `media_editing`, `code_generation`, `web_development`, `quality_inspection` | Local QA Policy Engine + Unbound / Approval-Gated Blueprints |
| **Marketing** | Cross-track | `document_generation`, `external_publish` | Blueprint + External Publish Hard-Gated |
| **Growth** | General Automation | `business_workflow`, `external_message` | Blueprint + External Messaging Hard-Gated |
| **Business Intelligence** | General Automation | `structured_reasoning`, `research`, `document_generation` | Local Cost Ledger Engine + Unbound Blueprint |
| **Security** | Cross-track | `quality_inspection`, `structured_reasoning` | Local NACS Security & Policy Engines Active |

## 3. Non-Negotiable Safety Invariants

1. **Zero Paid API Calls in Stage 1**: Zero external provider adapters are bound in `ProviderRegistry`. All routing runs strictly offline via `/api/nexus/route-dry-run`.
2. **Zero Exposed Secrets**: Provider entries store `credential_env_var` names only; `detectSecretLeaks` and `findSecretLeaks` reject credential fields or token patterns in contracts and payloads.
3. **Default-Deny Unknown Tools**: `KNOWN_CAPABILITY_ALLOWLIST` rejects unlisted capabilities with `UNKNOWN_TOOL_DENIED`.
4. **Human-Only High-Impact Authorization**: `public_publishing`, `external_message`, `purchase`, `payment`, `destructive_operation`, and `sensitive_account_modification` require SHA-256 payload-bound, non-expired human approval (`decision_source: "human"`).
