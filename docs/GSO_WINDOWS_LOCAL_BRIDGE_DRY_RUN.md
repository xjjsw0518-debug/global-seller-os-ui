# Windows GSO Local Bridge — Step A Dry Run

## Purpose

This Windows-only bridge verifies the non-model control path for one GitHub Issue. It reads public Issue state, verifies the local Codex CLI without invoking a model, enforces a single-instance lock and deterministic task lease, creates an isolated detached worktree probe, checks changed paths, and emits a redacted audit report.

It does not write GitHub, invoke Codex inference, edit business code, call server/root/database/container/production operations, alter frozen UI or Backstop references, change the GSO Gate, or push `main`.

## Source-state rule

`READY` and `RUNNING` are not synonyms. A plain claim comment does not establish actual execution. The bridge recognizes actual `RUNNING` only when a GitHub comment contains both a bounded `RUN_ID=...` and `LEASE_ID=...` marker. Until then, the Issue body status remains the effective source state.

## Lock and idempotency

- One local bridge process acquires an atomic lock directory before it reads or prepares work.
- One deterministic lease ID is derived from repository, Issue, Issue revision, base Git SHA, prompt manifest hash, and prompt hash.
- A second process cannot acquire an active lease.
- A completed lease is an idempotent replay and never authorizes a second model call.
- The bridge never auto-steals a stale or unknown lease. Recovery requires review.

## Worktree isolation

The dry run creates a clean detached probe at the exact `origin/main` commit in a state directory outside the source checkout. The reviewed Step B plan reserves branch `codex/wrc-p2-u01-single-issue` and relative path `worktrees/issue-21-wrc-p2-u01`, but Step A does not create that execution branch or edit it.

## Files and safety

The fixed manifest is `control/local-bridge/issue-21.manifest.json`; its prompt is `control/local-bridge/issue-21.prompt.md`. The manifest fails closed: Issue execution is disabled, its allowed-file list is empty, and all files are forbidden until Issue #21 contains a complete development-entry checklist and an explicitly reviewed file list.

Bridge validation changes are limited to the manifest, prompt, this document, the dry-run script, its tests, and the generated redacted evidence snapshot. Business files, `src/`, Worker code, Gate workflows, `public/dev-status.json`, Backstop configuration/reference images, package manifests, and hosting files are forbidden.

## Step B budget, prepared but not authorized

- existing Windows Codex CLI ChatGPT login only;
- one Issue, one worktree, one Codex process;
- at most one model run;
- no automatic retries;
- 30-minute wall-clock limit;
- no OpenAI API key and no server-side Codex;
- self-hosted runner remains limited to the existing non-AI GSO Gate;
- stop before commit/push if any changed path is outside the reviewed Issue scope;
- no GitHub status claim without the paired run and lease evidence;
- no PASS without the complete exact-commit GSO Gate evidence.

Step B remains blocked until the Issue checklist is complete, its allowed files are non-empty, a supported credentialled GitHub writeback path is available, and the plan receives human review.

## Invocation

Run from the reviewed bridge worktree with Node.js 20 or later:

```powershell
node scripts/gso-windows-local-bridge-dry-run.mjs `
  --repo-root . `
  --state-dir ..\gso-windows-local-bridge-state `
  --output ..\gso-windows-local-bridge-state\latest-report.json `
  --redacted-output docs\evidence\gso-windows-local-bridge-dry-run-issue-21.json
```

The command has no execute mode. `--execute` and `--model` are rejected.
