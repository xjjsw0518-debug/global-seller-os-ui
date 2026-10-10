import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

import {
  applyExecutorDevStatus, acquireExecutionLease, acquireExecutorLock,
  assertManifestMode, assertStateDirOutsideRepository, buildCodexInvocation,
  buildCodexPromptWithAttestation, buildControllerAdmissionAttestation,
  buildRestrictedCodexEnv, classifyPolicyDenial, consumeAuthorization, createRunIdentity,
  defaultStateDir, evaluateExecutorIssueState, finalizeMergedRun,
  formatStateComment, parseStateComment, recordModelRun, releaseExecutorLock,
  redactAuditText, runCodexProcess, scanForSecrets, sha256, simulateExecution, transitionJournal,
  validateAuthorizationEnvelope, verifyControllerAdmissionAttestation,
  verifyReviewedExecutionSources,
} from './gso-windows-auto-executor.mjs';

const policy = {
  allowed: ['docs/evidence/WRC_P2_U01_WORKER_HOME_REAL_READ_ACCEPTANCE.md'],
  forbidden: ['src/**', '.github/workflows/**', 'backstop_data/**'],
};
function tempState() { return mkdtempSync(join(tmpdir(), 'gso-step-c-')); }
function identity(suffix = 'one') { return { runId: `run-${suffix}`, leaseId: `lease-${suffix}` }; }
function git(cwd, ...args) {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}
function authorization(overrides = {}) {
  return {
    authorization_id: 'auth-20261010-issue21-0001', issue_number: 21,
    manifest_sha256: 'manifest-hash', prompt_sha256: 'prompt-hash',
    executor_sha256: 'executor-hash', approved_base_sha: 'base-sha',
    max_model_runs: 1, max_automatic_retries: 0,
    expires_at: new Date(Date.now() + 60_000).toISOString(), ...overrides,
  };
}
const authorizationContext = {
  issueNumber: 21, manifestHash: 'manifest-hash', promptHash: 'prompt-hash',
  executorHash: 'executor-hash', baseSha: 'base-sha',
};

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
  } finally { rmSync(stateDir, { recursive: true, force: true }); }
});

test('lease identity binds immutable authorization ID', () => {
  const base = { repository: 'example/repo', issueNumber: 21, baseSha: 'abc', manifestHash: 'manifest', issueRevision: 'body' };
  assert.equal(createRunIdentity({ ...base, authorizationId: 'auth-a' }).leaseId, createRunIdentity({ ...base, authorizationId: 'auth-a' }).leaseId);
  assert.notEqual(createRunIdentity({ ...base, authorizationId: 'auth-a' }).leaseId, createRunIdentity({ ...base, authorizationId: 'auth-b' }).leaseId);
});

test('RUNNING requires real run, lease, and Codex thread evidence', () => {
  const stateDir = tempState();
  try {
    const lease = acquireExecutionLease(stateDir, 'lease-running', 'run-running');
    transitionJournal(lease.journalPath, 'CLAIMED', {});
    assert.throws(() => transitionJournal(lease.journalPath, 'RUNNING', { run_id: 'run-running', lease_id: 'lease-running' }), /RUNNING_REQUIRES/);
  } finally { rmSync(stateDir, { recursive: true, force: true }); }
});

