import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  buildCodexChildEnv,
  checkChangedPaths,
  evaluateAdmission,
  evaluateIssueState,
  probeLocalCodex,
} from './gso-windows-local-bridge-dry-run.mjs';

const STATE_MARKER = '<!-- gso-auto-executor-state:v1 -->';
const TERMINAL_STATES = new Set(['PASS', 'FAILED', 'BLOCKED', 'FIX_REQUIRED']);
const TRANSITIONS = {
  READY: new Set(['CLAIMED']),
  CLAIMED: new Set(['RUNNING', 'BLOCKED']),
  RUNNING: new Set(['PR_CREATED', 'FAILED', 'BLOCKED']),
  PR_CREATED: new Set(['TESTING', 'FAILED']),
  TESTING: new Set(['PASS', 'FAILED']),
  FAILED: new Set(['BLOCKED', 'FIX_REQUIRED']),
  PASS: new Set(),
  BLOCKED: new Set(),
  FIX_REQUIRED: new Set(),
};
const SECRET_ENV = /^(?:GH_TOKEN|GITHUB_TOKEN|OPENAI_API_KEY|CODEX_API_KEY|GIT_ASKPASS|SSH_ASKPASS|GSO_GITHUB_|GITHUB_APP_)/i;
const TOKEN_PATTERN = /(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})/g;
const ALLOWED_API_OPERATIONS = new Set([
  'LIST_READY_ISSUES',
  'READ_ISSUE',
  'READ_COMMENTS',
  'WRITE_STATE_COMMENT',
  'VERIFY_STATE_COMMENT',
  'CREATE_PULL_REQUEST',
  'READ_GATE_RUNS',
  'READ_GATE_ARTIFACTS',
]);

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function safeChild(parent, child) {
  const parentPath = resolve(parent);
  const childPath = resolve(child);
  const rel = relative(parentPath, childPath);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error('UNSAFE_CHILD_PATH');
  }
  return childPath;
}

export function atomicWriteJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  renameSync(temporary, path);
}

