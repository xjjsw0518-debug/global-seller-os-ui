import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPreflightDecision,
  detectAuthMode,
  detectExecCapabilities,
} from './codex-runner-preflight.mjs';

test('auth reporting emits only a bounded category', () => {
  assert.equal(detectAuthMode('Logged in using ChatGPT', true), 'CHATGPT');
  assert.equal(detectAuthMode('Authenticated with an API key', true), 'API_KEY');
  assert.equal(detectAuthMode('Authenticated with access-token', true), 'ACCESS_TOKEN');
  assert.equal(detectAuthMode('user@example.com', true), 'AUTHENTICATED_UNKNOWN');
  assert.equal(detectAuthMode('anything', false), 'UNAUTHENTICATED');
});

test('exec capability reporting is derived from help text without executing a model', () => {
  const capabilities = detectExecCapabilities(
    'Run Codex non-interactively --json --ephemeral --sandbox --approve-for-me --worktree --dangerously-bypass-approvals-and-sandbox',
    true,
  );

  assert.deepEqual(capabilities, {
    non_interactive_exec: true,
    json_output: true,
    ephemeral_mode: true,
    sandbox_selection: true,
    automatic_approval_review: true,
    worktree_mode: true,
    dangerous_bypass_available: true,
  });
});

test('missing command cannot be reported as non-interactive', () => {
  assert.equal(detectExecCapabilities('Run Codex non-interactively', false).non_interactive_exec, false);
});

test('missing dedicated credential emits only the required secret name', () => {
  const decision = buildPreflightDecision({
    cliInstalled: true,
    authenticated: false,
    execAvailable: true,
    workspaceWritable: true,
    accessTokenSet: false,
  });

  assert.equal(decision.status, 'BLOCKED');
  assert.deepEqual(decision.blockers, ['BLOCKED_SECRET_MISSING:CODEX_ACCESS_TOKEN']);
  assert.equal(decision.required_status.CODEX_CLI_INSTALLED, true);
  assert.equal(decision.required_status.CODEX_AUTHENTICATED, false);
  assert.equal(decision.required_status.NEXT_SAFE_UNIT, null);
});

test('all required controls produce the Step 17C handoff', () => {
  const decision = buildPreflightDecision({
    cliInstalled: true,
    authenticated: true,
    execAvailable: true,
    workspaceWritable: true,
    accessTokenSet: true,
  });

  assert.deepEqual(decision, {
    status: 'PASS',
    blockers: [],
    required_status: {
      CODEX_CLI_INSTALLED: true,
      CODEX_AUTHENTICATED: true,
      CODEX_EXEC_AVAILABLE: true,
      NON_INTERACTIVE_SUPPORTED: true,
      STATUS: 'PASS',
      NEXT_SAFE_UNIT: 'STEP_17C_AUTONOMOUS_EXECUTOR_DRY_RUN',
    },
  });
});
