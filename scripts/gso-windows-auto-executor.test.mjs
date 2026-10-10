import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  applyExecutorDevStatus,
  acquireExecutionLease,
  acquireExecutorLock,
  buildCodexInvocation,
  buildRestrictedCodexEnv,
  createRunIdentity,
  evaluateExecutorIssueState,
  formatStateComment,
  parseStateComment,
  recordModelRun,
  releaseExecutorLock,
  scanForSecrets,
  simulateExecution,
  transitionJournal,
  validateAuthorizationEnvelope,
} from './gso-windows-auto-executor.mjs';

const policy = {
  allowed: ['docs/evidence/WRC_P2_U01_WORKER_HOME_REAL_READ_ACCEPTANCE.md'],
  forbidden: ['src/**', '.github/workflows/**', 'backstop_data/**'],
};

function tempState() {
  return mkdtempSync(join(tmpdir(), 'gso-step-c-'));
}

function identity(suffix = 'one') {
  return { runId: `run-${suffix}`, leaseId: `lease-${suffix}` };
}

test('single instance lock permits only one executor', () => {
  const stateDir = tempState();
  try {
    const first = acquireExecutorLock(stateDir, 'run-1');
    const second = acquireExecutorLock(stateDir, 'run-2');
    assert.equal(first.acquired, true);
    assert.equal(second.acquired, false);
    assert.equal(second.reason, 'SINGLE_INSTANCE_LOCK_BUSY');
    releaseExecutorLock(first);
  } finally { rmSync(stateDir, { recursive: true, force: true }); }
});

test('deterministic lease prevents duplicate Issue execution and requests recovery', () => {
  const stateDir = tempState();
  try {
    const first = acquireExecutionLease(stateDir, 'same-lease', 'run-1');
    const second = acquireExecutionLease(stateDir, 'same-lease', 'run-2');
    assert.equal(first.acquired, true);
    assert.equal(second.acquired, false);
    assert.equal(second.duplicate_prevented, true);
    assert.equal(second.recovery_required, true);
    assert.equal(second.prior_state, 'READY');
  } finally { rmSync(stateDir, { recursive: true, force: true }); }
});

test('lease identity is stable when GitHub comments change Issue timestamps', () => {
  const base = {
    repository: 'example/repo',
    issueNumber: 21,
    baseSha: 'abc',
    manifestHash: 'manifest',
    issueRevision: 'reviewed-body-hash',
  };
  const first = createRunIdentity({ ...base, issueUpdatedAt: 'before-comment' });
  const second = createRunIdentity({ ...base, issueUpdatedAt: 'after-comment' });
  assert.equal(first.leaseId, second.leaseId);
});

test('RUNNING is rejected without real run, lease, and Codex thread evidence', () => {
  const stateDir = tempState();
  try {
    const lease = acquireExecutionLease(stateDir, 'lease-running', 'run-running');
    transitionJournal(lease.journalPath, 'CLAIMED', {});
    assert.throws(
      () => transitionJournal(lease.journalPath, 'RUNNING', { run_id: 'run-running', lease_id: 'lease-running' }),
      /RUNNING_REQUIRES_RUN_LEASE_AND_CODEX_THREAD_EVIDENCE/,
    );
  } finally { rmSync(stateDir, { recursive: true, force: true }); }
});

test('PASS is rejected without exact successful Gate evidence', () => {
  const stateDir = tempState();
  try {
    const lease = acquireExecutionLease(stateDir, 'lease-pass', 'run-pass');
    transitionJournal(lease.journalPath, 'CLAIMED', {});
    transitionJournal(lease.journalPath, 'RUNNING', { run_id: 'run-pass', lease_id: 'lease-pass', codex_thread_id: 'thread-1' });
    transitionJournal(lease.journalPath, 'PR_CREATED', { pr_number: 1 });
    transitionJournal(lease.journalPath, 'TESTING', { gate_run_id: 2 });
    assert.throws(() => transitionJournal(lease.journalPath, 'PASS', { gate_run_id: 2, gate_conclusion: 'failure' }), /PASS_REQUIRES/);
  } finally { rmSync(stateDir, { recursive: true, force: true }); }
});