test('PASS requires merged PR and successful main Gate, not a PR Gate', () => {
  const stateDir = tempState();
  try {
    const lease = acquireExecutionLease(stateDir, 'lease-pass', 'run-pass');
    transitionJournal(lease.journalPath, 'CLAIMED', {});
    transitionJournal(lease.journalPath, 'RUNNING', { run_id: 'run-pass', lease_id: 'lease-pass', codex_thread_id: 'thread-1' });
    transitionJournal(lease.journalPath, 'PR_CREATED', { pr_number: 1 });
    transitionJournal(lease.journalPath, 'TESTING', { gate_run_id: 2 });
    transitionJournal(lease.journalPath, 'FINAL_GATE_PENDING', { gate_run_id: 2 });
    transitionJournal(lease.journalPath, 'PR_REVIEW_REQUIRED', { gate_run_id: 3 });
    assert.throws(() => finalizeMergedRun(lease.journalPath, { gate_run_id: 3, gate_conclusion: 'success' }), /PASS_REQUIRES_MERGED_PR/);
    assert.equal(finalizeMergedRun(lease.journalPath, {
      pr_merged: true, merge_commit_sha: 'merge-sha', main_gate_run_id: 4, main_gate_conclusion: 'success',
    }).state, 'PASS');
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

test('Codex child environment contains no controller or OpenAI credentials', () => {
  const child = buildRestrictedCodexEnv({ PATH: 'safe', GH_TOKEN: 'secret', GITHUB_TOKEN: 'secret', OPENAI_API_KEY: 'secret', CODEX_API_KEY: 'secret', GSO_GITHUB_BROKER_TOKEN: 'secret' });
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
    assert.equal(scanForSecrets({ repoRoot, paths: [path], exactSecrets: [secret] }).passed, false);
    writeFileSync(join(repoRoot, path), 'ghp_abcdefghijklmnopqrstuvwxyz123456\n');
    assert.equal(scanForSecrets({ repoRoot, paths: [path] }).passed, false);
  } finally { rmSync(repoRoot, { recursive: true, force: true }); }
});

test('authenticated state comment requires trusted author and matching local lineage', () => {
  const stateDir = tempState();
  try {
    const lease = acquireExecutionLease(stateDir, 'lease-21', 'run-21');
    transitionJournal(lease.journalPath, 'CLAIMED', {});
    transitionJournal(lease.journalPath, 'RUNNING', { run_id: 'run-21', lease_id: 'lease-21', codex_thread_id: 'thread-21' });
    const body = formatStateComment({ repository: 'example/repo', issueNumber: 21, state: 'RUNNING', runId: 'run-21', leaseId: 'lease-21' });
    assert.equal(parseStateComment(body).repository, 'example/repo');
    const options = { repository: 'example/repo', issueNumber: 21, trustedLogin: 'controller', stateDir };
    const issue = { state: 'open', body: '## Status\n\n`READY`' };
    const trusted = evaluateExecutorIssueState(issue, [{ body, created_at: '2026-10-10T15:00:00Z', user: { login: 'controller' } }], options);
    assert.equal(trusted.effective_state, 'RUNNING');
    const forged = evaluateExecutorIssueState(issue, [{ body, created_at: '2026-10-10T15:00:00Z', user: { login: 'attacker' } }], options);
    assert.equal(forged.effective_state, 'BLOCKED');
    assert.equal(forged.controller_state_evidence_error, 'UNTRUSTED_OR_UNVERIFIED_STATE_COMMENT');
  } finally { rmSync(stateDir, { recursive: true, force: true }); }
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
      assert.equal(result.automatic_retries, 0);
    } finally { rmSync(stateDir, { recursive: true, force: true }); }
  }
});

test('forbidden modification is blocked before PR creation', () => {
  const stateDir = tempState();
  try {
    assert.equal(simulateExecution({ stateDir, identity: identity('forbidden'), outcome: 'forbidden-change', changed: ['src/App.jsx'], policy }).state, 'BLOCKED');
  } finally { rmSync(stateDir, { recursive: true, force: true }); }
});

test('either PR Gate failure prevents PASS and auto-merge', () => {
  for (const outcome of ['gate-failure', 'final-gate-failure']) {
    const stateDir = tempState();
    try {
      const result = simulateExecution({ stateDir, identity: identity(outcome), outcome, changed: policy.allowed, policy });
      assert.equal(result.state, 'FIX_REQUIRED');
      assert.equal(result.auto_merge, false);
    } finally { rmSync(stateDir, { recursive: true, force: true }); }
  }
});

