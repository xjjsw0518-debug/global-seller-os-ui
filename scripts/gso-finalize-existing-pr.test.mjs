import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { applyControllerDevStatus } from './gso-controller-recovery-shared.mjs';
import {
  applyFinalizeExistingPr,
  buildFinalizeExistingPrPlan,
  sha256,
  validateFinalizeContract,
  validateRecoveryAuthorization,
} from './gso-finalize-existing-pr.mjs';

const artifactPath = 'docs/evidence/task-acceptance.md';
const statusPath = 'public/dev-status.json';

function git(repo, ...args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', windowsHide: true }).trim();
}

function gitBytes(repo, ...args) {
  return execFileSync('git', ['-C', repo, ...args], { windowsHide: true });
}

function atomicJson(path, value) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function mandatoryArtifacts(runId = 123) {
  return [
    'knip-unused-', 'dependency-cruiser-', 'playwright-smoke-', 'axe-accessibility-', 'backstop-visual-',
  ].map((prefix) => ({ name: `${prefix}${runId}`, expired: false }));
}

class MockBroker {
  constructor(fixture) {
    this.fixture = fixture;
    this.prHead = fixture.artifactCommit;
    this.prBase = 'main';
    this.prState = 'open';
    this.prMerged = false;
    this.files = [{ filename: artifactPath, status: 'added' }];
    this.preliminaryArtifacts = mandatoryArtifacts();
    this.finalGate = { run_id: 456, head_sha: null, conclusion: 'success', artifacts: mandatoryArtifacts(456) };
    this.writes = [];
    this.gateWaits = 0;
    this.failWriteOnce = false;
  }
  async readPullRequest() {
    return {
      number: 36, state: this.prState, merged: this.prMerged,
      mergeable: true, mergeable_state: 'clean',
      head: { sha: this.prHead, ref: 'codex/test-attempt' },
      base: { ref: this.prBase },
    };
  }
  async readPullFiles() { return this.files; }
  async readFileBytes(path, ref) { return gitBytes(this.fixture.taskWorktree, 'show', `${ref}:${path}`); }
  async readGateRun() { return { id: 123, head_sha: this.fixture.artifactCommit, status: 'completed', conclusion: 'success' }; }
  async readGateArtifacts() { return this.preliminaryArtifacts; }
  async onPush(commitSha) {
    this.prHead = commitSha;
    this.files = [{ filename: artifactPath, status: 'added' }, { filename: statusPath, status: 'modified' }];
  }
  async waitForExactHeadGate(headSha) {
    this.gateWaits += 1;
    if (this.finalGate instanceof Error) throw this.finalGate;
    return { ...this.finalGate, head_sha: this.finalGate.head_sha || headSha };
  }
  async writeRecoveryState(payload) {
    if (this.failWriteOnce) {
      this.failWriteOnce = false;
      throw new Error('SIMULATED_GITHUB_WRITE_FAILURE');
    }
    this.writes.push(payload);
    return { comment_id: this.writes.length };
  }
}

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'gso-finalize-existing-pr-'));
  const remote = join(root, 'remote.git');
  const seed = join(root, 'seed');
  const controllerRepo = join(root, 'controller');
  const stateDir = join(root, 'state');
  const taskWorktree = join(stateDir, 'worktrees', 'task-attempt');
  mkdirSync(stateDir, { recursive: true });
  git(root, 'init', '--bare', remote);
  mkdirSync(seed);
  git(seed, 'init', '--initial-branch=main');
  git(seed, 'config', 'user.name', 'GSO Test');
  git(seed, 'config', 'user.email', 'gso-test@users.noreply.github.com');
  mkdirSync(join(seed, 'public'), { recursive: true });
  mkdirSync(join(seed, 'docs', 'evidence'), { recursive: true });
  const initialStatus = {
    overall_status: 'ACTIVE', current_step: 'Task blocked',
    auto_loop: { status: 'BLOCKED', ready_queue: ['TASK-01', 'TASK-02'] },
    completed: [], in_progress: [], todo: [{ id: 'TASK-01' }],
  };
  writeFileSync(join(seed, statusPath), `${JSON.stringify(initialStatus, null, 2)}\n`);
  writeFileSync(join(seed, 'README.md'), 'fixture\n');
  git(seed, 'add', '.');
  git(seed, 'commit', '-m', 'base');
  const baseSha = git(seed, 'rev-parse', 'HEAD');
  git(seed, 'remote', 'add', 'origin', remote);
  git(seed, 'push', '-u', 'origin', 'main');
  execFileSync('git', ['-c', 'core.autocrlf=true', 'clone', '-b', 'main', remote, controllerRepo], { windowsHide: true });
  git(controllerRepo, 'config', 'user.name', 'GSO Test');
  git(controllerRepo, 'config', 'user.email', 'gso-test@users.noreply.github.com');
  assert.match(readFileSync(join(controllerRepo, 'README.md'), 'utf8'), /\r\n/);
  mkdirSync(join(stateDir, 'worktrees'), { recursive: true });
  git(controllerRepo, 'worktree', 'add', '-b', 'codex/test-attempt', taskWorktree, baseSha);
  mkdirSync(join(taskWorktree, 'docs', 'evidence'), { recursive: true });
  writeFileSync(join(taskWorktree, artifactPath), '# Accepted recovery evidence\n');
  git(taskWorktree, 'add', artifactPath);
  git(taskWorktree, 'commit', '-m', 'model artifact');
  const artifactCommit = git(taskWorktree, 'rev-parse', 'HEAD');
  git(taskWorktree, 'push', '-u', 'origin', 'codex/test-attempt');
  const artifactSha = sha256(gitBytes(taskWorktree, 'show', `HEAD:${artifactPath}`));
  const updatedStatus = applyControllerDevStatus(initialStatus, {
    now: '2026-10-11T00:00:00.000Z', repository: 'example/repo', issueNumber: 21,
    taskId: 'TASK-01', taskName: 'Generic recovery fixture', owner: 'GSO Recovery Controller',
    nextActionInstruction: 'Review the bounded artifact and controller status after the exact-head Gate.',
    pr: { number: 36, html_url: 'https://github.com/example/repo/pull/36' },
    headSha: artifactCommit,
    gate: { run_id: 123, html_url: 'https://github.com/example/repo/actions/runs/123' },
  });
  writeFileSync(join(taskWorktree, statusPath), `${JSON.stringify(updatedStatus, null, 2)}\n`);
  const statusSha = sha256(readFileSync(join(taskWorktree, statusPath)));

  const historical = {
    run_id: 'gso-21-original-run', lease_id: 'original-lease-0000000000000001',
    authorization_id: 'original-authorization-0000001', state: 'BLOCKED',
  };
  const journalPath = join(stateDir, 'leases', historical.lease_id, 'journal.json');
  const receiptPath = join(stateDir, 'authorizations', 'consumed', historical.authorization_id, 'receipt.json');
  atomicJson(journalPath, { schema_version: 1, run_id: historical.run_id, lease_id: historical.lease_id, state: 'BLOCKED', model_runs: 1 });
  atomicJson(receiptPath, { schema_version: 1, authorization_id: historical.authorization_id, run_id: historical.run_id, lease_id: historical.lease_id, model_call_started: true });
  const contract = {
    schema_version: 1,
    mode: 'FINALIZE_EXISTING_PR_CONTROLLER_ONLY',
    repository: 'example/repo', issue_number: 21, pr_number: 36,
    pr_url: 'https://github.com/example/repo/pull/36',
    reviewed_main_sha: baseSha, original_base_sha: baseSha,
    expected_pr_head_sha: artifactCommit, pr_branch: 'codex/test-attempt', pr_base: 'main',
    model_artifacts: [{ path: artifactPath, sha256: artifactSha }],
    preliminary_gate: { run_id: 123, head_sha: artifactCommit, html_url: 'https://github.com/example/repo/actions/runs/123' },
    historical: {
      ...historical,
      journal_sha256: sha256(readFileSync(journalPath)),
      receipt_sha256: sha256(readFileSync(receiptPath)),
    },
    worktree_relative_path: 'worktrees/task-attempt',
    controller_status: { path: statusPath, sha256: statusSha },
    task: {
      id: 'TASK-01', name: 'Generic recovery fixture', owner: 'GSO Recovery Controller',
      next_action_instruction: 'Review the bounded artifact and controller status after the exact-head Gate.',
    },
  };
  const contractPath = join(root, 'contract.json');
  atomicJson(contractPath, contract);
  const fixture = {
    root, remote, seed, controllerRepo, stateDir, taskWorktree, baseSha, artifactCommit,
    artifactSha, statusSha, historical, journalPath, receiptPath, contract, contractPath,
  };
  fixture.broker = new MockBroker(fixture);
  fixture.oldJournal = readFileSync(journalPath);
  fixture.oldReceipt = readFileSync(receiptPath);
  return fixture;
}

