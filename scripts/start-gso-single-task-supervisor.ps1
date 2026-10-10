param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,

    [Parameter(Mandatory = $true)]
    [string]$TaskConfig,

    [switch]$Run
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$node = Get-Command node -ErrorAction Stop
$root = (Resolve-Path -LiteralPath $RepoRoot).Path
$configPath = (Resolve-Path -LiteralPath $TaskConfig).Path
$scriptPath = Join-Path $root "scripts\gso-windows-single-task-supervisor.mjs"
if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
    throw "Supervisor source missing: $scriptPath"
}

Write-Host "GSO Single-Task Supervisor"
Write-Host "Repository: $root"
Write-Host "Task manifest: $configPath"

Push-Location $root
try {
    if ($Run) {
        Write-Host "MODE: WATCH (real execution only when a fresh pre-authorized envelope is present)"
        & $node.Source $scriptPath --config $configPath --repo-root $root --mode watch --allow-execute
    } else {
        Write-Host "MODE: PROBE (read-only; no Codex or GitHub write)"
        & $node.Source $scriptPath --config $configPath --repo-root $root --mode probe
    }
    if ($LASTEXITCODE -ne 0) { throw "Supervisor terminated with code $LASTEXITCODE" }
}
finally {
    Pop-Location
}
