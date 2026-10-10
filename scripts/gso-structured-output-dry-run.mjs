import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildControllerAdmissionAttestation,
  buildRestrictedCodexEnv,
  sha256,
} from './gso-windows-auto-executor.mjs';
import {
  applyStructuredModelOutput,
  buildStubStructuredModelOutput,
  validateStructuredModelOutput,
} from './gso-structured-model-output.mjs';

function git(repoRoot, args) {
  const result = spawnSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    env: buildRestrictedCodexEnv(process.env),
  });
  if (result.error || result.status !== 0) throw new Error(`DRY_RUN_GIT_FAILED:${args[0]}:${result.stderr || result.error?.code}`);
  return (result.stdout || '').trim();
}

function stubContent(attestation) {
  const task = attestation.packet.task;
  return [
    '# WRC-P2-U01 Worker Home Real-Read Acceptance',
    '',
    `Base SHA: ${task.base_sha}`,
    `RUN_ID: ${task.run_id}`,
    `LEASE_ID: ${task.lease_id}`,
    `Authorization ID: ${task.authorization_id}`,
    `Controller attestation SHA-256: ${attestation.packet_sha256}`,
    '',
    ...attestation.packet.source_evidence.map((entry) => `Source: ${entry.path}; SHA-256: ${entry.sha256}`),
    ...attestation.packet.accepted_historical_recovery_evidence.map((entry) => `Historical accepted provenance: ${entry.provenance_url}`),
    '',
    'The overview=200, map-data=200, health=200, and ready=200 statuses are historical accepted recovery evidence only.',
    'Current live verification was not performed.',
    'The historical resource-list=404 observation is deferred and outside this homepage read contract.',
    'The model stub proposed structured JSON but did not write files or run tests. The trusted controller applied this candidate.',
    'No server, database, container, login, business-write, production, secret, or GitHub operation was performed.',
    '',
  ].join('\n');
}

export function runStructuredOutputDryRun({ repoRoot, stateDir }) {
  const manifestPath = join(repoRoot, 'control', 'local-bridge', 'issue-21.execute.manifest.json');
  const fixturePath = join(repoRoot, 'control', 'local-bridge', 'fixtures', 'issue-21.valid-model-output.stub.json');
  const manifestBytes = readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const baseSha = git(repoRoot, ['rev-parse', 'HEAD']);
  const simulationId = `issue33-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const simulationRoot = resolve(stateDir, 'structured-output-simulations', simulationId);
  const worktreePath = join(simulationRoot, 'worktree');
  mkdirSync(dirname(worktreePath), { recursive: true });
  git(repoRoot, ['worktree', 'add', '--detach', worktreePath, baseSha]);

  const runId = `dry-run-${simulationId}`;
  const leaseId = createHash('sha256').update(`${baseSha}\n${simulationId}`).digest('hex').slice(0, 32);
  const authorizationId = `simulation-only-${simulationId}`;
  const context = {
    issueBodyHash: manifest.issue_body_sha256,
    manifestHash: sha256(manifestBytes),
    promptHash: sha256(readFileSync(join(repoRoot, manifest.prompt_path))),
    executorHash: sha256(readFileSync(join(repoRoot, 'scripts', 'gso-windows-auto-executor.mjs'))),
    baseSha,
    runId,
    leaseId,
    authorizationId,
    issueSourceState: 'SIMULATION_ONLY',
    attemptAdmission: { state: 'SIMULATION_ONLY', attempt_kind: 'INITIAL', prior_lineage: null },
    admission: { complete: true },
    exactReviewedMain: false,
    atomicLeaseAcquired: false,
    isolatedWorktree: true,
    noModelPreflight: { passed: true },
  };
  const attestation = buildControllerAdmissionAttestation({ repoRoot: worktreePath, manifest, context });
  const content = stubContent(attestation);
  const output = buildStubStructuredModelOutput({ fixture, manifest, attestation, content });
  const application = applyStructuredModelOutput({
    repoRoot: worktreePath,
    rawOutput: JSON.stringify(output),
    manifest,
    attestation,
  });
  git(worktreePath, ['add', '--', application.target_path]);
  git(worktreePath, ['-c', 'user.name=GSO Structured Output Dry Run', '-c', 'user.email=gso-dry-run@example.invalid', 'commit', '-m', 'test: controller-applied structured output stub']);
  const commitSha = git(worktreePath, ['rev-parse', 'HEAD']);
  const commitPaths = git(worktreePath, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']).split(/\r?\n/).filter(Boolean);

  const invalidChecks = {
    malformed_json: validateStructuredModelOutput({ rawOutput: '{', manifest, attestation }).ok === false,
    stale_base: validateStructuredModelOutput({ rawOutput: JSON.stringify({ ...output, base_sha: '0'.repeat(40) }), manifest, attestation }).ok === false,
    wrong_run_id: validateStructuredModelOutput({ rawOutput: JSON.stringify({ ...output, run_id: 'wrong-run-id' }), manifest, attestation }).ok === false,
    wrong_lease_id: validateStructuredModelOutput({ rawOutput: JSON.stringify({ ...output, lease_id: 'wrong-lease-id' }), manifest, attestation }).ok === false,
    missing_sources: validateStructuredModelOutput({ rawOutput: JSON.stringify({ ...output, evidence_sources: [] }), manifest, attestation }).ok === false,
    forged_sources: validateStructuredModelOutput({
      rawOutput: JSON.stringify({
        ...output,
        evidence_sources: output.evidence_sources.map((entry, index) => index === 0 ? { ...entry, sha256: 'f'.repeat(64) } : entry),
      }),
      manifest,
      attestation,
    }).ok === false,
    missing_provenance: validateStructuredModelOutput({ rawOutput: JSON.stringify({ ...output, provenance_urls: [] }), manifest, attestation }).ok === false,
    unexpected_path: validateStructuredModelOutput({ rawOutput: JSON.stringify({ ...output, target_path: '../escape.md' }), manifest, attestation }).ok === false,
  };
  const report = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    final_state: 'STRUCTURED_OUTPUT_DRY_RUN_PASS',
    simulation_only: true,
    source_revision: baseSha,
    source_revision_reviewed_main: false,
    model_call_performed: false,
    github_write_performed: false,
    authorization_created_or_consumed: false,
    historical_issue_21_state_changed: false,
    raw_stub_omits_content_sha256: !Object.hasOwn(output, 'content_sha256'),
    worktree: { isolated: true, path: worktreePath, clean_after_commit: git(worktreePath, ['status', '--porcelain']) === '' },
    controller_apply: application,
    local_commit_candidate: { sha: commitSha, changed_paths: commitPaths },
    invalid_output_checks: invalidChecks,
  };
  const reportPath = join(simulationRoot, 'structured-output-dry-run-report.json');
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return { ...report, report_path: reportPath };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const repoRoot = resolve(process.cwd());
  const localRoot = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
  const stateDir = resolve(localRoot, 'GlobalSellerOS', 'codex-bridge', 'issue33-structured-output');
  if (!existsSync(join(repoRoot, '.git')) && !git(repoRoot, ['rev-parse', '--is-inside-work-tree'])) throw new Error('REPOSITORY_REQUIRED');
  console.log(JSON.stringify(runStructuredOutputDryRun({ repoRoot, stateDir }), null, 2));
}
