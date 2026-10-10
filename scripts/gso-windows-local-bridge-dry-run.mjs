import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const REQUIRED_ISSUE_FIELDS = [
  ['scope', /(?:^|\n)(?:#{1,6}\s*)?scope\s*:/i],
  ['out_of_scope', /(?:^|\n)(?:#{1,6}\s*)?out of scope\s*:/i],
  ['acceptance_criteria', /(?:^|\n)(?:#{1,6}\s*)?acceptance criteria\s*:/i],
  ['allowed_files', /(?:^|\n)(?:#{1,6}\s*)?allowed files\s*:/i],
  ['forbidden_files', /(?:^|\n)(?:#{1,6}\s*)?forbidden files\s*:/i],
  ['required_gates', /(?:^|\n)(?:#{1,6}\s*)?required gates\s*:/i],
  ['expected_evidence', /(?:^|\n)(?:#{1,6}\s*)?expected evidence\s*:/i],
  ['authorization', /(?:^|\n)(?:#{1,6}\s*)?(?:user )?authorization(?: required)?\s*:/i],
  ['risk_level', /(?:^|\n)(?:#{1,6}\s*)?risk level\s*:/i],
  ['entry_decision', /(?:^|\n)(?:#{1,6}\s*)?entry decision\s*:/i],
  ['next_safe_unit', /(?:^|\n)(?:#{1,6}\s*)?next safe unit\s*:/i],
];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizePath(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//, '');
}

function globToRegExp(pattern) {
  const input = normalizePath(pattern);
  let output = '^';
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '*' && input[index + 1] === '*') {
      output += '.*';
      index += 1;
    } else if (char === '*') {
      output += '[^/]*';
    } else if (char === '?') {
      output += '[^/]';
    } else {
      output += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
  }
  return new RegExp(`${output}$`);
}

export function checkChangedPaths(paths, policy) {
  const normalized = [...new Set(paths.map(normalizePath).filter(Boolean))].sort();
  const forbidden = normalized.filter((file) => policy.forbidden.some((pattern) => globToRegExp(pattern).test(file)));
  const notAllowed = normalized.filter((file) => !policy.allowed.some((pattern) => globToRegExp(pattern).test(file)));
  return {
    ok: forbidden.length === 0 && notAllowed.length === 0,
    changed_paths: normalized,
    forbidden_matches: forbidden,
    not_allowed: notAllowed,
  };
}

export function extractIssueBodyStatus(body = '') {
  const section = body.match(/##\s+Status\s*\r?\n+\s*`?([A-Z_]+)`?/i);
  return section?.[1]?.toUpperCase() || 'UNKNOWN';
}

export function evaluateIssueState(issue, comments = []) {
  const bodyStatus = extractIssueBodyStatus(issue.body || '');
  const runningClaims = comments.filter((comment) => /\bRUNNING\b/i.test(comment.body || ''));
  const executionEvidence = comments.filter((comment) => {
    const body = comment.body || '';
    return /\bRUN_ID=[A-Za-z0-9._:-]+\b/.test(body) && /\bLEASE_ID=[A-Za-z0-9._:-]+\b/.test(body);
  });
  return {
    issue_open: issue.state === 'open',
    body_status: bodyStatus,
    running_claim_count: runningClaims.length,
    codex_run_lease_evidence_count: executionEvidence.length,
    effective_state: executionEvidence.length > 0 ? 'RUNNING' : bodyStatus,
    running_is_evidence_backed: executionEvidence.length > 0,
  };
}

export function evaluateAdmission(body = '') {
  const missing = REQUIRED_ISSUE_FIELDS
    .filter(([, matcher]) => !matcher.test(body))
    .map(([name]) => name.toUpperCase());
  return {
    complete: missing.length === 0,
    missing_fields: missing,
    decision: missing.length === 0 ? 'ALLOWED' : 'BLOCKED_INCOMPLETE_CHECKLIST',
  };
}

function runCommand(command, args, options = {}) {
  const useCommandShell = process.platform === 'win32' && /\.cmd$/i.test(command);
  const commandLine = [`"${command.replaceAll('"', '""')}"`, ...args.map((arg) => `"${arg.replaceAll('"', '""')}"`)].join(' ');
  const result = useCommandShell ? spawnSync(commandLine, {
    cwd: options.cwd,
    encoding: 'utf8',
    timeout: options.timeout ?? 20_000,
    windowsHide: true,
    shell: true,
    env: { ...process.env, NO_COLOR: '1', ...(options.env || {}) },
  }) : spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    timeout: options.timeout ?? 20_000,
    windowsHide: true,
    env: { ...process.env, NO_COLOR: '1', ...(options.env || {}) },
  });
  return {
    ok: !result.error && result.status === 0,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error_code: result.error?.code || null,
  };
}

function resolveCodexCommand() {
  if (process.platform !== 'win32') return 'codex';
  const where = runCommand('where.exe', ['codex']);
  const candidates = where.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return candidates.find((candidate) => /\.(?:cmd|exe)$/i.test(candidate)) || candidates[0] || 'codex';
}

function firstLine(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) || null;
}

function detectAuthType(text, authenticated) {
  if (!authenticated) return 'UNAUTHENTICATED';
  if (/chatgpt/i.test(text)) return 'CHATGPT';
  if (/access[ _-]?token/i.test(text)) return 'ACCESS_TOKEN';
  if (/api[ _-]?key/i.test(text)) return 'API_KEY';
  if (/workload identity/i.test(text)) return 'WORKLOAD_IDENTITY';
  return 'AUTHENTICATED_UNKNOWN';
}

export function probeLocalCodex(run = runCommand) {
  const command = resolveCodexCommand();
  const version = run(command, ['--version']);
  const login = version.ok ? run(command, ['login', 'status']) : { ok: false, stdout: '', stderr: '' };
  const authText = `${login.stdout}\n${login.stderr}`;
  return {
    executable_found: version.ok,
    executable_path: isAbsolute(command) ? command : null,
    version: version.ok ? firstLine(`${version.stdout}\n${version.stderr}`) : null,
    authenticated: login.ok,
    auth_type: detectAuthType(authText, login.ok),
    raw_auth_output_recorded: false,
  };
}

function git(repoRoot, args, timeout = 30_000) {
  const result = runCommand('git', ['-C', repoRoot, ...args], { timeout });
  if (!result.ok) {
    throw new Error(`GIT_COMMAND_FAILED:${args[0]}:${result.status ?? result.error_code ?? 'UNKNOWN'}`);
  }
  return result.stdout.trim();
}

function changedPaths(repoRoot) {
  const status = git(repoRoot, ['status', '--porcelain=v1', '--untracked-files=all']);
  if (!status) return [];
  return status.split(/\r?\n/).map((line) => {
    const value = line.slice(3).trim();
    return value.includes(' -> ') ? value.split(' -> ').at(-1) : value;
  });
}

function ensureChildPath(parent, child) {
  const parentPath = resolve(parent);
  const childPath = resolve(child);
  const rel = relative(parentPath, childPath);
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) {
    throw new Error('UNSAFE_STATE_CHILD_PATH');
  }
  return childPath;
}

function atomicWriteJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  renameSync(temporary, path);
}

export function acquireSingletonLock(stateDir, runId) {
  const lockDir = ensureChildPath(stateDir, join(stateDir, 'locks', 'bridge.lock'));
  mkdirSync(dirname(lockDir), { recursive: true });
  try {
    mkdirSync(lockDir);
  } catch (error) {
    if (error.code === 'EEXIST') return { acquired: false, code: 'SINGLE_INSTANCE_LOCK_BUSY', lockDir };
    throw error;
  }
  atomicWriteJson(join(lockDir, 'owner.json'), { run_id: runId, pid: process.pid, acquired_at: new Date().toISOString() });
  return { acquired: true, lockDir };
}

export function releaseSingletonLock(lock) {
  if (!lock?.acquired) return;
  const owner = join(lock.lockDir, 'owner.json');
  if (existsSync(owner)) rmSync(owner);
  rmdirSync(lock.lockDir);
}

export function acquireTaskLease(stateDir, leaseId, runId) {
  const leaseDir = ensureChildPath(stateDir, join(stateDir, 'leases', leaseId));
  mkdirSync(dirname(leaseDir), { recursive: true });
  try {
    mkdirSync(leaseDir);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const statePath = join(leaseDir, 'state.json');
    const prior = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { status: 'UNKNOWN' };
    return {
      acquired: false,
      idempotent_replay: prior.status === 'COMPLETED',
      status: prior.status,
      leaseDir,
    };
  }
  atomicWriteJson(join(leaseDir, 'state.json'), {
    lease_id: leaseId,
    run_id: runId,
    status: 'ACTIVE',
    acquired_at: new Date().toISOString(),
  });
  return { acquired: true, idempotent_replay: false, status: 'ACTIVE', leaseDir };
}

function completeTaskLease(lease, report) {
  if (!lease.acquired) return;
  atomicWriteJson(join(lease.leaseDir, 'state.json'), {
    lease_id: report.lease_id,
    run_id: report.run_id,
    status: 'COMPLETED',
    completed_at: new Date().toISOString(),
    report_sha256: sha256(JSON.stringify(report)),
  });
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'gso-windows-local-bridge-dry-run',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) throw new Error(`GITHUB_READ_FAILED:${response.status}`);
  return response.json();
}

async function readIssue(repository, issueNumber) {
  const base = `https://api.github.com/repos/${repository}`;
  const [issue, comments] = await Promise.all([
    fetchJson(`${base}/issues/${issueNumber}`),
    fetchJson(`${base}/issues/${issueNumber}/comments?per_page=100`),
  ]);
  return { issue, comments };
}

function verifyWorktreeIsolation(repoRoot, stateDir, manifest) {
  const probePath = ensureChildPath(stateDir, join(stateDir, 'worktrees', `issue-${manifest.issue_number}-probe`));
  const baseHead = git(repoRoot, ['rev-parse', manifest.base_ref]);
  let created = false;
  if (!existsSync(probePath)) {
    mkdirSync(dirname(probePath), { recursive: true });
    git(repoRoot, ['worktree', 'add', '--detach', probePath, manifest.base_ref], 60_000);
    created = true;
  }
  const probeHead = git(probePath, ['rev-parse', 'HEAD']);
  const probeTop = resolve(git(probePath, ['rev-parse', '--show-toplevel']));
  const sourceTop = resolve(git(repoRoot, ['rev-parse', '--show-toplevel']));
  const clean = changedPaths(probePath).length === 0;
  return {
    ok: probeTop !== sourceTop && probeHead === baseHead && clean,
    created,
    detached_probe: true,
    clean,
    same_base_head: probeHead === baseHead,
    distinct_top_level: probeTop !== sourceTop,
    planned_branch: manifest.planned_branch,
    planned_relative_path: manifest.planned_worktree_relative_path,
    probe_path: probePath,
    base_sha: baseHead,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) throw new Error(`UNKNOWN_ARGUMENT:${key}`);
    if (key === '--execute' || key === '--model') throw new Error('MODEL_EXECUTION_NOT_SUPPORTED_IN_DRY_RUN');
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`MISSING_ARGUMENT_VALUE:${key}`);
    args[key.slice(2)] = value;
    index += 1;
  }
  return args;
}

export async function buildDryRunReport({ repoRoot, stateDir, manifestPath }) {
  const manifestBytes = readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const promptPath = resolve(repoRoot, manifest.prompt_path);
  const promptBytes = readFileSync(promptPath);
  const promptHash = sha256(promptBytes);
  const manifestHash = sha256(manifestBytes);
  const runId = `gso-dry-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`;
  const singleton = acquireSingletonLock(stateDir, runId);
  if (!singleton.acquired) throw new Error(singleton.code);

  try {
    const { issue, comments } = await readIssue(manifest.repository, manifest.issue_number);
    const issueState = evaluateIssueState(issue, comments);
    const admission = evaluateAdmission(issue.body || '');
    const leaseId = sha256([
      manifest.repository,
      manifest.issue_number,
      issue.updated_at,
      manifestHash,
      promptHash,
    ].join('\n')).slice(0, 32);
    const lease = acquireTaskLease(stateDir, leaseId, runId);
    const pathPolicy = checkChangedPaths(changedPaths(repoRoot), manifest.bridge_change_policy);
    const worktree = verifyWorktreeIsolation(repoRoot, stateDir, manifest);
    const codex = probeLocalCodex();
    const ghCommand = process.platform === 'win32' ? runCommand('where.exe', ['gh']) : runCommand('which', ['gh']);
    const githubWriteback = {
      ready: false,
      gh_cli_installed: ghCommand.ok,
      gh_token_present: Boolean(process.env.GH_TOKEN || process.env.GITHUB_TOKEN),
      reason: 'DRY_RUN_HAS_NO_REVIEWED_CREDENTIALLED_GITHUB_WRITE_PATH',
      write_attempted: false,
    };

    const blockers = [];
    if (manifest.prompt_sha256 !== promptHash) blockers.push('PROMPT_HASH_MISMATCH');
    if (!codex.executable_found) blockers.push('LOCAL_CODEX_CLI_NOT_FOUND');
    if (!codex.authenticated) blockers.push('LOCAL_CODEX_NOT_AUTHENTICATED');
    if (!pathPolicy.ok) blockers.push('BRIDGE_CHANGED_FILE_POLICY_FAILED');
    if (!worktree.ok) blockers.push('WORKTREE_ISOLATION_FAILED');
    if (!lease.acquired && !lease.idempotent_replay) blockers.push('TASK_LEASE_BUSY');

    const stepABridgeReady = blockers.length === 0;
    const stepBBlockers = [
      ...(admission.complete ? [] : ['ISSUE_DEVELOPMENT_ENTRY_CHECKLIST_INCOMPLETE']),
      ...(issueState.effective_state === manifest.required_source_state ? [] : ['ISSUE_SOURCE_NOT_READY']),
      ...(manifest.issue_execution_policy.allowed_files.length > 0 ? [] : ['ISSUE_ALLOWED_FILES_EMPTY']),
      ...(githubWriteback.ready ? [] : ['GITHUB_WRITEBACK_NOT_READY']),
      'STEP_B_HUMAN_REVIEW_REQUIRED',
    ];

    const report = {
      schema_version: 1,
      generated_at: new Date().toISOString(),
      final_state: stepABridgeReady ? 'WINDOWS_GSO_BRIDGE_DRY_RUN_READY' : 'BLOCKED',
      run_id: runId,
      lease_id: leaseId,
      local_codex_cli: codex,
      auth_status: { authenticated: codex.authenticated, type: codex.auth_type, secret_value_recorded: false },
      issue_21_source_state: {
        repository: manifest.repository,
        issue_number: manifest.issue_number,
        title: issue.title,
        updated_at: issue.updated_at,
        ...issueState,
        conclusion: issueState.running_is_evidence_backed
          ? 'RUNNING_WITH_CODEX_RUN_AND_LEASE_EVIDENCE'
          : 'READY_FORMAL_RUNNING_COMMENT_HAS_NO_CODEX_RUN_OR_LEASE_EVIDENCE',
      },
      admission,
      bridge_dry_run: {
        ready: stepABridgeReady,
        model_call_performed: false,
        github_write_performed: false,
        business_code_changed: false,
        prompt_path: manifest.prompt_path,
        prompt_sha256: promptHash,
        prompt_hash_matches_manifest: manifest.prompt_sha256 === promptHash,
        manifest_sha256: manifestHash,
        changed_file_policy: pathPolicy,
      },
      worktree_isolation: worktree,
      lease_idempotency: {
        atomic_single_instance_lock: true,
        deterministic_lease_id: true,
        lease_acquired: lease.acquired,
        idempotent_replay: lease.idempotent_replay,
        status: lease.status,
      },
      gh_writeback_readiness: githubWriteback,
      runner_test_only: {
        gso_gate_runner_role: 'NON_AI_TESTS_ONLY',
        local_bridge_codex_role: 'WINDOWS_ONLY',
        server_codex_invoked: false,
        note: 'Existing manual runner Codex bootstrap workflows were not invoked or modified.',
      },
      blockers,
      step_b: {
        execution_performed: false,
        limits: manifest.step_b_limits,
        blockers: stepBBlockers,
      },
      next_safe_unit: stepABridgeReady
        ? 'Review this dry-run evidence; complete Issue #21 admission and a supported GitHub writeback path before one bounded Codex model run.'
        : 'Repair the Step A blocker list and rerun the no-model dry run.',
    };
    completeTaskLease(lease, report);
    return report;
  } finally {
    releaseSingletonLock(singleton);
  }
}

export function redactLocalPaths(report) {
  const redacted = structuredClone(report);
  if (redacted.local_codex_cli.executable_path) {
    redacted.local_codex_cli.executable_path = '<WINDOWS_CODEX_EXECUTABLE>';
  }
  if (redacted.worktree_isolation.probe_path) {
    redacted.worktree_isolation.probe_path = '<LOCAL_BRIDGE_STATE>/worktrees/issue-21-probe';
  }
  redacted.redaction = {
    local_paths: true,
    secret_values: true,
    raw_auth_output: true,
  };
  return redacted;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(args['repo-root'] || process.cwd());
  const stateDir = resolve(args['state-dir'] || join(repoRoot, '.gso-local-bridge-state'));
  const manifestPath = resolve(args.manifest || join(repoRoot, 'control', 'local-bridge', 'issue-21.manifest.json'));
  const output = resolve(args.output || join(stateDir, 'latest-report.json'));
  const report = await buildDryRunReport({ repoRoot, stateDir, manifestPath });
  atomicWriteJson(output, report);
  if (args['redacted-output']) {
    atomicWriteJson(resolve(args['redacted-output']), redactLocalPaths(report));
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.final_state === 'BLOCKED') process.exitCode = 1;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
