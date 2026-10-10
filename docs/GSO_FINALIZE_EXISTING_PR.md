# GSO controller-only finalize-existing-pr recovery

This entrypoint finalizes an existing pull request after its model-created artifact and preliminary exact-head GSO Gate have already passed, but a controller-owned status update was interrupted. It never starts Codex or another model.

## PLAN (default, read-only)

```powershell
node scripts/gso-finalize-existing-pr.mjs `
  --mode plan `
  --repo-root <clean-reviewed-main-worktree> `
  --state-dir <existing-executor-state> `
  --contract <reviewed-contract.json>
```

PLAN requires the controller repository and `origin/main` to equal the contract's reviewed main. It then verifies the open PR binding, exact head and branch, changed files, artifact bytes, preliminary exact-head Gate and five unexpired artifacts, immutable historical BLOCKED Journal and consumed receipt, isolated worktree, Git object file modes, zero-delimited changed paths, and deterministic controller status bytes. It does not create locks, receipts, commits, pushes, comments, or authorizations.

## APPLY (separately authorized)

```powershell
node scripts/gso-finalize-existing-pr.mjs `
  --mode apply `
  --repo-root <clean-reviewed-main-worktree> `
  --state-dir <existing-executor-state> `
  --contract <reviewed-contract.json> `
  --authorization-file <state-dir>\recovery\finalize-existing-pr\authorizations\pending\<authorization-id>.json
```

APPLY additionally requires a fresh, short-lived `GSO_CONTROLLER_ONLY_RECOVERY_V1` authorization bound to the contract digest, reviewed main, PR/head, artifact-set digest, preliminary Gate and controller-status digest. Its `issued_at` / `expires_at` window may be at most 15 minutes, it grants zero model calls, and it can be consumed only once. Recovery uses an authorization-scoped exclusive lock, append-only Journal and one-time consumed receipt outside the old lease and repository. It commits only `public/dev-status.json`, pushes without force, waits for a new exact-head GSO Gate with all five artifacts, and stops at `PR_REVIEW_REQUIRED`.

Reentry is idempotent across interruption after the local commit, remote push, final Gate verification, or GitHub writeback. An expired authorization may resume only when its exact one-time receipt already exists and the recovery remains non-terminal. Any unexpected path, rename, symlink, history change, remote divergence, Gate failure, timeout or authorization mismatch fails closed and preserves the original terminal evidence.

The checked-in Issue #21 / PR #36 contract is a conformance fixture for read-only PLAN. It is not an authorization to run APPLY. A later APPLY requires independent PM review, a separately approved current-main contract and a new one-use authorization.
