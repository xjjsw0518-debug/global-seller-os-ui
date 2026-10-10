# Codex Runner Read-Only Preflight

This diagnostic establishes whether the self-hosted GSO Gate runner has a usable, non-interactive Codex CLI entry point. It does not run `codex exec` with a prompt and does not make a model request.

## Reported fields

- Codex CLI installed status and version.
- Codex authentication status as a boolean and a bounded authentication category.
- Presence of the non-interactive, JSON, ephemeral, sandbox, automatic-review, and worktree CLI options.
- `SET` or `UNSET` for expected model credential environment variables.
- Read, write, and execute permission booleans for the GitHub runner directories.
- A final `PASS` or `BLOCKED` status with machine-readable blocker codes.

The diagnostic never emits raw login output, environment-variable values, tokens, usernames, email addresses, filesystem paths, or other credential material.

## Safety boundary

- Workflow permission is `contents: read`.
- No branch, commit, Issue, PR, service, container, database, or application state is changed by the diagnostic job.
- No model prompt is sent and no paid model inference is requested.
- `--dangerously-bypass-approvals-and-sandbox` is detected but never exercised.
- The generated JSON file exists only as a short-retention workflow artifact.

The pull-request trigger is limited to opening a PR that changes this diagnostic contract. After the workflow reaches the default branch, operators may rerun it explicitly with `workflow_dispatch`.
