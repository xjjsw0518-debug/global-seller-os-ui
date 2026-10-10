# GSO Auto-Loop Controller

## Purpose

The controller watches delivery state and records safe recovery actions. It never performs server, database, container, business-write API, secret, frozen-UI, Backstop baseline, or Gate-threshold operations.

## State machine

`READY -> RUNNING -> PASS` advances one Issue at a time. A normal failure becomes `FAILED`; an overdue RUNNING item becomes `STALE`; an unsafe or approval-required action becomes `BLOCKED`; `HOLD` pauses the loop by explicit operator choice.

- READY: scoped Issue has entry evidence and may be selected.
- RUNNING: exactly one Issue is being encoded and verified.
- PASS: required Gate and evidence are complete.
- FAILED: Gate or evidence failed; a repair recommendation is recorded.
- BLOCKED: user approval, secret availability, or prohibited side effect is required.
- STALE: RUNNING or status evidence exceeded its timeout without a fresh update.
- HOLD: loop intentionally paused; no automatic work is started.

Each batch contains at most three Issues. Only one Issue may be encoded at a time. After its Gate passes, the controller advances to the next READY Issue. When all three pass, it selects the next batch of at most three READY Issues.

## Checks and recovery

The controller checks Issue/Project state, RUNNING age, PR Gate presence and result, mergeability, artifacts, evidence comments, `/dev-status.json` freshness, and approval blockers. Ordinary failures produce a bounded recovery comment and status update. Missing Gate runs may trigger a no-op commit or workflow dispatch only when explicitly enabled for the repository. High-risk findings enter `BLOCKED_USER_APPROVAL_REQUIRED` and stop.

## Stop and authorization boundaries

Stop when a scope is incomplete, a secret is missing, a protected branch cannot merge, a Gate is failing, a user approval is required, or an action would touch root/server/database/container/business-write APIs. The controller never prints secret values, cookies, tokens, API keys, or credentials.

## Status and Work recovery

Every automatic transition writes an idempotent Issue comment and updates `/dev-status`. A status-only controller commit contains no business or UI code and dispatches the full GSO Gate explicitly. Status updates include the loop mode, batch, current RUNNING Issue, READY queue, last controller check, last recovery action, and approval requirement. When a Work stops, the watcher records the stop, marks an overdue RUNNING item STALE, and emits a resume instruction; it does not silently continue coding.

For the U00E to U00F transition, the controller requires the exact completion marker `FINAL_STATE=WRC_P2_U00E_ROUTE_AUDIT_READY` in the parent GitHub Issue or one of its comments. It then creates or reopens the contract-decision Issue, publishes the bounded resume instruction, clears the stale blocker on the parent Issue, and writes the same next action to `/dev-status.json`. All operations are idempotent.

GitHub Actions cannot start or wake a stopped Codex Work session. The controller removes the need to manually compose or copy the next prompt, but a Work-capable platform runner must still claim or start the READY Issue. This platform boundary is recorded in both the Issue and `/dev-status.json`.

## Three-unit cadence

The controller counts consecutive PASS results in the active batch. At three PASS results it closes the batch and claims the next eligible READY queue, never more than three Issues and never crossing centers or frozen scope.
