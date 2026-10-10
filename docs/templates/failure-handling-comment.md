# Global Seller OS Failure Handling

## Failure State

`FAILURE_STATE=<FAILED_OR_BLOCKED>`

Merge prohibited: <YES; explain if the field cannot be evaluated>

## Failed Gate

- Gate: <exact mandatory Gate name, supporting check, or NOT_RUN>
- Failed Step / Job: <exact step and job URL, or NOT_AVAILABLE with explanation>

## Actions Run

- Workflow: GSO Gate
- Run: <direct run URL, run number, and numeric run ID>
- Event: <pull_request / push / workflow_dispatch>
- Conclusion: <failure / cancelled / blocked / NOT_RUN>

## Commit

- PR: <direct PR URL or NOT_AVAILABLE with explanation>
- Commit: <full SHA and direct commit URL>

## Runner

- Runner: <exact runner_name or NOT_AVAILABLE with explanation>
- Environment detail: <only details relevant to the failure>

## Failure Type

`<CODE / ENVIRONMENT / PERMISSION / USER_APPROVAL / UNKNOWN>`

Rationale: <evidence supporting this classification>

## Evidence

| Evidence | ID / Digest | Direct Link | Availability / Expiration |
| --- | --- | --- | --- |
| <log, annotation, report, trace, screenshot, or artifact> | <ID and sha256 digest, or NOT_AVAILABLE> | <direct URL> | <available, missing, or expired with date> |

Failure summary: <concise faithful error; do not hide warnings or missing artifacts>

## Immediate Action

<What was stopped, preserved, or safely diagnosed immediately after failure.>

## Required Owner

- Owner: <Work author / repository maintainer / runner owner / server administrator / user / other named role>
- Required action: <one exact action or decision>

## Project Board Target Status

- Project: GSO 20-Day Launch Board
- Item: <issue number and title>
- Target Status: <FAILED / BLOCKED / RUNNING / PASS>
- Project URL: <direct Project view URL>

## Retry Condition

<The material code, environment, permission, or authorization change required before a retry. Link the previous failed run in the retry report.>

## Next Safe Unit

<One narrowly scoped authorized action and its expected evidence output.>
