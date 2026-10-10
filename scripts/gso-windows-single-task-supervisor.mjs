// Windows resident supervisor for ONE reviewed Issue and ONE reviewed executor.
// Keeps polling after a ChatGPT Work window closes; it never issues approvals.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync,
  renameSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  defaultStateDir, assertStateDirOutsideRepository,
  GitHubControllerBroker, evaluateExecutorIssueState,
} from './gso-windows-auto-executor.mjs';

export const SINGLE_TASK_SUPERVISOR_SCHEMA = 'gso.single-task-supervisor.v1';
const TERMINAL_STATES = new Set([
  'BLOCKED', 'FAILED', 'FIX_REQUIRED', 'PASS', 'PR_REVIEW_REQUIRED',
  'RUNNING', 'CLAIMED', 'PR_CREATED', 'TESTING', 'FINAL_GATE_PENDING',
]);
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{15,127}$/;
const SHA256 = /^[0-9a-f]{64}$/;

function fail(reason) { throw new Error('SINGLE_TASK_' + reason); }
function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function safeChild(root, child) {
  const base = resolve(root);
  const full = resolve(child);
  const part = relative(base, full);
  if (!part || part === '..' || part.startsWith('..' + sep) || isAbsolute(part)) fail('PATH_ESCAPE');
  return full;
}
function atomicJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = path + '.' + process.pid + '.tmp';
  writeFileSync(temporary, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  renameSync(temporary, path);
}
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }

export function validateSupervisorConfig(config, manifest) {
  if (config?.schema !== SINGLE_TASK_SUPERVISOR_SCHEMA) fail('CONFIG_SCHEMA_INVALID');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository || '')) fail('REPOSITORY_INVALID');
  if (!Number.isSafeInteger(config.issue_number) || config.issue_number < 1) fail('ISSUE_INVALID');
  if (!Number.isInteger(config.poll_seconds) || config.poll_seconds < 5 || config.poll_seconds > 300) fail('POLL_SECONDS_OUT_OF_RANGE');
  if (!Number.isInteger(config.max_authorized_launches) || config.max_authorized_launches < 1
      || config.max_authorized_launches > 5) fail('LAUNCH_BUDGET_OUT_OF_RANGE');
  if (!Number.isInteger(config.child_timeout_minutes) || config.child_timeout_minutes < 1
      || config.child_timeout_minutes > 240) fail('TIMEOUT_OUT_OF_RANGE');
  if (typeof config.manifest_path !== 'string'
      || !/^control\/local-bridge\/[A-Za-z0-9._-]+\.json$/.test(config.manifest_path)
      || config.manifest_path.includes('..')) fail('MANIFEST_PATH_INVALID');
  if (manifest?.mode !== 'EXECUTE_ONE_AUTHORIZED_ISSUE'
      || manifest?.repository !== config.repository
      || manifest?.issue_number !== config.issue_number) fail('EXECUTE_MANIFEST_TASK_MISMATCH');
  return true;
}

// Pure state decision: GitHub cannot grant model credits by changing a label.
export function decideSingleTaskAction({ issueOpen, effectiveState, pendingCount, launches, maxLaunches }) {
  if (!issueOpen) return 'STOP_ISSUE_CLOSED';
  if (TERMINAL_STATES.has(effectiveState)) return 'STOP_' + effectiveState;
  if (effectiveState !== 'READY') return 'STOP_UNVERIFIED_STATE';
  if (launches >= maxLaunches) return 'STOP_BUDGET_EXHAUSTED';
  if (pendingCount > 1) return 'STOP_MULTIPLE_PENDING_APPROVALS';
  if (pendingCount === 0) return 'WAIT_FOR_FRESH_APPROVAL';
  return 'DISPATCH_ONE_AUTHORIZED_RUN';
}

