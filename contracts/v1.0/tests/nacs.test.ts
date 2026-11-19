import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeArtifactAccess,
  computeActionPayloadHash,
  evaluateTaskExecutionPolicy,
  IdempotencyRegistry,
  transitionTaskState,
  transitionWorkflowState,
  validateAgentResult,
  validateApprovalRequest,
  validateArtifactManifest,
  validateTaskEnvelope,
  validateTaskGraph,
  validateWorkflowRequest,
  type ApprovalRequest,
  type ArtifactManifest,
  type TaskEnvelope,
  type WorkflowRequest,
} from '../ts/index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

function readFixture<T>(relPath: string): T {
  const fullPath = path.join(FIXTURES_DIR, relPath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as T;
}

test('1. Valid creative workflow passes schema, dependency, and policy checks', () => {
  const wf = readFixture<WorkflowRequest>('valid/creative-workflow.json');
  const task = readFixture<TaskEnvelope>('valid/task-envelope-creative.json');
  const result = readFixture('valid/agent-result-valid.json');
  const artifact = readFixture<ArtifactManifest>('valid/artifact-manifest-valid.json');

  assert.equal(validateWorkflowRequest(wf).valid, true);
  assert.equal(validateTaskEnvelope(task).valid, true);
  assert.equal(validateAgentResult(result).valid, true);
  assert.equal(validateArtifactManifest(artifact).valid, true);

  const graphCheck = validateTaskGraph(wf, [task]);
  assert.equal(graphCheck.valid, true);
  assert.deepEqual(graphCheck.topologicalOrder, [task.task_id]);

  const policy = evaluateTaskExecutionPolicy(wf, task);
  assert.equal(policy.allowed, true);
  assert.equal(policy.requiresApproval, false);
});

test('2. Valid automation workflow passes schema, dependency, and policy checks', () => {
  const wf = readFixture<WorkflowRequest>('valid/automation-workflow.json');
  const task = readFixture<TaskEnvelope>('valid/task-envelope-automation.json');

  assert.equal(validateWorkflowRequest(wf).valid, true);
  assert.equal(validateTaskEnvelope(task).valid, true);

  const graphCheck = validateTaskGraph(wf, [task]);
  assert.equal(graphCheck.valid, true);

  const policy = evaluateTaskExecutionPolicy(wf, task);
  assert.equal(policy.allowed, true);
  assert.equal(policy.requiresApproval, false);
});

test('3. Mixed workflow allows both creative and automation capabilities', () => {
  const wf = readFixture<WorkflowRequest>('valid/mixed-workflow.json');
  const creativeTask = {
    ...readFixture<TaskEnvelope>('valid/task-envelope-creative.json'),
    workflow_id: wf.workflow_id,
    workspace_id: wf.workspace_id,
    project_id: wf.project_id,
  };
  const autoTask = {
    ...readFixture<TaskEnvelope>('valid/task-envelope-automation.json'),
    task_id: 'task_mixed_web_02',
    workflow_id: wf.workflow_id,
    workspace_id: wf.workspace_id,
    project_id: wf.project_id,
    capability: 'automation.web_dev',
    dependencies: [creativeTask.task_id],
    idempotency_key: 'idem_mixed_web_02',
  };

  assert.equal(validateWorkflowRequest(wf).valid, true);
  assert.equal(validateTaskGraph(wf, [creativeTask, autoTask]).valid, true);
  assert.equal(evaluateTaskExecutionPolicy(wf, creativeTask).allowed, true);
  assert.equal(evaluateTaskExecutionPolicy(wf, autoTask).allowed, true);
});

test('4. Missing workspace identity is rejected by WorkflowRequest schema', () => {
  const badWf = readFixture('invalid/missing-workspace-workflow.json');
  const res = validateWorkflowRequest(badWf);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('workspace_id')));
});

test('5. Invalid production track is rejected by WorkflowRequest schema', () => {
  const badWf = readFixture('invalid/invalid-track-workflow.json');
  const res = validateWorkflowRequest(badWf);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('production_track')));
});

test('6. Invalid task dependencies (cycles, missing refs, cross-workspace) are rejected', () => {
  const wf = readFixture<WorkflowRequest>('valid/creative-workflow.json');
  const badTasks = readFixture<TaskEnvelope[]>('invalid/invalid-task-dependencies.json');

  const graphCheck = validateTaskGraph(wf, badTasks);
  assert.equal(graphCheck.valid, false);
  assert.ok(graphCheck.errors.some((e) => e.includes('missing dependency')));
  assert.ok(graphCheck.errors.some((e) => e.includes('cycle detected') || e.includes('Cycle') || e.includes('cycle')));

  const crossWorkspaceTask: TaskEnvelope = {
    ...readFixture<TaskEnvelope>('valid/task-envelope-creative.json'),
    workspace_id: 'ws_other_tenant',
  };
  const tenantCheck = validateTaskGraph(wf, [crossWorkspaceTask]);
  assert.equal(tenantCheck.valid, false);
  assert.ok(tenantCheck.errors.some((e) => e.includes('Cross-workspace')));
});

