# Global Seller OS UI V2 — Worker Coordination Handshake

- Handshake ID: `WUIV2-HANDSHAKE-20260930-01`
- Original Work session: `01a0eea8-d0db-7b93-a52f-5fbc0f2b0b86`
- Original Work title: `开发Global Seller OS UI V2`
- This note is a handoff artifact only. It does not wake, resume, steer, or notify that session. The original Work must read it at an explicit checkpoint.
- Deployment remains paused. This note does not authorize deployment, production login, production writes, or database changes.

## Ownership and first handshake

The original Work session remains the sole owner of Global Seller OS Worker UI development, bug fixes, testing, and acceptance. Do not create a duplicate Worker UI development task. On the next explicit checkpoint, read this note and create the separate status file `WORKER_UI_V2_ORIGINAL_WORK_STATUS_2026-09-30.md` beside it. Include the same Handshake ID and return only verified facts. Preserve unrelated files and user changes.

The status file must state:

1. Original task/session identifier and confirmed title.
2. Actual working directory (`cwd`).
3. Current concrete action in progress.
4. Files currently changed and the known change boundaries.
5. Paths to actual browser, E2E, API, database, visual-QA, and regression evidence; mark each `PASS`, `FAIL`, or `NOT_RUN` and never infer a pass from a build or screenshot alone.
6. Remaining work and specific blockers.
7. A reproducible build/version fingerprint for the exact code under review (for example commit plus dirty-file hashes or a source manifest).

Do not claim this handoff file itself delivered instructions to the session. If the session cannot read it, report that fact; do not resume, interrupt, or message another task through an unsupported path.

## Required implementation and QA sequence

1. Read the current requirements, project instructions, handoff documents, current code, and real API/function contracts before changing code. Map existing Worker UI controls to their current behavior and backend contract; do not invent endpoints or silently replace existing functionality with mocks.
2. Work in the smallest reviewable functional unit. Keep local/mock-preview results distinct from integration or production acceptance.
3. For each completed unit, run it on the user's computer and perform real browser interaction, focused E2E, Visual QA at a recorded viewport/DPR, and regression checks. Save dated evidence and record the exact snapshot/version tested. A static screenshot, build, or DOM-only test is not a substitute for real browser interaction.
4. Mark unavailable or unexecuted API/database/integration checks `NOT_RUN` or `BLOCKED`; do not present mock data as live behavior. Report console errors and unexpected network failures explicitly.
5. Do not deploy, alter production, modify production data/schema, or run database migrations under this handoff. Deployment stays paused until separately authorized after evidence review.

## Server reference and security boundary

The user-supplied server page reference is exactly `http://186.244.233.120/infrastructure/workers`. It is a reference only: no login, credential handling, API call, write, or deployment is authorized by this note. Do not read, request, copy, or use passwords, tokens, cookies, environment files, or SSH configuration from chat or disk. Do not probe other hosts or ports.

## Existing project handoff

Review `WORKER_RESOURCE_API_HANDOFF.md` as an existing project handoff document and verify its contents against current source/API documentation. Do not assume the preview mock is connected to the real backend. Leave all application code, configuration, tests, hosting files, backend, and database unchanged when creating this coordination artifact.
## Release gate update — 2026-09-30 12:32 UTC

Status check: `WORKER_UI_V2_ORIGINAL_WORK_STATUS_2026-09-30.md` was absent when this update was prepared. No original Work status writeback, timestamp, or source/version fingerprint was available; coordination is not established until the original Work reads this note and writes its status file. This note does not wake or notify that task.

Release gate for Worker Resource Center: review the current code first, then work through the smallest units sequentially. Before any deployment preparation, each unit must be verified on the user's computer/test VPS with all of the following passing against the exact final source/build fingerprint: Functional, real browser and button interactions, E2E, API, database, Visual QA, and Regression. Console errors must be 0 and unexpected network errors must be 0. Evidence must identify the tested source/version fingerprint. Mock-only results and historical reports do not satisfy this gate. Mark every unrun or blocked check as `NOT_RUN` or `BLOCKED`, never `PASS`.

