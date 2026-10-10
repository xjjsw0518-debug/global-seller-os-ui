# Global Seller OS Gate Evidence Standard

## 1. Purpose and scope

This document is the single evidence contract for Global Seller OS automation work. Every pull request, GitHub Actions Gate result, and control-issue completion comment must use the same field names and must tell the same verifiable story.

The contract applies to process rules, documentation, templates, workflow configuration, and evidence reporting. It does not authorize business UI changes, feature work, visual-baseline updates, or threshold reductions.

The canonical comment template is [`docs/templates/gate-evidence-comment.md`](templates/gate-evidence-comment.md). `npm run test:evidence-template` checks that the standard and template retain their required structure.

## 2. Gate name standard

Use the exact display names and final-state tokens below. Do not invent aliases in evidence comments.

| Order | Mandatory Gate | PASS token | Primary evidence |
| --- | --- | --- | --- |
| 1 | Build | `BUILD_GATE_PASS` | Successful Actions step and run log |
| 2 | dependency-cruiser | `DEPENDENCY_BOUNDARY_GATE_PASS` | `dependency-cruiser-<run-id>` artifact |
| 3 | Knip | `KNIP_GATE_PASS` | `knip-unused-<run-id>` artifact |
| 4 | Playwright Smoke | `PLAYWRIGHT_SMOKE_PASS` | `playwright-smoke-<run-id>` artifact |
| 5 | BackstopJS Visual | `BACKSTOP_VISUAL_GATE_PASS` | `backstop-visual-<run-id>` artifact |
| 6 | axe-core Accessibility | `AXE_ACCESSIBILITY_GATE_PASS` | `axe-accessibility-<run-id>` artifact |

All six Gates are mandatory. A supporting contract check, such as the evidence-template check, may run in the workflow but does not replace or weaken any mandatory Gate.

## 3. Status definitions

### PASS

All mandatory Gates completed successfully for the exact commit being evaluated, the required evidence artifacts were uploaded, and the evidence links identify that same run and commit. PASS never means “not run,” “assumed good,” or “passed previously on a different commit.”

### FAILED

At least one mandatory Gate completed with a failure. The PR must not be merged. The failing run, step, and available failure artifacts must be preserved and linked.

### BLOCKED

Execution cannot continue because required permission, environment, dependency, external availability, or user authorization is missing. BLOCKED is not a test result and must not be converted to PASS. Record the exact blocker, owner, and safe action needed to resume.

### WARNING

A historical issue, accepted limitation, or checked-in baseline that does not block the current merge. Every warning must be explicit, scoped, and linked to evidence or a tracked baseline. WARNING must not conceal a failed mandatory Gate.

If more than one status appears applicable, use the most consequential truthful final status: `FAILED` for an executed mandatory Gate failure, otherwise `BLOCKED` when execution cannot finish. `WARNING` is supplemental and never replaces the final status.

## 4. Conditions required before merging a PR

A PR may merge only when all of the following are true:

1. The PR targets `main` and identifies the exact head commit tested.
2. The complete `GSO Gate` workflow ran on that PR head commit.
3. Build, dependency-cruiser, Knip, Playwright Smoke, BackstopJS Visual, and axe-core Accessibility all passed.
4. Every configured evidence-upload step succeeded and the artifacts are present and not expired at decision time.
5. The Actions run, job, runner name, artifact IDs, and digests have been captured.
6. Known warnings and existing baselines are disclosed without being presented as clean results.
7. No failure was bypassed through a threshold reduction, skipped Gate, baseline replacement, or unrelated business-code change.
8. The PR evidence uses the canonical template and contains no unsupported PASS claim.
9. The branch is mergeable and no newer untested commit has replaced the verified head.

After merging, the `main` push run must complete successfully before the work is reported as finally complete or the Project Board item is confirmed as PASS.

## 5. Issue comment standard format

Every Gate completion comment must be rendered from the canonical template and contain these sections in this order:

1. `Final State`
2. `Change Record`, including PR, Merge Commit, Actions Run, and Runner
3. `Gate Summary`
4. `Artifact Table`
5. `Known Warnings / Existing Baseline`
6. `Project Board Status`
7. `Next Safe Unit`

The final-state line must use `FINAL_STATE=<UPPER_SNAKE_CASE_VALUE>`. Links must point directly to the PR, commit, Actions run, artifact, issue comment, or Project view being claimed.

Stage-aware values are allowed only as follows:

- Before merge, `Merge Commit` must be `PENDING — merge only after all mandatory Gates pass`.
- Before the final `main` run, the final state must not be PASS; use `BLOCKED` or a clearly labeled in-progress PR report outside the final completion comment.
- In the final Issue comment, `Merge Commit`, `Actions Run`, `Runner`, artifact rows, and Project Board status must all be real values. `PENDING`, blank cells, and placeholder text are forbidden.