function cleanup(fixture) {
  if (!fixture?.root || !existsSync(fixture.root)) return;
  // Remove only the dedicated mkdtemp fixture root after verifying its prefix.
  assert.match(fixture.root, /gso-finalize-existing-pr-/);
  rmSync(fixture.root, { recursive: true, force: true });
}

function authorization(fixture, overrides = {}) {
  const contractBytes = readFileSync(fixture.contractPath);
  return {
    kind: 'GSO_CONTROLLER_ONLY_RECOVERY_V1',
    authorization_id: 'recovery-authorization-0000001',
    repository: fixture.contract.repository,
    issue_number: fixture.contract.issue_number,
    pr_number: fixture.contract.pr_number,
    contract_sha256: sha256(contractBytes),
    approved_main_sha: fixture.contract.reviewed_main_sha,
    expected_pr_head_sha: fixture.contract.expected_pr_head_sha,
    artifact_set_sha256: sha256(JSON.stringify(fixture.contract.model_artifacts)),
    preliminary_gate_run_id: fixture.contract.preliminary_gate.run_id,
    controller_status_path: fixture.contract.controller_status.path,
    controller_status_sha256: fixture.contract.controller_status.sha256,
    max_apply_runs: 1,
    model_calls_allowed: 0,
    auto_merge_allowed: false,
    issued_at: new Date(Date.now() - 1_000).toISOString(),
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

async function expectPlanFailure(mutator, pattern) {
  const fixture = makeFixture();
  try {
    await mutator(fixture);
    await assert.rejects(() => buildFinalizeExistingPrPlan({
      repoRoot: fixture.controllerRepo, stateDir: fixture.stateDir,
      contractPath: fixture.contractPath, broker: fixture.broker, fetchMain: false,
    }), pattern);
  } finally { cleanup(fixture); }
}

test('PLAN verifies exact immutable bindings and performs no writes', async () => {
  const fixture = makeFixture();
  try {
    const plan = await buildFinalizeExistingPrPlan({
      repoRoot: fixture.controllerRepo, stateDir: fixture.stateDir,
      contractPath: fixture.contractPath, broker: fixture.broker, fetchMain: false,
    });
    assert.equal(plan.final_state, 'ELIGIBLE_FOR_SEPARATELY_AUTHORIZED_CONTROLLER_ONLY_APPLY');
    assert.deepEqual(plan.checks.worktree.changed_paths, [statusPath]);
    assert.deepEqual(plan.side_effects, {
      model_calls: 0, authorization_writes: 0, commits: 0, pushes: 0,
      github_writes: 0, historical_journal_writes: 0, historical_receipt_writes: 0,
    });
    assert.deepEqual(readFileSync(fixture.journalPath), fixture.oldJournal);
    assert.deepEqual(readFileSync(fixture.receiptPath), fixture.oldReceipt);
    assert.equal(git(fixture.taskWorktree, 'rev-parse', 'HEAD'), fixture.artifactCommit);
  } finally { cleanup(fixture); }
});

test('PLAN rejects wrong reviewed main, PR head/base, extra paths and artifact hash', async (t) => {
  await t.test('main', () => expectPlanFailure(async (f) => { f.contract.reviewed_main_sha = '0'.repeat(40); atomicJson(f.contractPath, f.contract); }, /REVIEWED_MAIN_MISMATCH/));
  await t.test('pr head', () => expectPlanFailure(async (f) => { f.broker.prHead = '1'.repeat(40); }, /PR_BINDING_MISMATCH/));
  await t.test('pr base', () => expectPlanFailure(async (f) => { f.broker.prBase = 'release'; }, /PR_BINDING_MISMATCH/));
  await t.test('merge conflict', () => expectPlanFailure(async (f) => {
    f.broker.readPullRequest = async () => ({
      number: 36, state: 'open', merged: false, mergeable: false, mergeable_state: 'dirty',
      head: { sha: f.artifactCommit, ref: 'codex/test-attempt' }, base: { ref: 'main' },
    });
  }, /PR_NOT_MERGEABLE/));
  await t.test('extra file', () => expectPlanFailure(async (f) => { f.broker.files.push({ filename: 'unexpected/文件 name.txt', status: 'added' }); }, /CHANGED_PATHS_MISMATCH/));
  await t.test('artifact hash', () => expectPlanFailure(async (f) => { f.contract.model_artifacts[0].sha256 = '2'.repeat(64); atomicJson(f.contractPath, f.contract); }, /ARTIFACT_HASH_MISMATCH/));
});

test('PLAN rejects missing or expired preliminary Gate artifacts', async () => {
  await expectPlanFailure(async (f) => { f.broker.preliminaryArtifacts = mandatoryArtifacts().slice(0, 4); }, /ARTIFACTS_MISSING/);
  await expectPlanFailure(async (f) => { f.broker.preliminaryArtifacts[0].expired = true; }, /ARTIFACTS_MISSING/);
});

test('PLAN rejects historical Journal or receipt tampering', async () => {
  await expectPlanFailure(async (f) => { writeFileSync(f.journalPath, '{}\n'); }, /JOURNAL_HASH_MISMATCH/);
  await expectPlanFailure(async (f) => { writeFileSync(f.receiptPath, '{}\n'); }, /RECEIPT_HASH_MISMATCH/);
});

test('PLAN rejects unexpected worktree path, altered status and rename', async () => {
  await expectPlanFailure(async (f) => { writeFileSync(join(f.taskWorktree, 'unexpected.txt'), 'x'); }, /WORKTREE_CHANGED_PATHS_MISMATCH/);
  await expectPlanFailure(async (f) => {
    const value = JSON.parse(readFileSync(join(f.taskWorktree, statusPath), 'utf8'));
    value.current_step = 'forged';
    writeFileSync(join(f.taskWorktree, statusPath), `${JSON.stringify(value, null, 2)}\n`);
  }, /STATUS_CONTENT_MISMATCH/);
  await expectPlanFailure(async (f) => {
    git(f.taskWorktree, 'restore', statusPath);
    git(f.taskWorktree, 'mv', statusPath, 'public/renamed status.json');
  }, /WORKTREE_CHANGED_PATHS_MISMATCH/);
});

test('PLAN rejects Unicode/case collisions, traversal and symlink Git mode', async () => {
  await expectPlanFailure(async (f) => {
    f.broker.files.push({ filename: `${artifactPath.normalize('NFD')}`, status: 'added' });
  }, /(PATH_COLLISION|CHANGED_PATHS_MISMATCH)/);
  const fixture = makeFixture();
  try {
    fixture.contract.controller_status.path = '../public/dev-status.json';
    assert.equal(validateFinalizeContract(fixture.contract).valid, false);
  } finally { cleanup(fixture); }
  await expectPlanFailure(async (f) => {
    git(f.taskWorktree, 'restore', statusPath);
    const target = 'README.md';
    writeFileSync(join(f.taskWorktree, artifactPath), target);
    git(f.taskWorktree, 'add', artifactPath);
    git(f.taskWorktree, 'update-index', '--cacheinfo', '120000', sha256(Buffer.from(target)), artifactPath);
  }, /(WORKTREE_CHANGED_PATHS_MISMATCH|WORKTREE_ARTIFACT_HASH_MISMATCH|RECOVERY_ARTIFACT_(?:NOT_REGULAR_FILE|GIT_MODE_INVALID))/);
});

test('recovery authorization is exact-bound, short-lived, zero-model and non-replayable', () => {
  const fixture = makeFixture();
  try {
    const envelope = authorization(fixture);
    const context = Object.fromEntries(Object.entries(envelope).filter(([key]) => [
      'repository', 'issue_number', 'pr_number', 'contract_sha256', 'approved_main_sha',
      'expected_pr_head_sha', 'artifact_set_sha256', 'preliminary_gate_run_id',
      'controller_status_path', 'controller_status_sha256',
    ].includes(key)));
    assert.equal(validateRecoveryAuthorization(envelope, context).valid, true);
    assert.ok(validateRecoveryAuthorization({ ...envelope, expires_at: new Date(0).toISOString() }, context).errors.includes('RECOVERY_AUTH_EXPIRED'));
    assert.ok(validateRecoveryAuthorization({
      ...envelope,
      issued_at: new Date(Date.now() - 60_000).toISOString(),
      expires_at: new Date(Date.now() + 16 * 60_000).toISOString(),
    }, context).errors.includes('RECOVERY_AUTH_LIFETIME_INVALID'));
    assert.ok(validateRecoveryAuthorization({ ...envelope, model_calls_allowed: 1 }, context).errors.includes('RECOVERY_AUTH_MODEL_BOUNDARY_INVALID'));
    assert.ok(validateRecoveryAuthorization({ ...envelope, expected_pr_head_sha: '0'.repeat(40) }, context).errors.some((item) => item.includes('EXPECTED_PR_HEAD_SHA')));
  } finally { cleanup(fixture); }
});

test('APPLY resumes idempotently after local commit without a second commit or authorization consumption', async () => {
  const fixture = makeFixture();
  try {
    const envelope = authorization(fixture);
    await assert.rejects(() => applyFinalizeExistingPr({
      repoRoot: fixture.controllerRepo, stateDir: fixture.stateDir, contractPath: fixture.contractPath,
      authorizationEnvelope: envelope, broker: fixture.broker, fetchMain: false, crashAt: 'AFTER_LOCAL_COMMIT',
    }), /SIMULATED_PROCESS_CRASH_AFTER_LOCAL_COMMIT/);
    const localCommit = git(fixture.taskWorktree, 'rev-parse', 'HEAD');
    assert.notEqual(localCommit, fixture.artifactCommit);
    assert.equal(git(fixture.taskWorktree, 'rev-list', '--count', `${fixture.artifactCommit}..HEAD`), '1');
    const result = await applyFinalizeExistingPr({
      repoRoot: fixture.controllerRepo, stateDir: fixture.stateDir, contractPath: fixture.contractPath,
      authorizationEnvelope: envelope, broker: fixture.broker, fetchMain: false,
    });
    assert.equal(result.final_state, 'PR_REVIEW_REQUIRED');
    assert.equal(result.authorization_resumed, true);
    assert.equal(result.model_calls, 0);
    assert.equal(git(fixture.taskWorktree, 'rev-list', '--count', `${fixture.artifactCommit}..HEAD`), '1');
    assert.deepEqual(readFileSync(fixture.journalPath), fixture.oldJournal);
    assert.deepEqual(readFileSync(fixture.receiptPath), fixture.oldReceipt);
  } finally { cleanup(fixture); }
});

test('APPLY resumes after remote push and rejects replay after terminal completion', async () => {
  const fixture = makeFixture();
  try {
    const envelope = authorization(fixture, { authorization_id: 'recovery-authorization-0000002' });
    await assert.rejects(() => applyFinalizeExistingPr({
      repoRoot: fixture.controllerRepo, stateDir: fixture.stateDir, contractPath: fixture.contractPath,
      authorizationEnvelope: envelope, broker: fixture.broker, fetchMain: false, crashAt: 'AFTER_REMOTE_PUSH',
    }), /SIMULATED_PROCESS_CRASH_AFTER_REMOTE_PUSH/);
    const result = await applyFinalizeExistingPr({
      repoRoot: fixture.controllerRepo, stateDir: fixture.stateDir, contractPath: fixture.contractPath,
      authorizationEnvelope: envelope, broker: fixture.broker, fetchMain: false,
    });
    assert.equal(result.final_state, 'PR_REVIEW_REQUIRED');
    await assert.rejects(() => applyFinalizeExistingPr({
      repoRoot: fixture.controllerRepo, stateDir: fixture.stateDir, contractPath: fixture.contractPath,
      authorizationEnvelope: envelope, broker: fixture.broker, fetchMain: false,
    }), /AUTH_ALREADY_TERMINAL/);
  } finally { cleanup(fixture); }
});

test('APPLY rejects occupied lock and remote divergence', async () => {
  const fixture = makeFixture();
  try {
    const envelope = authorization(fixture, { authorization_id: 'recovery-authorization-0000003' });
    const authorizationLockId = sha256(envelope.authorization_id).slice(0, 32);
    mkdirSync(join(fixture.stateDir, 'recovery', 'finalize-existing-pr', 'locks', `authorization-${authorizationLockId}.lock`), { recursive: true });
    await assert.rejects(() => applyFinalizeExistingPr({
      repoRoot: fixture.controllerRepo, stateDir: fixture.stateDir, contractPath: fixture.contractPath,
      authorizationEnvelope: envelope, broker: fixture.broker, fetchMain: false,
    }), /RECOVERY_LOCK_BUSY/);
  } finally { cleanup(fixture); }

  const diverged = makeFixture();
  try {
    const envelope = authorization(diverged, { authorization_id: 'recovery-authorization-0000004' });
    git(diverged.seed, 'checkout', '-b', 'other', diverged.baseSha);
    writeFileSync(join(diverged.seed, 'other.txt'), 'diverged\n');
    git(diverged.seed, 'add', 'other.txt');
    git(diverged.seed, 'commit', '-m', 'diverge');
    git(diverged.seed, 'push', 'origin', 'HEAD:codex/test-attempt', '--force');
    await assert.rejects(() => applyFinalizeExistingPr({
      repoRoot: diverged.controllerRepo, stateDir: diverged.stateDir, contractPath: diverged.contractPath,
      authorizationEnvelope: envelope, broker: diverged.broker, fetchMain: false,
    }), /REMOTE_BRANCH_DIVERGED/);
  } finally { cleanup(diverged); }
});

test('APPLY resumes an already-consumed authorization after expiry and GitHub writeback interruption', async () => {
  const fixture = makeFixture();
  try {
    const envelope = authorization(fixture, {
      authorization_id: 'recovery-authorization-writeback-0001',
      issued_at: new Date(Date.now() - 500).toISOString(),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    fixture.broker.failWriteOnce = true;
    await assert.rejects(() => applyFinalizeExistingPr({
      repoRoot: fixture.controllerRepo, stateDir: fixture.stateDir, contractPath: fixture.contractPath,
      authorizationEnvelope: envelope, broker: fixture.broker, fetchMain: false,
    }), /RECOVERY_WRITEBACK_PENDING/);
    const result = await applyFinalizeExistingPr({
      repoRoot: fixture.controllerRepo, stateDir: fixture.stateDir, contractPath: fixture.contractPath,
      authorizationEnvelope: envelope, broker: fixture.broker, fetchMain: false,
      authorizationNow: Date.parse(envelope.expires_at) + 1,
    });
    assert.equal(result.final_state, 'PR_REVIEW_REQUIRED');
    assert.equal(result.authorization_resumed, true);
    assert.equal(fixture.broker.gateWaits, 1);
    assert.equal(fixture.broker.writes.length, 1);
    assert.deepEqual(readFileSync(fixture.journalPath), fixture.oldJournal);
    assert.deepEqual(readFileSync(fixture.receiptPath), fixture.oldReceipt);
  } finally { cleanup(fixture); }
});

test('APPLY records factual final Gate failure and timeout without altering old evidence', async () => {
  for (const outcome of ['failure', 'timeout']) {
    const fixture = makeFixture();
    try {
      const envelope = authorization(fixture, { authorization_id: `recovery-authorization-${outcome}-00001` });
      fixture.broker.finalGate = outcome === 'timeout'
        ? new Error('RECOVERY_FINAL_GATE_TIMEOUT')
        : { run_id: 456, head_sha: null, conclusion: 'failure', artifacts: mandatoryArtifacts(456) };
      const result = await applyFinalizeExistingPr({
        repoRoot: fixture.controllerRepo, stateDir: fixture.stateDir, contractPath: fixture.contractPath,
        authorizationEnvelope: envelope, broker: fixture.broker, fetchMain: false,
      });
      assert.equal(result.final_state, 'RECOVERY_FAILED');
      assert.equal(result.model_calls, 0);
      assert.deepEqual(readFileSync(fixture.journalPath), fixture.oldJournal);
      assert.deepEqual(readFileSync(fixture.receiptPath), fixture.oldReceipt);
    } finally { cleanup(fixture); }
  }
});

test('recovery entrypoint has no Codex/model execution dependency', () => {
  const source = readFileSync(new URL('./gso-finalize-existing-pr.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /executeAuthorizedIssue|runCodexProcess|OPENAI_API_KEY|codex\s+exec/i);
});
