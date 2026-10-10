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
  ['frozen_ui_impact', /(?:^|\n)(?:#{1,6}\s*)?frozen ui impact\s*:/i],
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

function normalizeReviewText(value) {
  return value.replace(/\r\n/g, '\n').replace(/\s+$/, '');
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
    input: options.input,
  }) : spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    timeout: options.timeout ?? 20_000,
    windowsHide: true,
    env: { ...process.env, NO_COLOR: '1', ...(options.env || {}) },
    input: options.input,
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

const CHILD_SECRET_ENV_PATTERN = /^(?:GH_TOKEN|GITHUB_TOKEN|OPENAI_API_KEY|GIT_ASKPASS|SSH_ASKPASS|GSO_GITHUB_|GITHUB_APP_|CODEX_API_KEY)/i;

export function buildCodexChildEnv(source = process.env) {
  return Object.fromEntries(Object.entries(source).filter(([name]) => !CHILD_SECRET_ENV_PATTERN.test(name)));
}

function readGitHubCredential(run = runCommand) {
  const result = run('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    timeout: 20_000,
  });
  if (!result.ok) return { available: false, password: null };
  const values = Object.fromEntries(result.stdout.split(/\r?\n/).map((line) => {
    const split = line.indexOf('=');
    return split > 0 ? [line.slice(0, split), line.slice(split + 1)] : null;
  }).filter(Boolean));
  return {
    available: Boolean(values.password),
    password: values.password || null,
  };
}

export function evaluateGitHubWritebackCapabilities({ authenticated, scopes = [], repoPermissions = {} }) {
  const normalizedScopes = new Set(scopes.map((scope) => scope.trim().toLowerCase()).filter(Boolean));
  const repoScope = normalizedScopes.has('repo') || normalizedScopes.has('public_repo');
  const projectWrite = normalizedScopes.has('project');
  const repositoryWrite = authenticated && repoScope && repoPermissions.push === true;
  return {
    repository_issue_pr_write: repositoryWrite,
    repository_branch_write: repositoryWrite,
    actions_and_artifacts_read: authenticated && repoScope,
    personal_project_write: authenticated && projectWrite,
    complete: repositoryWrite && projectWrite,
    broad_personal_credential: normalizedScopes.has('repo') || normalizedScopes.has('workflow'),
  };
}

async function probeGitHubWriteback(credential, repository) {
  const base = {
    ready: false,
    provider: 'WINDOWS_GIT_CREDENTIAL_MANAGER',
    credential_available: credential.available,
    api_authenticated: false,
    oauth_scopes: [],
    secret_value_recorded: false,
    secret_persisted_by_bridge: false,
    credential_inherited_by_codex: false,
    controller_endpoint_allowlist_validated: true,
    write_runtime_enabled: false,
    write_attempted: false,
  };
  if (!credential.available || !credential.password) {
    return { ...base, reason: 'WINDOWS_GIT_CREDENTIAL_NOT_AVAILABLE' };
  }
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${credential.password}`,
    'User-Agent': 'gso-windows-local-bridge-dry-run',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  try {
    const [userResponse, repositoryResponse] = await Promise.all([
      fetch('https://api.github.com/user', { headers }),
      fetch(`https://api.github.com/repos/${repository}`, { headers }),
    ]);
    if (!userResponse.ok || !repositoryResponse.ok) {
      return { ...base, reason: `GITHUB_AUTHENTICATED_READ_FAILED:${userResponse.status}:${repositoryResponse.status}` };
    }
    const scopeHeader = userResponse.headers.get('x-oauth-scopes') || '';
    const scopes = scopeHeader.split(',').map((scope) => scope.trim()).filter(Boolean).sort();
    const repositoryJson = await repositoryResponse.json();
    const capabilities = evaluateGitHubWritebackCapabilities({
      authenticated: true,
      scopes,
      repoPermissions: repositoryJson.permissions || {},
    });
    return {
      ...base,
      api_authenticated: true,
      oauth_scopes: scopes,
      repository_admin: repositoryJson.permissions?.admin === true,
      capabilities,
      ready: capabilities.complete,
      reason: capabilities.complete
        ? 'CONTROLLER_ONLY_WRITEBACK_CAPABILITIES_COMPLETE'
        : 'PERSONAL_PROJECT_WRITE_PERMISSION_MISSING',
      recommended_provider: capabilities.complete ? null : 'LEAST_PRIVILEGE_GITHUB_APP_OR_APP_USER_ACCESS_TOKEN',
    };
  } catch (error) {
    return { ...base, reason: `GITHUB_AUTH_PROBE_FAILED:${error.name || 'ERROR'}` };
  }
}