Only after all required local checks pass, and backup/rollback readiness and the exact target version are verified, may deployment preparation begin. This update authorizes preparation only; it does not authorize deployment, production API/DB changes, or login. Production URL for reference: http://186.244.233.120/infrastructure/workers. Do not read, use, copy, or store credentials from chat.

## Follow-up instruction WUIV2-WORKER-CONTRACT-MAP-20260930-01

This is a prepared follow-up for the original Work `01a0eea8-d0db-7b93-a52f-5fbc0f2b0b86` only. It preserves all earlier instructions and does not itself deliver, wake, resume, or execute anything. At the next explicit checkpoint, the original Work should read this section and reply in `WORKER_UI_V2_ORIGINAL_WORK_STATUS_2026-09-30.md` with this exact instruction ID and `ACCEPTED`, `DECLINED`, or `BLOCKED`, plus the reason and timestamp. Do not infer acceptance from this file's presence.

### First work package: contract and safe-test mapping

Before implementation, inspect the current Worker UI source and trace every relevant existing behavior to verified current service/API and database contracts. Treat `WORKER_RESOURCE_API_HANDOFF.md` as a proposal unless corroborated by authoritative OpenAPI/schema, current service source, or owner-confirmed contract. Do not invent endpoints or replace existing behavior with mocks. Record per feature the UI control/state, current code location, actual service/API operation and request/response/error contract, persistence/DB effect, authorization, idempotency/retry behavior, and evidence source. If a contract cannot be verified, mark it `UNKNOWN/BLOCKED` and identify the exact input needed.

Create an isolated local/test-VPS environment inventory before any real write test: environment identity and isolation boundary (no secrets), permitted test account/roles, disposable dataset/resource IDs and cleanup/rollback method, API base/contract version, DB identity/schema/version and allowed operations, Worker/Runtime/RPA dependencies, AI/task/gateway/router/callback dependencies, network allowlist, backup/restore proof, and safe stop conditions. Do not use production data or production credentials for test writes. Do not perform a migration or deployment under this instruction.

For each affected path, classify files and components as `KEEP`, `MODIFY`, `ADD`, or `DO_NOT_TOUCH`, with reason and dependency. Protect unrelated application, security, hosting, backend, and database files; do not edit them without an explicit scoped need and approval. Report the highest-risk assumptions and missing inputs.

Select exactly one first minimum acceptance unit from the contract map. State its user-visible outcome, real service/API/DB contract, test fixture and cleanup, affected file boundary, rollback, and evidence plan. Do not start coding or testing until original Work reports the map and required inputs; proceed only inside its existing ownership and authorized scope.

### Acceptance and release gate

For each smallest unit, require current-source-fingerprint-bound local evidence on the user's computer/test VPS for Functional behavior, real browser/button interaction, focused E2E, API, database, Visual QA, and regression; record viewport/DPR, screenshots, console errors, and unexpected network errors. Required console errors = 0 and unexpected network errors = 0. Mock-only and historical evidence do not count. Any unavailable/unrun check is `NOT_RUN` or `BLOCKED`, never `PASS`.

Worker and AI Center are one coordinated release batch: do not publish/deploy Worker independently. Both batches and their real end-to-end integration (AI request -> existing task/gateway/router -> Worker/Runtime -> RPA -> result callback) must pass all required local gates against identified final fingerprints before joint deployment preparation. Verify target version, backup and rollback readiness for the combined release. This instruction authorizes only contract/test-environment mapping and planning; it does not authorize production login, production API/DB changes, migration, deployment preparation before the gate, or deployment. The production page reference remains `http://186.244.233.120/infrastructure/workers` and is not a test target.

### Checkpoint / communication status

The first handshake requires reading at an explicit checkpoint and writing a status file. The 2026-09-30 12:49 UTC writeback only confirms that one checkpoint's note review/status write was performed; it does not promise recurring polling or proactive future reads. There is no supported session API or automatic wake/notification established by this file. Unless the original Work explicitly commits in its reply to a future checkpoint/read cadence and status writeback, the user must trigger the next read by directing the original Work to inspect this file. The original Work must report whether it accepts that cadence; do not describe this instruction as delivered before it confirms.
