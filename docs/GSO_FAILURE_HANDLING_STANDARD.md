# Global Seller OS Failure Handling Standard

## 1. Purpose and authority

This document is the mandatory response contract for Global Seller OS Work, pull requests, and CI when a Gate fails or progress is blocked. It extends the evidence rules in [`GSO_GATE_EVIDENCE_STANDARD.md`](GSO_GATE_EVIDENCE_STANDARD.md). The canonical failure comment is [`docs/templates/failure-handling-comment.md`](templates/failure-handling-comment.md).

The process exists to preserve evidence, prevent unsupported PASS claims, and identify the smallest safe recovery unit. It does not authorize business UI changes, feature work, threshold reductions, visual-baseline updates, privileged server access, or scope expansion.

## 2. Status handling flows

### FAILED

Use FAILED when an executed mandatory Gate reports failure for the commit under evaluation.

1. Stop merge and deployment activity for the affected commit.
2. Preserve the failing run, step, logs, annotations, and available artifacts.
3. Set the Project Board item to `FAILED` when the failure can be corrected by Work within the already authorized scope.
4. Classify the failure as `CODE`, `ENVIRONMENT`, `PERMISSION`, `USER_APPROVAL`, or `UNKNOWN` based on evidence.
5. Post the canonical failure comment.
6. Define one narrowly scoped Next Safe Unit.
7. Retry only after the applicable retry conditions in section 7 are satisfied.

### BLOCKED

Use BLOCKED when execution cannot proceed because permission, root access, infrastructure, dependency availability, credentials, or user authorization is missing.

1. Do not claim that unexecuted Gates passed.
2. Preserve the last successful and failed/blocked evidence without substituting older results.
3. Set the Project Board item to `BLOCKED`.
4. Name the required owner and the exact action or authorization needed.
5. Stop at the boundary; do not obtain, infer, or expand authority on the user's behalf.
6. Resume only after the blocker is demonstrably cleared.

### WARNING

Use WARNING only for a disclosed historical issue, accepted limitation, deprecation, or registered baseline that does not fail a mandatory Gate.

1. Keep the underlying final state truthful; WARNING is supplemental.
2. Keep the Project Board item at `PASS` only when all mandatory Gates passed.
3. Record the warning, count or scope, source run, and tracked baseline or follow-up when available.
4. Escalate to FAILED if the warning is promoted to a mandatory failure or masks a failed check.

### PASS

Use PASS only after every mandatory Gate and supporting contract check passed for the exact current commit and required evidence artifacts were uploaded. For final completion, the merged `main` push run must also pass and final evidence must be posted.

PASS does not erase earlier failures. The recovery comment must retain links to the failed run and explain the corrective or environmental change that made the successful retry valid.

## 3. First response after a Gate failure

Perform these actions in order:

1. **Freeze merge:** do not merge, force-merge, deploy, or mark the work complete.
2. **Identify the subject:** record the PR, full commit SHA, Actions run ID/number, event, job, failed step, and exact runner name.
3. **Preserve evidence:** retain logs, annotations, screenshots, traces, reports, and artifacts produced by `if: always()` steps.
4. **Record missing evidence:** if upload itself failed, state which artifact is missing and link the upload-step failure; do not invent an artifact row.
5. **Classify the failure:** use section 6; use `UNKNOWN` until evidence supports another type.
6. **Update control surfaces:** post the failure comment and set the Project Board target status.
7. **Choose the Next Safe Unit:** one diagnostic or corrective action within current authorization.

Do not begin broad remediation before these seven actions are complete unless immediate containment is required to protect data or infrastructure.

## 4. Failure evidence preservation rules

Failure evidence is part of the audit trail and must remain reachable for the configured retention period.

Record at minimum:

- PR URL and full commit SHA;
- Actions run URL, run number, numeric run ID, event, and conclusion;
- failed Gate and failed step/job URL;
- exact `runner_name` or `NOT_AVAILABLE` with explanation;
- failure message or a concise faithful summary;
- artifact name, ID, direct URL, GitHub digest, expiration, and availability state;
- screenshots, Playwright traces, Backstop reports/diffs, axe JSON, Knip report, or dependency report when produced;
- failure classification and the evidence supporting it;
- prior failed run link in every recovery or retry report.