function buildWritebackPlan(manifest, runId, leaseId) {
  const issueBase = `/repos/${manifest.repository}/issues/${manifest.issue_number}`;
  return {
    dry_run_only: true,
    claim_requires_real_codex_run_id: true,
    idempotency_key: sha256(`${manifest.repository}\n${manifest.issue_number}\n${leaseId}`),
    controller_operations: [
      { operation: 'READ_READY_ISSUE', method: 'GET', endpoint: issueBase },
      { operation: 'CLAIM_WITH_RUN_AND_LEASE', method: 'POST', endpoint: `${issueBase}/comments`, precondition: 'REAL_CODEX_RUN_ID_AND_ACTIVE_LEASE' },
      { operation: 'UPDATE_ISSUE_EVIDENCE', method: 'POST', endpoint: `${issueBase}/comments`, precondition: 'MATCHING_RUN_AND_LEASE' },
      { operation: 'CREATE_PULL_REQUEST', method: 'POST', endpoint: `/repos/${manifest.repository}/pulls`, precondition: 'ALLOWED_PATHS_AND_NON_MAIN_BRANCH' },
      { operation: 'READ_GATE_AND_ARTIFACTS', method: 'GET', endpoint: `/repos/${manifest.repository}/actions/runs`, precondition: 'EXACT_PR_HEAD_SHA' },
      { operation: 'UPDATE_PROJECT_STATUS', method: 'GRAPHQL', endpoint: 'ProjectV2 item status', precondition: 'MATCHING_RUN_AND_LEASE' },
      { operation: 'UPDATE_DEV_STATUS_AFTER_GATE', method: 'GIT', endpoint: 'public/dev-status.json', precondition: 'EXACT_HEAD_FULL_GATE_PASS' },
    ],
    prepared_run_id: runId,
    prepared_lease_id: leaseId,
    write_attempted: false,
  };
}

function git(repoRoot, args, timeout = 30_000) {
  const result = runCommand('git', ['-C', repoRoot, ...args], { timeout });
  if (!result.ok) {
    throw new Error(`GIT_COMMAND_FAILED:${args[0]}:${result.status ?? result.error_code ?? 'UNKNOWN'}`);
  }
  return result.stdout.trim();
}

export function parseGitStatusPaths(status) {
  if (!status) return [];
  return status.split(/\r?\n/).filter(Boolean).map((line) => {
    const value = line.slice(3).trim();
    return value.includes(' -> ') ? value.split(' -> ').at(-1) : value;
  });
}

function changedPaths(repoRoot) {
  const result = runCommand('git', ['-C', repoRoot, 'status', '--porcelain=v1', '--untracked-files=all']);
  if (!result.ok) throw new Error(`GIT_STATUS_FAILED:${result.status ?? result.error_code ?? 'UNKNOWN'}`);
  return parseGitStatusPaths(result.stdout.replace(/\r?\n$/, ''));
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

async function fetchJson(url, token = null) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'gso-windows-local-bridge-dry-run',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, {
    headers,
  });
  if (!response.ok) throw new Error(`GITHUB_READ_FAILED:${response.status}`);
  return response.json();
}

