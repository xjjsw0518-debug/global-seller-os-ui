<!-- gso-auto-loop:WRC-P2-U01 -->
## Status

`READY`

## Scope:

Validate the Worker homepage authenticated, read-only `overview` and `map-data` path against the already accepted Worker staging recovery evidence and the exact `main` source revision. The unit may record an evidence document; it may not implement or change Worker business behavior.

## Out of Scope:

- No business-write API, data mutation, seed, migration, database, container, service, root, production, or secret operation.
- No Worker UI, layout, interaction, styling, visual fixture, asset, routing, API adapter, or business-code change.
- No standalone `resource-list` route or frontend read-path migration; that decision remains deferred.
- No BackstopJS reference/baseline, Gate workflow, threshold, dependency, package manifest, or direct `main` change.

## Acceptance Criteria:

1. Record the exact `main` SHA and the source locations proving the homepage read adapter uses only authenticated GET candidates for `worker-ops/overview` and `worker-ops/map-data`.
2. Reconcile the previously accepted read-only recovery evidence: authenticated session established; `overview=200`; `map-data=200`; `health=200`; `ready=200`; no business data written.
3. Record that `resource-list=404` is deferred and is not a failure of the current homepage read contract.
4. Record no secret value or response payload containing sensitive data.
5. Change only the single Codex-allowed evidence file below, or make no repository change and return a blocker.
6. Do not mark the Issue RUNNING until the bridge has both a real Codex `RUN_ID` and an atomic `LEASE_ID`; do not mark PASS until the exact PR head completes the full GSO Gate with all mandatory artifacts.

## Allowed Files:

Codex execution may create or update exactly:

- `docs/evidence/WRC_P2_U01_WORKER_HOME_REAL_READ_ACCEPTANCE.md`

After an exact-head Gate PASS, the bridge control process (not the Codex child) may update exactly:

- `public/dev-status.json`

## Forbidden Files:

- `src/App.jsx`
- `src/workerResourceReadAdapter.js`
- `src/workerResourceReadAdapter.test.js`
- `src/WorkerOverviewMapPanels.jsx`
- `src/workerOverviewMap.css`
- `src/workerWorldOutlineMap.css`
- `src/WorkerWorldOutlineMap.jsx`
- `worker/index.js`
- `tests/e2e/smoke.spec.mjs`
- `tests/e2e/accessibility.spec.mjs`
- `.github/workflows/gso-gate.yml`
- `backstop.config.cjs`
- `backstop_data/**`
- `package.json`
- `package-lock.json`
- every other repository path not listed under Allowed Files

## Frozen UI Impact:

`NONE`. The unit is evidence-only; all UI, visual fixture, CSS, assets, Backstop references, and Gate thresholds remain frozen.

## Required Gates:

- Local bridge manifest and prompt hash match.
- Atomic singleton lock, deterministic single-Issue lease, isolated worktree, and changed-file allowlist pass.
- Local bridge contract tests pass without a model call or GitHub write.
- Exact PR head completes the full existing GSO Gate on self-hosted runner `ser603198648259`: Build, dependency-cruiser, Knip, Playwright smoke, BackstopJS, axe-core, and evidence-template checks.
- Mandatory artifacts exist for that exact run: Playwright, Backstop, dependency-cruiser, Knip, and axe.

## Expected Evidence:

- Codex `RUN_ID`, bridge `LEASE_ID`, prompt SHA-256, manifest SHA-256, base SHA, branch, and isolated worktree identity.
- Changed-file allowlist result and proof that no forbidden path changed.
- Source references for the two approved read endpoints.
- Links to the accepted Worker recovery comments and the exact-head PR/GSO Gate run.
- Mandatory artifact names and final Issue/Project `/dev-status` writeback status.
- Explicit booleans for model calls, retries, business writes, secret output, server Codex use, and direct-main pushes.

## Authorization Required:

Step B DRY_RUN is authorized. The first real Codex model call is not authorized by this checklist and requires a separate user confirmation immediately before execution.

## Risk Level:

`LOW` for this evidence-only repository unit. External writeback remains fail-closed until a reviewed controller-only GitHub credential can update the Issue, PR, Gate evidence, personal Project, and `/dev-status` without being inherited by Codex.

## Entry Decision:

`READY_FOR_ONE_BOUNDED_RUN_AFTER_GITHUB_WRITEBACK_AUTH_AND_SEPARATE_USER_CONFIRMATION`.

## Next Safe Unit:

Provision or approve a least-privilege, controller-only GitHub writeback identity, rerun this no-model DRY_RUN on latest `main`, then request one separate confirmation for Issue #21 only: concurrency 1, at most 1 model call, 0 automatic retries, and a 30-minute timeout.