## 6. Artifact naming rules

Artifact names use lowercase kebab-case followed by the numeric GitHub run ID:

```text
<artifact-prefix>-<github-run-id>
```

Approved prefixes are:

```text
dependency-cruiser
knip-unused
playwright-smoke
backstop-visual
axe-accessibility
```

Do not reuse an artifact name across runs, rename an artifact to hide its source Gate, or claim an artifact produced by a different commit. Retention must be stated when it is known. If an artifact is expired, mark it `EXPIRED`; do not describe it as currently available evidence.

## 7. SHA-256 and digest recording rules

For every uploaded artifact, record the digest returned by GitHub Actions or the GitHub API. The canonical form is:

```text
sha256:<64 lowercase hexadecimal characters>
```

The Issue table must include the artifact name, artifact ID, direct link, digest, and expiration date or retention period. A locally calculated checksum may be added as supplemental evidence, but it must not replace the GitHub-provided digest without an explicit explanation.

Never invent, truncate, silently recalculate, or copy a digest from another run. If GitHub does not expose a digest, use `NOT_AVAILABLE` with a warning and do not claim the artifact is fully verified.

## 8. GitHub Actions run recording rules

Evidence must record:

- workflow name (`GSO Gate`);
- run number and numeric run ID;
- direct run URL;
- event (`pull_request`, `push`, or approved manual dispatch);
- tested head SHA;
- final status and conclusion;
- relevant job URL when available.

The final completion comment must use the successful `main` push run after merge. The PR run may be included as additional evidence, but it cannot substitute for the final `main` verification.

No GitHub Actions run means no CI PASS claim.

## 9. Runner recording rules

Record the exact `runner_name` reported by the successful Gate job. Do not replace it with a generic phrase such as “self-hosted runner.” If runner labels, operating system, or environment version are relevant to a failure or warning, record them as supplemental context.

If the runner name is unavailable, the final state cannot be PASS until the execution environment can be verified.

## 10. Project Board status rules

Use the existing Project Board workflow states consistently:

| Project status | Use |
| --- | --- |
| `Todo` | Accepted but not started |
| `RUNNING` | Actively being implemented or validated |
| `NEEDS_REVIEW` | Implementation is ready for review but merge admission is not complete |
| `READY` | Approved and ready for the next controlled action |
| `PASS` | Merged, final `main` run passed, evidence posted, and no blocking condition remains |
| `FAILED` | A mandatory Gate failed |
| `BLOCKED` | Work cannot continue because a required prerequisite or authorization is missing |
| `HOLD` | A deliberate user or program decision paused the work |

The final evidence comment must record the item number, Project name, direct Project URL, observed status, and verification time. Do not move an item to PASS based only on a local run or PR run. When a completed setup item is extended by a later successful Gate, verify that it remains PASS; do not churn the status merely to record new evidence.

## 11. Prohibited behavior after a failure

The following actions are forbidden:

- force-merging while CI is failing;
- skipping a mandatory Gate;
- lowering a threshold to bypass a failure;
- deleting or replacing failure evidence;
- presenting a WARNING as PASS;
- modifying business code while claiming a configuration-only change;
- claiming verification without the required artifacts;
- claiming CI passed without a GitHub Actions run;
- updating the BackstopJS `0.1%` threshold or visual baseline merely to make a run green;
- rerunning until green without recording a material infrastructure or code explanation for the earlier failure;
- using an artifact, run, commit, or runner from a different change as evidence.

On failure, preserve evidence, set the truthful status, identify the smallest safe corrective unit, and obtain any missing authorization before expanding scope.

## 12. Merge admission and final output contract

Merge admission is a closed rule: every mandatory condition in section 4 must be proven. Maintainer access, urgency, a previously passing run, or a non-blocking WARNING does not waive the rule.

After the successful final `main` run, every Work handoff must output:

- PR link;
- merge commit link and full SHA;
- final Actions run link, number, and ID;
- exact runner name;
- mandatory Gate results using the standard names;
- changed-file list;
- artifact table with IDs, links, GitHub digests, and expiration;
- known warnings and existing baselines;
- control-Issue evidence-comment link;
- Project Board item and observed status;
- next safe unit;
- a final line in the form `FINAL_STATE=<VALUE>`.

The output must distinguish verified facts from warnings. For the current baseline, the 24 known Knip unused-export warnings and the six registered axe violating-node fingerprints remain WARNING items until separately remediated; they must not be described as zero-warning or zero-violation results.
