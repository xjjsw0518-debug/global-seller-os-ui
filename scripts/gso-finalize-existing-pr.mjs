import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { checkChangedPaths } from './gso-windows-local-bridge-dry-run.mjs';
import { applyControllerDevStatus, changedPaths } from './gso-controller-recovery-shared.mjs';

const MODULE_PATH = fileURLToPath(import.meta.url);
const CONTRACT_MODE = 'FINALIZE_EXISTING_PR_CONTROLLER_ONLY';
const AUTH_KIND = 'GSO_CONTROLLER_ONLY_RECOVERY_V1';
const AUTH_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{15,127}$/;
const MAX_AUTHORIZATION_LIFETIME_MS = 15 * 60 * 1000;
const REQUIRED_ARTIFACT_PREFIXES = [
  'knip-unused-',
  'dependency-cruiser-',
  'playwright-smoke-',
  'axe-accessibility-',
  'backstop-visual-',
];
const TERMINAL_RECOVERY_EVENTS = new Set(['PR_REVIEW_REQUIRED', 'RECOVERY_BLOCKED', 'RECOVERY_FAILED']);

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizePath(value) {
  return String(value || '').replaceAll('\\', '/').replace(/^\.\//, '');
}

function assertRepoPath(path, code = 'CONTRACT_PATH_INVALID') {
  const normalized = normalizePath(path);
  if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) throw new Error(code);
  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) throw new Error(code);
  return normalized;
}

function safeChild(parent, child) {
  const parentPath = resolve(parent);
  const childPath = resolve(child);
  const rel = relative(parentPath, childPath);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('UNSAFE_CHILD_PATH');
  return childPath;
}

function assertStateDirOutsideRepository(repoRoot, stateDir) {
  const repository = resolve(repoRoot);
  const state = resolve(stateDir);
  const rel = relative(repository, state);
  if (!rel || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))) {
    throw new Error('RECOVERY_STATE_DIR_INSIDE_REPOSITORY');
  }
}

function atomicWriteJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  renameSync(temporary, path);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    input: options.input,
    encoding: options.encoding ?? 'utf8',
    windowsHide: true,
    timeout: options.timeout ?? 120_000,
  });
  return {
    ok: !result.error && result.status === 0,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error?.code || null,
  };
}

function git(repoRoot, args, options = {}) {
  const result = run('git', ['-C', repoRoot, ...args], options);
  if (!result.ok) throw new Error(`GIT_FAILED:${args[0]}:${result.status ?? result.error ?? 'UNKNOWN'}`);
  return typeof result.stdout === 'string' ? result.stdout.trim() : result.stdout;
}

function gitBytes(repoRoot, args) {
  try {
    return execFileSync('git', ['-C', repoRoot, ...args], { windowsHide: true });
  } catch {
    throw new Error(`GIT_FAILED:${args[0]}`);
  }
}

function ensureRegularGitBlob(repoRoot, ref, path, code) {
  const entry = git(repoRoot, ['ls-tree', ref, '--', path]);
  const match = /^(100644|100755) blob [0-9a-f]{40}\t/.exec(entry);
  if (!match) throw new Error(`${code}_GIT_MODE_INVALID`);
}

function ensureRegularFile(path, code) {
  if (!existsSync(path)) throw new Error(`${code}_MISSING`);
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${code}_NOT_REGULAR_FILE`);
}

function readJson(path, code) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(`${code}_INVALID`);
  }
}

export function validateFinalizeContract(contract) {
  const errors = [];
  if (contract?.schema_version !== 1) errors.push('CONTRACT_SCHEMA_INVALID');
  if (contract?.mode !== CONTRACT_MODE) errors.push('CONTRACT_MODE_INVALID');
  if (!/^[^/\s]+\/[^/\s]+$/.test(contract?.repository || '')) errors.push('CONTRACT_REPOSITORY_INVALID');
  if (!Number.isInteger(contract?.issue_number) || contract.issue_number <= 0) errors.push('CONTRACT_ISSUE_INVALID');
  if (!Number.isInteger(contract?.pr_number) || contract.pr_number <= 0) errors.push('CONTRACT_PR_INVALID');
  if (contract?.pr_url !== `https://github.com/${contract?.repository}/pull/${contract?.pr_number}`) errors.push('CONTRACT_PR_URL_INVALID');
  for (const [field, value] of [
    ['reviewed_main_sha', contract?.reviewed_main_sha],
    ['expected_pr_head_sha', contract?.expected_pr_head_sha],
    ['original_base_sha', contract?.original_base_sha],
    ['historical_journal_sha256', contract?.historical?.journal_sha256],
    ['historical_receipt_sha256', contract?.historical?.receipt_sha256],
    ['controller_status_sha256', contract?.controller_status?.sha256],
  ]) {
    if (!/^[a-f0-9]{64}$/i.test(value || '') && !(['reviewed_main_sha', 'expected_pr_head_sha', 'original_base_sha'].includes(field) && /^[a-f0-9]{40}$/i.test(value || ''))) {
      errors.push(`CONTRACT_${field.toUpperCase()}_INVALID`);
    }
  }
  if (!contract?.pr_branch || ['main', 'master'].includes(contract.pr_branch)) errors.push('CONTRACT_PR_BRANCH_INVALID');
  if (contract?.pr_base !== 'main') errors.push('CONTRACT_PR_BASE_INVALID');
  try {
    const artifactPaths = (contract?.model_artifacts || []).map((item) => assertRepoPath(item.path));
    if (artifactPaths.length === 0 || new Set(artifactPaths).size !== artifactPaths.length) errors.push('CONTRACT_ARTIFACTS_INVALID');
    for (const item of contract?.model_artifacts || []) if (!/^[a-f0-9]{64}$/i.test(item.sha256 || '')) errors.push('CONTRACT_ARTIFACT_HASH_INVALID');
    const controllerStatusPath = assertRepoPath(contract?.controller_status?.path);
    if (controllerStatusPath !== 'public/dev-status.json') errors.push('CONTRACT_CONTROLLER_STATUS_PATH_INVALID');
    if (artifactPaths.includes(controllerStatusPath)) errors.push('CONTRACT_ARTIFACT_STATUS_OVERLAP');
    assertRepoPath(contract?.worktree_relative_path);
  } catch (error) {
    errors.push(error.message);
  }
  if (!Number.isInteger(contract?.preliminary_gate?.run_id) || contract.preliminary_gate.run_id <= 0) errors.push('CONTRACT_GATE_INVALID');
  if (contract?.preliminary_gate?.head_sha !== contract?.expected_pr_head_sha) errors.push('CONTRACT_GATE_HEAD_INVALID');
  if (contract?.preliminary_gate?.html_url !== `https://github.com/${contract?.repository}/actions/runs/${contract?.preliminary_gate?.run_id}`) {
    errors.push('CONTRACT_GATE_URL_INVALID');
  }
  if (contract?.historical?.state !== 'BLOCKED') errors.push('CONTRACT_HISTORICAL_STATE_INVALID');
  for (const key of ['run_id', 'lease_id', 'authorization_id']) if (!contract?.historical?.[key]) errors.push(`CONTRACT_HISTORICAL_${key.toUpperCase()}_INVALID`);
  if (!contract?.task?.id || !contract?.task?.name || !contract?.task?.owner || !contract?.task?.next_action_instruction) {
    errors.push('CONTRACT_TASK_BINDING_INVALID');
  }
  return { valid: errors.length === 0, errors };
}