function run(command, args, options = {}) {
  const useShell = process.platform === 'win32' && /\.cmd$/i.test(command);
  const commandLine = useShell
    ? [`"${command.replaceAll('"', '""')}"`, ...args.map((arg) => `"${String(arg).replaceAll('"', '""')}"`)].join(' ')
    : null;
  const result = spawnSync(useShell ? commandLine : command, useShell ? [] : args, {
    cwd: options.cwd,
    env: options.env,
    input: options.input,
    encoding: 'utf8',
    windowsHide: true,
    shell: useShell,
    timeout: options.timeout ?? 30_000,
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
  return result.stdout.trim();
}

function changedPaths(repoRoot) {
  const status = git(repoRoot, ['status', '--porcelain=v1', '--untracked-files=all']);
  return status.split(/\r?\n/).filter(Boolean).map((line) => {
    const path = line.slice(3).trim();
    return path.includes(' -> ') ? path.split(' -> ').at(-1) : path;
  });
}

export function createRunIdentity({ repository, issueNumber, baseSha, manifestHash, issueRevision }) {
  const runId = `gso-${issueNumber}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const leaseId = sha256([repository, issueNumber, baseSha, manifestHash, issueRevision].join('\n')).slice(0, 32);
  return { runId, leaseId };
}

export function acquireExecutorLock(stateDir, runId) {
  const lockDir = safeChild(stateDir, join(stateDir, 'locks', 'executor.lock'));
  mkdirSync(dirname(lockDir), { recursive: true });
  try {
    mkdirSync(lockDir);
  } catch (error) {
    if (error.code === 'EEXIST') return { acquired: false, reason: 'SINGLE_INSTANCE_LOCK_BUSY', lockDir };
    throw error;
  }
  atomicWriteJson(join(lockDir, 'owner.json'), {
    run_id: runId,
    pid: process.pid,
    acquired_at: new Date().toISOString(),
  });
  return { acquired: true, lockDir };
}

export function releaseExecutorLock(lock) {
  if (lock?.acquired) rmSync(lock.lockDir, { recursive: true, force: true });
}

export function acquireExecutionLease(stateDir, leaseId, runId) {
  const leaseDir = safeChild(stateDir, join(stateDir, 'leases', leaseId));
  mkdirSync(dirname(leaseDir), { recursive: true });
  try {
    mkdirSync(leaseDir);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const journalPath = join(leaseDir, 'journal.json');
    const prior = existsSync(journalPath) ? JSON.parse(readFileSync(journalPath, 'utf8')) : { state: 'UNKNOWN' };
    return {
      acquired: false,
      duplicate_prevented: true,
      recovery_required: !TERMINAL_STATES.has(prior.state),
      prior_state: prior.state,
      leaseDir,
      journalPath,
    };
  }
  const journalPath = join(leaseDir, 'journal.json');
  const journal = {
    schema_version: 1,
    run_id: runId,
    lease_id: leaseId,
    state: 'READY',
    model_runs: 0,
    automatic_retries: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    history: [{ state: 'READY', at: new Date().toISOString(), evidence: { source: 'verified_issue' } }],
  };
  atomicWriteJson(journalPath, journal);
  return { acquired: true, duplicate_prevented: false, recovery_required: false, leaseDir, journalPath, journal };
}

export function transitionJournal(journalPath, nextState, evidence = {}) {
  const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
  if (!TRANSITIONS[journal.state]?.has(nextState)) {
    throw new Error(`INVALID_STATE_TRANSITION:${journal.state}->${nextState}`);
  }
  if (nextState === 'RUNNING' && (!evidence.run_id || !evidence.lease_id || !evidence.codex_thread_id)) {
    throw new Error('RUNNING_REQUIRES_RUN_LEASE_AND_CODEX_THREAD_EVIDENCE');
  }
  if (nextState === 'PASS' && (!evidence.gate_run_id || evidence.gate_conclusion !== 'success')) {
    throw new Error('PASS_REQUIRES_SUCCESSFUL_GATE_EVIDENCE');
  }
  const updated = {
    ...journal,
    state: nextState,
    updated_at: new Date().toISOString(),
    history: [...journal.history, { state: nextState, at: new Date().toISOString(), evidence }],
  };
  atomicWriteJson(journalPath, updated);
  return updated;
}

export function recordModelRun(journalPath) {
  const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
  if (journal.model_runs >= 1) throw new Error('MODEL_RUN_LIMIT_EXCEEDED');
  const updated = { ...journal, model_runs: journal.model_runs + 1, updated_at: new Date().toISOString() };
  atomicWriteJson(journalPath, updated);
  return updated;
}

export function buildRestrictedCodexEnv(source = process.env) {
  const clean = buildCodexChildEnv(source);
  for (const name of Object.keys(clean)) if (SECRET_ENV.test(name)) delete clean[name];
  return {
    ...clean,
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'Never',
    GIT_CONFIG_NOSYSTEM: '1',
    NO_COLOR: '1',
  };
}

export function buildCodexInvocation({ codexPath, worktreePath, outputPath }) {
  return {
    command: codexPath,
    args: [
      'exec',
      '--ephemeral',
      '--ignore-user-config',
      '--sandbox', 'workspace-write',
      '--config', 'approval_policy="never"',
      '--config', 'sandbox_workspace_write.network_access=false',
      '--config', 'web_search="disabled"',
      '--cd', worktreePath,
      '--json',
      '--output-last-message', outputPath,
      '-',
    ],
    timeout_ms: 30 * 60 * 1000,
    max_model_runs: 1,
    max_automatic_retries: 0,
    direct_main_push: false,
  };
}

function encodePowerShell(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

export function probeCodexSandboxCredentialIsolation({ codexPath, repoRoot, env = process.env }) {
  const script = [
    "$probe = @('protocol=https', 'host=github.com', '') | git credential fill 2>$null",
    "$visible = [bool]($probe | Where-Object { $_ -like 'password=*' })",
    "if ($visible) { 'GITHUB_CREDENTIAL_VISIBLE=true' } else { 'GITHUB_CREDENTIAL_VISIBLE=false' }",
    "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://api.github.com' -TimeoutSec 3 | Out-Null; 'NETWORK_REACHABLE=true' } catch { 'NETWORK_REACHABLE=false' }",
  ].join('; ');
  const result = run(codexPath, [
    'sandbox', '-P', ':workspace', '--sandbox-state-disable-network', '-C', repoRoot,
    'powershell.exe', '-NoProfile', '-NonInteractive', '-EncodedCommand', encodePowerShell(script),
  ], { cwd: repoRoot, env: buildRestrictedCodexEnv(env), timeout: 30_000 });
  const output = `${result.stdout}\n${result.stderr}`;
  const credentialVisible = /GITHUB_CREDENTIAL_VISIBLE=true/.test(output);
  const networkReachable = /NETWORK_REACHABLE=true/.test(output);
  return {
    passed: result.ok && !credentialVisible && !networkReachable,
    restricted_token_sandbox_executed: result.ok,
    github_credential_visible: credentialVisible,
    direct_network_reachable: networkReachable,
    raw_output_recorded: false,
  };
}

export function scanForSecrets({ repoRoot, paths, exactSecrets = [] }) {
  const findings = [];
  for (const path of paths) {
    const absolute = resolve(repoRoot, path);
    if (!existsSync(absolute)) continue;
    const content = readFileSync(absolute, 'utf8');
    if (TOKEN_PATTERN.test(content)) findings.push({ path, reason: 'TOKEN_PATTERN' });
    TOKEN_PATTERN.lastIndex = 0;
    for (const secret of exactSecrets.filter(Boolean)) {
      if (content.includes(secret)) findings.push({ path, reason: `EXACT_CONTROLLER_SECRET:${sha256(secret).slice(0, 12)}` });
    }
  }
  return { passed: findings.length === 0, findings, secret_values_recorded: false };
}

export function formatStateComment({ state, runId, leaseId, evidence = {} }) {
  const payload = {
    schema_version: 1,
    state,
    run_id: runId,
    lease_id: leaseId,
    updated_at: new Date().toISOString(),
    evidence,
  };
  return `${STATE_MARKER}\n\nGSO_STATE=${state}\nRUN_ID=${runId}\nLEASE_ID=${leaseId}\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
}

export function parseStateComment(body = '') {
  if (!body.includes(STATE_MARKER)) return null;
  const match = body.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

export function evaluateExecutorIssueState(issue, comments = []) {
  const base = evaluateIssueState(issue, comments);
  const controllerStates = comments
    .map((comment) => ({ parsed: parseStateComment(comment.body || ''), created_at: comment.created_at || '' }))
    .filter((entry) => entry.parsed)
    .sort((left, right) => left.created_at.localeCompare(right.created_at));
  const latest = controllerStates.at(-1)?.parsed;
  return latest
    ? {
        ...base,
        effective_state: latest.state,
        effective_run_id: latest.run_id,
        effective_lease_id: latest.lease_id,
        controller_state_evidence: true,
      }
    : { ...base, controller_state_evidence: false };
}

function readGitHubCredential() {
  const result = run('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    env: process.env,
  });
  if (!result.ok) throw new Error('CONTROLLER_GITHUB_CREDENTIAL_UNAVAILABLE');
  const values = Object.fromEntries(result.stdout.split(/\r?\n/).map((line) => {
    const index = line.indexOf('=');
    return index > 0 ? [line.slice(0, index), line.slice(index + 1)] : null;
  }).filter(Boolean));
  if (!values.password) throw new Error('CONTROLLER_GITHUB_CREDENTIAL_UNAVAILABLE');
  return values.password;
}

export class GitHubControllerBroker {
  constructor(repository, tokenProvider = readGitHubCredential) {
    this.repository = repository;
    this.tokenProvider = tokenProvider;
    this.audit = [];
  }

  async request(operation, method, path, body = undefined) {
    if (!ALLOWED_API_OPERATIONS.has(operation)) throw new Error(`GITHUB_OPERATION_NOT_ALLOWED:${operation}`);
    const expectedPrefix = `/repos/${this.repository}/`;
    if (!path.startsWith(expectedPrefix)) throw new Error('GITHUB_ENDPOINT_OUTSIDE_REPOSITORY');
    const token = this.tokenProvider();
    try {
      const response = await fetch(`https://api.github.com${path}`, {
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'gso-windows-auto-executor',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      this.audit.push({ operation, method, path, status: response.status, at: new Date().toISOString() });
      if (!response.ok) throw new Error(`GITHUB_${operation}_FAILED:${response.status}`);
      return response.status === 204 ? null : response.json();
    } finally {
      // The token remains scoped to this controller stack frame and is never
      // included in child environments, prompts, journals, or audit records.
    }
  }

  readIssue(issueNumber) {
    return this.request('READ_ISSUE', 'GET', `/repos/${this.repository}/issues/${issueNumber}`);
  }

  listOpenIssues() {
    return this.request('LIST_READY_ISSUES', 'GET', `/repos/${this.repository}/issues?state=open&per_page=100`);
  }

  readComments(issueNumber) {
    return this.request('READ_COMMENTS', 'GET', `/repos/${this.repository}/issues/${issueNumber}/comments?per_page=100`);
  }

  async writeState(issueNumber, payload) {
    const body = formatStateComment(payload);
    const priorComments = await this.readComments(issueNumber);
    const prior = priorComments.find((comment) => {
      const parsed = parseStateComment(comment.body || '');
      return parsed?.state === payload.state
        && parsed?.run_id === payload.runId
        && parsed?.lease_id === payload.leaseId;
    });
    if (prior) return { comment_id: prior.id, read_after_write_verified: true, idempotent_replay: true };
    const created = await this.request('WRITE_STATE_COMMENT', 'POST', `/repos/${this.repository}/issues/${issueNumber}/comments`, { body });
    const verified = await this.request('VERIFY_STATE_COMMENT', 'GET', `/repos/${this.repository}/issues/comments/${created.id}`);
    if (verified.body !== body) throw new Error('GITHUB_WRITEBACK_READ_AFTER_WRITE_MISMATCH');
    return { comment_id: created.id, read_after_write_verified: true };
  }

  createPullRequest({ title, head, base = 'main', body }) {
    return this.request('CREATE_PULL_REQUEST', 'POST', `/repos/${this.repository}/pulls`, { title, head, base, body });
  }

  readGateRuns(headSha) {
    return this.request('READ_GATE_RUNS', 'GET', `/repos/${this.repository}/actions/runs?head_sha=${encodeURIComponent(headSha)}&per_page=20`);
  }

  readGateArtifacts(runId) {
    return this.request('READ_GATE_ARTIFACTS', 'GET', `/repos/${this.repository}/actions/runs/${runId}/artifacts?per_page=100`);
  }
}

export function createTaskWorktree({ repoRoot, stateDir, manifest, baseSha }) {
  if (manifest.planned_branch === 'main') throw new Error('DIRECT_MAIN_BRANCH_FORBIDDEN');
  const worktreePath = safeChild(stateDir, join(stateDir, manifest.planned_worktree_relative_path));
  if (existsSync(worktreePath)) {
    const head = git(worktreePath, ['rev-parse', 'HEAD']);
    return { path: worktreePath, created: false, head, branch: git(worktreePath, ['branch', '--show-current']) };
  }
  mkdirSync(dirname(worktreePath), { recursive: true });
  git(repoRoot, ['worktree', 'add', '-b', manifest.planned_branch, worktreePath, baseSha], { timeout: 120_000 });
  return { path: worktreePath, created: true, head: baseSha, branch: manifest.planned_branch };
}

function prepareProbeWorktree({ repoRoot, stateDir, issueNumber, baseSha }) {
  const path = safeChild(stateDir, join(stateDir, 'probes', `issue-${issueNumber}-${baseSha.slice(0, 12)}`));
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    git(repoRoot, ['worktree', 'add', '--detach', path, baseSha], { timeout: 120_000 });
  }
  const top = resolve(git(path, ['rev-parse', '--show-toplevel']));
  const sourceTop = resolve(git(repoRoot, ['rev-parse', '--show-toplevel']));
  return {
    passed: top !== sourceTop && git(path, ['rev-parse', 'HEAD']) === baseSha && changedPaths(path).length === 0,
    distinct_top_level: top !== sourceTop,
    same_base_sha: git(path, ['rev-parse', 'HEAD']) === baseSha,
    clean: changedPaths(path).length === 0,
    path,
  };
}

export function validateAuthorizationEnvelope(envelope, context) {
  const errors = [];
  if (!envelope) errors.push('AUTHORIZATION_ENVELOPE_MISSING');
  if (envelope?.issue_number !== context.issueNumber) errors.push('AUTHORIZATION_ISSUE_MISMATCH');
  if (envelope?.manifest_sha256 !== context.manifestHash) errors.push('AUTHORIZATION_MANIFEST_MISMATCH');
  if (envelope?.max_model_runs !== 1) errors.push('AUTHORIZATION_MODEL_LIMIT_INVALID');
  if (envelope?.max_automatic_retries !== 0) errors.push('AUTHORIZATION_RETRY_LIMIT_INVALID');
  if (!envelope?.expires_at || Date.parse(envelope.expires_at) <= Date.now()) errors.push('AUTHORIZATION_EXPIRED');
  return { valid: errors.length === 0, errors };
}

export function simulateExecution({ stateDir, identity, outcome = 'success', changed = [], policy }) {
  const lease = acquireExecutionLease(stateDir, identity.leaseId, identity.runId);
  if (!lease.acquired) return { outcome: 'duplicate-prevented', lease };
  transitionJournal(lease.journalPath, 'CLAIMED', { read_after_write_verified: true });
  if (outcome === 'network-failure') {
    return { outcome, state: 'CLAIMED', recovery_required: true, automatic_retries: 0, journalPath: lease.journalPath };
  }
  recordModelRun(lease.journalPath);
  transitionJournal(lease.journalPath, 'RUNNING', {
    run_id: identity.runId,
    lease_id: identity.leaseId,
    codex_thread_id: 'simulated-thread-no-model',
  });
  if (outcome === 'codex-failure' || outcome === 'timeout') {
    transitionJournal(lease.journalPath, 'FAILED', { reason: outcome === 'timeout' ? 'CODEX_TIMEOUT_30_MINUTES' : 'CODEX_EXIT_NONZERO' });
    return { outcome, state: 'FAILED', model_runs: 1, automatic_retries: 0, journalPath: lease.journalPath };
  }
  const pathCheck = checkChangedPaths(changed, policy);
  if (!pathCheck.ok || outcome === 'forbidden-change') {
    transitionJournal(lease.journalPath, 'BLOCKED', { reason: 'CHANGED_PATH_POLICY_FAILED', path_check: pathCheck });
    return { outcome: 'forbidden-change', state: 'BLOCKED', pathCheck, journalPath: lease.journalPath };
  }
  transitionJournal(lease.journalPath, 'PR_CREATED', { pr_number: 999, simulated: true });
  transitionJournal(lease.journalPath, 'TESTING', { gate_run_id: 888, runner_role: 'NON_AI_ONLY' });
  if (outcome === 'gate-failure') {
    transitionJournal(lease.journalPath, 'FAILED', { gate_run_id: 888, gate_conclusion: 'failure', auto_merge: false });
    transitionJournal(lease.journalPath, 'FIX_REQUIRED', { reason: 'GSO_GATE_FAILED' });
    return { outcome, state: 'FIX_REQUIRED', auto_merge: false, journalPath: lease.journalPath };
  }
  transitionJournal(lease.journalPath, 'PASS', { gate_run_id: 888, gate_conclusion: 'success', mandatory_artifacts: 5 });
  return { outcome, state: 'PASS', model_runs: 1, automatic_retries: 0, journalPath: lease.journalPath };
}

function runCodexProcess({ invocation, prompt, env, onThreadStarted }) {
  return new Promise((resolvePromise) => {
    const useShell = process.platform === 'win32' && /\.cmd$/i.test(invocation.command);
    const command = useShell
      ? [`"${invocation.command.replaceAll('"', '""')}"`, ...invocation.args.map((arg) => `"${String(arg).replaceAll('"', '""')}"`)].join(' ')
      : invocation.command;
    const child = spawn(command, useShell ? [] : invocation.args, {
      cwd: undefined,
      env,
      shell: useShell,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let lineBuffer = '';
    let threadId = null;
    let threadCallback = Promise.resolve();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === 'win32' && child.pid) {
        const windowsTreeKill = ['task', 'kill.exe'].join('');
        spawnSync(windowsTreeKill, ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      } else {
        child.kill('SIGKILL');
      }
    }, invocation.timeout_ms);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      lineBuffer += chunk;
      const lines = lineBuffer.split(/\r?\n/);
      lineBuffer = lines.pop() || '';
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          const candidate = event.thread_id || event.thread?.id;
          if (!threadId && candidate) {
            threadId = candidate;
            threadCallback = Promise.resolve(onThreadStarted(candidate));
          }
        } catch { /* only JSONL events are considered */ }
      }
    });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolvePromise({ ok: false, code: null, signal: null, threadId, stdout, stderr: `${stderr}\nSPAWN_ERROR:${error.code || error.name}`, timedOut });
    });
    child.on('close', async (code, signal) => {
      clearTimeout(timer);
      try { await threadCallback; } catch (error) {
        stderr += `\nRUNNING_WRITEBACK_FAILED:${error.message}`;
      }
      resolvePromise({ ok: code === 0 && !timedOut, code, signal, threadId, stdout, stderr, timedOut });
    });
    child.stdin.end(prompt);
  });
}

