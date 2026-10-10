# Windows Codex auto-executor — Step C

## Result

The Windows bridge now has a runnable, fail-closed executor for one authorized READY Issue. The Step C validation used only GitHub reads, local locks/worktrees, the Codex sandbox credential probe, and simulated child/Gate outcomes. It did not call a model and did not write to GitHub.

Baseline evidence:

- PR #29 merge commit: `a38c1904ce457ae21fbf8c91739ad95c223894cd`
- post-merge main GSO Gate: `38061863441` (`SUCCESS`)
- Gate job: `114241585918`, runner `ser603198648259`
- all five mandatory artifact groups present and unexpired
- Issue #21 effective source state: `READY`
- READY queue observed: `#21`, `#22`, `#23`; the authorization manifest selects only `#21`
- Codex CLI: `0.161.0`, authenticated with `CHATGPT`
- Step C and inherited bridge contract tests: 28 passed, 0 failed

## Executable boundary

The controller owns GitHub reads/writes, worktree creation, commits, pushes, PR creation, Gate reads, Issue evidence, and the controller-only `/dev-status` update. The Codex child receives only the reviewed prompt and the isolated task worktree.

The real entry is `scripts/gso-windows-auto-executor.mjs --mode execute`. It refuses to start unless all of the following are true:

1. the executor revision is already reachable from `origin/main`;
2. a fresh one-time authorization envelope matches Issue #21 and the exact manifest hash;
3. the envelope permits exactly one model run and zero retries and has not expired;
4. Issue #21 is open, present in the READY queue, still matches the reviewed body hash, and has a complete development-entry checklist;
5. the prompt hash matches the reviewed manifest;
6. the singleton lock, deterministic Issue lease, isolated worktree, and Windows Codex sandbox credential probe pass.

No authorization envelope is stored in the repository. It is created only after the separately requested user confirmation for the first real run.

## State and recovery contract

The journal accepts only these transitions:

`READY → CLAIMED → RUNNING → PR_CREATED → TESTING → PASS`

Failure paths are bounded to `FAILED`, `BLOCKED`, or `FIX_REQUIRED`. `RUNNING` requires a controller `RUN_ID`, deterministic `LEASE_ID`, and an observed Codex thread ID. `PASS` requires a successful exact-head GSO Gate and all five mandatory artifact groups.

Each state write uses a stable marker plus `RUN_ID` and `LEASE_ID`. The controller reads the resulting comment back and compares the complete body. A replay finds the existing matching state comment instead of creating a duplicate.

An existing non-terminal lease is never automatically re-run after a restart. It is reported as recovery-required. The model retry budget remains zero.

## Credential isolation

Credential isolation is enforced independently of prompt text:

- GitHub credentials are obtained only inside the controller request stack.
- GitHub/OpenAI credential variables are removed from the Codex child environment.
- Codex runs with the native `workspace-write` sandbox, command network disabled, web search disabled, user configuration ignored, and an ephemeral session.
- A non-model Windows sandbox probe executes `git credential fill` and a direct network request from the same restricted-token sandbox before a run.
- The recorded probe result was `github_credential_visible=false` and `direct_network_reachable=false`.
- Changed files are scanned for token patterns and for the exact controller credential before any commit or push. Secret values are never written to the audit record.

The controller never passes its GitHub credential, token, API client, or writeback function into the Codex subprocess.

## Changed-file and Git boundaries

For Issue #21, the Codex child may modify only:

- `docs/evidence/WRC_P2_U01_WORKER_HOME_REAL_READ_ACCEPTANCE.md`

After the first exact-head Gate succeeds, the controller may additionally modify only:

- `public/dev-status.json`

The controller commits to `codex/wrc-p2-u01-single-issue`, creates a PR, and never pushes `main`. It waits for a second full exact-head Gate after the controller-only status commit. A failed Gate is recorded as `FIX_REQUIRED`; automatic merge is always disabled.

GitHub Project writeback is `DEFERRED_NON_BLOCKING`. Issue/PR/Actions and `/dev-status` form the required main chain.

## Simulated failure evidence

The dry run exercised these outcomes without invoking Codex:

| Scenario | Expected result | Observed result |
| --- | --- | --- |
| allowed change + successful Gate | `PASS` | `PASS` |
| duplicate Issue lease | no second execution | duplicate prevented |
| GitHub network failure | preserve incomplete claim for recovery | `CLAIMED`, recovery required, 0 retries |
| Codex failure | never mark PASS | `FAILED`, 0 retries |
| 30-minute timeout | terminate process tree, never retry | `FAILED`, 0 retries |
| forbidden path | stop before PR | `BLOCKED` |
| Gate failure | no merge | `FIX_REQUIRED`, auto-merge false |

## First real run boundary

The next run remains limited to Issue #21, concurrency 1, one model call, zero automatic retries, and a 30-minute Codex timeout. It uses the existing Windows ChatGPT login. It does not use an OpenAI API key, server Codex, frozen UI changes, database/container/production writes, Backstop baseline changes, Gate changes, or a direct main push.

The remaining action is a separate confirmation immediately before creating the short-lived authorization envelope and starting the one real Codex run.
