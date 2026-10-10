# Global Seller OS Development Entry Standard

## 1. Purpose

This standard is the mandatory admission control for new Worker, AI, product-center, content-center, and other feature work. It governs process, scope, authorization, evidence, and merge readiness; it does not authorize business UI changes or new product behavior by itself.

## 2. Entry decision

Every new unit starts with a dedicated Issue and a completed [`docs/templates/development-entry-checklist.md`](templates/development-entry-checklist.md). The decision is `ALLOWED` only after all required fields are present, the scope is reviewable, and authorization is available. Otherwise the Project Board state is `BLOCKED`.

Hard rules:

- no Issue: `BLOCKED`;
- no Scope, Out of Scope, or acceptance criteria: `BLOCKED`;
- business-code changes without an explicit allowed-file list: `BLOCKED`;
- frozen-UI, root/server, secret, or privileged work without user authorization: `BLOCKED`;
- mandatory Gate not completed: no merge;
- missing artifact: no `PASS` claim;
- failed CI: no merge.

## 3. Required Issue fields

The Issue must identify the Center / Module, Task Name, owner, Scope, Out of Scope, acceptance criteria, allowed files, forbidden files, frozen UI impact, required Gates, expected evidence, authorization decision, risk level, Entry Decision, and Next Safe Unit. Links to the relevant baseline and Project Board item must be included when they exist.

## 4. Scope and Out of Scope

Scope lists the exact user-visible behavior, API or Worker boundary, pages, tests, configuration, and files that may change. Out of Scope lists explicitly excluded centers, routes, business behavior, visual baselines, thresholds, real-time dashboards, and infrastructure operations. A scope change requires an Issue update and a fresh entry decision before implementation continues.

## 5. Allowed and forbidden files

The checklist must name allowed files or narrow file patterns. The forbidden list must include unrelated centers, frozen UI files, visual baselines, Backstop configuration, threshold definitions, secrets, and deployment/server files unless separately authorized. Touching an undeclared business file is an immediate `BLOCKED` condition and requires re-review.

## 6. UI freeze and authorization

Frozen UI includes existing business routes, shared layout, visual fixtures, Backstop references, and established interaction contracts. Configuration-only work must prove that no frozen UI behavior or baseline changes. Any frozen-UI impact requires explicit user authorization before implementation and must be recorded in the Issue and PR.

## 7. Mandatory Gates

Every new development unit must run the current mandatory Gates against the exact PR commit:

- Build
- dependency-cruiser
- Knip
- Playwright Smoke
- BackstopJS Visual
- axe-core Accessibility
- Evidence template contract check

No Gate may be skipped, softened, or replaced with a local-only assertion. Existing thresholds, including BackstopJS `0.1%`, and visual baselines remain unchanged.

## 8. PR merge admission

A PR may merge only when the complete GSO Gate succeeds, all mandatory artifacts are uploaded, the Actions run and runner are recorded, and the evidence comment uses the canonical template. A successful PR run is not sufficient: the post-merge `main` run must also pass before final completion is reported.

## 9. Evidence requirements

Each mandatory evidence artifact must identify the exact run, commit, artifact name, artifact ID, direct link, GitHub-provided SHA-256 digest, and retention or expiration. Missing or expired evidence is not PASS. Known warnings and accepted baselines must be disclosed as warnings, never presented as clean results.

## 10. Issue comments

Completion comments must contain Final State, PR, Merge Commit, Actions Run, Runner, Gate Summary, Artifact Table, Known Warnings / Existing Baseline, Project Board Status, and Next Safe Unit. Failure or blocked work must use the failure-handling template and must not claim PASS.

## 11. Project Board states

Use `RUNNING` while implementation or validation is active, `NEEDS_REVIEW` or `READY` when awaiting controlled review, `PASS` only after all mandatory Gates and final `main` evidence succeed, `FAILED` for a failed mandatory Gate, and `BLOCKED` for missing prerequisites, permissions, environment, or authorization. Historical warnings may remain `PASS` when documented and non-blocking.

## 12. User authorization

User authorization is required before changing frozen UI, using root or server access, handling secrets, changing deployment or runner configuration, expanding scope, or performing any action that transmits or alters external project state beyond the declared workflow. Authorization must be recorded in the Issue or handoff evidence.

## 13. BLOCKED conditions and recovery

Set `BLOCKED` immediately when a required Issue field, owner, dependency, environment, permission, root/server capability, or user authorization is missing. Preserve the request and available evidence. Development may resume only after the missing prerequisite is supplied, the checklist is updated, the Entry Decision returns to `ALLOWED`, and the affected mandatory Gates are rerun for the current commit.

## 14. Center-specific recovery standards

### Worker resources center

Before resuming, the Issue must declare the pages, APIs, and file range, explicitly state that the AI center is out of scope, and show all current mandatory Gates passing.

### AI intelligent model center

Before resuming, the Issue must declare the pages, subflows, and file range, explicitly state that the Worker center is out of scope, and show all current mandatory Gates passing.

### Product center

Start with an independent Issue and independent Scope. State whether existing Layout and Gates are reused. Product-center work may not bypass the GSO Gate or inherit evidence from another feature.

## 15. Next Safe Unit

Every entry decision and every completion or failure comment must name one smallest safe next unit. If no safe unit exists, state the exact missing authorization or prerequisite and leave the item `BLOCKED`; do not continue by assumption.

