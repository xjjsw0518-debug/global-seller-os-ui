// Generic, model-free recovery of a PR after its preliminary Gate.
// PLAN is read-only by construction. A later, separately approved APPLY
// entrypoint must not call the original model executor or change old journals.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { TextDecoder } from 'node:util';

export const RECOVERY_CONTRACT_SCHEMA = 'gso.finalize-existing-pr.v1';
export const REQUIRED_ARTIFACT_PREFIXES = Object.freeze([
  'playwright-smoke-', 'backstop-visual-', 'axe-accessibility-',
  'dependency-cruiser-', 'knip-unused-',
]);

const SHA40 = /^[0-9a-f]{40}$/;
const SHA64 = /^[0-9a-f]{64}$/;
const SIMPLE_ID = /^[A-Za-z0-9_.:-]{1,128}$/;
const AUTH_ID = /^[A-Za-z0-9_-]{10,160}$/;

function fail(code) { throw new Error('RECOVERY_' + code); }
export function recoverySha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
function requireMatch(value, regex, code) {
  if (typeof value !== 'string' || !regex.test(value)) fail(code);
}
function safeRelativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\')
      || value.includes('\0') || value.includes('//') || value.includes(':')
      || value.startsWith('/') || value.split('/').some(p => !p || p === '.' || p === '..')) {
    fail('UNSAFE_PATH');
  }
  return value;
}
function within(parent, candidate) {
  const rel = relative(resolve(parent), resolve(candidate));
  if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) fail('PATH_ESCAPE');
  return resolve(candidate);
}
function git(root, args, { binary = false } = {}) {
  const p = spawnSync('git', ['-C', root, ...args], {
    encoding: binary ? null : 'utf8', windowsHide: true, timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
  if (p.error || p.status !== 0) fail('GIT_COMMAND_FAILED_' + args[0].replace(/[^a-zA-Z0-9]/g, '_'));
  return binary ? p.stdout : p.stdout.trim();
}
export function parseRecoveryPorcelain(raw) {
  if (!Buffer.isBuffer(raw)) fail('PORCELAIN_BUFFER_REQUIRED');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  if (!text) return [];
  if (!text.endsWith('\0')) fail('PORCELAIN_MISSING_NUL');
  const fields = text.slice(0, -1).split('\0');
  const changed = [];
  for (let i = 0; i < fields.length; i += 1) {
    const item = fields[i];
    if (item.length < 4 || item[2] !== ' ' || !/^[ MARCUDT?!]{2}$/.test(item.slice(0, 2))) {
      fail('PORCELAIN_MALFORMED');
    }
    changed.push(item.slice(3));
    if (!item.slice(3)) fail('PORCELAIN_EMPTY_PATH');
    if (/[RC]/.test(item.slice(0, 2))) {
      const origin = fields[++i];
      if (!origin) fail('PORCELAIN_RENAME_MISSING_SOURCE');
      changed.push(origin);
    }
  }
  return [...new Set(changed)];
}
export function recoveryChangedPaths(worktree) {
  return parseRecoveryPorcelain(git(worktree, [
    'status', '--porcelain=v1', '-z', '--untracked-files=all',
  ], { binary: true }));
}
function assertNormalFile(root, rel) {
  safeRelativePath(rel);
  const full = within(root, resolve(root, rel));
  // Reject symlinks in every component, including parent directories.
  const pieces = rel.split('/');
  let node = root;
  for (const part of pieces) {
    node = resolve(node, part);
    const stat = lstatSync(node);
    if (stat.isSymbolicLink()) fail('SYMLINK_FORBIDDEN');
  }
  if (!lstatSync(full).isFile()) fail('NOT_REGULAR_FILE');
  return full;
}
export function validateRecoveryContract(contract, manifest) {
  if (!contract || contract.schema !== RECOVERY_CONTRACT_SCHEMA) fail('SCHEMA_INVALID');
  requireMatch(contract.repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'REPOSITORY_INVALID');
  requireMatch(contract.task_id, SIMPLE_ID, 'TASK_INVALID');
  if (!Number.isSafeInteger(contract.issue_number) || contract.issue_number < 1
      || !Number.isSafeInteger(contract.pr_number) || contract.pr_number < 1
      || !Number.isSafeInteger(contract.preliminary_gate_id) || contract.preliminary_gate_id < 1) {
    fail('IDENTIFIERS_INVALID');
  }
  for (const key of ['reviewed_main_sha', 'original_pr_head_sha', 'original_pr_base_sha']) {
    requireMatch(contract[key], SHA40, key.toUpperCase() + '_INVALID');
  }
  for (const key of ['artifact_sha256', 'journal_sha256', 'receipt_sha256', 'controller_file_sha256']) {
    requireMatch(contract[key], SHA64, key.toUpperCase() + '_INVALID');
  }
  for (const key of ['original_run_id', 'original_lease_id']) {
    requireMatch(contract[key], SIMPLE_ID, key.toUpperCase() + '_INVALID');
  }
  requireMatch(contract.consumed_authorization_id, AUTH_ID, 'AUTHORIZATION_ID_INVALID');
  requireMatch(contract.original_branch, /^[A-Za-z0-9_./-]{1,180}$/, 'BRANCH_INVALID');
  const worktree = safeRelativePath(contract.original_worktree_relative_path);
  if (!worktree.startsWith('worktrees/')) fail('WORKTREE_OUTSIDE_ALLOWED_ROOT');
  const artifacts = manifest?.issue_execution_policy?.allowed_files || [];
  const controllers = manifest?.issue_execution_policy?.controller_post_gate_allowed_files || [];
  if (manifest?.repository !== contract.repository || manifest?.issue_number !== contract.issue_number
      || manifest?.task_id !== contract.task_id
      || artifacts.length !== 1 || artifacts[0] !== contract.artifact_path
      || controllers.length !== 1 || controllers[0] !== contract.controller_path) {
    fail('MANIFEST_POLICY_MISMATCH');
  }
  safeRelativePath(contract.artifact_path);
  safeRelativePath(contract.controller_path);
  if (contract.artifact_path === contract.controller_path) fail('PATH_POLICY_OVERLAP');
  return true;
}
export function validateRecoveryStatus(content, contract) {
  let status;
  try { status = JSON.parse(content.toString('utf8')); } catch { fail('CONTROLLER_JSON_INVALID'); }
  if (!status || status.overall_status === 'PASS'
      || status.latest_actions_run?.status !== 'SUCCESS'
      || status.latest_actions_run?.head_sha !== contract.original_pr_head_sha
      || status.next_action?.pr_number !== contract.pr_number
      || status.next_action?.status !== 'READY'
      || (status.completed || []).some(x => x.id === contract.task_id)
      || !(status.in_progress || []).some(x => x.id === contract.task_id && x.status === 'FINAL_GATE_PENDING')) {
    fail('CONTROLLER_SEMANTIC_MISMATCH');
  }
  return true;
}
function validateGate(gate, artifacts, contract) {
  if (gate?.id !== contract.preliminary_gate_id
      || gate?.head_sha !== contract.original_pr_head_sha
      || gate?.status !== 'completed' || gate?.conclusion !== 'success'
      || gate?.name !== 'GSO Gate') fail('PRELIMINARY_GATE_MISMATCH');
  const names = (artifacts || []).filter(x => x && x.expired === false).map(x => x.name);
  for (const p of REQUIRED_ARTIFACT_PREFIXES) {
    if (!names.includes(p + contract.preliminary_gate_id)) fail('MANDATORY_ARTIFACT_MISSING');
  }
}
export async function planExistingPrRecovery({ repoRoot, stateDir, contract, github }) {
  if (!github || typeof github.pullRequest !== 'function'
      || typeof github.pullRequestFiles !== 'function' || typeof github.workflowRun !== 'function'
      || typeof github.workflowArtifacts !== 'function' || typeof github.mainSha !== 'function') {
    fail('READ_ONLY_GITHUB_BROKER_REQUIRED');
  }
  const root = resolve(repoRoot);
  const state = resolve(stateDir);
  if (state === root || !relative(root, state).startsWith('..' + sep)) {
    fail('STATE_MUST_BE_OUTSIDE_REPOSITORY');
  }
  const manifest = JSON.parse(git(root, ['show', 'HEAD:control/local-bridge/issue-21.execute.manifest.json']));
  // A generic task supplies a reviewed manifest path; the fallback above supports
  // the first fixture only and is never authority to widen an allowlist.
  validateRecoveryContract(contract, manifest);
  const head = git(root, ['rev-parse', 'HEAD']);
  const localMain = git(root, ['rev-parse', 'origin/main']);
  if (head !== contract.reviewed_main_sha || localMain !== head
      || recoveryChangedPaths(root).length !== 0) fail('MAIN_NOT_EXACT_CLEAN');
  if (await github.mainSha() !== head) fail('REMOTE_MAIN_CHANGED');

  const pr = await github.pullRequest(contract.pr_number);
  if (pr?.number !== contract.pr_number || pr?.state !== 'open' || pr?.merged === true
      || pr?.head?.sha !== contract.original_pr_head_sha
      || pr?.base?.sha !== contract.original_pr_base_sha
      || pr?.base?.ref !== 'main'
      || pr?.head?.ref !== contract.original_branch) fail('EXACT_PR_MISMATCH');
  if (pr.changed_files !== 1) fail('PR_SCOPE_COUNT_INVALID');
  const prFiles = await github.pullRequestFiles(contract.pr_number);
  if (!Array.isArray(prFiles) || prFiles.length !== 1
      || prFiles[0].filename !== contract.artifact_path
      || prFiles[0].status !== 'added') fail('PR_PATH_SCOPE_MISMATCH');

  const gate = await github.workflowRun(contract.preliminary_gate_id);
  const artifacts = await github.workflowArtifacts(contract.preliminary_gate_id);
  validateGate(gate, artifacts, contract);

  const originalWorktree = within(state, resolve(state, contract.original_worktree_relative_path));
  const actualWorktree = realpathSync(originalWorktree);
  within(state, actualWorktree);
  if (git(actualWorktree, ['rev-parse', 'HEAD']) !== contract.original_pr_head_sha
      || git(actualWorktree, ['branch', '--show-current']) !== contract.original_branch) {
    fail('HISTORICAL_WORKTREE_MISMATCH');
  }
  const changed = recoveryChangedPaths(actualWorktree);
  if (changed.length !== 1 || changed[0] !== contract.controller_path) fail('WORKTREE_SCOPE_MISMATCH');
  const artifactBytes = readFileSync(assertNormalFile(actualWorktree, contract.artifact_path));
  if (recoverySha256(artifactBytes) !== contract.artifact_sha256) fail('ARTIFACT_HASH_MISMATCH');
  const committedArtifact = git(actualWorktree, ['show', 'HEAD:' + contract.artifact_path], { binary: true });
  if (recoverySha256(committedArtifact) !== contract.artifact_sha256) fail('COMMITTED_ARTIFACT_MISMATCH');
  const controllerBytes = readFileSync(assertNormalFile(actualWorktree, contract.controller_path));
  if (recoverySha256(controllerBytes) !== contract.controller_file_sha256) fail('CONTROLLER_FILE_HASH_MISMATCH');
  validateRecoveryStatus(controllerBytes, contract);

  const journalPath = within(state, resolve(state, 'leases', contract.original_lease_id, 'journal.json'));
  const receiptPath = within(state, resolve(state, 'authorizations', 'consumed',
    contract.consumed_authorization_id, 'receipt.json'));
  const journalBytes = readFileSync(assertNormalFile(state,
    relative(state, journalPath).split(sep).join('/')));
  const receiptBytes = readFileSync(assertNormalFile(state,
    relative(state, receiptPath).split(sep).join('/')));
  if (recoverySha256(journalBytes) !== contract.journal_sha256
      || recoverySha256(receiptBytes) !== contract.receipt_sha256) fail('HISTORY_BYTES_CHANGED');
  const journal = JSON.parse(journalBytes.toString('utf8'));
  const receipt = JSON.parse(receiptBytes.toString('utf8'));
  if (journal.state !== 'BLOCKED' || journal.run_id !== contract.original_run_id
      || journal.lease_id !== contract.original_lease_id
      || receipt.authorization_id !== contract.consumed_authorization_id
      || receipt.run_id !== contract.original_run_id
      || receipt.lease_id !== contract.original_lease_id
      || receipt.model_call_started !== true) fail('HISTORY_LINEAGE_INVALID');

  return {
    schema: 'gso.finalize-existing-pr.plan.v1',
    eligible: true,
    readonly: true,
    original_pr_head_sha: contract.original_pr_head_sha,
    preliminary_gate_id: contract.preliminary_gate_id,
    artifact_sha256: contract.artifact_sha256,
    controller_file_sha256: contract.controller_file_sha256,
    historical_journal_sha256: contract.journal_sha256,
    historical_receipt_sha256: contract.receipt_sha256,
    recovery_binding_sha256: recoverySha256(Buffer.from(JSON.stringify(contract), 'utf8')),
    changed_paths: changed,
    model_calls: 0,
    github_writes: 0,
    next_action: 'REQUIRES_SEPARATELY_REVIEWED_CONTROLLER_ONLY_APPLY',
  };
}
