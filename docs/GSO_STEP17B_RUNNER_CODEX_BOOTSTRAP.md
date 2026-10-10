# Step 17B — Runner Codex CLI Bootstrap

Step 17B installs a fixed Codex CLI version for the non-root self-hosted Runner account and verifies that a dedicated automation credential can support non-interactive execution. It never invokes a model.

## Installation boundary

- Fixed package: `@openai/codex@0.162.1`.
- Versioned user-space root: `$HOME/.local/share/gso-codex/0.162.1`.
- User-space command link: `$HOME/.local/bin/codex`.
- `sudo` and root execution are prohibited.
- Worker business code, UI, databases, containers, services, GSO Gate, and Backstop baselines are not modified.

## Authentication boundary

- Required secret name: `CODEX_ACCESS_TOKEN`.
- The value must belong to a dedicated automation identity and must be stored in GitHub Secrets or an equivalent Runner secret store.
- The workflow injects the value only into authentication and preflight steps.
- The workflow uses a unique temporary `CODEX_HOME` and does not persist the access token with `codex login --with-access-token`.
- Raw login output and secret values are never printed or uploaded.
- A missing value returns `BLOCKED_SECRET_MISSING:CODEX_ACCESS_TOKEN`.

## No-model verification

The bootstrap runs `codex --version`, `codex login status`, and `codex exec --help`. It does not run `codex exec` with a prompt and does not request model inference.

The required PASS contract is:

```text
CODEX_CLI_INSTALLED=true
CODEX_AUTHENTICATED=true
CODEX_EXEC_AVAILABLE=true
NON_INTERACTIVE_SUPPORTED=true
STATUS=PASS
NEXT_SAFE_UNIT=STEP_17C_AUTONOMOUS_EXECUTOR_DRY_RUN
```

Any missing secret, invalid authentication, version mismatch, root execution, missing CLI capability, or unwritable workspace stops the workflow before Step 17C.