test('Codex invocation is bounded, ephemeral, sandboxed, offline, and non-main', () => {
  const invocation = buildCodexInvocation({ codexPath: 'codex.cmd', worktreePath: 'C:\\task', outputPath: 'C:\\state\\last.txt' });
  assert.equal(invocation.timeout_ms, 30 * 60 * 1000);
  assert.equal(invocation.max_model_runs, 1);
  assert.equal(invocation.max_automatic_retries, 0);
  assert.equal(invocation.direct_main_push, false);
  assert.ok(invocation.args.includes('--ephemeral'));
  assert.ok(invocation.args.includes('workspace-write'));
  assert.ok(invocation.args.includes('sandbox_workspace_write.network_access=false'));
  assert.ok(invocation.args.includes('web_search="disabled"'));
});

test('Codex child environment contains no controller or OpenAI credential variables', () => {
  const child = buildRestrictedCodexEnv({
    PATH: 'safe',
    GH_TOKEN: 'secret',
    GITHUB_TOKEN: 'secret',
    OPENAI_API_KEY: 'secret',
    CODEX_API_KEY: 'secret',
    GSO_GITHUB_BROKER_TOKEN: 'secret',
  });
  assert.equal(child.PATH, 'safe');
  assert.equal(child.GH_TOKEN, undefined);
  assert.equal(child.GITHUB_TOKEN, undefined);
  assert.equal(child.OPENAI_API_KEY, undefined);
  assert.equal(child.CODEX_API_KEY, undefined);
  assert.equal(child.GIT_TERMINAL_PROMPT, '0');
});

test('post-run secret scan blocks exact controller secret and token patterns', () => {
  const repoRoot = tempState();
  try {
    const path = 'evidence.md';
    const secret = 'controller-secret-value-without-standard-prefix';
    writeFileSync(join(repoRoot, path), `unsafe ${secret}\n`);
    const exact = scanForSecrets({ repoRoot, paths: [path], exactSecrets: [secret] });
    assert.equal(exact.passed, false);
    assert.equal(exact.findings[0].reason.startsWith('EXACT_CONTROLLER_SECRET:'), true);
    writeFileSync(join(repoRoot, path), 'ghp_abcdefghijklmnopqrstuvwxyz123456\n');
    assert.equal(scanForSecrets({ repoRoot, paths: [path] }).passed, false);
  } finally { rmSync(repoRoot, { recursive: true, force: true }); }
});

test('writeback state comments round-trip run and lease evidence', () => {
  const body = formatStateComment({ state: 'RUNNING', runId: 'run-21', leaseId: 'lease-21', evidence: { codex_thread_id: 'thread-21' } });
  const parsed = parseStateComment(body);
  assert.equal(parsed.state, 'RUNNING');
  assert.equal(parsed.run_id, 'run-21');
  assert.equal(parsed.lease_id, 'lease-21');
});

test('latest controller state prevents a completed READY-body Issue from being reclaimed', () => {
  const running = formatStateComment({ state: 'RUNNING', runId: 'run-21', leaseId: 'lease-21', evidence: { codex_thread_id: 'thread-21' } });
  const pass = formatStateComment({ state: 'PASS', runId: 'run-21', leaseId: 'lease-21', evidence: { gate_run_id: 123 } });
  const state = evaluateExecutorIssueState(
    { state: 'open', body: '## Status\n\n`READY`' },
    [
      { body: running, created_at: '2026-10-10T15:00:00Z' },
      { body: pass, created_at: '2026-10-10T15:30:00Z' },
    ],
  );
  assert.equal(state.effective_state, 'PASS');
  assert.equal(state.controller_state_evidence, true);
});

test('network failure does not retry or advance to RUNNING', () => {
  const stateDir = tempState();
  try {
    const result = simulateExecution({ stateDir, identity: identity('network'), outcome: 'network-failure', changed: policy.allowed, policy });
    assert.equal(result.state, 'CLAIMED');
    assert.equal(result.recovery_required, true);
    assert.equal(result.automatic_retries, 0);
  } finally { rmSync(stateDir, { recursive: true, force: true }); }
});

