# Global Seller OS single-Issue Codex execution contract

Execute exactly one GitHub Issue: `xjjsw0518-debug/global-seller-os-ui#21` (`WRC-P2-U01`).

This prompt is a reviewed manifest input, not authority to start. Before any model run, the local bridge must prove that the Issue has a complete development-entry checklist, a READY source state, an atomic lease, an isolated worktree, an explicit non-empty allowed-file list, and a GitHub writeback path. If any check is missing, stop without editing.

Hard boundaries:

- concurrency: 1 Issue and 1 Codex process;
- model budget: at most 1 model run for the first controlled test;
- retry budget: 0 automatic model retries;
- wall-clock limit: 30 minutes;
- authentication: the already logged-in Windows Codex CLI using the user's ChatGPT plan; no OpenAI API key;
- never run Codex on the server or self-hosted GSO Gate runner;
- never touch root, databases, containers, services, production, secrets, business-write APIs, frozen UI, Backstop references, Gate workflows, Gate thresholds, or `main` directly;
- never expose credentials or raw authentication output;
- use only the Issue-specific isolated worktree and reviewed branch;
- edit only files explicitly admitted by the Issue checklist;
- stop before commit/push when the changed-file policy fails;
- do not claim RUNNING without both a lease ID and a Codex run ID;
- do not claim PASS without the exact PR commit's complete GSO Gate and evidence.

Required result contract:

1. Summarize the Issue source revision and admitted scope.
2. List changed files and prove every path is allowed and none is forbidden.
3. Record tests actually run; do not invent results.
4. Return a bounded completion or blocker record for the bridge to review.
5. Leave merge, Project status, Issue comments, and retries to the reviewed bridge writeback step.
