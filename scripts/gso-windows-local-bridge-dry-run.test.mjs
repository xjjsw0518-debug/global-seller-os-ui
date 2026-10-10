import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  acquireSingletonLock,
  acquireTaskLease,
  buildCodexChildEnv,
  checkChangedPaths,
  evaluateAdmission,
  evaluateGitHubWritebackCapabilities,
  evaluateIssueState,
  parseGitStatusPaths,
  releaseSingletonLock,
} from './gso-windows-local-bridge-dry-run.mjs';

test('RUNNING text without both RUN_ID and LEASE_ID remains READY', () => {
  const state = evaluateIssueState(
    { state: 'open', body: '## Status\n\n`READY`' },
    [{ body: 'Claimed as RUNNING, but no execution evidence exists.' }],
  );
  assert.equal(state.running_claim_count, 1);
  assert.equal(state.codex_run_lease_evidence_count, 0);
  assert.equal(state.effective_state, 'READY');
  assert.equal(state.running_is_evidence_backed, false);
});

test('RUNNING requires a paired Codex run and lease marker', () => {
  const state = evaluateIssueState(
    { state: 'open', body: '## Status\n\n`READY`' },
    [{ body: 'RUNNING\nRUN_ID=run-1\nLEASE_ID=lease-1' }],
  );
  assert.equal(state.effective_state, 'RUNNING');
  assert.equal(state.running_is_evidence_backed, true);
});

test('incomplete Issue checklist blocks admission', () => {
  const admission = evaluateAdmission('## Status\n`READY`\n\nScope: read-only acceptance.');
  assert.equal(admission.complete, false);
  assert.ok(admission.missing_fields.includes('ALLOWED_FILES'));
  assert.ok(admission.missing_fields.includes('ACCEPTANCE_CRITERIA'));
});

test('complete Issue checklist requires the frozen UI impact declaration', () => {
  const body = [
    '## Scope:',
    '## Out of Scope:',
    '## Acceptance Criteria:',
    '## Allowed Files:',
    '## Forbidden Files:',
    '## Frozen UI Impact:',
    '## Required Gates:',
    '## Expected Evidence:',
    '## Authorization Required:',
    '## Risk Level:',
    '## Entry Decision:',
    '## Next Safe Unit:',
  ].join('\n');
  assert.equal(evaluateAdmission(body).complete, true);
  assert.equal(evaluateAdmission(body.replace('## Frozen UI Impact:', '')).missing_fields.includes('FROZEN_UI_IMPACT'), true);
});

test('allowed and forbidden path policy is fail closed', () => {
  const policy = {
    allowed: ['scripts/gso-windows-local-bridge-*', 'control/local-bridge/**'],
    forbidden: ['src/**', '.github/workflows/**'],
  };
  assert.equal(checkChangedPaths(['scripts/gso-windows-local-bridge-dry-run.mjs'], policy).ok, true);
  const denied = checkChangedPaths(['src/App.jsx', 'docs/unreviewed.md'], policy);
  assert.equal(denied.ok, false);
  assert.deepEqual(denied.forbidden_matches, ['src/App.jsx']);
  assert.deepEqual(denied.not_allowed, ['docs/unreviewed.md', 'src/App.jsx']);
});

test('git porcelain parser preserves paths for tracked and untracked files', () => {
  assert.deepEqual(
    parseGitStatusPaths(' M docs/GSO_WINDOWS_LOCAL_BRIDGE_DRY_RUN.md\n?? scripts/new-file.mjs\n'),
    ['docs/GSO_WINDOWS_LOCAL_BRIDGE_DRY_RUN.md', 'scripts/new-file.mjs'],
  );
});

test('single-instance lock is atomic and releases cleanly', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'gso-bridge-lock-'));
  try {
    const first = acquireSingletonLock(stateDir, 'run-1');
    const second = acquireSingletonLock(stateDir, 'run-2');
    assert.equal(first.acquired, true);
    assert.equal(second.acquired, false);
    assert.equal(second.code, 'SINGLE_INSTANCE_LOCK_BUSY');
    releaseSingletonLock(first);
    const third = acquireSingletonLock(stateDir, 'run-3');
    assert.equal(third.acquired, true);
    releaseSingletonLock(third);
  } finally {
    rmSync(stateDir, { recursive: true, force: true });
  }
});
test('task lease refuses a duplicate active lease', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'gso-bridge-lease-'));
  try {
    const first = acquireTaskLease(stateDir, 'deterministic-lease', 'run-1');
    const second = acquireTaskLease(stateDir, 'deterministic-lease', 'run-2');
    assert.equal(first.acquired, true);
    assert.equal(second.acquired, false);
    assert.equal(second.idempotent_replay, false);
    assert.equal(second.status, 'ACTIVE');
  } finally {
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test('Codex child environment never inherits GitHub or OpenAI credentials', () => {
  const child = buildCodexChildEnv({
    PATH: 'safe',
    GH_TOKEN: 'secret',
    GITHUB_TOKEN: 'secret',
    OPENAI_API_KEY: 'secret',
    GITHUB_APP_PRIVATE_KEY: 'secret',
    GSO_GITHUB_BROKER_TOKEN: 'secret',
  });
  assert.deepEqual(child, { PATH: 'safe' });
});

test('GitHub writeback readiness requires personal Project write access', () => {
  const repositoryOnly = evaluateGitHubWritebackCapabilities({
    authenticated: true,
    scopes: ['repo', 'workflow'],
    repoPermissions: { push: true },
  });
  assert.equal(repositoryOnly.repository_issue_pr_write, true);
  assert.equal(repositoryOnly.personal_project_write, false);
  assert.equal(repositoryOnly.complete, false);

  const complete = evaluateGitHubWritebackCapabilities({
    authenticated: true,
    scopes: ['repo', 'project'],
    repoPermissions: { push: true },
  });
  assert.equal(complete.complete, true);
});
// End of dry-run contract tests.
