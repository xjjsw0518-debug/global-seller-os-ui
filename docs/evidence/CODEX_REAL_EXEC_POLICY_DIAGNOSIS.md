# Codex real-exec policy diagnosis and safe output fallback

Issue: `#33`

Affected execution: Issue `#21`, second real attempt

RUN_ID: `gso-21-1791654820670-73a624e9`

LEASE_ID: `ef1e890864010e857f9b663e2d8d52e7`

Codex thread: `01a126f3-4d98-7ff2-9f1e-0509b1fac5e1`

## Finding

- `ROOT_CAUSE_LAYER=CODEX_AGENT_COMMAND_ROUTER_POLICY`
- `ROOT_CAUSE_LAYER_EVIDENCE=EVIDENCED`
- `EXACT_DENIAL_RULE=UNKNOWN`
- `WINDOWS_SANDBOX_DEFECT=NOT_PROVEN`
- `FIX_MODE=MODEL_JSON_CONTROLLER_APPLY`

The saved real-run JSONL proves that the Codex agent's `exec_command` request was rejected in `codex_core::tools::router` as `blocked by policy`. It does not identify a rule ID, managed-policy source, or exact matching rule. The local inspection found no user or project `.rules` files, and the real invocation used `--ignore-user-config`, but those facts do not exclude an application-managed, host-managed, or built-in command policy. Attribution below that evidenced router layer is therefore unknown.

## Preserved local evidence

The files remain in the controller's protected state directory outside the repository. No raw authentication material is reproduced here.

| Evidence file | SHA-256 |
| --- | --- |
| `codex-events.sanitized.jsonl` | `0a5b558a5ac8b0cb02a724ffc3d203b51898f446cbeced30da48766b2c1b6b85` |
| `codex-last-message.txt` | `aaff9ce5f999e9dc467cf54c7eb25288130c4aaeac1cd61b07a9e284fbe27d52` |
| `codex-audit-summary.json` | `6986024427b4cc53402d4ca3fe77c4578c3bf3c59e6fe4243cffaabd7bfb348b` |
| `journal.json` | `f081866acda31f38e97ae6868698223d7c2a6ce8499528699c362fe18c60750a` |
| `controller-admission-attestation.json` | `3bbc1a4dc0f428098f8bc286e29a25b4ed8bcaddc26cd130c2fdc859c00e8c56` |

Redacted relevant excerpt:

```text
codex_process_started: sandbox=workspace-write, network_enabled=false
codex_core::tools::router: exec_command failed
pwsh.exe -Command 'git status --short; git rev-parse HEAD; Get-FileHash ...'
Rejected(... rejected: blocked by policy)
codex_process_completed: code=0, policy_denial_class=EXECUTION_POLICY_DENIAL
```

There was no standalone raw stderr file. The sanitized JSONL contains the persisted `stderr` event. The controller audit deliberately did not persist raw subprocess output.

## Why the earlier preflight did not prove real agent access

| Property | No-model preflight | Real `codex exec` |
| --- | --- | --- |
| Entry point | `codex sandbox -P :workspace ... powershell.exe` | `codex exec` agent turn |
| Model call | No | Yes, exactly one |
| Command router | Bypassed; controller directly supplies the process | Agent tool request passes through `codex_core::tools::router` |
| OS sandbox result | Read/write/remove probe passed | Not reached for the rejected agent command, as far as saved evidence proves |
| Network | Disabled | Disabled |
| Credentials | Removed from child environment | Removed from child environment |
| What it proves | Native sandbox can enforce the bounded worktree profile | Agent command policy may still reject a command before or independently of OS sandbox execution |

The two paths test different boundaries. A successful direct sandbox probe must not be used as evidence that the agent tool router will approve a model-generated command.

## Safe remediation

The controller now uses an output-only contract:

1. The model receives only the reviewed prompt and hash-bound controller attestation.
2. The prompt forbids command, filesystem, network, browser, MCP, and GitHub tools.
3. `codex exec` runs with `--sandbox read-only`, network disabled, and an official `--output-schema` JSON schema.
4. The model returns content as data and never claims to have written a file.
5. The trusted controller independently validates the exact schema, base/RUN/LEASE/authorization/attestation bindings, sole target path, source hashes, provenance URLs, content hash and size, historical-vs-live wording, secret patterns, and executable-control patterns.
6. Only after validation and a clean-worktree check does the controller atomically create the one admitted evidence file in the isolated worktree.
7. The existing changed-path and secret checks still run before the controller can commit, push, or create a PR.

This fix does not use `--ignore-rules`, dangerous sandbox bypass, elevated permissions, network access, an additional API key, or GitHub credentials in the Codex child.

## No-model acceptance

The stub contract tests cover:

- valid JSON to the sole allowed file;
- malformed JSON;
- stale base SHA;
- missing provenance;
- path traversal and wrong target;
- model-declared blocker;
- secret-shaped content;
- executable control text;
- dirty worktree;
- existing target preservation;
- simulation-only authorization rejection for real execute.

The dedicated dry run creates an isolated detached Git worktree, applies a hydrated stub JSON through the same controller validator, creates a local commit candidate containing exactly the one allowed evidence file, and performs no model or GitHub call. It does not change Issue `#21`, replay either consumed authorization, or claim a reviewed-main run.