export function gateArtifactStatus(artifacts = []) {
  const names = artifacts.filter((artifact) => !artifact.expired).map((artifact) => artifact.name);
  const missing = REQUIRED_ARTIFACT_PREFIXES.filter((prefix) => !names.some((name) => name.startsWith(prefix)));
  return { complete: missing.length === 0, names, missing };
}

function verifyReviewedMain(repoRoot, expectedSha, fetchMain = true) {
  if (fetchMain) git(repoRoot, ['fetch', '--quiet', 'origin', 'main']);
  const head = git(repoRoot, ['rev-parse', 'HEAD']);
  const reviewedMain = git(repoRoot, ['rev-parse', 'origin/main']);
  if (head !== expectedSha || reviewedMain !== expectedSha) throw new Error('RECOVERY_REVIEWED_MAIN_MISMATCH');
  const status = git(repoRoot, ['status', '--porcelain=v1', '--untracked-files=all']);
  if (status) throw new Error('RECOVERY_CONTROLLER_REPOSITORY_DIRTY');
  return { head, reviewed_main: reviewedMain };
}

function verifyHistoricalEvidence(stateDir, contract) {
  const leaseRoot = safeChild(stateDir, join(stateDir, 'leases', contract.historical.lease_id));
  const journalPath = safeChild(leaseRoot, join(leaseRoot, 'journal.json'));
  const consumedRoot = safeChild(stateDir, join(stateDir, 'authorizations', 'consumed'));
  const receiptPath = safeChild(consumedRoot, join(consumedRoot, contract.historical.authorization_id, 'receipt.json'));
  ensureRegularFile(journalPath, 'HISTORICAL_JOURNAL');
  ensureRegularFile(receiptPath, 'HISTORICAL_RECEIPT');
  const journalBytes = readFileSync(journalPath);
  const receiptBytes = readFileSync(receiptPath);
  if (sha256(journalBytes) !== contract.historical.journal_sha256) throw new Error('HISTORICAL_JOURNAL_HASH_MISMATCH');
  if (sha256(receiptBytes) !== contract.historical.receipt_sha256) throw new Error('HISTORICAL_RECEIPT_HASH_MISMATCH');
  const journal = JSON.parse(journalBytes.toString('utf8'));
  const receipt = JSON.parse(receiptBytes.toString('utf8'));
  if (journal.state !== 'BLOCKED' || journal.run_id !== contract.historical.run_id || journal.lease_id !== contract.historical.lease_id) {
    throw new Error('HISTORICAL_JOURNAL_BINDING_MISMATCH');
  }
  if (receipt.authorization_id !== contract.historical.authorization_id
    || receipt.run_id !== contract.historical.run_id
    || receipt.lease_id !== contract.historical.lease_id
    || receipt.model_call_started !== true) {
    throw new Error('HISTORICAL_RECEIPT_BINDING_MISMATCH');
  }
  return {
    journal_path: journalPath,
    receipt_path: receiptPath,
    journal_sha256: sha256(journalBytes),
    receipt_sha256: sha256(receiptBytes),
    state: journal.state,
  };
}

function assertNoPathCollisions(paths) {
  const normalized = paths.map(normalizePath);
  const folded = normalized.map((path) => path.normalize('NFC').toLowerCase());
  if (new Set(folded).size !== folded.length) throw new Error('RECOVERY_PATH_COLLISION');
}

