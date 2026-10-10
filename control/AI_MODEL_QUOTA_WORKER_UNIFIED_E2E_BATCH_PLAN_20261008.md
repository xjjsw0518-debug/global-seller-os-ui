# AI MODEL & QUOTA + WORKER Unified E2E Batch Plan (2026-10-08)
## Authority / Priority
User explicitly LOCKED **both AI「模型与额度」parent and ALL Add Model child UI** on 2026-10-08; this replaces 2026-10-07 policy language that Add Model UI is awaiting approval. Freeze **AI_UI_USER_SELECTED_FINAL.zip / AI-UI-FREEZE-20261004-002** remains visual Source of Truth. Preserve Worker existing UI, locks and accepted Gates. The user orders **real E2E baseline FIRST**, then one shared Worker/AI application, then complete real functional wiring and E2E regression. Never pretend a baseline that currently fails is PASS.
Only execute in original AI Work thread `01a10430-8d4f-7493-a19e-d90e51c18d48`; no new Work/Writer. Worker thread `01a10380-32ad-7231-a83f-b26f6f63f15b` retains Worker code ownership. This plan authorizes scoped development, not unsafe process recovery.

## Code + security invariants
- Initial `git status`, recent commits, local AI Result/Heartbeat, consumed revision, writer ownership and shared-source lock. If newer local Revision exists, don't overwrite it; report.
- Source-of-truth shared Vite: `C:\Users\DELL\Documents\Codex\VITE_UI_SANDBOX_WORKER_TEST`, port `5173`. Review previous AI workspace `C:\Users\DELL\Documents\Codex\2026-10-04\ai-work-windows-work-7-ui`, reuse existing working components. Do not create a second application or alternate port.
- Preserve locked parent and all Add Model child page geometry/typography/logos/layout/visual states. No redesign. 1536×864 before/after screenshot/DOM visual regression against seven frozen reference images. Parent/child route `/ai-center/models`, `/ai-center/models/add` and Worker route `/ui-v2/worker-resources` must all work inside one Sidebar/Header/navigation.
- User reports that LLM API + keys were previously provided. Inspect existing approved secret store / runtime config **without printing, logging, copying or committing secrets**. No user re-entry unless verifiably unavailable. Never hardcode secrets or persist plaintext. Use existing adapter paths and protected test credentials; a small authorized real API smoke call may incur tokens; impose modest caps, no cost-heavy loops. Do not call production irreversible actions or create customer resources.
- Only after UI lock (NOW confirmed for all AI parent+child pages) may AI's visual fixture be disabled/removed in controlled functional test runtime. Preserve reversible visual baseline and do not change Worker fixture lifecycle without Worker authorization. No false fixture fallback for E2E.
- Before any shared edit coordinate with exact shared file ownership; no concurrent AI/Worker changes to same file. Do not rewrite Worker code, destroy Docker/DB/Redis, remove Writer Lock, kill codex.exe or run `probe_work_state.ps1` / Watchdog / GUI focus scripts.
- Every micro-unit => relevant tests/evidence and heartbeat. Every Batch => Result summary, changed files, test/log excerpts sanitized, UI screenshot/Console+Network summary, API/DB result, P0/P1, next safe action. Continue next independent unit/batch while safe; don't wait for PM to reissue the same Revision.

## B00 — Must run first: initial REAL E2E + code audit (4 units)
- B00-U01: Verify current user-session writer, latest AI task/Result/Heartbeat, Worker shared lock, source vs Vite root, Git differences, UI freeze screenshot fingerprint. Preserve all existing valid PASS Gates.
- B00-U02: Before any code edits, run current `npm run build` and browser E2E journey on existing `5173`: Worker↔AI navigation, parent page, Step1/2/3, save/enable, return, refresh; capture exact PASS/FAIL, screenshot 1536x864, Console/Network errors, routes and broken steps. If it fails, label BASELINE_FAIL with reproducible proof, then proceed to fix; **never label as passed because only mock worked**.
- B00-U03: Audit current backend/API/DB schemas, auth/role contracts, adapters/provider registry, model metadata, secret references, keys *presence only*, quota, routing, existing tests, code imports/exports and old LOCAL DRAFT mock. Run safe read-only API availability and DB existence checks, identify required test data. No secret value output.
- B00-U04: Publish reuse matrix [ALREADY_DONE / REUSE / MISSING / BLOCKED], P0/P1 list, exact files in AI scope and any shared ownership locks. B00 Gate = baseline executed and evidence recorded, NOT full E2E PASS.

