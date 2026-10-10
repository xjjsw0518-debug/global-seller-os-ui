# DEVELOPMENT_EXECUTION_POLICY — CURRENT

Applies to Worker开发 + AI开发.

1. UI method:
Macro Geometry → Region/Component Reconstruction → Typography/Detail → Pixel Polish → Final Gate.

2. Final visual close:
Visual >= 85% AND P0=0 AND P1=0 AND No Obvious Visual Defect.

3. Functional/quality Gates stay strict:
Browser / Console / Network / REAL API / DB / E2E / Security / Responsive / fixture residue=0.

4. At >=85% with no obvious defect:
CLOSE immediately.
Remaining minor visual differences go to Punch List.
Do not spend repeated cycles on 1-3px polish, antialiasing, tiny shadow/border/radius differences.

5. Vite Visibility Gate:
SOURCE_WORKSPACE must equal VITE_CWD/ROOT and the page the user actually sees.
Every UI bundle needs same-viewport Before/After.
No visible change = no effective UI progress.

6. Progress is only:
visible Vite delta, similarity delta, region close, or Gate close.
ACK / QUEUED / batch count / changed_files alone are not progress.

7. Anti-loop:
Two low-yield attempts in the same direction => stop that direction and move to a different Region/Component solution or Punch List.

8. Queue discipline:
Policy changes are guidance, not new tasks.
Do not create a new revision solely because this policy changed.
New revisions are for actual development bundles, page/function transition, true recovery, or scope change.


## Control recovery anti-loop

9. Recovery uses direct evidence, not labels:
- If writer_process_alive=true, do not send another wake. Wait for a new material heartbeat or consumed revision.
- If effective_state is stale and wake says BLOCKED_ACTIVE_WRITER while writer_process_alive=false, classify as STALE_WRITER_CONFLICT; allow one recovery attempt only after fresh direct evidence.
- No repeated wake is allowed without new material evidence.
- Recovery must resume the existing thread/checkpoint only; never create a replacement Work and never replay passed Gates.
- A PM task is considered consumed only when last_consumed_pm_task_revision equals the current control task revision.
- QUEUED/ACK alone never proves recovery.


## Temporary Visual Fixture Mode — USER APPROVED 2026-10-07

10. During UI visual review only, Worker开发 and AI开发 MAY use synthetic/fake display data so the user can see the complete intended UI on the actual local Vite page at `127.0.0.1:5173`.

11. Fixture scope is visual-only:
- Populate cards, tables, charts, statuses, progress, counts, labels, form defaults, empty-state replacements, and other visual regions with realistic synthetic data when real data is unavailable.
- Do NOT use real customer/personal data.
- Do NOT treat fixture-backed UI as REAL API / DB / E2E / functional PASS.
- Do NOT write fixture data to real API, DB, staging persistence, production, or external systems.

12. Fixture implementation must be centralized and reversible:
- Use one explicit local-dev visual fixture switch/provider, not scattered hard-coded fake values across business components.
- Fixture mode must only affect local visual preview / Vite development runtime.
- Existing production/business adapters must remain intact and must be restorable without reconstruction.
- Production UI must not expose MOCK / Fixture / Debug labels or fields solely because fixture mode is enabled.

13. Visual review behavior:
- The actual page shown to the user at `127.0.0.1:5173` must render the fixture-filled final intended visual state.
- Use 1536x864 canonical screenshots for user review.
- Continue Visual ≥85% AND P0=0 AND P1=0 AND No Obvious Visual Defect + Vite Visibility Gate.
- Fixture mode may satisfy visual completeness only; it cannot close functional/quality Gates.

14. Functional-test cleanup Gate:
When the user says to begin functional testing / clear fake data, BOTH lanes must first disable/remove the temporary visual fixture mode and prove:
- fixture residue = 0 in the functional runtime,
- no fixture/mock fallback is serving functional-test pages,
- real adapters/API/DB paths are active where required,
- no synthetic data is persisted,
- Browser / Console / Network / REAL API / DB / E2E / Security / Responsive Gates remain strict.

15. Queue discipline:
This is an explicit user-approved scope change, so each active development lane receives one revision to adopt Visual Fixture Mode. Do not create follow-up revisions merely to restate the same rule.


## Visual Close Threshold — USER APPROVED 2026-10-07

