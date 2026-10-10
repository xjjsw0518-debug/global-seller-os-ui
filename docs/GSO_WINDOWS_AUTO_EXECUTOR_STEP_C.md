# Windows Codex auto-executor — Step C

## Scope and current result

The Windows bridge has one bounded execution path for Issue #21. GitHub remains the queue and evidence source, the Windows controller owns Git/GitHub operations, Codex uses the existing local ChatGPT login only inside an isolated worktree, and the self-hosted runner remains non-AI.

The validation for this revision made GitHub reads and local filesystem/Git checks only. It did not run `codex exec`, write Issue state, create a task PR, or consume model quota.

## Reviewed-executor boundary

Real execution uses `control/local-bridge/issue-21.execute.manifest.json`; dry-run uses `control/local-bridge/issue-21.manifest.json`. The two modes are not interchangeable.

Before any real run, the controller fetches `origin/main` and requires all of the following:

1. local `HEAD` equals current `origin/main` exactly;
2. the repository is clean, including untracked files;
3. the running module is the tracked `scripts/gso-windows-auto-executor.mjs` in that checkout;
4. the executor, execute manifest, prompt, and checklist have the same Git blobs as `origin/main`;
5. the canonical executor SHA-256 equals the hash recorded by the execute manifest.

An older checkout, a copied/replaced executor, a dirty policy file, or an untracked executable fails closed.

## One-time authorization

The authorization envelope lives only under the external controller state directory. It binds:

- authorization ID;
- Issue number;
- execute-manifest SHA-256;
- prompt SHA-256;
- reviewed executor SHA-256;
- approved `origin/main` commit;
- expiry;
- one model run and zero automatic retries.

The controller atomically creates a durable consumption receipt before starting Codex. Reusing the ID is rejected after a process restart. A changed main commit, manifest, prompt, or executor also invalidates the authorization. The pending authorization file must be under the external `authorizations/pending` directory.

## State contract

The success path is:

`READY → CLAIMED → RUNNING → PR_CREATED → TESTING → FINAL_GATE_PENDING → PR_REVIEW_REQUIRED`

`PASS` is a separate post-merge reconciliation state. It requires a merged PR commit and a successful exact-merge-commit main Gate. A successful PR Gate alone never means the Issue or project is complete.

Failure paths remain `FAILED`, `BLOCKED`, and `FIX_REQUIRED`. `RUNNING` requires a real `RUN_ID`, `LEASE_ID`, and observed Codex thread ID. A failure in either PR-head Gate prevents PASS and automatic merge.

`/dev-status` preserves the aggregate project status and the rest of the READY queue. The controller records U01 under `in_progress` as `FINAL_GATE_PENDING`; it does not add U01 to `completed` or set the whole project to PASS.

State comments are accepted only when the author matches the reviewed controller login, the payload binds the repository and Issue, and the referenced run/lease/state exists in the external local journal. Forged or lineage-free marker comments block automatic reclaim.

## Local and credential isolation

State, journals, locks, authorization files, model output, logs, and task worktrees default to `%LOCALAPPDATA%/GlobalSellerOS/codex-bridge/<repo-id>`, outside the repository. A repository-local state directory is rejected; `.gso-auto-executor-state/` is also ignored as defense in depth.

The Codex child receives no controller GitHub or OpenAI credential environment variables. The non-model sandbox probe additionally verifies that Git Credential Manager credentials and direct network access are unavailable inside the restricted token. The controller never passes its token, broker, or writeback function to the child.

Issue #21 allows Codex to modify only:

- `docs/evidence/WRC_P2_U01_WORKER_HOME_REAL_READ_ACCEPTANCE.md`

After the preliminary exact-head Gate, only the controller may additionally modify:

- `public/dev-status.json`

Direct pushes to `main`, automatic merge, frozen UI changes, Gate or Backstop baseline changes, database/production work, server Codex, extra API keys, retries, and a second model run are forbidden.

## Verification commands

Executor and inherited bridge tests are separate from the existing GSO Gate:

```text
node --test scripts/gso-windows-local-bridge-dry-run.test.mjs scripts/gso-windows-auto-executor.test.mjs
```

The existing GSO Gate does **not** invoke these executor unit tests. It continues to own build, dependency, unused-code, Playwright, axe, and Backstop validation without invoking AI. Both evidence sets are required and must not be conflated.

The no-model dry run uses the dry-run manifest and an external short state directory. It validates READY selection, checklist completeness, lock/lease behavior, worktree isolation, prompt hash, allowed/forbidden paths, controller read access, sandbox credential isolation, failure recovery, both Gate-failure paths, and duplicate prevention.

## First real run boundary

Issue #21 remains the only selectable first run: concurrency 1, one model execution, zero retries, and a 30-minute timeout. A fresh one-time authorization may be created only after the user separately confirms the real run. Until then, the correct state remains READY; there is no real run ID or lease ID.