test('7. Illegal workflow and task state transitions are rejected', () => {
  const wfSkip = transitionWorkflowState('draft', 'running');
  assert.equal(wfSkip.ok, false);
  assert.equal(wfSkip.errorCode, 'ILLEGAL_WORKFLOW_TRANSITION');

  const wfFromTerminal = transitionWorkflowState('completed', 'running');
  assert.equal(wfFromTerminal.ok, false);
  assert.equal(wfFromTerminal.errorCode, 'ILLEGAL_WORKFLOW_TRANSITION');

  const wfFromCancelled = transitionWorkflowState('cancelled', 'queued');
  assert.equal(wfFromCancelled.ok, false);

  const taskSkip = transitionTaskState('pending', 'completed');
  assert.equal(taskSkip.ok, false);
  assert.equal(taskSkip.errorCode, 'ILLEGAL_TASK_TRANSITION');

  const taskUnmetDeps = transitionTaskState('pending', 'ready', false);
  assert.equal(taskUnmetDeps.ok, false);
  assert.equal(taskUnmetDeps.errorCode, 'DEPENDENCIES_UNMET');
});

test('8. Completed workflow with unfinished tasks is rejected', () => {
  const attempt = transitionWorkflowState('reviewing', 'completed', {
    tasks: [
      { task_id: 'task_1', state: 'completed' },
      { task_id: 'task_2', state: 'running' },
    ],
  });

  assert.equal(attempt.ok, false);
  assert.equal(attempt.errorCode, 'UNFINISHED_TASKS_REMAIN');

  const passed = transitionWorkflowState('reviewing', 'completed', {
    tasks: [
      { task_id: 'task_1', state: 'completed' },
      { task_id: 'task_2', state: 'completed' },
    ],
  });
  assert.equal(passed.ok, true);
  assert.equal(passed.state, 'completed');
});

test('9. Duplicate idempotency keys within the same workspace are rejected', () => {
  const registry = new IdempotencyRegistry();
  const task1 = readFixture<TaskEnvelope>('valid/task-envelope-creative.json');
  const task2: TaskEnvelope = {
    ...task1,
    task_id: 'task_creative_screenplay_02',
  };

  const first = registry.register(task1);
  assert.equal(first.accepted, true);

  const duplicate = registry.register(task2);
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.errorCode, 'DUPLICATE_IDEMPOTENCY_KEY');
});

test('10. High-risk actions, unknown tools, and agent self-approvals are denied without valid human approval', () => {
  const wf = readFixture<WorkflowRequest>('valid/creative-workflow.json');
  const publishTask: TaskEnvelope = {
    ...readFixture<TaskEnvelope>('valid/task-envelope-creative.json'),
    task_id: 'task_creative_publish_09',
    capability: 'creative.publish',
    action_type: 'public_publishing',
    risk_level: 'high',
    input: { channel: 'youtube_main', artifact_id: 'art_final_render_01' },
  };

  // No approval provided
  const noApproval = evaluateTaskExecutionPolicy(wf, publishTask);
  assert.equal(noApproval.allowed, false);
  assert.equal(noApproval.requiresApproval, true);
  assert.equal(noApproval.reasonCode, 'APPROVAL_REQUIRED');

  // Unknown tool default-deny
  const unknownToolTask: TaskEnvelope = {
    ...publishTask,
    capability: 'unknown.arbitrary_shell',
  };
  const unknownRes = evaluateTaskExecutionPolicy(wf, unknownToolTask);
  assert.equal(unknownRes.allowed, false);
  assert.equal(unknownRes.reasonCode, 'UNKNOWN_TOOL_DENIED');

  // Agent self-approval rejected at schema AND policy layers
  const agentSelfApproval = readFixture<ApprovalRequest>('invalid/agent-self-approval.json');
  assert.equal(validateApprovalRequest(agentSelfApproval).valid, false);
  const selfPolicy = evaluateTaskExecutionPolicy(wf, publishTask, agentSelfApproval);
  assert.equal(selfPolicy.allowed, false);
  assert.equal(selfPolicy.reasonCode, 'AGENT_APPROVAL_REJECTED');
});

