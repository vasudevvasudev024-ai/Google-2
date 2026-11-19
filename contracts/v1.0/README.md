# NEXUS APEX Core Contract System (NACS) — Contract Version `1.0`

## 1. Repository Audit & Runtime Footprint

- **Languages**: TypeScript (`^7.0.2`), HTML/CSS
- **Frameworks & Libraries**: React 19, Vite 8, Tailwind CSS v4, Express 4 (`^4.21.2` installed in `package.json`), `@google/genai`, `ajv` + `ajv-formats` (JSON Schema Draft 2020-12)
- **Package Manager**: `bun.lock` present (npm / Node.js also available)
- **Test Runner**: Built-in Node.js test runner (`node:test` + `node:assert/strict`) executed via `npx --yes tsx --test`
- **Python Runtime**: Not present and not configured in this repository (`pyproject.toml` / `requirements.txt` absent), so Python Pydantic models are **not** generated here; JSON Schema Draft 2020-12 remains the single source of truth.

## 2. Directory Structure (`/contracts/v1.0/`)

```text
contracts/v1.0/
├── README.md
├── schemas/                         # Canonical JSON Schema Draft 2020-12 contracts
│   ├── workflow-request.schema.json
│   ├── task-envelope.schema.json
│   ├── agent-result.schema.json
│   ├── artifact-manifest.schema.json
│   └── approval-request.schema.json
├── ts/                              # TypeScript types, Ajv validator, state machine, policy
│   ├── index.ts
│   ├── types.ts
│   ├── validator.ts
│   ├── stateMachine.ts
│   └── policy.ts
├── fixtures/
│   ├── valid/                       # Valid Creative, Automation, Mixed, Result, Artifact, Approval fixtures
│   └── invalid/                     # Negative security, dependency, schema, and self-approval fixtures
└── tests/
    └── nacs.test.ts                 # Automated contract, state machine, policy, and isolation test suite
```

## 3. Core Contracts (`1.0`)

1. **`WorkflowRequest`**: Controls track (`creative | automation | mixed`), tenant boundary (`workspace_id`, `project_id`), goal, constraints, requested outputs, hybrid autonomy policy (`unknown_tools: "deny"`), and budget caps.
2. **`TaskEnvelope`**: Controls agent identity, allowlisted `capability` (`creative.*` / `automation.*`), typed inputs, expected output, DAG dependencies, workspace-scoped `idempotency_key`, retry bounds (`attempt <= max_attempts`), `risk_level`, and timestamps.
3. **`AgentResult`**: Captures task outcome (`succeeded | failed | blocked | needs_correction | cancelled`), summary, structured output, artifact IDs, token/compute/cost usage, and structured errors.
4. **`ArtifactManifest`**: Tracks typed artifacts (`screenplay`, `storyboard`, `image`, `video`, `audio`, `code`, `website_bundle`, `document`, etc.), logical `storage_uri` (`nacs://` or `obj://`), MIME type, `sha256` checksum, version, provenance, review status, and tenant `visibility` (`private | workspace | public_approved`).
5. **`ApprovalRequest`**: Enforces payload-bound human authorization (`decision_source: "human"`, rejecting `agent_*` identities), SHA-256 `action_payload_hash`, risk level, status, and expiration (`expires_at`).

## 4. State Machines, DAG Validation & Idempotency

- **Workflow State Machine**: `draft -> queued -> planning <-> running <-> waiting_approval`, `running <-> reviewing -> completed`, `planning/running/reviewing -> failed -> queued`, and non-terminal states `-> cancelled`.
  - Transitioning to `completed` is guarded: rejected if zero tasks exist or any task remains unfinished (`pending`, `ready`, `running`, `waiting_approval`, `failed`).
- **Task State Machine**: `pending -> ready -> running -> completed`, with `waiting_approval`, `failed -> ready`, and `cancelled` transitions.
  - Transitioning to `ready`, `running`, or `completed` fails if upstream `dependencies` are incomplete.
- **Task Graph Validation (`validateTaskGraph`)**: Rejects duplicate `task_id`s, cross-workspace/cross-project tasks, missing dependencies, self-dependencies, and dependency cycles.
- **Idempotency (`IdempotencyRegistry`)**: Scopes `(workspace_id, idempotency_key)` uniqueness to prevent duplicate side effects across retries or concurrent submissions.

## 5. Default-Deny Policy & Security Model

- **Default-Deny Capability Allowlist**: Unknown capabilities (`unknown.arbitrary_shell`, etc.) are rejected (`UNKNOWN_TOOL_DENIED`), and cross-track capabilities are rejected unless `production_track === "mixed"`.
- **Mandatory Human Approval**: `public_publishing`, `external_message`, `purchase`, `payment`, `destructive_operation`, `sensitive_account_modification`, and `risk_level: "high" | "critical"` require a valid `ApprovalRequest`.
- **Cryptographic Payload Binding**: `computeActionPayloadHash()` hashes a canonically key-sorted JSON payload (`workspace_id`, `task_id`, `capability`, `action_type`, `input`). Before execution, `evaluateTaskExecutionPolicy()` verifies `decision_source === "human"`, non-agent `decided_by`, `status === "approved"`, `now < expires_at`, matching `workspace_id`, and exact `action_payload_hash` equality.
- **Secret Hygiene & Tenant Isolation**: `findSecretLeaks()` rejects payloads containing credential field names (`api_key`, `password`, `secret`, `private_key`) or token patterns (`Bearer ...`, `sk-...`, `AIza...`). `authorizeArtifactAccess()` blocks cross-workspace reads and strips internal `storage_uri` paths from `public_viewer` projections.

## 6. Cross-Language Consumption (Express & Future Python Orchestrator)

JSON Schema Draft 2020-12 files in `contracts/v1.0/schemas/` are the **single source of truth**.

### Express (TypeScript) API Gateway
Express route handlers import directly from `contracts/v1.0/ts/`:
- Validate incoming HTTP `POST /api/workflows` payloads with `validateWorkflowRequest(req.body)` (backed by `Ajv2020` compiling `workflow-request.schema.json` + secret leak scanning).
- Enforce `validateTaskGraph()`, `IdempotencyRegistry`, and `evaluateTaskExecutionPolicy()` before dispatching tasks to provider adapters or queues.
- Project artifacts through `authorizeArtifactAccess(manifest, req.authContext)` so tenant boundaries and `storage_uri` redaction are enforced at the API edge.

### Future Python Orchestration Runtime
When a Python worker service (e.g., FastAPI / Celery / Temporal worker) is introduced:
1. Mount or package `contracts/v1.0/schemas/*.schema.json` alongside the Python service (no manual schema duplication).
2. Validate incoming/outgoing envelopes directly against the Draft 2020-12 JSON Schemas using `jsonschema.Draft202012Validator` and/or generate strict **Pydantic v2** models from those schemas during build (`datamodel-code-generator --input contracts/v1.0/schemas --input-file-type jsonschema --output python/nacs_contracts/`).
3. Mirror canonical payload hashing (`json.dumps(payload, sort_keys=True, separators=(",", ":"))` + `hashlib.sha256`) so an `ApprovalRequest` signed in the Express control plane verifies identically in Python workers prior to executing high-impact provider calls.