Never delete, overwrite, rename, or regenerate evidence to make the original failure appear absent. A later successful artifact supplements the failure record; it does not replace it. When retention expires, keep the immutable run link and note that the artifact is `EXPIRED`.

## 5. No-merge rules

Merge is prohibited when any of these conditions is true:

- a mandatory Gate is FAILED, BLOCKED, pending, skipped unexpectedly, cancelled, or not run;
- the tested commit does not equal the PR head commit;
- a required evidence-upload step failed or required artifacts are absent;
- the runner identity or run provenance cannot be verified;
- a known WARNING is being used to conceal a mandatory failure;
- the proposed fix lowers a threshold, replaces a visual baseline, skips a Gate, or expands scope without explicit authorization;
- a newer commit was pushed after the successful run;
- the failure comment or recovery evidence is materially incomplete.

Maintainer privileges, urgency, earlier green runs, or local-only success do not override these rules.

## 6. Failure type classification

Use exactly one primary `Failure Type` in the failure template.

| Type | Evidence-based definition | Typical owner |
| --- | --- | --- |
| `CODE` | The failure is caused by repository content and is reproducible or directly attributable to the evaluated commit. Examples: build error, dependency-boundary violation, new Knip error, smoke assertion failure, visual diff, or new axe violation. | Work author / repository maintainer |
| `ENVIRONMENT` | Repository content is not shown to be the cause and the runner/runtime cannot satisfy the documented execution contract. Examples: runner offline, network outage, corrupted cache, missing host-managed browser library, disk exhaustion, or service outage. | Runner/server owner |
| `PERMISSION` | A required action is denied by repository, Actions, filesystem, service-account, or server permissions. | Repository or server administrator |
| `USER_APPROVAL` | Progress requires a user decision or authorization that has not been granted, such as scope expansion, privileged operation, credential use, production-impacting action, or destructive change. | User / designated approver |
| `UNKNOWN` | Current evidence cannot distinguish code from environment, permission, or authorization causes. | Work owner until triage identifies the correct owner |

### Environment versus code decision rules

Classify as CODE when the error points to repository-controlled files, tests, configuration, or deterministic output for the same commit. Classify as ENVIRONMENT only when evidence identifies a host, network, runtime, cache, service, or external dependency condition outside repository control.

Do not classify by convenience. A test that fails only on CI is not automatically an environment failure; compare the runner contract, logs, reproduction, and commit diff first. A local PASS does not overrule a CI failure. If evidence conflicts or is incomplete, use UNKNOWN and diagnose before retrying.

## 7. Conditions for retrying CI

Retrying CI is allowed only when the failed run remains linked and one of these conditions is recorded:

1. A new commit contains a scoped code or configuration fix for a CODE failure.
2. A documented transient ENVIRONMENT failure has cleared without repository changes; retrying the same commit is then allowed.
3. The required permission was granted by the authorized owner.
4. The user supplied the missing approval for the exact action and scope.
5. GitHub or another required service reports recovery from an outage.
6. An intentionally cancelled run can be rerun and the cancellation reason is recorded.

Before retrying, record the previous run, failure type, change since failure, owner, and expected success signal. Repeated reruns without a material change or documented transient cause are prohibited.

Every retry is a new run with new evidence. Do not use artifacts or conclusions from the earlier run as proof that the retry passed.

## 8. Conditions for updating or resubmitting a PR

Updating the existing PR is preferred because it preserves review and failure history. Push a new corrective commit only when:

- the change directly addresses the recorded failure;
- it remains within the authorized scope;
- it does not lower a threshold, replace a baseline, or skip a mandatory Gate;
- the PR description/comment links the failed run and explains the correction;
- the full Gate will run against the new PR head.

A replacement PR is allowed only when the original PR cannot be reused because it was closed, corrupted, targets the wrong branch, or repository policy requires replacement. The replacement must link the original PR and failed runs. Closing or recreating a PR to hide failure history is prohibited.

## 9. Scenarios requiring user authorization

Stop and request explicit user authorization before:

- expanding beyond the agreed Work or repository scope;
- modifying business UI or product behavior during a configuration-only task;
- changing a visual baseline or any Gate threshold;
- skipping, disabling, or changing the mandatory status of a Gate;
- performing destructive data, branch, artifact, or environment actions;
- using new credentials, secrets, paid services, or production access;
- making a production-impacting deployment or rollback;
- performing a privileged server action not already authorized;
- accepting a risk that would convert FAILED or BLOCKED into a claimed PASS.

