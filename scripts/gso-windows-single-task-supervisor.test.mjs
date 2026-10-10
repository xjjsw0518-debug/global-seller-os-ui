import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import test from 'node:test';
import {
  SINGLE_TASK_SUPERVISOR_SCHEMA, validateSupervisorConfig, decideSingleTaskAction,
  acquireSupervisorLock, releaseSupervisorLock, findFreshPendingAuthorizations,
  runOneSupervisorPoll,
} from './gso-windows-single-task-supervisor.mjs';

const manifest = {
  mode: 'EXECUTE_ONE_AUTHORIZED_ISSUE',
  repository: 'example/single-task',
  issue_number: 77,
};
const config = {
  schema: SINGLE_TASK_SUPERVISOR_SCHEMA,
  repository: manifest.repository,
  issue_number: manifest.issue_number,
  manifest_path: 'control/local-bridge/issue-77.execute.manifest.json',
  poll_seconds: 10,
  max_authorized_launches: 1,
  child_timeout_minutes: 180,
};
const authId = 'gh-comment-1234567890-20261011';
const hash = 'a'.repeat(64);
function temp() { return mkdtempSync(join(tmpdir(), 'gso-supervisor-test-')); }
function git(cwd, ...args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(r.stderr || 'git command failed');
  return r.stdout.trim();
}
function fixture() {
  const root = temp(), repoRoot = join(root, 'repo'), stateDir = join(root, 'state');
  mkdirSync(repoRoot);
  mkdirSync(stateDir);
  git(repoRoot, 'init', '-b', 'main');
  git(repoRoot, 'config', 'user.name', 'Test');
  git(repoRoot, 'config', 'user.email', 'test@example.invalid');
  writeFileSync(join(repoRoot, 'README.md'), 'Test single task\n');
  git(repoRoot, 'add', '.');
  git(repoRoot, 'commit', '-m', 'fixture');
  git(repoRoot, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  const mainSha = git(repoRoot, 'rev-parse', 'HEAD');
  const dir = join(stateDir, 'authorizations', 'pending');
  mkdirSync(dir, { recursive: true });
  const authorization = {
    authorization_id: authId, issue_number: 77, manifest_sha256: hash,
    approved_base_sha: mainSha, max_model_runs: 1, max_automatic_retries: 0,
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  };
  const authFile = join(dir, 'approval.json');
  writeFileSync(authFile, JSON.stringify(authorization) + '\n');
  return { root, repoRoot, stateDir, mainSha, authFile, authorization };
}

test('config is fixed to one reviewed issue and rejects arbitrary execution scope', () => {
  assert.equal(validateSupervisorConfig(config, manifest), true);
  assert.throws(() => validateSupervisorConfig({ ...config, issue_number: 78 }, manifest), /EXECUTE_MANIFEST_TASK_MISMATCH/);
  assert.throws(() => validateSupervisorConfig({ ...config, poll_seconds: 0 }, manifest), /POLL_SECONDS_OUT_OF_RANGE/);
  assert.throws(() => validateSupervisorConfig({ ...config, max_authorized_launches: 999 }, manifest), /LAUNCH_BUDGET_OUT_OF_RANGE/);
  assert.throws(() => validateSupervisorConfig({ ...config, manifest_path: '../../bad' }, manifest), /MANIFEST_PATH_INVALID/);
  assert.throws(() => validateSupervisorConfig(config, { ...manifest, mode: 'DRY_RUN_NO_MODEL_NO_GITHUB_WRITE' }), /EXECUTE_MANIFEST_TASK_MISMATCH/);
});

test('READY waits for fresh auth, blocked/finalized tasks never auto-dispatch', () => {
  const base = { issueOpen: true, effectiveState: 'READY', pendingCount: 0, launches: 0, maxLaunches: 2 };
  assert.equal(decideSingleTaskAction(base), 'WAIT_FOR_FRESH_APPROVAL');
  assert.equal(decideSingleTaskAction({ ...base, pendingCount: 1 }), 'DISPATCH_ONE_AUTHORIZED_RUN');
  assert.equal(decideSingleTaskAction({ ...base, pendingCount: 2 }), 'STOP_MULTIPLE_PENDING_APPROVALS');
  assert.equal(decideSingleTaskAction({ ...base, launches: 2, pendingCount: 1 }), 'STOP_BUDGET_EXHAUSTED');
  assert.equal(decideSingleTaskAction({ ...base, effectiveState: 'BLOCKED', pendingCount: 1 }), 'STOP_BLOCKED');
  assert.equal(decideSingleTaskAction({ ...base, effectiveState: 'PR_REVIEW_REQUIRED', pendingCount: 1 }), 'STOP_PR_REVIEW_REQUIRED');
  assert.equal(decideSingleTaskAction({ ...base, effectiveState: 'RUNNING', pendingCount: 1 }), 'STOP_RUNNING');
  assert.equal(decideSingleTaskAction({ ...base, issueOpen: false }), 'STOP_ISSUE_CLOSED');
  assert.equal(decideSingleTaskAction({ ...base, effectiveState: 'UNTRUSTED', pendingCount: 1 }), 'STOP_UNVERIFIED_STATE');
});

test('Windows-compatible single-task lock prevents a second process', () => {
  const root = temp();
  try {
    const one = acquireSupervisorLock(root, 77);
    assert.throws(() => acquireSupervisorLock(root, 77), /ALREADY_RUNNING_OR_STALE_LOCK/);
    releaseSupervisorLock(one);
    const again = acquireSupervisorLock(root, 77);
    releaseSupervisorLock(again);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('only a new, exact-bound protected authorization is eligible', () => {
  const f = fixture();
  try {
    const ledger = { schema: 1, issue_number: 77, attempts: [] };
    assert.deepEqual(findFreshPendingAuthorizations({
      stateDir: f.stateDir, config, manifestHash: hash, approvedBaseSha: f.mainSha, ledger,
    }).map(x => x.authorization_id), [authId]);
    assert.equal(findFreshPendingAuthorizations({
      stateDir: f.stateDir, config, manifestHash: hash, approvedBaseSha: f.mainSha,
      ledger: { ...ledger, attempts: [{ authorization_id: authId }] },
    }).length, 0);
    const receipt = join(f.stateDir, 'authorizations', 'consumed', authId);
    mkdirSync(receipt, { recursive: true });
    assert.equal(findFreshPendingAuthorizations({
      stateDir: f.stateDir, config, manifestHash: hash, approvedBaseSha: f.mainSha, ledger,
    }).length, 0);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('tampered or expired pending auth fails closed before any child can launch', () => {
  const f = fixture();
  try {
    const ledger = { schema: 1, issue_number: 77, attempts: [] };
    const args = { stateDir: f.stateDir, config, manifestHash: hash, approvedBaseSha: f.mainSha, ledger };
    writeFileSync(f.authFile, JSON.stringify({ ...f.authorization, approved_base_sha: 'b'.repeat(40) }));
    assert.throws(() => findFreshPendingAuthorizations(args), /AUTH_BINDING_MISMATCH/);
    writeFileSync(f.authFile, JSON.stringify({ ...f.authorization, expires_at: '2020-01-01T00:00:00Z' }));
    assert.throws(() => findFreshPendingAuthorizations(args), /AUTHORIZATION_EXPIRED/);
    writeFileSync(f.authFile, JSON.stringify({ ...f.authorization, max_model_runs: 4 }));
    assert.throws(() => findFreshPendingAuthorizations(args), /AUTH_ENVELOPE_INVALID/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('one mock controller launch completes once and restart cannot replay it', async () => {
  const f = fixture();
  try {
    let launches = 0;
    const options = {
      config, repoRoot: f.repoRoot, stateDir: f.stateDir,
      manifestPath: join(f.repoRoot, config.manifest_path), manifestHash: hash,
      readRemoteState: async () => ({ open: true, effectiveState: 'READY' }),
      launch: async ({ authorization, outputPath }) => {
        launches += 1;
        assert.equal(authorization.authorization_id, authId);
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, JSON.stringify({ final_state: 'PR_REVIEW_REQUIRED' }));
        return { exit_code: 0, timed_out: false };
      },
    };
    const first = await runOneSupervisorPoll(options);
    assert.equal(first.action, 'STOP_PR_REVIEW_REQUIRED');
    assert.equal(first.launches, 1);
    const second = await runOneSupervisorPoll(options);
    assert.equal(second.action, 'STOP_BUDGET_EXHAUSTED');
    assert.equal(launches, 1);
    const ledger = JSON.parse(readFileSync(join(f.stateDir, 'single-task', 'issue-77', 'dispatch-ledger.json')));
    assert.equal(ledger.attempts.length, 1);
    assert.equal(ledger.attempts[0].status, 'EXITED');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('mock child failure is journaled, never retried or relabeled successful', async () => {
  const f = fixture();
  try {
    let launches = 0;
    const options = {
      config, repoRoot: f.repoRoot, stateDir: f.stateDir,
      manifestPath: join(f.repoRoot, config.manifest_path), manifestHash: hash,
      readRemoteState: async () => ({ open: true, effectiveState: 'READY' }),
      launch: async () => { launches += 1; throw Object.assign(new Error('TEST_FAILURE'), { code: 'TEST_CHILD_FAILURE' }); },
    };
    const first = await runOneSupervisorPoll(options);
    assert.equal(first.action, 'STOP_EXECUTION_REQUIRES_REVIEW');
    assert.equal(first.exit_code, null);
    assert.equal((await runOneSupervisorPoll(options)).action, 'STOP_BUDGET_EXHAUSTED');
    assert.equal(launches, 1);
    const ledger = JSON.parse(readFileSync(join(f.stateDir, 'single-task', 'issue-77', 'dispatch-ledger.json')));
    assert.equal(ledger.attempts[0].outcome.failure_code, 'TEST_CHILD_FAILURE');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('mock remote BLOCKED state does not inspect or consume protected approval', async () => {
  const f = fixture();
  try {
    let launches = 0;
    const status = await runOneSupervisorPoll({
      config, repoRoot: f.repoRoot, stateDir: f.stateDir,
      manifestPath: join(f.repoRoot, config.manifest_path), manifestHash: hash,
      readRemoteState: async () => ({ open: true, effectiveState: 'BLOCKED' }),
      launch: async () => { launches += 1; return { exit_code: 0 }; },
    });
    assert.equal(status.action, 'STOP_BLOCKED');
    assert.equal(launches, 0);
    assert.ok(readFileSync(f.authFile, 'utf8').includes(authId));
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
