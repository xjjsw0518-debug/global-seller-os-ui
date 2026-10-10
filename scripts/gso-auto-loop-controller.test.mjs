import assert from 'node:assert/strict';
import test from 'node:test';

import {
  U00E_FINAL_STATE,
  U00F_MARKER,
  applyU00FStatus,
  buildU00FIssueBody,
  hasU00ECompletion,
} from './gso-auto-loop-controller.mjs';

test('detects U00E completion only from the exact final-state marker', () => {
  assert.equal(hasU00ECompletion({ body: 'audit ready' }, []), false);
  assert.equal(hasU00ECompletion({ body: null }, [{ body: `Evidence\n${U00E_FINAL_STATE}` }]), true);
});

test('builds a bounded U00F contract-decision issue', () => {
  const body = buildU00FIssueBody('https://github.com/example/repo/issues/12');
  assert.match(body, new RegExp(U00F_MARKER));
  assert.match(body, /DEFERRED/);
  assert.match(body, /No business UI or business-code changes/);
  assert.match(body, /cannot start or wake a stopped Codex Work session/);
});

test('writes the same READY next action to dev-status without authorizing coding', () => {
  const updated = applyU00FStatus(
    {
      overall_status: 'RUNNING',
      auto_loop: { status: 'ON' },
      completed: [],
      todo: [],
      issues_to_resolve: [{ id: 'worker-resource-list-route', status: 'READY' }],
    },
    {
      now: '2026-10-10T12:00:00.000Z',
      issueNumber: 17,
      issueUrl: 'https://github.com/example/repo/issues/17',
    },
  );

  assert.equal(updated.overall_status, 'READY');
  assert.equal(updated.next_action.id, 'WRC-P2-U00F');
  assert.equal(updated.next_action.requires_manual_prompt_copying, false);
  assert.equal(updated.next_action.requires_work_session_start, true);
  assert.equal(updated.auto_loop.platform_auto_start_supported, false);
  assert.equal(updated.issues_to_resolve[0].status, 'DEFERRED');
  assert.equal(updated.todo[0].status, 'READY');
});