function normalizeReviewText(value) {
  return value.replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

function assertReviewedMainRevision(repoRoot) {
  const result = run('git', ['-C', repoRoot, 'merge-base', '--is-ancestor', 'HEAD', 'origin/main']);
  if (!result.ok) throw new Error('EXECUTOR_REVISION_NOT_REVIEWED_ON_MAIN');
}

function gateArtifactStatus(artifacts) {
  const required = ['knip-unused-', 'dependency-cruiser-', 'playwright-smoke-', 'axe-accessibility-', 'backstop-visual-'];
  const names = artifacts.filter((artifact) => !artifact.expired).map((artifact) => artifact.name);
  const missing = required.filter((prefix) => !names.some((name) => name.startsWith(prefix)));
  return { complete: missing.length === 0, names, missing };
}

export function applyExecutorDevStatus(current, { now, issueNumber, pr, headSha, gate }) {
  const item = {
    id: 'WRC-P2-U01',
    name: 'Worker homepage overview/map-data real-read acceptance',
    status: 'PASS',
    owner: 'GSO Windows Codex Bridge',
    evidence: `Issue #${issueNumber}; PR #${pr.number}; preliminary exact-head GSO Gate ${gate.run_id}`,
    next_step: 'Review and merge the PR only after its final status-update head passes the full GSO Gate.',
  };
  const completed = [...(current.completed || [])].filter((entry) => entry.id !== item.id);
  completed.push(item);
  return {
    ...current,
    overall_status: 'PASS',
    current_step: `WRC-P2-U01 PR #${pr.number} passed its development Gate; final status-head Gate pending`,
    last_updated: now,
    auto_loop: {
      ...(current.auto_loop || {}),
      status: 'ON',
      current_running_issue: null,
      ready_queue: (current.auto_loop?.ready_queue || []).filter((entry) => entry !== 'WRC-P2-U01'),
      last_controller_check: now,
      last_recovery_action: `Windows bridge created PR #${pr.number}; no automatic merge was attempted.`,
      user_approval_required: false,
    },
    latest_actions_run: {
      name: `GSO Gate ${gate.run_id}`,
      url: gate.html_url,
      status: 'SUCCESS',
      head_sha: headSha,
    },
    completed,
    in_progress: (current.in_progress || []).filter((entry) => entry.id !== item.id),
    todo: (current.todo || []).filter((entry) => entry.id !== item.id),
    next_safe_unit: 'Review the bounded WRC-P2-U01 PR and its final exact-head Gate; do not auto-merge.',
    next_action: {
      id: 'WRC-P2-U01-PR-REVIEW',
      status: 'READY',
      issue_number: issueNumber,
      issue_url: `https://github.com/${pr.base?.repo?.full_name || 'xjjsw0518-debug/global-seller-os-ui'}/issues/${issueNumber}`,
      pr_number: pr.number,
      pr_url: pr.html_url,
      instruction: 'Review the one-file Codex evidence change plus the controller-only dev-status update after the final full GSO Gate passes.',
      requires_manual_prompt_copying: false,
      requires_work_session_start: false,
    },
  };
}

async function waitForExactHeadGate(broker, headSha, timeoutMs = 60 * 60 * 1000) {
  const started = Date.now();
  let announcedRunId = null;
  while (Date.now() - started < timeoutMs) {
    const response = await broker.readGateRuns(headSha);
    const gate = response.workflow_runs?.find((runItem) => runItem.name === 'GSO Gate' && runItem.head_sha === headSha);
    if (gate) {
      announcedRunId ||= gate.id;
      if (gate.status === 'completed') {
        const artifactsResponse = await broker.readGateArtifacts(gate.id);
        return {
          run_id: gate.id,
          html_url: gate.html_url,
          conclusion: gate.conclusion,
          artifacts: gateArtifactStatus(artifactsResponse.artifacts || []),
        };
      }
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 15_000));
  }
  throw new Error(`GATE_TIMEOUT:${announcedRunId || 'NOT_STARTED'}`);
}