function verifyPrFiles(files, contract, phase = 'ORIGINAL') {
  const artifactPaths = contract.model_artifacts.map((item) => item.path).sort();
  const allowed = phase === 'ORIGINAL'
    ? artifactPaths
    : [...artifactPaths, contract.controller_status.path].sort();
  const actual = files.map((file) => normalizePath(file.filename)).sort();
  assertNoPathCollisions(actual);
  if (files.some((file) => file.previous_filename || ['renamed', 'copied'].includes(file.status))) throw new Error('RECOVERY_PR_RENAME_FORBIDDEN');
  if (actual.length !== allowed.length || actual.some((path, index) => path !== allowed[index])) {
    throw new Error('RECOVERY_PR_CHANGED_PATHS_MISMATCH');
  }
  return actual;
}

async function verifyRemoteBindings({ broker, contract, phase = 'ORIGINAL', expectedHead = contract.expected_pr_head_sha }) {
  const pr = await broker.readPullRequest(contract.pr_number);
  if (pr.number !== contract.pr_number || pr.state !== 'open' || pr.merged === true) throw new Error('RECOVERY_PR_NOT_OPEN');
  if (pr.head?.sha !== expectedHead || pr.head?.ref !== contract.pr_branch || pr.base?.ref !== contract.pr_base) {
    throw new Error('RECOVERY_PR_BINDING_MISMATCH');
  }
  if (pr.mergeable !== true || pr.mergeable_state === 'dirty') throw new Error('RECOVERY_PR_NOT_MERGEABLE');
  const files = await broker.readPullFiles(contract.pr_number);
  const changedPathsResult = verifyPrFiles(files, contract, phase);
  for (const artifact of contract.model_artifacts) {
    const bytes = await broker.readFileBytes(artifact.path, expectedHead);
    if (sha256(bytes) !== artifact.sha256) throw new Error(`RECOVERY_ARTIFACT_HASH_MISMATCH:${artifact.path}`);
  }
  if (phase !== 'ORIGINAL') {
    const statusBytes = await broker.readFileBytes(contract.controller_status.path, expectedHead);
    if (sha256(statusBytes) !== contract.controller_status.sha256) throw new Error('RECOVERY_REMOTE_STATUS_HASH_MISMATCH');
  }
  const gate = await broker.readGateRun(contract.preliminary_gate.run_id);
  if (gate.status !== 'completed' || gate.conclusion !== 'success' || gate.head_sha !== contract.expected_pr_head_sha) {
    throw new Error('RECOVERY_PRELIMINARY_GATE_INVALID');
  }
  const artifacts = gateArtifactStatus(await broker.readGateArtifacts(contract.preliminary_gate.run_id));
  if (!artifacts.complete) throw new Error(`RECOVERY_PRELIMINARY_ARTIFACTS_MISSING:${artifacts.missing.join(',')}`);
  return {
    pr,
    changed_paths: changedPathsResult,
    preliminary_gate: {
      run_id: gate.id ?? contract.preliminary_gate.run_id,
      head_sha: gate.head_sha,
      status: gate.status,
      conclusion: gate.conclusion,
      html_url: gate.html_url,
      artifacts,
    },
  };
}

function verifyOriginalWorktree(stateDir, contract) {
  const worktreePath = safeChild(stateDir, join(stateDir, contract.worktree_relative_path));
  if (!existsSync(worktreePath)) throw new Error('RECOVERY_WORKTREE_MISSING');
  const head = git(worktreePath, ['rev-parse', 'HEAD']);
  const branch = git(worktreePath, ['branch', '--show-current']);
  if (head !== contract.expected_pr_head_sha || branch !== contract.pr_branch) throw new Error('RECOVERY_WORKTREE_BINDING_MISMATCH');
  const mergeBase = git(worktreePath, ['merge-base', contract.original_base_sha, contract.expected_pr_head_sha]);
  if (mergeBase !== contract.original_base_sha) throw new Error('RECOVERY_ORIGINAL_BASE_NOT_ANCESTOR');
  const paths = changedPaths(worktreePath).map(normalizePath);
  assertNoPathCollisions(paths);
  const pathPolicy = checkChangedPaths(paths, { allowed: [contract.controller_status.path], forbidden: ['**/.git/**'] });
  if (!pathPolicy.ok || paths.length !== 1 || paths[0] !== contract.controller_status.path) {
    throw new Error('RECOVERY_WORKTREE_CHANGED_PATHS_MISMATCH');
  }
  for (const artifact of contract.model_artifacts) {
    ensureRegularGitBlob(worktreePath, 'HEAD', artifact.path, 'RECOVERY_ARTIFACT');
    const absolute = safeChild(worktreePath, join(worktreePath, artifact.path));
    ensureRegularFile(absolute, 'RECOVERY_ARTIFACT');
    if (sha256(gitBytes(worktreePath, ['show', `HEAD:${artifact.path}`])) !== artifact.sha256) {
      throw new Error(`RECOVERY_WORKTREE_ARTIFACT_HASH_MISMATCH:${artifact.path}`);
    }
  }
  ensureRegularGitBlob(worktreePath, 'HEAD', contract.controller_status.path, 'RECOVERY_STATUS_FILE');
  const statusPath = safeChild(worktreePath, join(worktreePath, contract.controller_status.path));
  ensureRegularFile(statusPath, 'RECOVERY_STATUS_FILE');
  const originalStatus = JSON.parse(gitBytes(worktreePath, ['show', `HEAD:${contract.controller_status.path}`]).toString('utf8'));
  const currentBytes = readFileSync(statusPath);
  const currentStatus = JSON.parse(currentBytes.toString('utf8'));
  const expected = applyControllerDevStatus(originalStatus, {
    now: currentStatus.last_updated,
    repository: contract.repository,
    issueNumber: contract.issue_number,
    taskId: contract.task.id,
    taskName: contract.task.name,
    owner: contract.task.owner,
    nextActionInstruction: contract.task.next_action_instruction,
    pr: { number: contract.pr_number, html_url: contract.pr_url },
    headSha: contract.expected_pr_head_sha,
    gate: { run_id: contract.preliminary_gate.run_id, html_url: contract.preliminary_gate.html_url },
  });
  const expectedBytes = Buffer.from(`${JSON.stringify(expected, null, 2)}\n`, 'utf8');
  if (!currentBytes.equals(expectedBytes) || sha256(currentBytes) !== contract.controller_status.sha256) {
    throw new Error('RECOVERY_STATUS_CONTENT_MISMATCH');
  }
  return { path: worktreePath, head, branch, changed_paths: paths, status_sha256: sha256(currentBytes) };
}