export function acquireSupervisorLock(stateDir, issueNumber) {
  const path = safeChild(stateDir, join(stateDir, 'locks', 'single-task-' + issueNumber + '.lock'));
  mkdirSync(dirname(path), { recursive: true });
  try { mkdirSync(path); } catch (error) {
    if (error.code === 'EEXIST') fail('ALREADY_RUNNING_OR_STALE_LOCK');
    throw error;
  }
  atomicJson(join(path, 'owner.json'), { pid: process.pid, issue_number: issueNumber, started: new Date().toISOString() });
  return { path };
}
export function releaseSupervisorLock(lock) {
  if (lock?.path) rmSync(lock.path, { recursive: true, force: true });
}

function journalPath(stateDir, issueNumber) {
  return safeChild(stateDir, join(stateDir, 'single-task', 'issue-' + issueNumber, 'dispatch-ledger.json'));
}
function loadLedger(path, issueNumber) {
  if (!existsSync(path)) return { schema: 1, issue_number: issueNumber, attempts: [] };
  const ledger = readJson(path);
  if (ledger.schema !== 1 || ledger.issue_number !== issueNumber || !Array.isArray(ledger.attempts)) fail('LEDGER_INVALID');
  return ledger;
}
function authPendingRoot(stateDir) { return safeChild(stateDir, join(stateDir, 'authorizations', 'pending')); }

export function findFreshPendingAuthorizations({ stateDir, config, manifestHash, approvedBaseSha, ledger }) {
  const root = authPendingRoot(stateDir);
  if (!existsSync(root)) return [];
  if (lstatSync(root).isSymbolicLink()) fail('AUTH_ROOT_SYMLINK');
  const names = readdirSync(root).filter(name => name.endsWith('.json')).sort();
  const found = [];
  for (const name of names) {
    const path = safeChild(root, join(root, name));
    if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) fail('AUTH_FILE_NOT_REGULAR');
    const a = readJson(path);
    if (a.issue_number !== config.issue_number) continue;
    if (!ID.test(a.authorization_id || '') || !SHA256.test(a.manifest_sha256 || '')
        || a.max_model_runs !== 1 || a.max_automatic_retries !== 0
        || !Number.isFinite(Date.parse(a.expires_at || ''))) fail('AUTH_ENVELOPE_INVALID');
    // Controller performs the full attestation and consumes the envelope once.
    if (a.manifest_sha256 !== manifestHash || a.approved_base_sha !== approvedBaseSha) fail('AUTH_BINDING_MISMATCH');
    if (Date.parse(a.expires_at) <= Date.now()) fail('AUTHORIZATION_EXPIRED');
    if (ledger.attempts.some(x => x.authorization_id === a.authorization_id)) continue;
    const consumed = safeChild(stateDir, join(stateDir, 'authorizations', 'consumed', a.authorization_id));
    if (existsSync(consumed)) continue;
    found.push({ path, authorization_id: a.authorization_id });
  }
  return found;
}

function gitHead(repoRoot, ref) {
  const child = spawnSyncGit(repoRoot, ['rev-parse', ref]);
  if (!/^[0-9a-f]{40}$/.test(child)) fail('REVIEWED_MAIN_NOT_AVAILABLE');
  return child;
}
function spawnSyncGit(repoRoot, args) {
  const result = spawnSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf8', windowsHide: true, timeout: 30000,
  });
  if (result.error || result.status !== 0) fail('GIT_READ_FAILED');
  return result.stdout.trim();
}
export async function launchReviewedExecutor({ repoRoot, stateDir, manifestPath, authorization, outputPath, timeoutMinutes }) {
  const source = resolve(repoRoot, 'scripts', 'gso-windows-auto-executor.mjs');
  safeChild(repoRoot, source);
  if (!existsSync(source)) fail('REVIEWED_EXECUTOR_MISSING');
  const logs = safeChild(stateDir, join(stateDir, 'single-task', 'logs'));
  mkdirSync(logs, { recursive: true });
  const logFile = safeChild(logs, join(logs, 'run-' + digest(authorization.authorization_id).slice(0, 12) + '.log'));
  const fd = openSync(logFile, 'a', 0o600);
  const argv = [
    source, '--mode', 'execute', '--repo-root', repoRoot, '--state-dir', stateDir,
    '--manifest', manifestPath, '--authorization-file', authorization.path,
    '--output', outputPath,
  ];
  try {
    return await new Promise((resolveRun) => {
      let done = false;
      let timedOut = false;
      const child = spawn(process.execPath, argv, {
        cwd: repoRoot, shell: false, windowsHide: true,
        stdio: ['ignore', fd, fd],
      });
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMinutes * 60000);
      const finish = (value) => {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        resolveRun({ ...value, timed_out: timedOut, log_file: logFile });
      };
      child.once('error', (error) => finish({ exit_code: null, failure_code: error.code || 'SPAWN_ERROR' }));
      child.once('exit', (code, signal) => finish({ exit_code: code, signal: signal || null }));
    });
  } finally { closeSync(fd); }
}