test('successful PR Gate simulation stops at PR_REVIEW_REQUIRED', () => {
  const stateDir = tempState();
  try {
    const result = simulateExecution({ stateDir, identity: identity('success'), changed: policy.allowed, policy });
    const journal = JSON.parse(readFileSync(result.journalPath, 'utf8'));
    assert.equal(result.state, 'PR_REVIEW_REQUIRED');
    assert.equal(journal.model_runs, 1);
    assert.equal(result.auto_merge, false);
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

test('one-time authorization binds Issue, manifest, prompt, executor, base, ID and expiry', () => {
  assert.equal(validateAuthorizationEnvelope(null, authorizationContext).valid, false);
  assert.equal(validateAuthorizationEnvelope(authorization(), authorizationContext).valid, true);
  assert.ok(validateAuthorizationEnvelope(authorization({ approved_base_sha: 'new-main' }), authorizationContext).errors.includes('AUTHORIZATION_BASE_MISMATCH'));
  assert.ok(validateAuthorizationEnvelope(authorization({ prompt_sha256: 'other' }), authorizationContext).errors.includes('AUTHORIZATION_PROMPT_MISMATCH'));
});

test('authorization is atomically consumed once and remains blocked after restart', () => {
  const stateDir = tempState();
  try {
    const first = consumeAuthorization(stateDir, authorization(), authorizationContext);
    assert.equal(first.receipt.authorization_id, 'auth-20261010-issue21-0001');
    assert.throws(() => consumeAuthorization(stateDir, authorization(), authorizationContext), /AUTHORIZATION_ALREADY_CONSUMED/);
    assert.equal(JSON.parse(readFileSync(join(first.receiptDir, 'receipt.json'), 'utf8')).approved_base_sha, 'base-sha');
  } finally { rmSync(stateDir, { recursive: true, force: true }); }
});

test('DRY_RUN and EXECUTE manifests are not interchangeable', () => {
  assert.doesNotThrow(() => assertManifestMode({ mode: 'DRY_RUN_NO_MODEL_NO_GITHUB_WRITE' }, 'DRY_RUN_NO_MODEL_NO_GITHUB_WRITE'));
  assert.throws(() => assertManifestMode({ mode: 'DRY_RUN_NO_MODEL_NO_GITHUB_WRITE' }, 'EXECUTE_ONE_AUTHORIZED_ISSUE'), /EXECUTE_REQUIRES/);
  assert.throws(() => assertManifestMode({ mode: 'EXECUTE_ONE_AUTHORIZED_ISSUE' }, 'DRY_RUN_NO_MODEL_NO_GITHUB_WRITE'), /DRY_RUN_REQUIRES/);
});

test('executor state defaults outside repository and repository-local state is rejected', () => {
  const parent = tempState();
  const repoRoot = resolve(parent, 'repo');
  const appData = tempState();
  mkdirSync(repoRoot, { recursive: true });
  try {
    assert.doesNotThrow(() => assertStateDirOutsideRepository(repoRoot, defaultStateDir(repoRoot, { LOCALAPPDATA: appData })));
    assert.throws(() => assertStateDirOutsideRepository(repoRoot, join(repoRoot, '.gso-auto-executor-state')), /MUST_BE_OUTSIDE/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
    rmSync(appData, { recursive: true, force: true });
  }
});

test('reviewed executor must be exact clean origin/main content', () => {
  const repoRoot = tempState();
  try {
    git(repoRoot, 'init', '-b', 'main');
    git(repoRoot, 'config', 'user.email', 'test@example.invalid');
    git(repoRoot, 'config', 'user.name', 'Test');
    const executorPath = join(repoRoot, 'scripts', 'gso-windows-auto-executor.mjs');
    const manifestPath = join(repoRoot, 'control', 'local-bridge', 'issue-21.execute.manifest.json');
    const promptPath = join(repoRoot, 'control', 'local-bridge', 'issue-21.prompt.md');
    const checklistPath = join(repoRoot, 'control', 'local-bridge', 'issue-21.checklist.md');
    for (const path of [executorPath, manifestPath, promptPath, checklistPath]) mkdirSync(dirname(path), { recursive: true });
    writeFileSync(executorPath, 'reviewed executor\n');
    writeFileSync(promptPath, 'prompt\n');
    writeFileSync(checklistPath, 'checklist\n');
    const manifest = {
      mode: 'EXECUTE_ONE_AUTHORIZED_ISSUE', prompt_path: 'control/local-bridge/issue-21.prompt.md',
      issue_body_path: 'control/local-bridge/issue-21.checklist.md', reviewed_executor_sha256: sha256(readFileSync(executorPath)),
    };
    writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
    git(repoRoot, 'add', '.'); git(repoRoot, 'commit', '-m', 'reviewed');
    git(repoRoot, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    assert.equal(verifyReviewedExecutionSources({ repoRoot, manifestPath, manifest, fetchMain: false, runningExecutorPath: executorPath }).passed, true);
    writeFileSync(executorPath, 'locally replaced executor\n');
    assert.throws(() => verifyReviewedExecutionSources({ repoRoot, manifestPath, manifest, fetchMain: false, runningExecutorPath: executorPath }), /NOT_CLEAN/);
    git(repoRoot, 'add', '.'); git(repoRoot, 'commit', '-m', 'unreviewed local replacement');
    assert.throws(() => verifyReviewedExecutionSources({ repoRoot, manifestPath, manifest, fetchMain: false, runningExecutorPath: executorPath }), /EXACT_REVIEWED_MAIN/);
    git(repoRoot, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    git(repoRoot, 'checkout', '--detach', 'HEAD~1');
    const oldManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.throws(() => verifyReviewedExecutionSources({ repoRoot, manifestPath, manifest: oldManifest, fetchMain: false, runningExecutorPath: executorPath }), /EXACT_REVIEWED_MAIN/);
  } finally { rmSync(repoRoot, { recursive: true, force: true }); }
});

function attestationFixture(repoRoot) {
  mkdirSync(join(repoRoot, 'src'), { recursive: true });
  mkdirSync(join(repoRoot, 'public'), { recursive: true });
  writeFileSync(join(repoRoot, 'src', 'adapter.js'), "const overview = '/overview';\nconst map = '/map-data';\n");
  writeFileSync(join(repoRoot, 'public', 'status.json'), '{"historical":"accepted"}\n');
  const manifest = {
    repository: 'example/repo', issue_number: 21, task_id: 'WRC-P2-U01',
    required_source_state: 'READY',
    issue_execution_policy: { allowed_files: ['docs/evidence/only.md'], forbidden_files: ['src/**'] },
    github_writeback_policy: { controller_only: true },
    controller_evidence_policy: {
      preflight_read_path: 'src/adapter.js',
      source_references: [
        { path: 'src/adapter.js', line_ranges: [[1, 2]] },
        { path: 'public/status.json', line_ranges: [[1, 1]] },
      ],
      accepted_historical_recovery_evidence: [{
        provenance_url: 'https://github.com/example/repo/issues/11#issuecomment-1',
        statuses: { overview: 200, 'map-data': 200, health: 200, ready: 200 },
        business_data_written: false,
      }],
      deferred_observation: {
        'resource-list': 404,
        classification: 'HISTORICAL_DEFERRED_OUTSIDE_CURRENT_HOMEPAGE_READ_CONTRACT',
        current_live_verification: false,
      },
    },
  };
  const context = {
    issueBodyHash: 'issue-hash', manifestHash: 'manifest-hash', promptHash: 'prompt-hash',
    executorHash: 'executor-hash', baseSha: 'base-sha', runId: 'run-id', leaseId: 'lease-id',
    authorizationId: 'authorization-id', issueSourceState: 'READY', admission: { complete: true },
    exactReviewedMain: true, atomicLeaseAcquired: true, isolatedWorktree: true,
    noModelPreflight: { passed: true },
  };
  return { manifest, context };
}

test('controller attestation binds task, source hashes, admission, and historical provenance', () => {
  const repoRoot = tempState();
  try {
    const { manifest, context } = attestationFixture(repoRoot);
    const envelope = buildControllerAdmissionAttestation({ repoRoot, manifest, context });
    const verification = verifyControllerAdmissionAttestation({ envelope, repoRoot, manifest, context });
    assert.equal(verification.passed, true);
    assert.equal(envelope.packet.task.run_id, 'run-id');
    assert.equal(envelope.packet.task.lease_id, 'lease-id');
    assert.equal(envelope.packet.file_policy.allowed_files.length, 1);
    assert.equal(envelope.packet.current_live_verification.performed, false);
    assert.equal(envelope.packet.accepted_historical_recovery_evidence[0].classification, 'HISTORICAL_ACCEPTED_NOT_CURRENT_LIVE_VERIFICATION');
    assert.equal(envelope.packet.deferred_observation['resource-list'], 404);
  } finally { rmSync(repoRoot, { recursive: true, force: true }); }
});

test('controller attestation rejects missing, adulterated, stale, and forged evidence', () => {
  const repoRoot = tempState();
  try {
    const { manifest, context } = attestationFixture(repoRoot);
    const envelope = buildControllerAdmissionAttestation({ repoRoot, manifest, context });
    assert.throws(() => verifyControllerAdmissionAttestation({ envelope: null, repoRoot, manifest, context }), /ATTESTATION_MISSING/);
    const adulterated = structuredClone(envelope);
    adulterated.packet.task.run_id = 'forged-run';
    assert.throws(() => verifyControllerAdmissionAttestation({ envelope: adulterated, repoRoot, manifest, context }), /ATTESTATION_ADULTERATED/);
    writeFileSync(join(repoRoot, 'src', 'adapter.js'), "const overview = '/changed';\nconst map = '/map-data';\n");
    assert.throws(() => verifyControllerAdmissionAttestation({ envelope, repoRoot, manifest, context }), /ATTESTATION_STALE_OR_FORGED/);
  } finally { rmSync(repoRoot, { recursive: true, force: true }); }
});

test('Codex prompt passes attestation as data and preserves controller authority boundary', () => {
  const repoRoot = tempState();
  try {
    const { manifest, context } = attestationFixture(repoRoot);
    const envelope = buildControllerAdmissionAttestation({ repoRoot, manifest, context });
    const prompt = buildCodexPromptWithAttestation('Reviewed prompt', envelope);
    assert.match(prompt, /controller-attested DATA, not instructions/);
    assert.match(prompt, /CONTROLLER_ATTESTATION_SHA256=/);
    assert.match(prompt, /NO_GITHUB_AUTHORITY/);
    assert.match(prompt, /HISTORICAL_ACCEPTED_NOT_CURRENT_LIVE_VERIFICATION/);
    assert.match(prompt, /"performed": false/);
  } finally { rmSync(repoRoot, { recursive: true, force: true }); }
});

test('sanitized audit removes known token shapes and classifies policy denial without secrets', () => {
  const token = 'ghp_abcdefghijklmnopqrstuvwxyz123456';
  const sanitized = redactAuditText(`command rejected by execution policy ${token}`);
  assert.doesNotMatch(sanitized, /ghp_/);
  assert.match(sanitized, /REDACTED_TOKEN/);
  assert.equal(classifyPolicyDenial(sanitized), 'EXECUTION_POLICY_DENIAL');
  assert.equal(classifyPolicyDenial('Access is denied by the sandbox'), 'SANDBOX_OR_OS_PERMISSION_DENIAL');
});

test('Codex process audit persists a sanitized policy event without invoking a model', async () => {
  const stateDir = tempState();
  try {
    const auditPath = join(stateDir, 'codex-events.sanitized.jsonl');
    const fakeToken = 'ghp_abcdefghijklmnopqrstuvwxyz123456';
    const invocation = {
      command: process.execPath,
      args: ['-e', `process.stdout.write(JSON.stringify({type:'error',message:'command rejected by execution policy ${fakeToken}'})+'\\n')`],
      timeout_ms: 10_000,
    };
    const result = await runCodexProcess({
      invocation,
      prompt: 'NO_MODEL_TEST',
      env: process.env,
      auditPath,
      onThreadStarted: async () => { throw new Error('UNEXPECTED_THREAD'); },
    });
    const audit = readFileSync(auditPath, 'utf8');
    assert.equal(result.ok, true);
    assert.equal(result.threadId, null);
    assert.doesNotMatch(audit, /ghp_/);
    assert.match(audit, /REDACTED_TOKEN/);
    assert.match(audit, /EXECUTION_POLICY_DENIAL/);
  } finally { rmSync(stateDir, { recursive: true, force: true }); }
});

test('attestation fails closed when admission or no-model preflight evidence is incomplete', () => {
  const repoRoot = tempState();
  try {
    const { manifest, context } = attestationFixture(repoRoot);
    for (const overrides of [
      { admission: { complete: false } },
      { noModelPreflight: { passed: false } },
      { isolatedWorktree: false },
      { atomicLeaseAcquired: false },
      { exactReviewedMain: false },
      { issueSourceState: 'BLOCKED' },
    ]) {
      const incomplete = { ...context, ...overrides };
      const envelope = buildControllerAdmissionAttestation({ repoRoot, manifest, context: incomplete });
      assert.throws(() => verifyControllerAdmissionAttestation({ envelope, repoRoot, manifest, context: incomplete }), /ATTESTATION_CHECKS_INCOMPLETE/);
    }
  } finally { rmSync(repoRoot, { recursive: true, force: true }); }
});

test('dev-status preserves aggregate status and queue while marking U01 pending final Gate', () => {
  const updated = applyExecutorDevStatus({
    overall_status: 'IN_PROGRESS', auto_loop: { status: 'ON', ready_queue: ['WRC-P2-U01', 'WRC-P2-U02', 'WRC-P2-U03'] },
    completed: [{ id: 'OTHER' }], in_progress: [], todo: [{ id: 'WRC-P2-U01' }],
  }, {
    now: '2026-10-10T15:00:00.000Z', issueNumber: 21,
    pr: { number: 30, html_url: 'https://github.com/example/repo/pull/30', base: { repo: { full_name: 'example/repo' } } },
    headSha: 'abc123', gate: { run_id: 123, html_url: 'https://github.com/example/repo/actions/runs/123' },
  });
  assert.equal(updated.overall_status, 'IN_PROGRESS');
  assert.equal(updated.in_progress.at(-1).status, 'FINAL_GATE_PENDING');
  assert.deepEqual(updated.auto_loop.ready_queue, ['WRC-P2-U02', 'WRC-P2-U03']);
  assert.deepEqual(updated.completed.map((entry) => entry.id), ['OTHER']);
  assert.equal(updated.next_action.pr_number, 30);
});