export async function buildFinalizeExistingPrPlan({ repoRoot, stateDir, contractPath, broker, fetchMain = true }) {
  assertStateDirOutsideRepository(repoRoot, stateDir);
  const contractBytes = readFileSync(contractPath);
  const contract = JSON.parse(contractBytes.toString('utf8'));
  const validation = validateFinalizeContract(contract);
  if (!validation.valid) throw new Error(`RECOVERY_CONTRACT_INVALID:${validation.errors.join(',')}`);
  const reviewedMain = verifyReviewedMain(repoRoot, contract.reviewed_main_sha, fetchMain);
  const remote = await verifyRemoteBindings({ broker, contract });
  const historical = verifyHistoricalEvidence(stateDir, contract);
  const worktree = verifyOriginalWorktree(stateDir, contract);
  return {
    schema_version: 1,
    mode: 'PLAN',
    final_state: 'ELIGIBLE_FOR_SEPARATELY_AUTHORIZED_CONTROLLER_ONLY_APPLY',
    generated_at: new Date().toISOString(),
    binding: {
      repository: contract.repository,
      issue_number: contract.issue_number,
      pr_number: contract.pr_number,
      pr_head_sha: contract.expected_pr_head_sha,
      pr_branch: contract.pr_branch,
      reviewed_main_sha: contract.reviewed_main_sha,
      contract_sha256: sha256(contractBytes),
      artifact_set_sha256: sha256(JSON.stringify(contract.model_artifacts)),
      controller_status_path: contract.controller_status.path,
      controller_status_sha256: contract.controller_status.sha256,
      preliminary_gate_run_id: contract.preliminary_gate.run_id,
    },
    checks: {
      reviewed_main: reviewedMain,
      github_pr_open_unmerged: true,
      github_changed_paths: remote.changed_paths,
      model_artifact_hashes: contract.model_artifacts.map((item) => ({ path: item.path, sha256: item.sha256 })),
      preliminary_gate: remote.preliminary_gate,
      historical: {
        state: historical.state,
        journal_sha256: historical.journal_sha256,
        receipt_sha256: historical.receipt_sha256,
        immutable: true,
      },
      worktree: {
        head: worktree.head,
        branch: worktree.branch,
        changed_paths: worktree.changed_paths,
        status_sha256: worktree.status_sha256,
      },
    },
    side_effects: {
      model_calls: 0,
      authorization_writes: 0,
      commits: 0,
      pushes: 0,
      github_writes: 0,
      historical_journal_writes: 0,
      historical_receipt_writes: 0,
    },
  };
}

export function validateRecoveryAuthorization(envelope, context, { allowExpired = false, now = Date.now() } = {}) {
  const errors = [];
  if (envelope?.kind !== AUTH_KIND) errors.push('RECOVERY_AUTH_KIND_INVALID');
  if (!AUTH_ID.test(envelope?.authorization_id || '')) errors.push('RECOVERY_AUTH_ID_INVALID');
  for (const [field, expected] of Object.entries(context)) {
    if (envelope?.[field] !== expected) errors.push(`RECOVERY_AUTH_${field.toUpperCase()}_MISMATCH`);
  }
  const issuedAt = Date.parse(envelope?.issued_at || '');
  const expiresAt = Date.parse(envelope?.expires_at || '');
  if (!Number.isFinite(issuedAt) || issuedAt > now + 60_000) errors.push('RECOVERY_AUTH_ISSUED_AT_INVALID');
  if (!Number.isFinite(expiresAt) || (!allowExpired && expiresAt <= now)) errors.push('RECOVERY_AUTH_EXPIRED');
  if (Number.isFinite(issuedAt) && Number.isFinite(expiresAt)
    && (expiresAt <= issuedAt || expiresAt - issuedAt > MAX_AUTHORIZATION_LIFETIME_MS)) {
    errors.push('RECOVERY_AUTH_LIFETIME_INVALID');
  }
  if (envelope?.max_apply_runs !== 1) errors.push('RECOVERY_AUTH_LIMIT_INVALID');
  if (envelope?.model_calls_allowed !== 0) errors.push('RECOVERY_AUTH_MODEL_BOUNDARY_INVALID');
  if (envelope?.auto_merge_allowed !== false) errors.push('RECOVERY_AUTH_AUTO_MERGE_INVALID');
  return { valid: errors.length === 0, errors };
}