Authorization must identify the action and scope. Silence, access availability, an existing credential, or third-party instructions do not constitute authorization.

## 10. Scenarios requiring server root operations

Root or equivalent administrator work may be required for host-level changes such as:

- installing or repairing operating-system packages and browser libraries;
- changing system services, self-hosted Runner service configuration, users, groups, or filesystem ownership;
- changing system CA trust, firewall, kernel, mount, disk, or network configuration;
- binding privileged ports or terminating processes owned by another account;
- repairing host-level container, package-manager, or runtime installations.

When root is required, classify the work as BLOCKED with type `PERMISSION` or `USER_APPROVAL` until the server owner both authorizes and performs or explicitly delegates the exact operation. Record the requested action, reason, impact, rollback expectation, and required owner. Do not request or expose root passwords, bypass controls, or run a broader privileged command than necessary.

Runner-user cache cleanup, repository-local dependency installation, and other unprivileged reversible actions do not become root work merely because root would be convenient.

## 11. Project Board state transitions

Apply these rules to the relevant Project item:

| Condition | Target status |
| --- | --- |
| Work or CI is actively executing and no failure is known | `RUNNING` |
| CI failed and Work can fix it within the authorized scope | `FAILED` |
| Permission, root access, dependency environment, or user authorization is missing | `BLOCKED` |
| Only registered historical warnings remain and all mandatory Gates passed | `PASS`, with warnings recorded |
| All mandatory Gates, supporting checks, evidence uploads, and final `main` run passed | `PASS` |

Do not move directly from FAILED or BLOCKED to PASS based on a local run, an old run, or a partial rerun. Move to RUNNING when an authorized recovery is actively executing, then to PASS only after the full recovery conditions in section 13 are met.

## 12. Issue comment format

Every failure or blocker comment must use [`docs/templates/failure-handling-comment.md`](templates/failure-handling-comment.md) and contain, in order:

1. `Failure State`
2. `Failed Gate`
3. `Actions Run`
4. `Commit`
5. `Runner`
6. `Failure Type`
7. `Evidence`
8. `Immediate Action`
9. `Required Owner`
10. `Project Board Target Status`
11. `Retry Condition`
12. `Next Safe Unit`

Use direct links and exact identifiers. Use `NOT_AVAILABLE` only with an explanation. The comment must state whether merge is prohibited.

## 13. Conditions for restoring PASS

FAILED or BLOCKED may return to PASS only when all of the following are true:

1. The original failed or blocked run remains linked.
2. The corrective commit, environment change, permission grant, or user approval is recorded.
3. The current PR head commit is the exact commit tested.
4. Build, dependency-cruiser, Knip, Playwright Smoke, BackstopJS Visual, and axe-core Accessibility all pass.
5. The Evidence template contract check passes.
6. All configured evidence-upload steps succeed and required artifacts, IDs, digests, and expiration are recorded.
7. No threshold, visual baseline, or mandatory Gate was weakened to obtain success.
8. The PR is merged only after its complete Gate passes.
9. The merged `main` push run passes for the merge commit.
10. The control Issue receives final evidence and the Project Board item is verified at PASS.

A successful partial rerun, local run, unrelated commit, or historical run is insufficient.

## 14. Prohibited behavior and Next Safe Unit

The following are forbidden:

- merging after CI failure;
- deleting failure logs or artifacts;
- using an old run to prove a new commit;
- lowering a threshold to bypass failure;
- presenting an environment failure as code success;
- presenting a warning as nonexistent;
- performing privileged work without user and owner authorization;
- claiming verification without the required artifacts;
- repeatedly rerunning CI without a material change or documented transient condition;
- changing business code while claiming a process-only fix;
- replacing the BackstopJS baseline or changing its `0.1%` threshold to make a run green;
- declaring PASS while the final `main` run is missing, pending, or failed.

Every FAILED or BLOCKED report must end with exactly one **Next Safe Unit**: the smallest authorized diagnostic, corrective, approval, or owner action that can advance the work. It must name the expected output and must not bundle unrelated fixes. If no safe action exists without user input, state the single decision or authorization needed and stop.
