# GSO Auto-Merge / Auto-Close / Auto-Continue Controller

The controller closes GitHub-side work after a Work session stops. It never performs Worker business, server, database, container, secret, UI, baseline, or threshold changes.

## Conditions

Auto-merge requires an open `WRC-P2-Uxx` PR, a matching latest head SHA, a completed `GSO Gate` with `conclusion=success` for that exact SHA, all mandatory artifacts (`playwright-smoke`, `backstop-visual`, `dependency-cruiser`, `knip-unused`, `axe-accessibility`), an evidence comment, no prohibited files, no BLOCKED/HOLD/approval marker, and PR `mergeable_state=clean` (branch protection remains authoritative).

Auto-close marks the associated Issue PASS only after the merge response is successful, recording PR, merge commit, Gate run and artifact evidence. Project Board status follows the same PASS transition.

Auto-continue updates `/dev-status` through a reviewed repository change and selects at most three READY Issues only after the current batch reaches three PASS units. It publishes a resume instruction; it cannot wake or impersonate a stopped Work session.

The latest-head rule is strict: an older successful run never proves a newer commit. Missing artifacts, stale evidence, prohibited paths, BLOCKED/HOLD, user approval, root/DB/container/write API work, frozen UI, Backstop baseline, Gate threshold, or secrets cause a safe stop.

## Stopped Work boundary

When Work stops, GitHub Actions may inspect and close eligible PRs, comment Issues, and publish a resume instruction. It must not invent scope, start coding, change protected files, or perform infrastructure actions. A human or Work-capable runner must claim the next READY Issue.