function recoveryPaths(stateDir, authorizationId, recoveryId) {
  const root = safeChild(stateDir, join(stateDir, 'recovery', 'finalize-existing-pr'));
  const authorizationLockId = sha256(authorizationId).slice(0, 32);
  return {
    root,
    lock: safeChild(root, join(root, 'locks', `authorization-${authorizationLockId}.lock`)),
    journal: safeChild(root, join(root, 'runs', recoveryId, 'journal.jsonl')),
    receipt: safeChild(root, join(root, 'authorizations', 'consumed', authorizationId, 'receipt.json')),
  };
}

function appendRecoveryEvent(journalPath, event, evidence = {}) {
  mkdirSync(dirname(journalPath), { recursive: true });
  appendFileSync(journalPath, `${JSON.stringify({ event, at: new Date().toISOString(), evidence })}\n`, { encoding: 'utf8', mode: 0o600 });
}

function readRecoveryEvents(journalPath) {
  if (!existsSync(journalPath)) return [];
  return readFileSync(journalPath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function acquireRecoveryLock(lockPath, recoveryId, authorizationId) {
  mkdirSync(dirname(lockPath), { recursive: true });
  try {
    mkdirSync(lockPath);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('RECOVERY_LOCK_BUSY');
    throw error;
  }
  atomicWriteJson(join(lockPath, 'owner.json'), {
    recovery_id: recoveryId,
    authorization_id: authorizationId,
    pid: process.pid,
    acquired_at: new Date().toISOString(),
  });
  return { lockPath };
}

function releaseRecoveryLock(lock) {
  if (!lock?.lockPath || !existsSync(lock.lockPath)) return;
  // Remove only the exact lock directory created by this recovery invocation.
  const owner = join(lock.lockPath, 'owner.json');
  if (existsSync(owner)) rmSync(owner, { force: true });
  rmdirSync(lock.lockPath);
}

function consumeOrResumeAuthorization(paths, envelope, context, recoveryId) {
  const envelopeHash = sha256(JSON.stringify(envelope));
  if (existsSync(paths.receipt)) {
    const receipt = readJson(paths.receipt, 'RECOVERY_RECEIPT');
    if (receipt.authorization_id !== envelope.authorization_id || receipt.envelope_sha256 !== envelopeHash || receipt.recovery_id !== recoveryId) {
      throw new Error('RECOVERY_AUTH_REPLAY_MISMATCH');
    }
    const events = readRecoveryEvents(paths.journal);
    if (events.some((entry) => TERMINAL_RECOVERY_EVENTS.has(entry.event))) throw new Error('RECOVERY_AUTH_ALREADY_TERMINAL');
    return { receipt, resumed: true };
  }
  const receipt = {
    schema_version: 1,
    kind: AUTH_KIND,
    authorization_id: envelope.authorization_id,
    envelope_sha256: envelopeHash,
    recovery_id: recoveryId,
    contract_sha256: context.contract_sha256,
    consumed_at: new Date().toISOString(),
    model_calls: 0,
  };
  atomicWriteJson(paths.receipt, receipt);
  appendRecoveryEvent(paths.journal, 'AUTHORIZATION_CONSUMED', { authorization_id: envelope.authorization_id, model_calls: 0 });
  return { receipt, resumed: false };
}

function localCommitCheckpoint(worktreePath, contract, journalPath, priorEvents) {
  const recorded = priorEvents.find((entry) => entry.event === 'LOCAL_COMMIT_CREATED')?.evidence?.commit_sha;
  if (recorded) {
    if (git(worktreePath, ['rev-parse', 'HEAD']) !== recorded || changedPaths(worktreePath).length !== 0) {
      throw new Error('RECOVERY_LOCAL_COMMIT_CHECKPOINT_MISMATCH');
    }
    return recorded;
  }
  if (git(worktreePath, ['rev-parse', 'HEAD']) !== contract.expected_pr_head_sha) throw new Error('RECOVERY_LOCAL_HEAD_CHANGED');
  const paths = changedPaths(worktreePath);
  if (paths.length !== 1 || normalizePath(paths[0]) !== contract.controller_status.path) throw new Error('RECOVERY_LOCAL_PATH_POLICY_FAILED');
  const statusPath = safeChild(worktreePath, join(worktreePath, contract.controller_status.path));
  ensureRegularFile(statusPath, 'RECOVERY_STATUS_FILE');
  if (sha256(readFileSync(statusPath)) !== contract.controller_status.sha256) throw new Error('RECOVERY_STATUS_HASH_CHANGED');
  git(worktreePath, ['add', '--', contract.controller_status.path]);
  git(worktreePath, ['-c', 'user.name=GSO Windows Recovery Controller', '-c', 'user.email=gso-windows-recovery@users.noreply.github.com', 'commit', '-m', `chore: finalize ${contract.task.id} controller status (#${contract.issue_number})`]);
  const commitSha = git(worktreePath, ['rev-parse', 'HEAD']);
  if (git(worktreePath, ['rev-parse', 'HEAD^']) !== contract.expected_pr_head_sha) throw new Error('RECOVERY_COMMIT_PARENT_MISMATCH');
  const committedPaths = git(worktreePath, ['diff', '--name-only', 'HEAD^', 'HEAD']).split(/\r?\n/).filter(Boolean).map(normalizePath);
  if (committedPaths.length !== 1 || committedPaths[0] !== contract.controller_status.path) throw new Error('RECOVERY_COMMIT_PATH_POLICY_FAILED');
  appendRecoveryEvent(journalPath, 'LOCAL_COMMIT_CREATED', { commit_sha: commitSha, parent_sha: contract.expected_pr_head_sha, path: contract.controller_status.path });
  return commitSha;
}

function remoteBranchSha(worktreePath, branch) {
  const output = git(worktreePath, ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`]);
  return output ? output.split(/\s+/)[0] : null;
}

async function verifyResumeBindings({ broker, contract, stateDir, commitSha, pushed }) {
  verifyHistoricalEvidence(stateDir, contract);
  const worktreePath = safeChild(stateDir, join(stateDir, contract.worktree_relative_path));
  if (git(worktreePath, ['rev-parse', 'HEAD']) !== commitSha || changedPaths(worktreePath).length !== 0) {
    throw new Error('RECOVERY_RESUME_WORKTREE_MISMATCH');
  }
  const expectedRemote = pushed ? commitSha : contract.expected_pr_head_sha;
  await verifyRemoteBindings({
    broker,
    contract,
    phase: pushed ? 'FINAL' : 'ORIGINAL',
    expectedHead: expectedRemote,
  });
  return worktreePath;
}

export async function applyFinalizeExistingPr({
  repoRoot,
  stateDir,
  contractPath,
  authorizationEnvelope,
  broker,
  fetchMain = true,
  crashAt = null,
  gateTimeoutMs = 60 * 60 * 1000,
  authorizationNow = null,
}) {
  const contractBytes = readFileSync(contractPath);
  const contract = JSON.parse(contractBytes.toString('utf8'));
  const contractHash = sha256(contractBytes);
  const recoveryId = `gso-recovery-${sha256(`${authorizationEnvelope?.authorization_id}\n${contractHash}`).slice(0, 24)}`;
  const paths = recoveryPaths(stateDir, authorizationEnvelope?.authorization_id || 'invalid-authorization-id', recoveryId);
  const priorEvents = readRecoveryEvents(paths.journal);
  const priorCommit = priorEvents.find((entry) => entry.event === 'LOCAL_COMMIT_CREATED')?.evidence?.commit_sha || null;
  const priorPushed = priorEvents.some((entry) => entry.event === 'REMOTE_PUSHED');
  let plan;
  if (!priorCommit) {
    plan = await buildFinalizeExistingPrPlan({ repoRoot, stateDir, contractPath, broker, fetchMain });
  } else {
    const validation = validateFinalizeContract(contract);
    if (!validation.valid) throw new Error(`RECOVERY_CONTRACT_INVALID:${validation.errors.join(',')}`);
    verifyReviewedMain(repoRoot, contract.reviewed_main_sha, fetchMain);
    await verifyResumeBindings({ broker, contract, stateDir, commitSha: priorCommit, pushed: priorPushed });
    plan = { binding: { contract_sha256: contractHash, artifact_set_sha256: sha256(JSON.stringify(contract.model_artifacts)) } };
  }
  const authorizationContext = {
    repository: contract.repository,
    issue_number: contract.issue_number,
    pr_number: contract.pr_number,
    contract_sha256: contractHash,
    approved_main_sha: contract.reviewed_main_sha,
    expected_pr_head_sha: contract.expected_pr_head_sha,
    artifact_set_sha256: plan.binding.artifact_set_sha256,
    preliminary_gate_run_id: contract.preliminary_gate.run_id,
    controller_status_path: contract.controller_status.path,
    controller_status_sha256: contract.controller_status.sha256,
  };
  const authorization = validateRecoveryAuthorization(authorizationEnvelope, authorizationContext, {
    allowExpired: existsSync(paths.receipt),
    now: authorizationNow ?? Date.now(),
  });
  if (!authorization.valid) throw new Error(`RECOVERY_NOT_AUTHORIZED:${authorization.errors.join(',')}`);
  const lock = acquireRecoveryLock(paths.lock, recoveryId, authorizationEnvelope.authorization_id);
  try {
    const consumption = consumeOrResumeAuthorization(paths, authorizationEnvelope, authorizationContext, recoveryId);
    let events = readRecoveryEvents(paths.journal);
    if (!events.some((entry) => entry.event === 'PLAN_VERIFIED')) {
      appendRecoveryEvent(paths.journal, 'PLAN_VERIFIED', { contract_sha256: contractHash, historical_evidence_immutable: true });
    }
    const worktreePath = safeChild(stateDir, join(stateDir, contract.worktree_relative_path));
    const commitSha = localCommitCheckpoint(worktreePath, contract, paths.journal, events);
    if (crashAt === 'AFTER_LOCAL_COMMIT') throw new Error('SIMULATED_PROCESS_CRASH_AFTER_LOCAL_COMMIT');
    events = readRecoveryEvents(paths.journal);
    if (!events.some((entry) => entry.event === 'REMOTE_PUSHED')) {
      const remoteSha = remoteBranchSha(worktreePath, contract.pr_branch);
      if (remoteSha === contract.expected_pr_head_sha) {
        git(worktreePath, ['push', 'origin', contract.pr_branch]);
        await broker.onPush?.(commitSha);
      } else if (remoteSha !== commitSha) {
        throw new Error('RECOVERY_REMOTE_BRANCH_DIVERGED');
      }
      appendRecoveryEvent(paths.journal, 'REMOTE_PUSHED', { commit_sha: commitSha, force_push: false });
    }
    if (crashAt === 'AFTER_REMOTE_PUSH') throw new Error('SIMULATED_PROCESS_CRASH_AFTER_REMOTE_PUSH');
    await verifyResumeBindings({ broker, contract, stateDir, commitSha, pushed: true });
    events = readRecoveryEvents(paths.journal);
    if (!events.some((entry) => entry.event === 'FINAL_GATE_PENDING')) {
      appendRecoveryEvent(paths.journal, 'FINAL_GATE_PENDING', { head_sha: commitSha });
    }
    const verifiedGateEvent = events.find((entry) => entry.event === 'FINAL_GATE_VERIFIED');
    let finalGate;
    let finalArtifacts;
    if (verifiedGateEvent) {
      finalGate = verifiedGateEvent.evidence.gate;
      finalArtifacts = { complete: true, names: verifiedGateEvent.evidence.artifacts, missing: [] };
    } else {
      try {
        finalGate = await broker.waitForExactHeadGate(commitSha, gateTimeoutMs);
      } catch (error) {
        appendRecoveryEvent(paths.journal, 'RECOVERY_FAILED', { reason: error.message, head_sha: commitSha, model_calls: 0 });
        await broker.writeRecoveryState?.({ issueNumber: contract.issue_number, state: 'RECOVERY_FAILED', recoveryId, commitSha, reason: error.message });
        return { final_state: 'RECOVERY_FAILED', recovery_id: recoveryId, commit_sha: commitSha, reason: error.message, model_calls: 0 };
      }
      finalArtifacts = gateArtifactStatus(finalGate?.artifacts || []);
    }
    if (finalGate?.head_sha !== commitSha || finalGate?.conclusion !== 'success' || !finalArtifacts.complete) {
      const reason = 'RECOVERY_FINAL_GATE_OR_ARTIFACTS_FAILED';
      appendRecoveryEvent(paths.journal, 'RECOVERY_FAILED', { reason, gate: finalGate, artifacts: finalArtifacts, model_calls: 0 });
      await broker.writeRecoveryState?.({ issueNumber: contract.issue_number, state: 'RECOVERY_FAILED', recoveryId, commitSha, reason });
      return { final_state: 'RECOVERY_FAILED', recovery_id: recoveryId, commit_sha: commitSha, gate: finalGate, artifacts: finalArtifacts, model_calls: 0 };
    }
    if (!verifiedGateEvent) {
      const gateEvidence = {
        run_id: finalGate.run_id ?? finalGate.id,
        head_sha: finalGate.head_sha,
        conclusion: finalGate.conclusion,
        html_url: finalGate.html_url || null,
      };
      appendRecoveryEvent(paths.journal, 'FINAL_GATE_VERIFIED', {
        head_sha: commitSha,
        gate: gateEvidence,
        artifacts: finalArtifacts.names,
        model_calls: 0,
      });
      finalGate = gateEvidence;
    }
    try {
      await broker.writeRecoveryState?.({ issueNumber: contract.issue_number, state: 'PR_REVIEW_REQUIRED', recoveryId, commitSha, gate: finalGate, autoMerge: false });
    } catch (error) {
      const currentEvents = readRecoveryEvents(paths.journal);
      if (!currentEvents.some((entry) => entry.event === 'WRITEBACK_PENDING')) {
        appendRecoveryEvent(paths.journal, 'WRITEBACK_PENDING', { reason: error.message, head_sha: commitSha, model_calls: 0 });
      }
      throw new Error(`RECOVERY_WRITEBACK_PENDING:${error.message}`);
    }
    appendRecoveryEvent(paths.journal, 'PR_REVIEW_REQUIRED', { head_sha: commitSha, gate_run_id: finalGate.run_id, artifacts: finalArtifacts.names, auto_merge: false, model_calls: 0 });
    return {
      final_state: 'PR_REVIEW_REQUIRED',
      recovery_id: recoveryId,
      authorization_resumed: consumption.resumed,
      commit_sha: commitSha,
      gate: finalGate,
      artifacts: finalArtifacts,
      model_calls: 0,
      auto_merge: false,
    };
  } catch (error) {
    if (error.message.startsWith('SIMULATED_PROCESS_CRASH_') || error.message.startsWith('RECOVERY_WRITEBACK_PENDING:')) throw error;
    const events = readRecoveryEvents(paths.journal);
    if (events.length > 0 && !events.some((entry) => TERMINAL_RECOVERY_EVENTS.has(entry.event))) {
      appendRecoveryEvent(paths.journal, 'RECOVERY_BLOCKED', { reason: error.message, model_calls: 0 });
      await broker.writeRecoveryState?.({ issueNumber: contract.issue_number, state: 'RECOVERY_BLOCKED', recoveryId, reason: error.message });
    }
    throw error;
  } finally {
    releaseRecoveryLock(lock);
  }
}

function readGitHubCredential() {
  const result = run('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n' });
  if (!result.ok) throw new Error('CONTROLLER_GITHUB_CREDENTIAL_UNAVAILABLE');
  const values = Object.fromEntries(result.stdout.split(/\r?\n/).map((line) => {
    const index = line.indexOf('=');
    return index > 0 ? [line.slice(0, index), line.slice(index + 1)] : null;
  }).filter(Boolean));
  if (!values.password) throw new Error('CONTROLLER_GITHUB_CREDENTIAL_UNAVAILABLE');
  return values.password;
}

export class FinalizeGitHubBroker {
  constructor(repository, tokenProvider = readGitHubCredential) {
    this.repository = repository;
    this.tokenProvider = tokenProvider;
  }

  async request(method, path, body) {
    const prefix = `/repos/${this.repository}/`;
    if (!path.startsWith(prefix)) throw new Error('RECOVERY_GITHUB_ENDPOINT_OUTSIDE_REPOSITORY');
    const token = this.tokenProvider();
    const response = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'gso-finalize-existing-pr',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`RECOVERY_GITHUB_REQUEST_FAILED:${response.status}`);
    return response.status === 204 ? null : response.json();
  }

  readPullRequest(number) { return this.request('GET', `/repos/${this.repository}/pulls/${number}`); }
  readPullFiles(number) { return this.request('GET', `/repos/${this.repository}/pulls/${number}/files?per_page=100`); }
  readGateRun(id) { return this.request('GET', `/repos/${this.repository}/actions/runs/${id}`); }
  async readGateArtifacts(id) { return (await this.request('GET', `/repos/${this.repository}/actions/runs/${id}/artifacts?per_page=100`)).artifacts || []; }
  async readFileBytes(path, ref) {
    const result = await this.request('GET', `/repos/${this.repository}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`);
    if (result.type !== 'file' || result.encoding !== 'base64') throw new Error('RECOVERY_GITHUB_FILE_INVALID');
    return Buffer.from(result.content.replace(/\s/g, ''), 'base64');
  }
  async waitForExactHeadGate(headSha, timeoutMs) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const runs = await this.request('GET', `/repos/${this.repository}/actions/runs?head_sha=${headSha}&per_page=30`);
      const gate = runs.workflow_runs?.find((item) => item.name === 'GSO Gate' && item.head_sha === headSha);
      if (gate?.status === 'completed') return { ...gate, run_id: gate.id, artifacts: await this.readGateArtifacts(gate.id) };
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 15_000));
    }
    throw new Error('RECOVERY_FINAL_GATE_TIMEOUT');
  }
  async writeRecoveryState(payload) {
    if (!Number.isInteger(payload.issueNumber) || payload.issueNumber <= 0) throw new Error('RECOVERY_WRITEBACK_ISSUE_INVALID');
    if (!['PR_REVIEW_REQUIRED', 'RECOVERY_BLOCKED', 'RECOVERY_FAILED'].includes(payload.state)) {
      throw new Error('RECOVERY_WRITEBACK_STATE_INVALID');
    }
    const marker = '<!-- gso-finalize-existing-pr-state:v1 -->';
    const record = {
      schema_version: 1,
      repository: this.repository,
      issue_number: payload.issueNumber,
      recovery_id: payload.recoveryId,
      state: payload.state,
      commit_sha: payload.commitSha || null,
      gate_run_id: payload.gate?.run_id || payload.gate?.id || null,
      reason: payload.reason || null,
      auto_merge: false,
      model_calls: 0,
      updated_at: new Date().toISOString(),
    };
    const body = `${marker}\n\nGSO_RECOVERY_STATE=${payload.state}\nRECOVERY_ID=${payload.recoveryId}\n\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\``;
    const comments = await this.request('GET', `/repos/${this.repository}/issues/${payload.issueNumber}/comments?per_page=100`);
    const prior = comments.find((comment) => comment.body?.includes(marker)
      && comment.body.includes(`RECOVERY_ID=${payload.recoveryId}`)
      && comment.body.includes(`GSO_RECOVERY_STATE=${payload.state}`));
    if (prior) return { comment_id: prior.id, idempotent: true };
    const created = await this.request('POST', `/repos/${this.repository}/issues/${payload.issueNumber}/comments`, { body });
    const verified = await this.request('GET', `/repos/${this.repository}/issues/comments/${created.id}`);
    if (verified.body !== body) throw new Error('RECOVERY_WRITEBACK_READ_AFTER_WRITE_MISMATCH');
    return { comment_id: created.id, idempotent: false };
  }
}

function parseArgs(argv) {
  const args = { mode: 'plan' };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--')) throw new Error('RECOVERY_ARGUMENT_INVALID');
    args[key.slice(2)] = value;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(args['repo-root'] || process.cwd());
  const stateDir = resolve(args['state-dir'] || join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'GlobalSellerOS', 'codex-bridge', 'recovery'));
  const contractPath = resolve(args.contract || 'control/local-bridge/finalize-existing-pr.contract.json');
  const contract = readJson(contractPath, 'RECOVERY_CONTRACT');
  const broker = new FinalizeGitHubBroker(contract.repository);
  if (args.mode === 'plan') {
    const report = await buildFinalizeExistingPrPlan({ repoRoot, stateDir, contractPath, broker });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  if (args.mode !== 'apply') throw new Error('RECOVERY_MODE_INVALID');
  const authorizationPath = resolve(args['authorization-file'] || '');
  if (!authorizationPath || !existsSync(authorizationPath)) throw new Error('RECOVERY_AUTHORIZATION_MISSING');
  const pendingRoot = safeChild(stateDir, join(stateDir, 'recovery', 'finalize-existing-pr', 'authorizations', 'pending'));
  safeChild(pendingRoot, authorizationPath);
  const result = await applyFinalizeExistingPr({
    repoRoot,
    stateDir,
    contractPath,
    authorizationEnvelope: readJson(authorizationPath, 'RECOVERY_AUTHORIZATION'),
    broker,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.final_state !== 'PR_REVIEW_REQUIRED') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
