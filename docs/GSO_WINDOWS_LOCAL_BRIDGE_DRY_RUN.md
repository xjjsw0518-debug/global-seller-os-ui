# Windows GSO Local Bridge — Step B admission dry run

## Outcome boundary

This Windows-only bridge prepares one bounded local Codex run for GitHub Issue #21. It does not invoke a model, write GitHub, edit Worker business code, call server/root/database/container/production operations, change frozen UI or Backstop references, modify the GSO Gate, or push `main`.

`READY` and `RUNNING` are distinct. An Issue is considered actively running only after an actual Codex process supplies a `RUN_ID` and the bridge owns the matching atomic `LEASE_ID`. The earlier #21 comment and Project value that say `RUNNING` have no paired evidence, so the effective source state remains `READY`.

## Reviewed Issue #21 entry contract

The exact GitHub Issue body must match `control/local-bridge/issue-21.checklist.md` by normalized SHA-256 before a model can run. The fixed prompt must also match its manifest hash.

Codex may create or update exactly:

- `docs/evidence/WRC_P2_U01_WORKER_HOME_REAL_READ_ACCEPTANCE.md`

Only the bridge control process, after the exact PR head passes the full Gate, may update:

- `public/dev-status.json`

All Worker implementation, UI, CSS, route, adapter, test, Gate, Backstop, dependency, package, baseline, and other unlisted paths are forbidden. The unit is evidence-only. It may reconcile the already accepted authenticated `overview=200` and `map-data=200` history with current `main`, but it may not repeat a login, inspect secrets, mutate business data, or invent a current live-read PASS.

## Lock, lease, and worktree

- An atomic lock directory admits one local bridge process.
- A deterministic lease binds repository, Issue number and revision, exact base SHA, manifest hash, prompt hash, and reviewed Issue-body hash.
- A duplicate active lease is rejected. A completed lease is an idempotent replay and cannot authorize another model call.
- Every base SHA receives a distinct detached probe worktree; a stale probe from an older `main` cannot be silently reused.
- The planned execution branch is `codex/wrc-p2-u01-single-issue`, under the local bridge state root at `worktrees/issue-21-wrc-p2-u01`.

## Controlled GitHub writeback

The Windows Git Credential Manager may be inspected and used only by the bridge control process. The bridge records only provider type, boolean readiness, permission names, and repository permission booleans. It never prints or persists the credential. A future Codex child receives a sanitized environment with GitHub tokens, OpenAI keys, GitHub App material, and ask-pass variables removed.

The broker allowlist is limited to:

1. read the single READY Issue;
2. claim it only with a real `RUN_ID` and active `LEASE_ID`;
3. append matching execution/Gate evidence;
4. create the reviewed non-`main` branch and PR;
5. read the exact-head GSO Gate and mandatory artifacts;
6. update the Project item status;
7. update `public/dev-status.json` only after exact-head Gate success.

The current Git Credential Manager identity authenticates the GitHub API and can write repository content, Issues, and PRs, but its personal OAuth scopes do not include Project write access. It is also a broad personal credential and therefore must never be inherited by the Codex child. Full automatic writeback remains fail-closed until a controller-only least-privilege identity covers the Project update.

Recommended GitHub App permissions, installed only on `xjjsw0518-debug/global-seller-os-ui`:

- Repository metadata: read (implicit/minimum)
- Repository contents: write (branch and controlled `/dev-status` commit)
- Issues: write
- Pull requests: write
- Actions: read
- Checks: read
- Personal/user Projects: write for Project #1

No administration, workflows write, secrets, environments, deployments, members, hooks, or runner-management permission is required. The private/app credential must stay in the Windows controller credential store; use short-lived access tokens at runtime and never pass them to Codex.

## First real-run limits (prepared, not authorized)

- Issue #21 only
- existing Windows Codex CLI ChatGPT login only
- concurrency 1
- at most 1 model call
- 0 automatic retries
- 30-minute wall-clock timeout
- no OpenAI API key and no server-side Codex
- no direct push to `main`
- stop before commit/push on any path-policy failure
- self-hosted runner `ser603198648259` remains non-AI Gate-only
- separate user confirmation is mandatory immediately before consuming Codex quota

## Invocation

Run from the reviewed bridge worktree with Node.js 20 or later:

```powershell
node scripts/gso-windows-local-bridge-dry-run.mjs `
  --repo-root . `
  --state-dir ..\gso-windows-local-bridge-step-b-state `
  --output ..\gso-windows-local-bridge-step-b-state\latest-report.json `
  --redacted-output docs\evidence\gso-windows-local-bridge-dry-run-issue-21.json
```

The command has no execution mode. `--execute` and `--model` are rejected.