export async function runOneSupervisorPoll({
  config, repoRoot, stateDir, manifestPath, manifestHash, readRemoteState,
  launch = launchReviewedExecutor,
}) {
  const file = journalPath(stateDir, config.issue_number);
  const ledger = loadLedger(file, config.issue_number);
  const remote = await readRemoteState();
  const approvedBaseSha = gitHead(repoRoot, 'origin/main');
  if (gitHead(repoRoot, 'HEAD') !== approvedBaseSha) fail('CHECKOUT_NOT_EXACT_MAIN');
  if (spawnSyncGit(repoRoot, ['status', '--porcelain=v1', '--untracked-files=all']) !== '') {
    fail('CHECKOUT_DIRTY');
  }
  const pending = remote.effectiveState === 'READY'
    ? findFreshPendingAuthorizations({ stateDir, config, manifestHash, approvedBaseSha, ledger })
    : [];
  const action = decideSingleTaskAction({
    issueOpen: remote.open, effectiveState: remote.effectiveState,
    pendingCount: pending.length, launches: ledger.attempts.length,
    maxLaunches: config.max_authorized_launches,
  });
  if (action !== 'DISPATCH_ONE_AUTHORIZED_RUN') return { action, model_calls: 0 };
  const authorization = pending[0];
  const outputPath = safeChild(stateDir, join(stateDir, 'single-task', 'issue-' + config.issue_number,
    'result-' + digest(authorization.authorization_id).slice(0, 12) + '.json'));
  // Commit the one-time dispatch receipt before process launch. A crash is
  // fail-closed: a restarted daemon will NOT automatically repeat this call.
  const entry = { authorization_id: authorization.authorization_id, status: 'DISPATCH_CLAIMED', at: new Date().toISOString() };
  ledger.attempts.push(entry);
  atomicJson(file, ledger);
  let outcome;
  try {
    outcome = await launch({
      repoRoot, stateDir, manifestPath, authorization, outputPath,
      timeoutMinutes: config.child_timeout_minutes,
    });
  } catch (error) {
    outcome = { exit_code: null, failure_code: error.code || 'LAUNCH_FAILED' };
  }
  entry.status = 'EXITED';
  entry.outcome = {
    exit_code: outcome.exit_code, timed_out: outcome.timed_out === true,
    failure_code: outcome.failure_code || null,
  };
  if (existsSync(outputPath)) {
    try { entry.controller_final_state = readJson(outputPath).final_state || 'UNKNOWN'; }
    catch { entry.controller_final_state = 'INVALID_OUTPUT'; }
  }
  atomicJson(file, ledger);
  return {
    action: entry.controller_final_state === 'PR_REVIEW_REQUIRED' && outcome.exit_code === 0
      ? 'STOP_PR_REVIEW_REQUIRED' : 'STOP_EXECUTION_REQUIRES_REVIEW',
    launches: ledger.attempts.length,
    controller_final_state: entry.controller_final_state || null,
    exit_code: entry.outcome.exit_code,
    model_calls: 'CONTROLLER_OWNED_EVIDENCE_ONLY',
  };
}