16. The mandatory overall visual close threshold for BOTH Worker开发 and AI开发 is now:
- Overall visual similarity >= 85%.
- P0 = 0.
- P1 = 0.
- No obvious visual defect visible to the user on the actual `127.0.0.1:5173` page.
- No overlap, clipping, overflow, broken layout, missing critical icon/image, unreadable text, or obvious geometry error.

17. 90% is now an excellence target, NOT a mandatory close gate.
- Do not keep a page open solely to chase small shadow, border, radius, antialiasing, font-rendering, or 1–3 px differences once the page is >=85% and has no obvious defect.
- Minor residual visual differences go to the lane Punch List.
- The user will explicitly identify any remaining small visual issue they want repaired later.

18. Structural quality remains strict:
- Sidebar / Header / primary card geometry / main table-grid structure / principal buttons and inputs should stay as close to the frozen reference as practical.
- A page may close at >=85% overall only when the remaining difference is minor and not an obvious user-visible defect.

19. This section supersedes any older task text, checkpoint, heartbeat, or policy wording that still says the mandatory visual close threshold is 90% or 98%.
- This is guidance/acceptance-policy change only.
- Do NOT create a new task revision solely to restate this threshold change.
- Existing Work threads/checkpoints continue without restart.

20. Functional/quality Gates are unchanged:
Browser / Console / Network / REAL API / DB / E2E / Security / Responsive / fixture residue=0 remain strict and are not reduced by the 85% visual threshold.


## Broker Delivery / WAIT_PM De-dup — USER OBSERVED LOOP FIX 2026-10-07

21. A task revision is SATISFIED as soon as the lane heartbeat/result reports:
`last_consumed_pm_task_revision == control/<lane>_task.json.revision`.
- Dispatch receipt remaining `QUEUED` must NOT cause re-delivery of the same revision.
- Do not inject the same "latest task available" message again after consumption is proven.
- Repeated delivery of an already-consumed revision is a control-plane defect, not development progress.

22. WAIT_PM rules:
- WAIT_PM is legal only when `NEED_USER_INPUT=true`, or `safe_next_action_exists=false`, or a real PM/product decision is explicitly required.
- If `NEED_USER_INPUT=false` AND `safe_next_action_exists=true`, the lane must continue its existing `next_action` from the current checkpoint without requiring a new PM revision.
- Do not create a new revision merely to say "continue".

23. Broker retry rules:
- Before any retry/resume, compare current task revision with `last_consumed_pm_task_revision`.
- If equal, suppress retry and mark the delivery state logically SATISFIED/CONSUMED.
- If the lane later becomes stale while `safe_next_action_exists=true`, perform at most one resume/recovery attempt after fresh direct evidence; do not replay the consumed task body.
- Preserve `NO_REPEAT_WAKE_WITHOUT_NEW_MATERIAL_EVIDENCE`.

24. Guidance tasks such as visual threshold / Visual Fixture adoption are one-time adoption instructions. After adoption, they remain policy guidance; they are not perpetual executable queue items.


## UI USER CONFIRMATION GATE — USER LOCKED 2026-10-07

25. Before any UI page/center is formally locked, explicit USER confirmation is mandatory.
- Work may finish UI implementation, fill Visual Fixture data, run visual checks, and prepare Before/After evidence.
- Work MUST then stop at USER_UI_APPROVAL_PENDING.
- Work MUST present the actual `127.0.0.1:5173` visual result and wait for the user's explicit approval.
- Visual similarity / P0 / P1 / automated QA alone do NOT authorize formal UI lock.

26. Until the user explicitly says the UI is approved/locked:
- Do NOT disable or remove Visual Fixture Mode for functional testing.
- Do NOT replace fixture content with real test data.
- Do NOT start real API/DB E2E solely because automated UI gates passed.
- Do NOT mark UI FINAL/FROZEN/CLOSED.

27. After explicit USER approval:
- Mark the approved UI as the visual Source of Truth / locked baseline.
- Disable/remove Visual Fixture from the functional-test runtime.
- Prove fixture residue = 0 and no mock fallback remains.
- Keep the approved visual geometry/layout/style unchanged unless the user later requests a specific UI change.

28. Real test data stage:
- After fixture cleanup, populate the UI using REAL TEST DATA / test records through the intended real adapter/API/DB paths.
- Test data must be non-production-safe test data and must not use real customer/personal data unless explicitly authorized.
- Verify the real test data produces the same approved UI structure and no layout regression.
- Then execute Browser / Console / Network / REAL API / DB write-readback / E2E / Security / Responsive / validation-error-retry-timeout gates.