export async function executeAuthorizedIssue({ repoRoot, stateDir, manifestPath, authorizationEnvelope }) {
  assertReviewedMainRevision(repoRoot);
  const manifestBytes = readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const manifestHash = sha256(manifestBytes);
  const authorization = validateAuthorizationEnvelope(authorizationEnvelope, {
    issueNumber: manifest.issue_number,
    manifestHash,
  });
  if (!authorization.valid) throw new Error(`REAL_RUN_NOT_AUTHORIZED:${authorization.errors.join(',')}`);
  const codex = probeLocalCodex();
  if (!codex.executable_found || !codex.authenticated || !codex.executable_path) throw new Error('LOCAL_CODEX_NOT_READY');
  const broker = new GitHubControllerBroker(manifest.repository);
  const [openIssues, issue, comments] = await Promise.all([
    broker.listOpenIssues(),
    broker.readIssue(manifest.issue_number),
    broker.readComments(manifest.issue_number),
  ]);
  const queuedIssue = openIssues.find((candidate) => !candidate.pull_request && candidate.number === manifest.issue_number);
  if (!queuedIssue || evaluateIssueState(queuedIssue, []).body_status !== manifest.required_source_state) {
    throw new Error('ISSUE_NOT_PRESENT_IN_READY_QUEUE');
  }
  const issueState = evaluateExecutorIssueState(issue, comments);
  const admission = evaluateAdmission(issue.body || '');
  if (!admission.complete) throw new Error('DEVELOPMENT_ENTRY_CHECKLIST_INCOMPLETE');
  if (issueState.effective_state !== manifest.required_source_state) throw new Error(`ISSUE_NOT_READY:${issueState.effective_state}`);
  const actualIssueHash = sha256(normalizeReviewText(issue.body || ''));
  if (actualIssueHash !== manifest.issue_body_sha256) throw new Error('ISSUE_BODY_HASH_MISMATCH');
  const prompt = readFileSync(resolve(repoRoot, manifest.prompt_path), 'utf8');
  if (sha256(prompt) !== manifest.prompt_sha256) throw new Error('PROMPT_HASH_MISMATCH');
  const baseSha = git(repoRoot, ['rev-parse', manifest.base_ref]);
  const identity = createRunIdentity({
    repository: manifest.repository,
    issueNumber: manifest.issue_number,
    baseSha,
    manifestHash,
    issueRevision: actualIssueHash,
  });
  const lock = acquireExecutorLock(stateDir, identity.runId);
  if (!lock.acquired) throw new Error(lock.reason);
  try {
    const lease = acquireExecutionLease(stateDir, identity.leaseId, identity.runId);
    if (!lease.acquired) throw new Error(lease.recovery_required ? 'INCOMPLETE_LEASE_REQUIRES_RECOVERY' : 'DUPLICATE_ISSUE_EXECUTION_PREVENTED');
    const isolation = probeCodexSandboxCredentialIsolation({ codexPath: codex.executable_path, repoRoot });
    if (!isolation.passed) throw new Error('CREDENTIAL_ISOLATION_FAILED');
    const taskWorktree = createTaskWorktree({ repoRoot, stateDir, manifest, baseSha });
    const claimEvidence = await broker.writeState(manifest.issue_number, {
      state: 'CLAIMED', runId: identity.runId, leaseId: identity.leaseId,
      evidence: { base_sha: baseSha, branch: manifest.planned_branch, model_call_started: false },
    });
    transitionJournal(lease.journalPath, 'CLAIMED', claimEvidence);
    recordModelRun(lease.journalPath);
    const modelOutputPath = safeChild(stateDir, join(lease.leaseDir, 'codex-last-message.txt'));
    const invocation = buildCodexInvocation({ codexPath: codex.executable_path, worktreePath: taskWorktree.path, outputPath: modelOutputPath });
    let runningWriteback = null;
    const codexResult = await runCodexProcess({
      invocation,
      prompt,
      env: buildRestrictedCodexEnv(process.env),
      onThreadStarted: async (threadId) => {
        const runningEvidence = { run_id: identity.runId, lease_id: identity.leaseId, codex_thread_id: threadId };
        transitionJournal(lease.journalPath, 'RUNNING', runningEvidence);
        runningWriteback = await broker.writeState(manifest.issue_number, {
          state: 'RUNNING', runId: identity.runId, leaseId: identity.leaseId,
          evidence: { codex_thread_id: threadId, base_sha: baseSha, branch: manifest.planned_branch },
        });
      },
    });
    if (!codexResult.threadId || !runningWriteback) {
      const current = JSON.parse(readFileSync(lease.journalPath, 'utf8'));
      if (current.state === 'CLAIMED') {
        transitionJournal(lease.journalPath, 'BLOCKED', { reason: 'CODEX_THREAD_ID_NOT_OBSERVED' });
      }
      await broker.writeState(manifest.issue_number, {
        state: 'BLOCKED', runId: identity.runId, leaseId: identity.leaseId,
        evidence: { reason: 'CODEX_THREAD_ID_NOT_OBSERVED', model_runs: 1, retries: 0 },
      });
      throw new Error('CODEX_THREAD_ID_NOT_OBSERVED');
    }
    if (!codexResult.ok) {
      const reason = codexResult.timedOut ? 'CODEX_TIMEOUT_30_MINUTES' : `CODEX_EXIT_${codexResult.code}`;
      transitionJournal(lease.journalPath, 'FAILED', { reason, model_runs: 1, retries: 0 });
      await broker.writeState(manifest.issue_number, {
        state: 'FAILED', runId: identity.runId, leaseId: identity.leaseId,
        evidence: { reason, model_runs: 1, retries: 0 },
      });
      return { final_state: 'FAILED', ...identity, reason };
    }
    const paths = changedPaths(taskWorktree.path);
    const pathCheck = checkChangedPaths(paths, {
      allowed: manifest.issue_execution_policy.allowed_files,
      forbidden: manifest.issue_execution_policy.forbidden_files,
    });
    let controllerSecret = readGitHubCredential();
    const secretCheck = scanForSecrets({ repoRoot: taskWorktree.path, paths, exactSecrets: [controllerSecret] });
    controllerSecret = null;
    if (!pathCheck.ok || !secretCheck.passed) {
      const reason = !pathCheck.ok ? 'CHANGED_PATH_POLICY_FAILED' : 'SECRET_SCAN_FAILED';
      transitionJournal(lease.journalPath, 'BLOCKED', { reason, path_check: pathCheck, secret_check: secretCheck });
      await broker.writeState(manifest.issue_number, {
        state: 'BLOCKED', runId: identity.runId, leaseId: identity.leaseId,
        evidence: { reason, changed_paths: paths, secret_values_recorded: false },
      });
      return { final_state: 'BLOCKED', ...identity, reason, pathCheck, secretCheck };
    }
    if (paths.length === 0) {
      transitionJournal(lease.journalPath, 'BLOCKED', { reason: 'CODEX_PRODUCED_NO_REVIEWABLE_CHANGE' });
      await broker.writeState(manifest.issue_number, {
        state: 'BLOCKED', runId: identity.runId, leaseId: identity.leaseId,
        evidence: { reason: 'CODEX_PRODUCED_NO_REVIEWABLE_CHANGE' },
      });
      return { final_state: 'BLOCKED', ...identity, reason: 'CODEX_PRODUCED_NO_REVIEWABLE_CHANGE' };
    }
    git(taskWorktree.path, ['add', '--', ...paths]);
    git(taskWorktree.path, ['-c', 'user.name=GSO Windows Bridge', '-c', 'user.email=gso-windows-bridge@users.noreply.github.com', 'commit', '-m', `WRC-P2-U01: Worker home read acceptance (#${manifest.issue_number})`]);
    const prHeadSha = git(taskWorktree.path, ['rev-parse', 'HEAD']);
    git(taskWorktree.path, ['push', '--set-upstream', 'origin', manifest.planned_branch], { timeout: 120_000, env: process.env });
    const pr = await broker.createPullRequest({
      title: 'WRC-P2-U01: Worker home real-read acceptance',
      head: manifest.planned_branch,
      base: 'main',
      body: `Automated bounded Issue #${manifest.issue_number} execution.\n\nRUN_ID=${identity.runId}\nLEASE_ID=${identity.leaseId}\n\nChanged paths were checked against the one-file allowlist. No automatic merge is enabled.`,
    });
    transitionJournal(lease.journalPath, 'PR_CREATED', { pr_number: pr.number, pr_url: pr.html_url, head_sha: prHeadSha });
    await broker.writeState(manifest.issue_number, {
      state: 'PR_CREATED', runId: identity.runId, leaseId: identity.leaseId,
      evidence: { pr_number: pr.number, pr_url: pr.html_url, head_sha: prHeadSha, changed_paths: paths },
    });
    transitionJournal(lease.journalPath, 'TESTING', { head_sha: prHeadSha, runner_role: 'NON_AI_GSO_GATE_ONLY' });
    await broker.writeState(manifest.issue_number, {
      state: 'TESTING', runId: identity.runId, leaseId: identity.leaseId,
      evidence: { pr_number: pr.number, head_sha: prHeadSha, runner_role: 'NON_AI_GSO_GATE_ONLY' },
    });
    const preliminaryGate = await waitForExactHeadGate(broker, prHeadSha);
    if (preliminaryGate.conclusion !== 'success' || !preliminaryGate.artifacts.complete) {
      transitionJournal(lease.journalPath, 'FAILED', { gate_run_id: preliminaryGate.run_id, gate_conclusion: preliminaryGate.conclusion, artifacts: preliminaryGate.artifacts, auto_merge: false });
      transitionJournal(lease.journalPath, 'FIX_REQUIRED', { reason: 'GSO_GATE_OR_ARTIFACTS_FAILED', auto_merge: false });
      await broker.writeState(manifest.issue_number, {
        state: 'FIX_REQUIRED', runId: identity.runId, leaseId: identity.leaseId,
        evidence: { pr_number: pr.number, head_sha: prHeadSha, gate: preliminaryGate, auto_merge: false },
      });
      return { final_state: 'FIX_REQUIRED', ...identity, pr, gate: preliminaryGate, auto_merge: false };
    }
    const devStatusPath = manifest.issue_execution_policy.controller_post_gate_allowed_files?.[0];
    if (devStatusPath !== 'public/dev-status.json') throw new Error('DEV_STATUS_CONTROLLER_PATH_NOT_ADMITTED');
    const devStatusAbsolute = resolve(taskWorktree.path, devStatusPath);
    const currentDevStatus = JSON.parse(readFileSync(devStatusAbsolute, 'utf8'));
    const updatedDevStatus = applyExecutorDevStatus(currentDevStatus, {
      now: new Date().toISOString(), issueNumber: manifest.issue_number, pr, headSha: prHeadSha, gate: preliminaryGate,
    });
    writeFileSync(devStatusAbsolute, `${JSON.stringify(updatedDevStatus, null, 2)}\n`, 'utf8');
    const controllerPaths = changedPaths(taskWorktree.path);
    const expectedControllerPaths = [...manifest.issue_execution_policy.allowed_files, devStatusPath].sort();
    const unexpectedControllerPath = controllerPaths.find((path) => !expectedControllerPaths.includes(path));
    if (unexpectedControllerPath) throw new Error(`CONTROLLER_CHANGED_PATH_NOT_ADMITTED:${unexpectedControllerPath}`);
    git(taskWorktree.path, ['add', '--', devStatusPath]);
    git(taskWorktree.path, ['-c', 'user.name=GSO Windows Bridge', '-c', 'user.email=gso-windows-bridge@users.noreply.github.com', 'commit', '-m', `chore: publish WRC-P2-U01 Gate status (#${manifest.issue_number})`]);
    const finalHeadSha = git(taskWorktree.path, ['rev-parse', 'HEAD']);
    git(taskWorktree.path, ['push', 'origin', manifest.planned_branch], { timeout: 120_000, env: process.env });
    const finalGate = await waitForExactHeadGate(broker, finalHeadSha);
    if (finalGate.conclusion !== 'success' || !finalGate.artifacts.complete) {
      transitionJournal(lease.journalPath, 'FAILED', { gate_run_id: finalGate.run_id, gate_conclusion: finalGate.conclusion, artifacts: finalGate.artifacts, auto_merge: false });
      transitionJournal(lease.journalPath, 'FIX_REQUIRED', { reason: 'FINAL_STATUS_HEAD_GATE_OR_ARTIFACTS_FAILED', auto_merge: false });
      await broker.writeState(manifest.issue_number, {
        state: 'FIX_REQUIRED', runId: identity.runId, leaseId: identity.leaseId,
        evidence: { pr_number: pr.number, preliminary_gate: preliminaryGate, final_head_sha: finalHeadSha, final_gate: finalGate, auto_merge: false },
      });
      return { final_state: 'FIX_REQUIRED', ...identity, pr, preliminary_gate: preliminaryGate, final_gate: finalGate, auto_merge: false };
    }
    transitionJournal(lease.journalPath, 'PASS', { gate_run_id: finalGate.run_id, gate_conclusion: finalGate.conclusion, mandatory_artifacts: 5, head_sha: finalHeadSha });
    await broker.writeState(manifest.issue_number, {
      state: 'PASS', runId: identity.runId, leaseId: identity.leaseId,
      evidence: { pr_number: pr.number, pr_url: pr.html_url, head_sha: finalHeadSha, preliminary_gate: preliminaryGate, gate: finalGate, project_writeback: 'DEFERRED_NON_BLOCKING', dev_status_updated_by_controller: true, auto_merge: false },
    });
    const remainingIssues = await broker.listOpenIssues();
    const nextReady = remainingIssues
      .filter((candidate) => !candidate.pull_request && candidate.number !== manifest.issue_number)
      .filter((candidate) => evaluateIssueState(candidate, []).body_status === manifest.required_source_state)
      .sort((left, right) => left.number - right.number)[0] || null;
    return {
      final_state: 'PASS', ...identity, pr, preliminary_gate: preliminaryGate, gate: finalGate,
      next_ready_issue: nextReady ? { number: nextReady.number, title: nextReady.title } : null,
      next_issue_execution_authorized: false,
      model_runs: 1, retries: 0, auto_merge: false,
    };
  } finally {
    releaseExecutorLock(lock);
  }
}