async function readIssue(repository, issueNumber, token = null) {
  const base = `https://api.github.com/repos/${repository}`;
  const [issue, comments] = await Promise.all([
    fetchJson(`${base}/issues/${issueNumber}`, token),
    fetchJson(`${base}/issues/${issueNumber}/comments?per_page=100`, token),
  ]);
  return { issue, comments };
}

function verifyWorktreeIsolation(repoRoot, stateDir, manifest) {
  const baseHead = git(repoRoot, ['rev-parse', manifest.base_ref]);
  const probeName = `i${manifest.issue_number}-${baseHead.slice(0, 12)}`;
  const probePath = ensureChildPath(stateDir, join(stateDir, 'w', probeName));
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
    probe_name: probeName,
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
  const issueBodyPath = resolve(repoRoot, manifest.issue_body_path);
  const expectedIssueBody = normalizeReviewText(readFileSync(issueBodyPath, 'utf8'));
  const issueBodyHash = sha256(expectedIssueBody);
  const bridgeSourceIntegrity = manifest.bridge_sources.map((entry) => {
    const actual = sha256(readFileSync(resolve(repoRoot, entry.path)));
    return { path: entry.path, expected_sha256: entry.sha256, actual_sha256: actual, matches: entry.sha256 === actual };
  });
  const manifestHash = sha256(manifestBytes);
  const runId = `gso-dry-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`;
  const singleton = acquireSingletonLock(stateDir, runId);
  if (!singleton.acquired) throw new Error(singleton.code);

  try {
    const githubCredential = readGitHubCredential();
    const githubWriteback = await probeGitHubWriteback(githubCredential, manifest.repository);
    const { issue, comments } = await readIssue(manifest.repository, manifest.issue_number, githubCredential.password);
    githubCredential.password = null;
    const issueState = evaluateIssueState(issue, comments);
    const admission = evaluateAdmission(issue.body || '');
    const actualIssueBodyHash = sha256(normalizeReviewText(issue.body || ''));
    const issueBodyMatches = issueBodyHash === actualIssueBodyHash;
    const baseSha = git(repoRoot, ['rev-parse', manifest.base_ref]);
    const leaseId = sha256([
      manifest.repository,
      manifest.issue_number,
      issue.updated_at,
      baseSha,
      manifestHash,
      promptHash,
      issueBodyHash,
    ].join('\n')).slice(0, 32);
    const pathPolicy = checkChangedPaths(changedPaths(repoRoot), manifest.bridge_change_policy);
    const worktree = verifyWorktreeIsolation(repoRoot, stateDir, manifest);
    const codex = probeLocalCodex();
    // A dry-run lease is acquired only after non-model preflight succeeds, so a
    // checkout/path failure cannot strand an ACTIVE lease before any model run.
    const lease = acquireTaskLease(stateDir, leaseId, runId);

    const blockers = [];
    if (manifest.prompt_sha256 !== promptHash) blockers.push('PROMPT_HASH_MISMATCH');
    if (manifest.issue_body_sha256 !== issueBodyHash) blockers.push('ISSUE_BODY_HASH_MISMATCH');
    if (bridgeSourceIntegrity.some((entry) => !entry.matches)) blockers.push('BRIDGE_SOURCE_HASH_MISMATCH');
    if (!codex.executable_found) blockers.push('LOCAL_CODEX_CLI_NOT_FOUND');
    if (!codex.authenticated) blockers.push('LOCAL_CODEX_NOT_AUTHENTICATED');
    if (!pathPolicy.ok) blockers.push('BRIDGE_CHANGED_FILE_POLICY_FAILED');
    if (!worktree.ok) blockers.push('WORKTREE_ISOLATION_FAILED');
    if (!lease.acquired && !lease.idempotent_replay) blockers.push('TASK_LEASE_BUSY');

    const stepABridgeReady = blockers.length === 0;
    const stepBBlockers = [
      ...(admission.complete ? [] : ['ISSUE_DEVELOPMENT_ENTRY_CHECKLIST_INCOMPLETE']),
      ...(issueBodyMatches ? [] : ['ISSUE_BODY_DOES_NOT_MATCH_REVIEWED_CHECKLIST']),
      ...(issueState.effective_state === manifest.required_source_state ? [] : ['ISSUE_SOURCE_NOT_READY']),
      ...(manifest.issue_execution_policy.allowed_files.length > 0 ? [] : ['ISSUE_ALLOWED_FILES_EMPTY']),
      ...(githubWriteback.ready ? [] : ['GITHUB_WRITEBACK_NOT_READY']),
    ];
    const stepBReady = stepABridgeReady && stepBBlockers.length === 0;
    const writebackPlan = buildWritebackPlan(manifest, runId, leaseId);

    const report = {
      schema_version: 2,
      generated_at: new Date().toISOString(),
      final_state: stepBReady ? 'WINDOWS_GSO_BRIDGE_STEP_B_READY' : 'WINDOWS_GSO_BRIDGE_STEP_B_BLOCKED',
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
      reviewed_issue_checklist: {
        path: manifest.issue_body_path,
        expected_sha256: issueBodyHash,
        manifest_hash_matches: manifest.issue_body_sha256 === issueBodyHash,
        github_body_sha256: actualIssueBodyHash,
        github_body_matches: issueBodyMatches,
        codex_allowed_files: manifest.issue_execution_policy.allowed_files,
        controller_post_gate_allowed_files: manifest.issue_execution_policy.controller_post_gate_allowed_files,
        forbidden_files: manifest.issue_execution_policy.forbidden_files,
      },
      bridge_dry_run: {
        ready: stepABridgeReady,
        model_call_performed: false,
        github_write_performed: false,
        business_code_changed: false,
        prompt_path: manifest.prompt_path,
        prompt_sha256: promptHash,
        prompt_hash_matches_manifest: manifest.prompt_sha256 === promptHash,
        manifest_sha256: manifestHash,
        bridge_source_integrity: bridgeSourceIntegrity,
        changed_file_policy: pathPolicy,
      },
      worktree_isolation: worktree,
      lease_idempotency: {
        atomic_single_instance_lock: true,
        deterministic_lease_id: true,
        input_base_sha: baseSha,
        lease_acquired: lease.acquired,
        idempotent_replay: lease.idempotent_replay,
        status: lease.status,
      },
      gh_writeback_readiness: {
        ...githubWriteback,
        required_permissions: manifest.github_writeback_policy.required_permissions,
        operations: manifest.github_writeback_policy.allowed_operations,
        plan: writebackPlan,
      },
      runner_test_only: {
        gso_gate_runner_role: 'NON_AI_TESTS_ONLY',
        local_bridge_codex_role: 'WINDOWS_ONLY',
        server_codex_invoked: false,
        note: 'Existing manual runner Codex bootstrap workflows were not invoked or modified.',
      },
      blockers,
      step_b: {
        ready: stepBReady,
        execution_performed: false,
        model_call_performed: false,
        separate_real_run_confirmation_required: true,
        limits: manifest.step_b_limits,
        blockers: stepBBlockers,
      },
      next_safe_unit: stepBReady
        ? 'Request separate user confirmation immediately before one bounded Codex model run for Issue #21.'
        : stepABridgeReady
          ? issueBodyMatches
            ? 'Provision controller-only personal Project writeback permission, then rerun the no-model dry run.'
            : 'Synchronize the reviewed Issue #21 checklist, then rerun the no-model dry run.'
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
    redacted.worktree_isolation.probe_path = `<LOCAL_BRIDGE_STATE>/worktrees/${redacted.worktree_isolation.probe_name}`;
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
  if (report.final_state.endsWith('_BLOCKED')) process.exitCode = 1;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