## B01 — Merge into shared Worker application (4 units)
- B01-U01: Audit shared app Shell/Routes; choose current Worker `5173` as the only root, no fork. Preserve Worker Sidebar/Header/geometry and accepted Worker visual fixture.
- B01-U02: Wire AI parent + all child routes into the existing shared router and top-level navigation, keep Add Model nested under Model & Quota, eliminate wrong legacy LOCAL DRAFT route through correct component mapping, not cosmetic CSS.
- B01-U03: Reconcile imports/exports/styles/assets/official provider logos and isolated AI feature store without global CSS collisions; exact shared lock handoff when necessary.
- B01-U04: Real Chrome/Playwright mouse+keyboard navigation test, refresh/back/forward/deep link across Worker↔AI, no blank/overlay/404, screenshot regressions at 1536×864, build PASS. B01 Gate only after user-visible 5173 change.

## B02 — Model & Quota parent real functionality (5 units)
- B02-U01: Authenticate and role-check current existing API; 401/403/expired token/timeout UX; no bypass.
- B02-U02: Real model list/detail/search/filter/sort/table actions with browser-network evidence and exact API contract.
- B02-U03: Enable/disable, connection test, archive/restore, draft/active state with write→DB/API readback, idempotency/negative tests.
- B02-U04: Quota balance/trend, provider share, health, KPI, Top5 and audit operation history bind existing data adapters; loading/empty/error/retry and no secret leak.
- B02-U05: Full parent user-visible locked geometry regression plus real backend/API/DB functional E2E, no fixture fallback. B02 Gate evidence required.

## B03 — Add Model Step 1 + Step 2 (5 units)
- B03-U01: MODEL_VENDOR choice drives concrete model discovery; explicit model selection updates live preview; use provider registry/adapter; `更多` opens right drawer only on click and never expands main model grid.
- B03-U02: Custom/compatible path and MODEL_VENDOR vs ACCESS_PROVIDER vs CONNECTION_TYPE/DEPLOYMENT_TYPE separation, immutable user selections until confirm, validated inputs.
- B03-U03: Step2 provider/credential secret reference/Base URL/auth/headers/timeouts/retry/health advanced options, no plaintext.
- B03-U04: Real safe Connection Test and provider model discovery against existing supplied API/key via secret store; success/error/timeout/retry/no-authorization states; cheap minimal tokens.
- B03-U05: Step1→Step2 browser E2E, preview state, UX errors and 1536×864 frozen screenshot regression, build/Console/Network evidence.

## B04 — Add Model Step 3 + persistence (5 units)
- B04-U01: Model capability recognition via Provider Adapter + Model Metadata + Capability Registry; category/scenario separate; correct read-only detected capability behavior.
- B04-U02: Quota/price/unit/cost and limits, validation/edge cases/real data readback, protect sensitive or absent metrics.
- B04-U03: Routing priority, weight, fallback, conditions, health validation and save semantics, independent provider credentials; tests.
- B04-U04: Save Draft → DB readback → Edit/Enable/Disable/Test → Archive/Restore; Save & Enable and success/error/failure recovery + idempotency, no duplicate records.
- B04-U05: Full Step3 and preview + success page browser E2E, API/DB exact readback and frozen UI regression; no false PASS.

## B05 — Unified real E2E + Final Gate (4 units)
- B05-U01: Unified one-root `5173` run through Worker↔AI routes, parent and every Step1/Step2/Step3 state, create draft/activate/manage/restore using safe real test data, no fixture residue.
- B05-U02: Auth/permissions/invalid input/network timeout/retry/error recovery, secret logging scan=0, API/DB integrity; build/tests and Console errors=0, relevant unexpected Network errors=0.
- B05-U03: All frozen AI parent+child states screenshot diff at 1536×864 (overall ≥85%, 90% target; P0=0 P1=0, no obvious visual defects), Worker UI regression; stable content.
- B05-U04: Source+build fingerprint, changed files, endpoint proofs, real E2E evidence, remaining blockers, rollback notes; ask PM to audit final Gate and publish completion only when all criteria verifiably pass.

