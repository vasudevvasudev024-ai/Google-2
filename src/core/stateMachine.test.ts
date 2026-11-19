import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkflowContract } from './contracts';
import {
  canTransition,
  evaluatePolicyTriggers,
  getAvailableTransitions,
  resolveApprovalDecision,
  scaffoldWorkflowBundle,
  transitionWorkflowBundle,
  updateTaskExecutionState,
} from './stateMachine';
import { createInitialWorkflows } from './seedData';

test('stateDiagram-v2 allows all specified transitions and blocks invalid shortcuts', () => {
  assert.equal(canTransition('draft', 'queued'), true);
  assert.equal(canTransition('draft', 'cancelled'), true);
  assert.equal(canTransition('draft', 'running'), false);
  assert.equal(canTransition('draft', 'completed'), false);

  assert.equal(canTransition('queued', 'planning'), true);
  assert.equal(canTransition('planning', 'waiting_approval'), true);
  assert.equal(canTransition('running', 'waiting_approval'), true);
  assert.equal(canTransition('waiting_approval', 'running'), true);
  assert.equal(canTransition('waiting_approval', 'reviewing'), false);

  assert.equal(canTransition('reviewing', 'running'), true); // Corrections needed
  assert.equal(canTransition('reviewing', 'completed'), true); // Passed
  assert.equal(canTransition('failed', 'queued'), true); // Authorized retry
  assert.equal(canTransition('failed', 'running'), false);

  assert.equal(canTransition('completed', 'draft'), false);
  assert.equal(canTransition('cancelled', 'queued'), false);
});

test('workflow cannot resume running from waiting_approval while approval is pending', () => {
  const [creative] = createInitialWorkflows();
  assert.equal(creative.state, 'waiting_approval');

  const available = getAvailableTransitions(creative);
  assert.equal(
    available.some((opt) => opt.to === 'running'),
    false
  );

  const attempt = transitionWorkflowBundle(creative, 'running', 'Tester');
  assert.ok(attempt.error);
  assert.equal(attempt.bundle.state, 'waiting_approval');
});

test('granting pending approval automatically resumes running state', () => {
  const [creative] = createInitialWorkflows();
  const pendingApproval = creative.approvals.find((a) => a.status === 'pending');
  assert.ok(pendingApproval);

  const resolved = resolveApprovalDecision(creative, pendingApproval.approval_id, 'approved', 'Lead Producer');
  assert.equal(resolved.error, undefined);
  assert.equal(resolved.bundle.state, 'running');
  assert.equal(resolved.bundle.approvals[0].status, 'approved');
});

test('budget over limit and autonomy policy triggers are evaluated accurately', () => {
  const [creative] = createInitialWorkflows();
  const videoTask = creative.tasks.find((t) => t.task_id === 'task_cr_04');
  assert.ok(videoTask);

  const triggers = evaluatePolicyTriggers(creative.contract, videoTask, 350);
  assert.ok(triggers.includes('purchases'));
  assert.ok(triggers.includes('budget_over_limit'));
});

test('task completion enforces upstream dependency order', () => {
  const [creative] = createInitialWorkflows();
  const blockedAttempt = updateTaskExecutionState(creative, 'task_cr_06', 'completed');
  assert.ok(blockedAttempt.error);

  const readyAttempt = updateTaskExecutionState(creative, 'task_cr_05', 'completed');
  assert.equal(readyAttempt.error, undefined);
  const completedTask = readyAttempt.bundle.tasks.find((t) => t.task_id === 'task_cr_05');
  assert.equal(completedTask?.execution_state, 'completed');
  assert.equal(readyAttempt.bundle.results.length, creative.results.length + 1);
});

test('validateWorkflowContract catches missing fields and accepts wf_demo_001 contract', () => {
  const [creative] = createInitialWorkflows();
  assert.equal(validateWorkflowContract(creative.contract).valid, true);

  const invalid = validateWorkflowContract({
    ...creative.contract,
    goal: 'hi',
    budget: { currency: 'INR', max_spend: -10, require_approval_over_limit: true },
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.length >= 2);
});

test('scaffoldWorkflowBundle initializes draft state and track-matched tasks', () => {
  const [creative] = createInitialWorkflows();
  const scaffolded = scaffoldWorkflowBundle({
    ...creative.contract,
    workflow_id: 'wf_new_003',
    production_track: 'automation',
    requested_outputs: ['research', 'code', 'documents'],
  });
  assert.equal(scaffolded.state, 'draft');
  assert.equal(scaffolded.tasks.length, 3);
  assert.equal(scaffolded.tasks[0].execution_state, 'ready');
  assert.equal(scaffolded.tasks[1].dependencies[0], scaffolded.tasks[0].task_id);
});
