import { spawnSync } from 'node:child_process';
import { accessSync, constants, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MODEL_CREDENTIAL_NAMES = [
  'CODEX_ACCESS_TOKEN',
  'OPENAI_API_KEY',
  'CODEX_API_KEY',
  'OPENAI_EXECUTOR_API_KEY',
];

function runCommand(command, args = [], timeout = 10_000) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout,
    windowsHide: true,
    env: { ...process.env, NO_COLOR: '1' },
  });

  return {
    available: result.error?.code !== 'ENOENT',
    ok: !result.error && result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function cleanVersion(commandResult) {
  if (!commandResult.ok) return null;
  const value = `${commandResult.stdout}\n${commandResult.stderr}`
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return value ? value.slice(0, 160) : null;
}

export function detectAuthMode(rawStatus, authenticated) {
  if (!authenticated) return 'UNAUTHENTICATED';
  if (/access[ _-]?token/i.test(rawStatus)) return 'ACCESS_TOKEN';
  if (/api[ _-]?key/i.test(rawStatus)) return 'API_KEY';
  if (/chatgpt/i.test(rawStatus)) return 'CHATGPT';
  return 'AUTHENTICATED_UNKNOWN';
}

export function detectExecCapabilities(rawHelp, commandAvailable) {
  return {
    non_interactive_exec: commandAvailable && /Run Codex non-interactively/i.test(rawHelp),
    json_output: /--json\b/.test(rawHelp),
    ephemeral_mode: /--ephemeral\b/.test(rawHelp),
    sandbox_selection: /--sandbox\b/.test(rawHelp),
    automatic_approval_review: /--approve-for-me\b/.test(rawHelp),
    worktree_mode: /--worktree\b/.test(rawHelp),
    dangerous_bypass_available: /--dangerously-bypass-approvals-and-sandbox\b/.test(rawHelp),
  };
}

export function buildPreflightDecision({
  cliInstalled,
  authenticated,
  execAvailable,
  workspaceWritable,
  accessTokenSet,
}) {
  const blockers = [];
  if (!cliInstalled) blockers.push('CODEX_CLI_NOT_INSTALLED');
  if (!authenticated) {
    blockers.push(accessTokenSet ? 'CODEX_AUTHENTICATION_INVALID' : 'BLOCKED_SECRET_MISSING:CODEX_ACCESS_TOKEN');
  }
  if (!execAvailable) blockers.push('CODEX_EXEC_NOT_AVAILABLE');
  if (!workspaceWritable) blockers.push('GITHUB_WORKSPACE_NOT_WRITABLE');
  const status = blockers.length === 0 ? 'PASS' : 'BLOCKED';

  return {
    status,
    blockers,
    required_status: {
      CODEX_CLI_INSTALLED: cliInstalled,
      CODEX_AUTHENTICATED: authenticated,
      CODEX_EXEC_AVAILABLE: execAvailable,
      NON_INTERACTIVE_SUPPORTED: execAvailable,
      STATUS: status,
      NEXT_SAFE_UNIT: status === 'PASS' ? 'STEP_17C_AUTONOMOUS_EXECUTOR_DRY_RUN' : null,
    },
  };
}

function directoryPermissions(directory) {
  if (!directory) return { configured: false, readable: false, writable: false, executable: false };
  const allowed = (mode) => {
    try {
      accessSync(directory, mode);
      return true;
    } catch {
      return false;
    }
  };
  return {
    configured: true,
    readable: allowed(constants.R_OK),
    writable: allowed(constants.W_OK),
    executable: allowed(constants.X_OK),
  };
}

export function buildReport({ env = process.env, run = runCommand } = {}) {
  const codexVersion = run('codex', ['--version']);
  const codexLogin = codexVersion.available
    ? run('codex', ['login', 'status'])
    : { available: false, ok: false, stdout: '', stderr: '' };
  const codexHelp = codexVersion.available
    ? run('codex', ['exec', '--help'])
    : { available: false, ok: false, stdout: '', stderr: '' };
  const helpText = `${codexHelp.stdout}\n${codexHelp.stderr}`;
  const authText = `${codexLogin.stdout}\n${codexLogin.stderr}`;
  const capabilities = detectExecCapabilities(helpText, codexHelp.available);

  const directories = {
    runner_temp: directoryPermissions(env.RUNNER_TEMP),
    runner_workspace: directoryPermissions(env.RUNNER_WORKSPACE),
    github_workspace: directoryPermissions(env.GITHUB_WORKSPACE),
  };
  const executorPreflight = buildPreflightDecision({
    cliInstalled: codexVersion.available && codexVersion.ok,
    authenticated: codexLogin.ok,
    execAvailable: capabilities.non_interactive_exec,
    workspaceWritable: directories.github_workspace.writable,
    accessTokenSet: Boolean(env.CODEX_ACCESS_TOKEN),
  });

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    probe: {
      mode: 'READ_ONLY_NO_MODEL',
      model_call_performed: false,
      business_code_changed: false,
      server_service_changed: false,
      database_changed: false,
      secret_values_emitted: false,
    },
    runner: {
      name: env.RUNNER_NAME || 'UNSET',
      os: env.RUNNER_OS || process.platform,
      architecture: env.RUNNER_ARCH || process.arch,
      environment: env.RUNNER_ENVIRONMENT || 'UNSET',
    },
    repository: {
      name: env.GITHUB_REPOSITORY || 'UNSET',
      event: env.GITHUB_EVENT_NAME || 'UNSET',
      ref: env.GITHUB_REF || 'UNSET',
      sha: env.GITHUB_SHA || 'UNSET',
    },
    tools: {
      codex: {
        installed: codexVersion.available && codexVersion.ok,
        version: cleanVersion(codexVersion),
        authenticated: codexLogin.ok,
        auth_mode: detectAuthMode(authText, codexLogin.ok),
        ...capabilities,
      },
      git: {
        installed: run('git', ['--version']).ok,
      },
      node: {
        installed: run('node', ['--version']).ok,
      },
      npm: {
        installed: run('npm', ['--version']).ok,
      },
    },
    credentials: Object.fromEntries(
      MODEL_CREDENTIAL_NAMES.map((name) => [name, env[name] ? 'SET' : 'UNSET']),
    ),
    directories,
    permission_boundary: {
      workflow_contents_permission: 'READ_ONLY',
      approval_mode_exercised: false,
      dangerous_bypass_exercised: false,
      git_write_exercised: false,
      network_model_request_exercised: false,
    },
    executor_preflight: executorPreflight,
  };
}

function main() {
  const output = resolve(process.env.PREFLIGHT_OUTPUT || 'codex-runner-preflight.json');
  const report = buildReport();
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  writeFileSync(output, serialized, { encoding: 'utf8', mode: 0o600 });
  process.stdout.write(serialized);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) main();