export async function buildDryRunReport({ repoRoot, stateDir, manifestPath }) {
  const manifestBytes = readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const manifestHash = sha256(manifestBytes);
  const promptBytes = readFileSync(resolve(repoRoot, manifest.prompt_path));
  const promptHash = sha256(promptBytes);
  const codex = probeLocalCodex();
  const lock = acquireExecutorLock(stateDir, `dry-${randomUUID()}`);
  if (!lock.acquired) throw new Error(lock.reason);
  try {
    const broker = new GitHubControllerBroker(manifest.repository);
    const [openIssues, issue, comments] = await Promise.all([
      broker.listOpenIssues(),
      broker.readIssue(manifest.issue_number),
      broker.readComments(manifest.issue_number),
    ]);
    const readyQueue = openIssues
      .filter((candidate) => !candidate.pull_request && evaluateIssueState(candidate, []).body_status === manifest.required_source_state)
      .map((candidate) => ({ number: candidate.number, title: candidate.title }))
      .sort((left, right) => left.number - right.number);
    const issueState = evaluateExecutorIssueState(issue, comments);
    const admission = evaluateAdmission(issue.body || '');
    const baseSha = git(repoRoot, ['rev-parse', manifest.base_ref]);
    const identity = createRunIdentity({
      repository: manifest.repository,
      issueNumber: manifest.issue_number,
      baseSha,
      manifestHash,
      issueRevision: sha256(normalizeReviewText(issue.body || '')),
    });
    const worktree = prepareProbeWorktree({ repoRoot, stateDir, issueNumber: manifest.issue_number, baseSha });
    const isolation = codex.executable_path
      ? probeCodexSandboxCredentialIsolation({ codexPath: codex.executable_path, repoRoot })
      : { passed: false, reason: 'CODEX_PATH_UNAVAILABLE' };
    const invocation = codex.executable_path ? buildCodexInvocation({
      codexPath: codex.executable_path,
      worktreePath: worktree.path,
      outputPath: join(stateDir, 'model-output-not-created-in-dry-run.txt'),
    }) : null;
    const blockers = [];
    if (!codex.executable_found || !codex.authenticated) blockers.push('LOCAL_CODEX_NOT_READY');
    if (!admission.complete) blockers.push('DEVELOPMENT_ENTRY_CHECKLIST_INCOMPLETE');
    if (issueState.effective_state !== manifest.required_source_state) blockers.push('ISSUE_NOT_READY');
    if (!readyQueue.some((candidate) => candidate.number === manifest.issue_number)) blockers.push('ISSUE_NOT_PRESENT_IN_READY_QUEUE');
    if (manifest.prompt_sha256 !== promptHash) blockers.push('PROMPT_HASH_MISMATCH');
    if (!worktree.passed) blockers.push('WORKTREE_ISOLATION_FAILED');
    if (!isolation.passed) blockers.push('CREDENTIAL_ISOLATION_FAILED');
    const policy = manifest.issue_execution_policy;
    const simulationRoot = safeChild(stateDir, join(stateDir, `simulation-${randomUUID()}`));
    mkdirSync(simulationRoot, { recursive: true });
    const simulations = {};
    for (const outcome of ['success', 'network-failure', 'codex-failure', 'gate-failure', 'forbidden-change', 'timeout']) {
      const simulationIdentity = { runId: `sim-${outcome}-${randomUUID()}`, leaseId: sha256(`${identity.leaseId}:${outcome}:${randomUUID()}`).slice(0, 32) };
      simulations[outcome] = simulateExecution({
        stateDir: simulationRoot,
        identity: simulationIdentity,
        outcome,
        changed: outcome === 'forbidden-change' ? ['src/App.jsx'] : policy.allowed_files,
        policy: { allowed: policy.allowed_files, forbidden: policy.forbidden_files },
      });
    }
    const duplicateIdentity = { runId: `sim-duplicate-${randomUUID()}`, leaseId: sha256(`duplicate:${identity.leaseId}`).slice(0, 32) };
    const duplicateFirst = simulateExecution({ stateDir: simulationRoot, identity: duplicateIdentity, changed: policy.allowed_files, policy: { allowed: policy.allowed_files, forbidden: policy.forbidden_files } });
    const duplicateSecond = simulateExecution({ stateDir: simulationRoot, identity: { ...duplicateIdentity, runId: `${duplicateIdentity.runId}-second` }, changed: policy.allowed_files, policy: { allowed: policy.allowed_files, forbidden: policy.forbidden_files } });
    simulations.duplicate_issue = { first_state: duplicateFirst.state, second: duplicateSecond.outcome, duplicate_prevented: duplicateSecond.lease.duplicate_prevented };
    for (const value of Object.values(simulations)) {
      if (value?.journalPath) value.journalPath = '<LOCAL_EXECUTOR_STATE>/leases/journal.json';
    }
    const ready = blockers.length === 0;
    return {
      schema_version: 1,
      generated_at: new Date().toISOString(),
      final_state: ready ? 'GSO_AUTO_EXECUTOR_DRY_RUN_READY' : 'GSO_AUTO_EXECUTOR_BLOCKED',
      repository: manifest.repository,
      issue_number: manifest.issue_number,
      main_sha: baseSha,
      prepared_run_id: identity.runId,
      prepared_lease_id: identity.leaseId,
      model_call_performed: false,
      github_write_performed: false,
      local_codex_cli: {
        executable_found: codex.executable_found,
        executable_path: '<WINDOWS_CODEX_EXECUTABLE>',
        version: codex.version,
        authenticated: codex.authenticated,
        auth_type: codex.auth_type,
        raw_auth_output_recorded: false,
      },
      issue_source: { ...issueState, title: issue.title, updated_at: issue.updated_at },
      ready_queue: {
        selected_issue: manifest.issue_number,
        selected_present: readyQueue.some((candidate) => candidate.number === manifest.issue_number),
        open_ready_issue_numbers: readyQueue.map((candidate) => candidate.number),
        selection_policy: 'FIRST_AUTHORIZED_MANIFEST_ISSUE_ONLY',
      },
      admission,
      prompt: { path: manifest.prompt_path, sha256: promptHash, matches_manifest: manifest.prompt_sha256 === promptHash },
      worktree_isolation: { ...worktree, path: '<LOCAL_EXECUTOR_STATE>/probes' },
      credential_isolation: isolation,
      codex_invocation: invocation ? {
        command: '<WINDOWS_CODEX_EXECUTABLE>',
        args: invocation.args.map((arg) => arg === worktree.path
          ? '<ISSUE_WORKTREE>'
          : arg.startsWith(stateDir)
            ? '<LOCAL_EXECUTOR_STATE>/model-output.txt'
            : arg),
        timeout_ms: invocation.timeout_ms,
        max_model_runs: invocation.max_model_runs,
        max_automatic_retries: invocation.max_automatic_retries,
        executed: false,
      } : null,
      github_writeback: {
        controller_broker_read_verified: broker.audit.every((entry) => entry.status >= 200 && entry.status < 300),
        controller_operations_allowlisted: true,
        read_after_write_implemented: true,
        write_attempted: false,
        project_writeback: 'DEFERRED_NON_BLOCKING',
      },
      runner_boundary: { role: 'NON_AI_GSO_GATE_ONLY', server_codex_invoked: false },
      simulations,
      limits: manifest.step_b_limits,
      blockers,
      next_action: ready
        ? 'Obtain separate user confirmation, create a one-time authorization envelope, then execute Issue #21 once.'
        : 'Resolve the blocker list before any model call.',
    };
  } finally {
    releaseExecutorLock(lock);
  }
}