test('Codex failure and timeout cannot become PASS and never retry', () => {
  for (const outcome of ['codex-failure', 'timeout']) {
    const stateDir = tempState();
    try {
      const result = simulateExecution({ stateDir, identity: identity(outcome), outcome, changed: policy.allowed, policy });
      assert.equal(result.state, 'FAILED');
      assert.equal(result.model_runs, 1);
      assert.equal(result.automatic_retries, 0);
    } finally { rmSync(stateDir, { recursive: true, force: true }); }
  }
});

test('forbidden file modification is blocked before PR creation', () => {
  const stateDir = tempState();
  try {
    const result = simulateExecution({ stateDir, identity: identity('forbidden'), outcome: 'forbidden-change', changed: ['src/App.jsx'], policy });
    assert.equal(result.state, 'BLOCKED');
    assert.equal(result.pathCheck.ok, false);
  } finally { rmSync(stateDir, { recursive: true, force: true }); }
});

test('Gate failure never auto-merges and requires a fix', () => {
  const stateDir = tempState();
  try {
    const result = simulateExecution({ stateDir, identity: identity('gate'), outcome: 'gate-failure', changed: policy.allowed, policy });
    assert.equal(result.state, 'FIX_REQUIRED');
    assert.equal(result.auto_merge, false);
  } finally { rmSync(stateDir, { recursive: true, force: true }); }
});

test('successful simulation needs allowed path and all bounded limits', () => {
  const stateDir = tempState();
  try {
    const result = simulateExecution({ stateDir, identity: identity('success'), changed: policy.allowed, policy });
    const journal = JSON.parse(readFileSync(result.journalPath, 'utf8'));
    assert.equal(result.state, 'PASS');
    assert.equal(journal.model_runs, 1);
    assert.equal(journal.automatic_retries, 0);
    assert.equal(journal.history.at(-1).evidence.mandatory_artifacts, 5);
  } finally { rmSync(stateDir, { recursive: true, force: true }); }
});

test('a second model run is rejected', () => {
  const stateDir = tempState();
  try {
    const lease = acquireExecutionLease(stateDir, 'lease-limit', 'run-limit');
    recordModelRun(lease.journalPath);
    assert.throws(() => recordModelRun(lease.journalPath), /MODEL_RUN_LIMIT_EXCEEDED/);
  } finally { rmSync(stateDir, { recursive: true, force: true }); }
});

test('real execution requires a fresh one-time authorization envelope', () => {
  const context = { issueNumber: 21, manifestHash: 'abc' };
  assert.equal(validateAuthorizationEnvelope(null, context).valid, false);
  assert.equal(validateAuthorizationEnvelope({
    issue_number: 21,
    manifest_sha256: 'abc',
    max_model_runs: 1,
    max_automatic_retries: 0,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  }, context).valid, true);
});

test('controller-only dev-status update records PR evidence without authorizing auto-merge', () => {
  const updated = applyExecutorDevStatus({
    auto_loop: { ready_queue: ['WRC-P2-U01', 'WRC-P2-U02'] },
    completed: [],
    in_progress: [{ id: 'WRC-P2-U01' }],
    todo: [{ id: 'WRC-P2-U01' }],
  }, {
    now: '2026-10-10T15:00:00.000Z',
    issueNumber: 21,
    pr: { number: 30, html_url: 'https://github.com/example/repo/pull/30', base: { repo: { full_name: 'example/repo' } } },
    headSha: 'abc123',
    gate: { run_id: 123, html_url: 'https://github.com/example/repo/actions/runs/123' },
  });
  assert.equal(updated.completed.at(-1).id, 'WRC-P2-U01');
  assert.deepEqual(updated.auto_loop.ready_queue, ['WRC-P2-U02']);
  assert.equal(updated.next_action.requires_work_session_start, false);
  assert.equal(updated.next_action.pr_number, 30);
  assert.match(updated.next_action.instruction, /Review/);
});