test('11. Expired approval is rejected even when payload hash matches', () => {
  const wf = readFixture<WorkflowRequest>('valid/creative-workflow.json');
  const publishTask: TaskEnvelope = {
    ...readFixture<TaskEnvelope>('valid/task-envelope-creative.json'),
    task_id: 'task_creative_publish_09',
    capability: 'creative.publish',
    action_type: 'public_publishing',
    risk_level: 'high',
    input: { channel: 'youtube_main', artifact_id: 'art_final_render_01' },
  };

  const payloadHash = computeActionPayloadHash({
    workspace_id: publishTask.workspace_id,
    task_id: publishTask.task_id,
    capability: publishTask.capability,
    action_type: 'public_publishing',
    input: publishTask.input,
  });

  const baseApproval = readFixture<ApprovalRequest>('valid/approval-request-valid.json');
  const expiredApproval: ApprovalRequest = {
    ...baseApproval,
    action_payload_hash: payloadHash,
    expires_at: '2026-01-01T00:00:00Z',
  };

  assert.equal(validateApprovalRequest(expiredApproval).valid, true);
  const res = evaluateTaskExecutionPolicy(wf, publishTask, expiredApproval, '2026-11-18T08:50:00Z');
  assert.equal(res.allowed, false);
  assert.equal(res.reasonCode, 'APPROVAL_EXPIRED');
});

test('12. Changed action payload after approval invalidates approval and blocks execution', () => {
  const wf = readFixture<WorkflowRequest>('valid/creative-workflow.json');
  const originalTask: TaskEnvelope = {
    ...readFixture<TaskEnvelope>('valid/task-envelope-creative.json'),
    task_id: 'task_creative_publish_09',
    capability: 'creative.publish',
    action_type: 'public_publishing',
    risk_level: 'high',
    input: { channel: 'youtube_staging', artifact_id: 'art_final_render_01' },
  };

  const approvedHash = computeActionPayloadHash({
    workspace_id: originalTask.workspace_id,
    task_id: originalTask.task_id,
    capability: originalTask.capability,
    action_type: 'public_publishing',
    input: originalTask.input,
  });

  const validApproval: ApprovalRequest = {
    ...readFixture<ApprovalRequest>('valid/approval-request-valid.json'),
    action_payload_hash: approvedHash,
  };

  // Original payload passes verification
  const okRes = evaluateTaskExecutionPolicy(wf, originalTask, validApproval, '2026-11-18T08:50:00Z');
  assert.equal(okRes.allowed, true);
  assert.equal(okRes.reasonCode, 'APPROVAL_VERIFIED');

  // Mutated payload after approval is rejected
  const mutatedTask: TaskEnvelope = {
    ...originalTask,
    input: { channel: 'youtube_production_global', artifact_id: 'art_final_render_01' },
  };
  const tamperedRes = evaluateTaskExecutionPolicy(wf, mutatedTask, validApproval, '2026-11-18T08:50:00Z');
  assert.equal(tamperedRes.allowed, false);
  assert.equal(tamperedRes.reasonCode, 'ACTION_PAYLOAD_HASH_MISMATCH');
});

test('13. Cross-workspace artifact access is denied and secret leaks in contracts are rejected', () => {
  const artifact = readFixture<ArtifactManifest>('valid/artifact-manifest-valid.json');

  const crossWorkspace = authorizeArtifactAccess(artifact, {
    workspace_id: 'ws_other_tenant',
    user_id: 'user_attacker',
    scope: 'workspace_member',
  });
  assert.equal(crossWorkspace.allowed, false);
  assert.equal(crossWorkspace.reasonCode, 'CROSS_WORKSPACE_ACCESS_DENIED');

  const sameWorkspace = authorizeArtifactAccess(artifact, {
    workspace_id: 'ws_studio_alpha',
    user_id: 'user_producer_01',
    scope: 'workspace_member',
  });
  assert.equal(sameWorkspace.allowed, true);
  assert.equal(sameWorkspace.artifact?.storage_uri, artifact.storage_uri);

  // Public approved artifact redacts internal storage_uri
  const publicArtifact: ArtifactManifest = { ...artifact, visibility: 'public_approved' };
  const publicView = authorizeArtifactAccess(publicArtifact, {
    workspace_id: 'ws_other_tenant',
    user_id: 'anon_viewer',
    scope: 'public_viewer',
  });
  assert.equal(publicView.allowed, true);
  assert.equal(publicView.artifact?.storage_uri, undefined);

  // Secret leak in TaskEnvelope is rejected
  const secretTask = readFixture('invalid/automation-secret-leak.json');
  const secretValidation = validateTaskEnvelope(secretTask);
  assert.equal(secretValidation.valid, false);
  assert.ok(secretValidation.errors.some((e) => e.includes('Forbidden credential field')));
});