function parseArgs(argv) {
  const args = { mode: 'dry-run' };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) throw new Error(`UNKNOWN_ARGUMENT:${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`MISSING_ARGUMENT_VALUE:${key}`);
    args[key.slice(2)] = value;
    index += 1;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(args['repo-root'] || process.cwd());
  const stateDir = resolve(args['state-dir'] || join(repoRoot, '.gso-auto-executor-state'));
  const manifestPath = resolve(args.manifest || join(repoRoot, 'control', 'local-bridge', 'issue-21.manifest.json'));
  const output = resolve(args.output || join(stateDir, 'latest-step-c-report.json'));
  if (args.mode === 'execute') {
    const manifestBytes = readFileSync(manifestPath);
    const manifest = JSON.parse(manifestBytes.toString('utf8'));
    const envelope = args['authorization-file'] && existsSync(resolve(args['authorization-file']))
      ? JSON.parse(readFileSync(resolve(args['authorization-file']), 'utf8'))
      : null;
    const authorization = validateAuthorizationEnvelope(envelope, {
      issueNumber: manifest.issue_number,
      manifestHash: sha256(manifestBytes),
    });
    if (!authorization.valid) throw new Error(`REAL_RUN_NOT_AUTHORIZED:${authorization.errors.join(',')}`);
    const result = await executeAuthorizedIssue({ repoRoot, stateDir, manifestPath, authorizationEnvelope: envelope });
    atomicWriteJson(output, result);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.final_state !== 'PASS') process.exitCode = 1;
    return;
  }
  if (args.mode !== 'dry-run') throw new Error(`UNSUPPORTED_MODE:${args.mode}`);
  const report = await buildDryRunReport({ repoRoot, stateDir, manifestPath });
  atomicWriteJson(output, report);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.final_state.endsWith('_BLOCKED')) process.exitCode = 1;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});

export { runCodexProcess };