async function start({ configFile, repoRoot, stateDir, mode, allowExecute }) {
  const config = readJson(resolve(configFile));
  const manifestPath = safeChild(repoRoot, resolve(repoRoot, config.manifest_path));
  const bytes = readFileSync(manifestPath);
  const manifest = JSON.parse(bytes.toString('utf8'));
  validateSupervisorConfig(config, manifest);
  assertStateDirOutsideRepository(repoRoot, stateDir);
  if (mode === 'probe') {
    return { status: 'CONFIG_READY_NO_MODEL', issue: config.issue_number, repository: config.repository,
      manifest_sha256: digest(bytes), model_calls: 0 };
  }
  if (mode !== 'watch' || allowExecute !== true) fail('EXPLICIT_WATCH_EXECUTION_FLAG_REQUIRED');
  const lock = acquireSupervisorLock(stateDir, config.issue_number);
  try {
    const broker = new GitHubControllerBroker(config.repository);
    const actor = await broker.readAuthenticatedUser();
    let stopped = false;
    process.once('SIGINT', () => { stopped = true; });
    process.once('SIGTERM', () => { stopped = true; });
    let lastAction = '';
    while (!stopped) {
      try {
        const readRemoteState = async () => {
          const [issue, comments] = await Promise.all([
            broker.readIssue(config.issue_number), broker.readComments(config.issue_number),
          ]);
          const evidence = evaluateExecutorIssueState(issue, comments, {
            trustedLogin: actor.login, repository: config.repository,
            issueNumber: config.issue_number, stateDir,
          });
          return { open: issue.state === 'open', effectiveState: evidence.effective_state };
        };
        const result = await runOneSupervisorPoll({
          config, repoRoot, stateDir, manifestPath, manifestHash: digest(bytes),
          readRemoteState,
        });
        atomicJson(safeChild(stateDir, join(stateDir, 'single-task', 'issue-' + config.issue_number,
          'heartbeat.json')), { ...result, at: new Date().toISOString() });
        if (result.action !== lastAction) process.stdout.write(JSON.stringify(result) + '\n');
        lastAction = result.action;
        if (result.action.startsWith('STOP_')) return result;
      } catch (error) {
        // Only network/service errors retry without dispatch. An admission,
        // authorization, path or source error stops rather than polling forever.
        const transient = /(?:fetch failed|ETIMEDOUT|ECONNRESET|ENOTFOUND|GITHUB_[A-Z_]+_FAILED:5[0-9]{2})/i.test(error.message || '');
        if (!transient) throw error;
        const failure = { action: 'REMOTE_TEMPORARILY_UNAVAILABLE', reason: error.message, at: new Date().toISOString() };
        atomicJson(safeChild(stateDir, join(stateDir, 'single-task', 'issue-' + config.issue_number,
          'heartbeat.json')), failure);
        if (lastAction !== failure.reason) process.stderr.write(JSON.stringify(failure) + '\n');
        lastAction = failure.reason;
      }
      await new Promise(done => setTimeout(done, config.poll_seconds * 1000));
    }
    return { action: 'STOP_MANUAL_SHUTDOWN' };
  } finally { releaseSupervisorLock(lock); }
}

function parseArgs(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--allow-execute') { values.allowExecute = true; continue; }
    if (!['--config', '--repo-root', '--state-dir', '--mode'].includes(key) || !argv[i + 1]) fail('CLI_ARGUMENT_INVALID');
    values[key.slice(2).replace(/-([a-z])/g, (_, x) => x.toUpperCase())] = argv[++i];
  }
  return values;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.config) fail('CONFIG_REQUIRED');
  const repoRoot = resolve(args.repoRoot || process.cwd());
  const stateDir = resolve(args.stateDir || defaultStateDir(repoRoot));
  const report = await start({ configFile: args.config, repoRoot, stateDir,
    mode: args.mode || 'probe', allowExecute: args.allowExecute });
  process.stdout.write(JSON.stringify(report) + '\n');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) main().catch((error) => {
  process.stderr.write(error.message + '\n');
  process.exitCode = 1;
});

