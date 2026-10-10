import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  acquireSingletonLock,
  acquireTaskLease,
  checkChangedPaths,
  evaluateAdmission,
  evaluateIssueState,
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
// End of dry-run contract tests.
