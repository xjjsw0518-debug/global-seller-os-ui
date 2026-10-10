# New Development Entry Checklist

## Issue ID

<!-- Required: #<number> and direct Issue link. -->

## Center / Module

<!-- Worker resources / AI models / Product / Content / other. -->

## Task Name

<!-- Short, specific task name. -->

## Scope

<!-- Exact behavior, routes, APIs, tests, configuration, and allowed file range. -->

## Out of Scope

<!-- Explicitly excluded centers, routes, business behavior, baselines, thresholds, dashboards, and infrastructure. -->

## Allowed Files

<!-- Exact files or narrow patterns that may change. -->

## Forbidden Files

<!-- Files and patterns that must not change without a new decision. -->

## Frozen UI Impact

<!-- NONE, or describe the frozen route/layout/baseline impact and attach user authorization. -->

## Required Gates

- [ ] Build
- [ ] dependency-cruiser
- [ ] Knip
- [ ] Playwright Smoke
- [ ] BackstopJS Visual
- [ ] axe-core Accessibility
- [ ] Evidence template contract check

## Expected Evidence

<!-- Actions run, runner, artifacts, IDs, direct links, digests, and retention. -->

## User Authorization Required: YES / NO

<!-- YES for frozen UI, root/server, secrets, privileged operations, or scope expansion. -->

## Risk Level: LOW / MEDIUM / HIGH

## Entry Decision: ALLOWED / BLOCKED

<!-- ALLOWED only when every required field and authorization is complete. -->

## Next Safe Unit

<!-- One smallest safe action, or the prerequisite needed to leave BLOCKED. -->

