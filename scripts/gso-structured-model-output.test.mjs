import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  applyStructuredModelOutput,
  buildStubStructuredModelOutput,
  STRUCTURED_MODEL_OUTPUT_MODE,
  validateStructuredModelOutput,
} from './gso-structured-model-output.mjs';

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(scriptRoot, '..', 'control', 'local-bridge', 'fixtures', 'issue-21.valid-model-output.stub.json'), 'utf8'));
const targetPath = 'docs/evidence/WRC_P2_U01_WORKER_HOME_REAL_READ_ACCEPTANCE.md';
const hash = (value) => createHash('sha256').update(value).digest('hex');

function git(cwd, ...args) {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

function cleanRepository() {
  const root = mkdtempSync(join(tmpdir(), 'gso-structured-output-'));
  git(root, 'init');
  git(root, 'config', 'user.name', 'GSO Test');
  git(root, 'config', 'user.email', 'gso-test@example.invalid');
  writeFileSync(join(root, 'README.md'), 'baseline\n');
  git(root, 'add', 'README.md');
  git(root, 'commit', '-m', 'baseline');
  return root;
}

function contract() {
  const baseSha = 'a'.repeat(40);
  const attestation = {
    packet_sha256: 'b'.repeat(64),
    packet: {
      task: {
        base_sha: baseSha,
        run_id: 'gso-21-stub-run-0001',
        lease_id: 'stub-lease-000000000000000000000001',
        authorization_id: 'stub-authorization-000000000001',
      },
      source_evidence: [
        { path: 'src/workerResourceReadAdapter.js', sha256: 'c'.repeat(64) },
        { path: 'public/dev-status.json', sha256: 'd'.repeat(64) },
      ],
      accepted_historical_recovery_evidence: [
        { provenance_url: 'https://github.com/example/repo/issues/11#issuecomment-1' },
        { provenance_url: 'https://github.com/example/repo/issues/12#issuecomment-2' },
      ],
    },
  };
  const manifest = {
    issue_execution_policy: {
      allowed_files: [targetPath],
      forbidden_files: ['src/**', '.github/workflows/**', 'backstop_data/**'],
    },
  };
  const content = [
    '# WRC-P2-U01 Worker Home Real-Read Acceptance',
    '',
    `Base: ${baseSha}`,
    `RUN_ID: ${attestation.packet.task.run_id}`,
    `LEASE_ID: ${attestation.packet.task.lease_id}`,
    `Authorization: ${attestation.packet.task.authorization_id}`,
    `Controller attestation: ${attestation.packet_sha256}`,
    ...attestation.packet.source_evidence.map((entry) => `Source: ${entry.path} SHA-256 ${entry.sha256}`),
    ...attestation.packet.accepted_historical_recovery_evidence.map((entry) => `Historical accepted provenance: ${entry.provenance_url}`),
    '',
    'The overview=200, map-data=200, health=200, and ready=200 results are historical accepted recovery evidence only.',
    'Current live verification was not performed.',
    'The historical resource-list=404 observation is deferred and outside this homepage read contract.',
    'The model proposed structured output but did not write files or run tests; only the controller may apply this candidate.',
    'No server, database, container, login, business-write, production, secret, or GitHub operation was performed.',
  ].join('\n');
  const output = buildStubStructuredModelOutput({ fixture, manifest, attestation, content });
  return { manifest, attestation, content, output };
}

test('stub JSON flows through controller validation and creates exactly the one allowed file', () => {
  const repoRoot = cleanRepository();
  try {
    const { manifest, attestation, content, output } = contract();
    const result = applyStructuredModelOutput({ repoRoot, rawOutput: JSON.stringify(output), manifest, attestation });
    assert.equal(result.passed, true);
    assert.equal(result.mode, STRUCTURED_MODEL_OUTPUT_MODE);
    assert.equal(result.model_wrote_files, false);
    assert.equal(result.controller_wrote_file, true);
    assert.deepEqual(result.changed_paths, [targetPath]);
    assert.equal(readFileSync(join(repoRoot, targetPath), 'utf8'), content);
    assert.equal(git(repoRoot, 'status', '--porcelain', '--untracked-files=all').slice(3).replaceAll('\\', '/'), targetPath);
  } finally { rmSync(repoRoot, { recursive: true, force: true }); }
});

test('malformed JSON, stale base, missing provenance, path traversal, and BLOCKED output fail closed', () => {
  const { manifest, attestation, output } = contract();
  assert.equal(validateStructuredModelOutput({ rawOutput: '{', manifest, attestation }).ok, false);

  const stale = { ...output, base_sha: 'e'.repeat(40) };
  assert.ok(validateStructuredModelOutput({ rawOutput: JSON.stringify(stale), manifest, attestation }).errors.includes('MODEL_OUTPUT_BASE_SHA_MISMATCH'));

  const missingProvenance = { ...output, provenance_urls: [] };
  assert.ok(validateStructuredModelOutput({ rawOutput: JSON.stringify(missingProvenance), manifest, attestation }).errors.includes('MODEL_OUTPUT_PROVENANCE_MISMATCH'));

  const traversalManifest = { issue_execution_policy: { allowed_files: ['../escape.md'], forbidden_files: [] } };
  const traversal = { ...output, target_path: '../escape.md', changed_files: ['../escape.md'] };
  assert.ok(validateStructuredModelOutput({ rawOutput: JSON.stringify(traversal), manifest: traversalManifest, attestation }).errors.includes('MODEL_OUTPUT_ALLOWED_PATH_INVALID'));

  const blocked = { ...output, status: 'BLOCKED', blocker: 'insufficient evidence', content: '', content_sha256: hash('') };
  assert.ok(validateStructuredModelOutput({ rawOutput: JSON.stringify(blocked), manifest, attestation }).errors.includes('MODEL_OUTPUT_DECLARED_BLOCKED'));
});

test('secret-shaped or executable model content is rejected before filesystem mutation', () => {
  const repoRoot = cleanRepository();
  try {
    const { manifest, attestation, content, output } = contract();
    const secretContent = `${content}\napi_key=sk-abcdefghijklmnopqrstuvwxyz123456`;
    const secretOutput = { ...output, content: secretContent, content_sha256: hash(secretContent) };
    assert.throws(
      () => applyStructuredModelOutput({ repoRoot, rawOutput: JSON.stringify(secretOutput), manifest, attestation }),
      /MODEL_OUTPUT_SECRET_SHAPED_CONTENT/,
    );
    assert.equal(existsSync(join(repoRoot, targetPath)), false);

    const executableContent = `${content}\n\`\`\`powershell\ngit push origin main\n\`\`\``;
    const executableOutput = { ...output, content: executableContent, content_sha256: hash(executableContent) };
    assert.throws(
      () => applyStructuredModelOutput({ repoRoot, rawOutput: JSON.stringify(executableOutput), manifest, attestation }),
      /MODEL_OUTPUT_EXECUTABLE_CONTROL_TEXT/,
    );
    assert.equal(existsSync(join(repoRoot, targetPath)), false);
  } finally { rmSync(repoRoot, { recursive: true, force: true }); }
});

test('unexpected pre-existing changes and an existing target block controller apply without rollback loss', () => {
  const repoRoot = cleanRepository();
  try {
    const { manifest, attestation, output } = contract();
    writeFileSync(join(repoRoot, 'dirty.txt'), 'unexpected\n');
    assert.throws(
      () => applyStructuredModelOutput({ repoRoot, rawOutput: JSON.stringify(output), manifest, attestation }),
      /CONTROLLER_APPLY_WORKTREE_NOT_CLEAN/,
    );
    assert.equal(existsSync(join(repoRoot, targetPath)), false);
  } finally { rmSync(repoRoot, { recursive: true, force: true }); }

  const secondRepo = cleanRepository();
  try {
    const { manifest, attestation, output } = contract();
    mkdirSync(dirname(join(secondRepo, targetPath)), { recursive: true });
    writeFileSync(join(secondRepo, targetPath), 'preserve me\n');
    git(secondRepo, 'add', targetPath);
    git(secondRepo, 'commit', '-m', 'existing target');
    assert.throws(
      () => applyStructuredModelOutput({ repoRoot: secondRepo, rawOutput: JSON.stringify(output), manifest, attestation }),
      /CONTROLLER_APPLY_TARGET_ALREADY_EXISTS/,
    );
    assert.equal(readFileSync(join(secondRepo, targetPath), 'utf8'), 'preserve me\n');
  } finally { rmSync(secondRepo, { recursive: true, force: true }); }
});