## Dispatch / operational reporting
Current task revision `AI-20261008-028-UNIFIED-UI-E2E-WIRING`; **single PM dispatch contains all Batch objectives**, so the original AI Work shall execute B00→B05 without repeated dispatch for safe next steps. Update `AI_TO_PM_RESULT.md` and `AI_HEARTBEAT.json` in existing AI workspace; update existing sanitized outbox `ai_status.json` with `last_consumed_pm_task_revision`, batch/unit and next safe action. Heartbeat at least each 120 seconds while truly executing (not artificial PM labels). If blocked by secret not found/auth/Writer or unavailable tool, report exact blocker, no bypass; proceed independent safe work. Give DOT read-only progress via existing feed, not separate Work. Work receives task only if Bridge actually dispatches to old thread; QUEUED != execution.


## xuejian-skill Mandatory Control Acceptance — USER DIRECTIVE 2026-10-08

User explicitly mandates xuejian-skill after implementation of every Model & Quota parent page and every Add Model child page. This skill specializes in control/interaction/functional QA. huashu-design remains visual comparison only. DO NOT use one as a substitute for the other.

### Load actual installed skill before the first test
- In the ORIGINAL AI Work Windows runtime, locate its installed skill entry and read xuejian-skill/SKILL.md in full. Verify availability and invocation. Reuse installation, do not install duplicates.
- Invoke the ACTUAL skill. Handwritten reports or generic Playwright scripts must not be passed off as successful xuejian-skill calls.
- Record real skill loading/invocation evidence, installed version/path, test route and timestamp in AI_TO_PM_RESULT.md, omitting credentials. If not found, mark SKILL_UNAVAILABLE or SKILL_LOAD_FAILED; continue independent coding/tests, but final Gate remains blocked until real skill QA.
- All modes default to VERIFY_ONLY. QA skills must not redesign locked UI or alter source unexpectedly.

### Modes and acceptance contract
- VERIFY_ONLY: existing pre-change baseline observation and inventory without source modification.
- UI_INTERACTION_MODE: actual browser Playwright action on every button, input, dropdown, tab, toggle, modal, drawer and table control. Check clickable states, open/close, navigation, validation, loading, success, error, retry, negative and boundary states.
- REAL_FUNCTIONAL_MODE: after genuine wired adapters, verify auth, real API/DB exact readback, mutation/postcondition, retry/error/network/console state and data consistency using authorized safe test records. Mocked API or visual fixture cannot qualify as PASS.
- Real LLM API & key have been supplied previously; use existing approved secret store reference. Never print/log/persist/reveal keys; fail safely and continue unrelated units if missing.

### Existing Batches to run the skill
- B00-U02: VERIFY_ONLY pre-code baseline; record failures accurately and build control inventory.
- B01-U04: UI_INTERACTION_MODE after shared Worker + AI Vite 5173 navigation merge; no Worker regression.
- B02-U05: UI_INTERACTION_MODE and REAL_FUNCTIONAL_MODE for locked Model & Quota parent (filters/list/detail/toggles/quota/health).
- B03-U05: both modes for Add Model Step1 and Step2, More right drawer, provider/model select, preview, secret-reference and connection test.
- B04-U05: both modes for Step3 capability/quota/cost/routing and Draft/Save & Enable/success/error/retry.
- B05-U01/U02/U03: full-site keyboard/mouse, all controls, browser/API/DB/permissions/network/console, before/after 1536x864 frozen-UI comparisons, Worker regression.
- B05-U04: verify coverage and actual skill reports before PM Final Gate. Retest failures after targeted fixes; do not hide unfixed controls.

### Required actual reports per page and aggregate
CONTROL_TOTAL
CONTROL_TESTED
CONTROL_PASS
CONTROL_FAIL
CONTRACT_PASS
CONSOLE_ERROR
NETWORK_ERROR
P0
P1
CONTROL_PASS_MATRIX
FINAL_STATE

CONTROL_PASS_MATRIX must include route, control name or ID, test mode, action, expected response/postcondition, observed actual browser/API/DB outcome, PASS/FAIL and evidence reference.
All expected controls and states must be exercised; untested does not equal PASS. Final must have P0=0, P1=0, no unexplained console/network errors and an authenticated API/DB E2E where applicable.

Execution: use the same original AI thread. Keep 6 batches/27 micro-units and their ordering, with skill QA integrated inside existing batch gates; NO extra 27 Work queue submissions. Write real Result and heartbeat, and proceed to the next safe unit without waiting for PM. Respect the frozen UI and Writer Lock. Preserve all prior PASS Gates.

