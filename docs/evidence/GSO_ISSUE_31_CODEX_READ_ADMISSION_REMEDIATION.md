# GSO Issue #31 — Codex read/admission remediation evidence

## Scope and safety boundary

This remediation diagnoses the first bounded Issue #21 Codex run and changes only the Windows bridge, its reviewed prompt/manifests, tests, and this evidence record. It does not replay the consumed authorization, invoke a Codex model, change Issue #21 back to READY, modify frozen UI or business code, touch a database/server/production system, or change the GSO Gate or Backstop baselines.

## Previous-run audit finding

The local controller state for the consumed Issue #21 run contains the result, journal, consumed authorization receipt, and `codex-last-message.txt`. It does not contain the Codex JSONL event stream or stderr. The executor buffered stdout/stderr in memory and discarded them after completion, while `--ephemeral` intentionally left no resumable Codex session.

The last-message record states that a read-only inspection command was rejected by execution policy. The exact attempted command and exact policy rule cannot be recovered from the retained evidence. Accordingly:

- `CHILD_READ_POLICY_DIAGNOSIS=PARTIAL_EVIDENCE`
- reported denial class: `EXECUTION_POLICY_DENIAL` (from the retained last message)
- exact command: `NOT_RECOVERABLE_FROM_PRIOR_RUN`
- exact policy rule: `NOT_RECOVERABLE_FROM_PRIOR_RUN`

This is an observability gap, not evidence that the Windows workspace sandbox is generally unable to read repository files.

## No-model sandbox preflight

A detached scratch worktree at the reviewed base was tested through `codex sandbox -P :workspace --sandbox-state-disable-network`. The bounded PowerShell payload performed only these operations:

1. read the first three lines of `src/workerResourceReadAdapter.js`;
2. create `.gso-codex-sandbox-preflight.tmp` in the scratch worktree;
3. remove that scratch file.

Results:

- source read: PASS
- scratch write: PASS
- scratch removal: PASS
- network enabled: false
- model call performed: false
- scratch worktree after probe: clean

`NO_MODEL_PREFLIGHT=PASS`

## Verified contract mismatch

The earlier reviewed prompt required the Codex child to prove GitHub Issue state, checklist completeness, atomic lease, isolated worktree, allowed-file policy, and controller writeback readiness. Those are controller-only facts. The child received only the prompt text and no hash-bound controller evidence, so it could not truthfully satisfy that requirement even if repository reads succeeded.

The remediation adds a deterministic `gso.controller-admission-attestation.v1` packet. Before a future model call, the controller builds and verifies the packet against:

- repository, Issue, task, exact base SHA, RUN_ID, LEASE_ID, and one-time authorization ID;
- Issue body, manifest, prompt, and reviewed executor SHA-256 hashes;
- checklist, exact-main source, lease, worktree, credential boundary, and no-model preflight checks;
- exact allowed/forbidden file policy;
- hashes and bounded excerpts from the reviewed source files;
- accepted historical Worker recovery provenance.

Missing, modified, stale, or forged packets fail closed before model execution. The packet is appended as explicitly delimited data, not instructions. The child receives no GitHub authority or controller credential.

## Historical versus current evidence

Accepted historical recovery provenance:

- [Issue #11 recovery evidence](https://github.com/xjjsw0518-debug/global-seller-os-ui/issues/11#issuecomment-6096811756)
- [Issue #12 recovery evidence](https://github.com/xjjsw0518-debug/global-seller-os-ui/issues/12#issuecomment-6096811856)

Those records report authenticated `overview=200`, `map-data=200`, `health=200`, and `ready=200`, with no business data written. They are historical accepted evidence, not a new live verification. No current live server verification is performed by this remediation. The historical `resource-list=404` remains deferred and outside the homepage read contract.

## Forward audit behavior

Future real executions persist only a sanitized JSONL audit stream in the external controller state directory, plus a sanitized last message and summary. Token-shaped and exact known secrets are redacted. The repository worktree never contains authorization files, model output, or local execution state.

## Retry boundary

The previous authorization remains consumed. Issue #21 remains effectively BLOCKED, model calls remain 1, automatic retries remain 0, and no retry is authorized by this PR. After review, merge, and a successful main GSO Gate, a new one-time user authorization bound to the new manifest, prompt, executor, and main hashes is required.

## Local verification result

- executor plus bridge contract tests: 44 PASS, 0 FAIL
- production build: PASS
- dependency-cruiser: PASS
- Knip gate: PASS under the repository's existing policy
- evidence-template contract: PASS
- reviewed base checked by DRY_RUN: `f0d6acfe3215eba8baabcb0e356027c309e6470d`
- prompt/manifest hash match: PASS
- worktree isolation: PASS
- credential isolation: PASS (GitHub credential not visible; direct network not reachable)
- no-model workspace read/write/remove preflight: PASS
- model call performed: false
- GitHub write performed by DRY_RUN: false

The live DRY_RUN final state remains `GSO_AUTO_EXECUTOR_BLOCKED` solely because the prior evidence-backed Issue #21 run is BLOCKED and no new authorization exists. A usable controller attestation is deliberately not emitted for a BLOCKED source state. Trusted READY-context packet creation and validation pass in the regression tests; missing, modified, stale, forged, or incomplete packets fail closed.

## PM P1 recovery closure

The final PR revision adds an explicit recovery admission without changing or clearing the historical GitHub state:

- a new authorization must declare `attempt_kind=NEW_ATTEMPT` and bind the exact prior terminal `BLOCKED` RUN_ID, LEASE_ID, and consumed authorization ID;
- the prior trusted GitHub state must match the preserved local terminal journal;
- the prior authorization receipt must show that the single model call started, and its deterministic lease must match the historical lease;
- the new authorization must bind the current main, manifest, prompt, and executor hashes and must differ from the consumed authorization;
- at least one reviewed version binding must have changed since the blocked attempt;
- missing, stale, replayed, already-consumed, wrong-manifest, or forged-lineage authorization fails closed;
- every authorization/lease derives a stable unique non-main branch and external worktree path;
- the historical worktree, branch, journal, authorization receipt, and GitHub BLOCKED comment remain untouched;
- an interrupted new lease is detected on restart and cannot create a second model opportunity.

The ordinary DRY_RUN continues to report the historical Issue #21 state as BLOCKED. The separate no-model recovery simulation uses that actual trusted lineage and the preserved old-base worktree, but creates only an in-memory mock authorization bound to the prospective reviewed head. It must reach `NEW_ATTEMPT_READY` with a distinct new-base worktree, a verified controller attestation, sandbox preflight PASS, zero model calls, and zero GitHub mutations. The mock authorization is neither persisted as a pending authorization nor consumed.

Observed recovery simulation result:

- historical state: `BLOCKED`
- historical RUN_ID/LEASE_ID and consumed authorization: matched and preserved
- historical model run count: 1
- prior old-base worktree: clean and preserved
- mock authorization: fresh, version-bound, validated, not persisted, not consumed
- new lease: distinct and deterministic for the mock authorization
- new worktree/branch: distinct, clean, non-main, bound to the prospective reviewed head
- controller attestation: PASS
- credential isolation: PASS
- sandbox source-read and scratch write/remove preflight: PASS
- final state: `NEW_ATTEMPT_READY`
- repeated simulation: idempotent; same lease, no second execution opportunity
- model calls: 0
- GitHub mutations: 0
- Issue #22/#23 selection: false
