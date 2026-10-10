# AI Center implementation roadmap

Scope for this local batch is the four user-approved AI pages: Overview, Models and Quota, Usage and Cost, and Routing Advice. Settings is explicitly out of this batch. This work is isolated under `src/features/ai/`; `preview.html` is a QA-only entry, not production routing.

## Unit 1 - Models and Quota list

- [x] Provider rail and provider dropdown filters.
- [x] Status, model type, enabled filters, search, and filter reset.
- [x] Sorting, pagination, previous/next, page number, and page size.
- [x] Loading, empty, retry/error, and demo-data disclosure.
- [x] Provider distribution and health summaries from the isolated mock adapter.
- [x] Chromium interaction E2E, console/network checks, and visual review at 1440, 1672, 1920, and 2560 widths.
- [x] Final screenshot compared with reference 771271 for layout, color, typography, and density; generic icons intentionally replace unverified vendor marks.
- [ ] Verified API adapter; blocked until user sets UI_LOCKED and an API contract/version is confirmed.

## Unit 2A - Add model form

- [x] Dialog, required-field validation, URL/key/quota validation, config feedback, mocked connection feedback, save, cancellation, and unsaved-change confirmation.
- [x] Mock save success/failure, draft retention, created-row searchability, and simulated connection-error state.
- [x] Chromium interaction E2E and clean blank-dialog screenshot. No key is persisted, sent, or included in evidence.
- [ ] Real Provider discovery/test/save API and DB write-read verification; not in this UI-only batch.

## Remaining minimum units

- [x] Model detail, edit, and enable/disable local mock interactions. A22 detail and the related list/add/edit/toggle regressions passed; see task evidence.
- [x] A23 model connection-test UI: no-credentials, busy, success, failure, permission-denied, model-state unchanged, and secret/network guard; 13/13 real-Chromium mock checks passed.
- [x] A24 reversible archive/restore UI: cancel, busy/double-submit guard, archive/restore success, failure and permission states, loading/empty/error list states; 19/19 real-Chromium mock checks passed. Four-width dialog geometry passed at 1440/1672/1920/2560. Evidence JSONs are in the task evidence directory.
- [ ] Batch import: selection, file validation, preview, results, and failures.
- [x] Overview A01: body layout, sample-data disclosure, demo controls, and child-page entry visuals. Real local Chromium VisualQA and click checks passed at 1440/1467/1672/1920/2560 widths.
- [ ] Overview A02: complete loading, empty, error, retry, and permission states with the isolated mock adapter; remain mock-only until UI/API contract approval.
- [ ] Usage and Cost.
- [ ] Routing Advice.

## Acceptance and release boundaries

- Current PASS evidence is mock-only and bound to the source fingerprint in the task evidence directory. It does not establish real API, database, permission, AI-to-Task-to-Runtime-to-RPA, Worker integration, or Production PASS.
- Each next minimum unit starts only after the current unit's Reference -> Before -> Diff -> repair -> After -> real-browser VisualPASS gate.
- Do not alter shared shell/App/routes/global CSS, Worker files, Gateway/Router/Worker Core, Production APIs/DB, or deploy. UI_LOCKED is user-owned; until explicitly set, report `VITE_UI_READY_FOR_USER_REVIEW` only when the complete applicable UI batch is ready.


## Batch 01 regression checkpoint (2026-10-01 UTC)

- Add-model form subset regression (unnumbered): 23/23 real local Chromium mock checks passed; this covers only fields and behavior currently implemented.
- Edit-model regression (unnumbered): 10/10 real local Chromium mock checks passed; the shared menu now has five items including A23/A24.
- A16 full historical-field alignment: BLOCKED / NOT COMPLETE. Historical inventory calls for a separate display name, Provider model discovery, endpoint mode, input/output pricing, pricing/billing mode, RPM/TPM/RPD, free allowance/month budget/thresholds, capability and strategy controls, draft persistence, and test-then-enable. Current Add Model mock exposes only Provider, model ID, base URL, API-key presence, type, context length, and one demo CNY quota. Historical backend notes do not verify the current API/schema, so do not invent these fields or payloads. Current isolated adapter accepts only provider/model/baseUrl/type/context/quota/secretConfigured; no raw key, real request, or persistence.
- A17 Add Model route consistency: BLOCKED / NOT RUN pending an authoritative route contract. Current approved route list has /ai-center/models but no /ai-center/models/add; a historical inventory proposes /ai-center/models/add. Current Add button opens a dialog without changing the URL. Do not change shared routing until the expected route is confirmed.
- Native Provider select Escape reproduction: with a dirty Add Model dialog and the Provider select focused/open, one trusted Escape closed the browser-native option popup while the dialog remained open and the draft stayed intact (dialogOpen:true, discardPromptOpen:false, Provider OpenAI, model Escape dropdown draft). The probe only observed trusted Control+A app events; it did not establish second-Escape/discard behavior.
- A22 detail regression: 12/12 real local Chromium mock checks passed on `/ai-center/models`.
- Enable/disable regression: 11/11 real local Chromium mock checks passed.
- A23 and A24 responsive dialogs: 1440, 1672, 1920, and 2560 px; no document-width overflow and all dialog actions stayed inside the viewport. At 1440 px the table itself needs 89 px of horizontal scroll to reach its last column.
- All the above remain isolated in-memory mock acceptance; no real Provider/API/DB or cross-module result is claimed. Shared-shell-only visual details remain with its owner.
