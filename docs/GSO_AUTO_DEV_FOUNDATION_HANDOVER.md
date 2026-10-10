# Global Seller OS 7×24 Automation Development Foundation Handover

## 1. Final State

```text
FINAL_STATE=GSO_AUTO_DEV_FOUNDATION_READY
Date: 2026-10-10 16:42 Asia/Jakarta (2026-10-10T09:42:00Z)
Baseline main commit before this handover: 4590db152cc94e4ab1d369ecd66bd721c1d6374a
Runner: ser603198648259
Server: 186.244.233.120
Dev Preview: http://186.244.233.120:5173/
Dev Status: http://186.244.233.120:5173/dev-status
```

The final merge commit and final `main` Actions run are recorded in the completion evidence for this handover. This document is the controlled baseline for resuming feature development.

## 2. Repository / Server

- UI repository: `global-seller-os-ui`
- Control repository: `global-seller-os-control`
- Server checkout: `/opt/gso/gso-ui`
- Service: `gso-ui-dev.service`
- Server runtime secret file: `/etc/gso/secrets.env`
- CI secret location: GitHub Secrets

Secrets must never be exposed in ChatGPT, Work, chat messages, Issues, PRs, source code, logs, or artifacts. Work may reference variable names and secret locations, but never request or print secret values.

## 3. Completed Foundation Steps

| Step | Foundation | Result |
| --- | --- | --- |
| 4 | Self-hosted Runner + Build Gate | PASS |
| 5 | Playwright Smoke Gate | PASS |
| 6 | BackstopJS Visual Gate | PASS |
| 7 | dependency-cruiser Gate | PASS |
| 8 | Knip Gate | PASS |
| 9 | axe-core Accessibility Gate | PASS |
| 10 | Evidence Standard | PASS |
| 11 | Failure Handling Standard | PASS |
| 12 | Development Entry Standard | PASS |
| 13 | `/dev-status` Mobile Progress Page | PASS |
| 14 | Foundation Handover | READY after final merge run |

## 4. Mandatory Gates

Every PR and final `main` verification must run:

1. Build
2. dependency-cruiser
3. Knip
4. Playwright Smoke
5. BackstopJS Visual
6. axe-core Accessibility
7. Evidence Template Contract Check

No Gate may be skipped, replaced with a local-only claim, or weakened by changing thresholds or baselines.

## 5. Current Warnings / Baselines

- Knip has 24 existing unused-export warnings; they are recorded warnings, not hidden failures.
- axe-core has 6 existing baseline violation nodes; new violations remain subject to the Gate.
- GitHub Actions reports a Node.js 20 deprecation warning for affected official actions.
- BackstopJS threshold remains `0.1%`.
- BackstopJS baseline generation and judgement are performed by the Linux self-hosted Runner.

Warnings do not become PASS claims and do not authorize threshold or baseline changes.

## 6. Evidence / Artifact Rules

The canonical rules and templates are:

- [`docs/GSO_GATE_EVIDENCE_STANDARD.md`](GSO_GATE_EVIDENCE_STANDARD.md)
- [`docs/GSO_FAILURE_HANDLING_STANDARD.md`](GSO_FAILURE_HANDLING_STANDARD.md)
- [`docs/GSO_DEVELOPMENT_ENTRY_STANDARD.md`](GSO_DEVELOPMENT_ENTRY_STANDARD.md)
- [`docs/templates/gate-evidence-comment.md`](templates/gate-evidence-comment.md)
- [`docs/templates/failure-handling-comment.md`](templates/failure-handling-comment.md)
- [`docs/templates/development-entry-checklist.md`](templates/development-entry-checklist.md)

Every mandatory Gate artifact must identify the exact run, commit, artifact ID, direct URL, GitHub SHA-256 digest, and retention or expiration. No artifact means no PASS.

## 7. Failure Handling Rules

Failure type classification is:

- `CODE`: the tested change or its contract is wrong;
- `ENVIRONMENT`: runner, dependency, service, network, or external system prevents execution;
- `PERMISSION`: required access is missing;
- `USER_APPROVAL`: explicit authorization is required before continuing;
- `UNKNOWN`: evidence is insufficient to classify safely.

Status handling:

- `FAILED`: a mandatory Gate ran and failed; preserve logs/artifacts and prohibit merge.
- `BLOCKED`: execution cannot continue because of missing environment, permission, dependency, or authorization; record owner and recovery condition.
- `WARNING`: a known historical issue or accepted baseline; record it explicitly and never use it to hide a failure.
- `PASS`: every mandatory Gate passed for the exact commit, evidence artifacts exist, and the final run is verifiable.

The first response is always to preserve evidence, classify the failure, set the truthful Project status, and define the smallest `Next Safe Unit`.

## 8. Development Entry Rules

Before any new Worker, AI, Product, Content, or other feature work:

- no Issue = `BLOCKED`;
- no Scope = `BLOCKED`;
- no Out of Scope = `BLOCKED`;
- no acceptance criteria = `BLOCKED`;
- frozen UI without user authorization = `BLOCKED`;
- root/server/secrets without user authorization = `BLOCKED`;
- mandatory Gate not passed = no merge;
- missing artifact = no PASS status.

The Issue must declare allowed and forbidden files, required Gates, expected evidence, risk, authorization, and one Next Safe Unit.

## 9. `/dev-status` Rules

- Mobile-browser first.
- Route: `/dev-status`.
- Data source: `public/dev-status.json`.
- Refresh interval: fetch JSON every 30 seconds.
- Do not reload the full page.
- No database, login, notification, editing, or complex backend.
- Never expose secrets.
- Four sections are mandatory: 已完成, 进行中, 待执行, 需要解决的问题.

## 10. Secret Rules

- GitHub Secrets are used for CI.
- `/etc/gso/secrets.env` is used for server runtime configuration.
- Plaintext secrets must not appear in ChatGPT, Work, Issues, PRs, logs, or artifacts.
- Missing secret must produce `BLOCKED_SECRET_MISSING`.
- Work may reference only the variable name and must not request the plaintext value.
- Any secret that has been exposed must be revoked and rotated.

## 11. Project Board Rules

| Status | Meaning |
| --- | --- |
| `PASS` | Mandatory Gates and evidence complete; no blocker remains |
| `RUNNING` | Work or validation is active |
| `FAILED` | A mandatory Gate failed |
| `BLOCKED` | A prerequisite, permission, environment, or authorization is missing |
| `READY` | Approved for the next controlled action |
| `NEEDS_REVIEW` | Awaiting controlled review |
| `HOLD` | Deliberately paused by an explicit decision |

Current Project Board state: Issues #1–#5 are `PASS`. Issue #4 is the Skill Gate main evidence pool and remains the controlling evidence location.

## 12. Next Development Recommendation

Resume development in this order:

1. Worker resources center
2. AI intelligent model center
3. Product center
4. Content creation center

Each unit must pass development entry review before implementation and the full mandatory Gate set before merge.

## 13. Next Safe Unit

The automation foundation is complete. The next safe action is to create a new Worker resources center development Issue and fill [`development-entry-checklist.md`](templates/development-entry-checklist.md) before writing code.

