import assert from 'node:assert/strict';
import test from 'node:test';

import { detectAuthMode, detectExecCapabilities } from './codex-runner-preflight.mjs';

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