29. Mandatory execution sequence for BOTH Worker开发 and AI开发:
`UI implementation + Visual Fixture → visual evidence → USER CONFIRMATION → UI LOCK → fixture cleanup → REAL TEST DATA fill → real E2E → final closeout`.

30. This user-confirmation gate supersedes any earlier task/policy wording that allowed automatic transition from visual close directly into fixture cleanup or real E2E.
- This is an execution-policy override only.
- Do NOT create a new task revision solely to restate this rule.


## PM / WORK / DOT Operating Contract — USER DIRECTIVE 2026-10-08

This is an operating-priority clarification, not a new development batch or a request to create Work.

- **One PM, two existing development Work threads, one existing DOT thread.** PM owns task order, priority, cross-lane decisions and Gate acceptance. Worker开发 and AI开发 own implementation, tests, evidence and next safe action. DOT is read-only oversight and user reporting; DOT does not develop, dispatch or alter Gates.
- **One clear delivery loop:** PM task → existing Work execution → Result/Heartbeat with consumed revision, delivered work, tests/Gate, blocker, next safe action → PM decision → DOT rollup. QUEUED/ACKED, a live PID and a refreshed mirror are never completion evidence.
- **Do not stop between micro-units.** If a safe authorized next action exists, each Work continues from its current checkpoint without waiting for another PM "continue" revision. A blocker confined to one unit does not stop independent safe work in that lane. Never invent a passing Gate or bypass required user UI approval.
- **Escalation:** Work handles ordinary implementation issues; PM handles ordering, dependencies and technical tradeoffs. Ask the user only for mandatory UI locks, business decisions, approval for restricted actions, or a genuine unresolvable blocker. Send concise actionable blockers, not low-level debug transcripts.
- **DOT rhythm:** reuse the existing 15-minute read-only status feed and existing monitoring/reporting surfaces, no new watcher. DOT prepares one concise delivery summary per hour (completed / in progress / blocked / next milestone) and escalates material blockers; suppress duplicate unchanged feed deliveries. A feed QUEUED without DOT Result is not a completed report. Do not claim hourly user-facing reports until the existing DOT delivery channel is verified.
- **Recovery safety:** do not create replacement Work, kill process, remove Writer Lock, restart forbidden GUI watchdog/probe_work_state.ps1, or repeat a failed wake without fresh evidence. Keep previously passed Gates and frozen UI unchanged. Stop investing in IPC research unless it is the narrowest required step to restore safe original-thread communication.
- **Scope order remains:** Worker B41-U04 stays blocked pending real authorized Mobile template; Worker may advance B42/B43 safe audits. AI focuses on Add Model child flow while the user-locked Model & Quota parent page is untouched. Other centers stay deferred.

This contract clarifies execution behavior; it does **not** by itself prove that Work auto-consumption, DOT reporting or one-round resume has been repaired. The PM reports those as operational Gates only after observed end-to-end evidence.


## AI Full UI Lock + Real Wiring Authorization — USER CONFIRMED 2026-10-08
User explicitly confirms: AI 智能模型中心→模型与额度 parent page **and ALL Add Model child pages UI are formally locked**. The previously pending Add Model user-approval Gate is now satisfied by this user instruction; it is no longer appropriate to block functional wiring on UI approval. Preserve exact frozen parent+child geometry/style/interactions and 7-image `AI-UI-FREEZE-20261004-002` reference. This overrides older 2026-10-07 statements that Add Model UI remains unapproved (only for AI Model & Quota + children). Worker UI approvals remain unchanged.

User instructs: **run baseline E2E tests first (document FAIL honestly), then merge AI Model & Quota and children inside existing Worker Center single Vite/Sidebar/Header on port 5173, then wire real functionality and perform batch E2E regression**. AI may now disable its local visual fixture in controlled functional-test runtime and use existing authorized credentials from its secret store, with safe real test records; never use fixture for real E2E, never print a key, and never mutate Worker database or UI without ownership. No new Writer, task Work, unsafe recovery, or desktop focus scripts. See `control/AI_MODEL_QUOTA_WORKER_UNIFIED_E2E_BATCH_PLAN_20261008.md`. Preserve previous PASS Gates, all locked UI, and PM final review.

