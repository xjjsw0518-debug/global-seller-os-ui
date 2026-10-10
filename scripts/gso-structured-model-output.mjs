import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export const STRUCTURED_MODEL_OUTPUT_SCHEMA = 'gso.codex-controller-artifact.v1';
export const STRUCTURED_MODEL_OUTPUT_MODE = 'MODEL_JSON_CONTROLLER_APPLY';
export const MAX_STRUCTURED_OUTPUT_BYTES = 96 * 1024;
export const MAX_ARTIFACT_CONTENT_BYTES = 64 * 1024;

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const TOKEN_PATTERN = /(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})/g;
const SECRET_TEXT_PATTERN = /(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|authorization\s*:\s*bearer\s+\S+|(?:api[_-]?key|password|client[_-]?secret)\s*[:=]\s*\S+)/i;
const EXECUTABLE_TEXT_PATTERN = /(?:<script\b|javascript:|data:text\/html|```(?:powershell|pwsh|cmd|bat|bash|sh)\b|\bgit\s+push\b|\binvoke-expression\b)/i;
const REQUIRED_KEYS = Object.freeze([
  'schema_version',
  'status',
  'base_sha',
  'run_id',
  'lease_id',
  'authorization_id',
  'attestation_sha256',
  'target_path',
  'content',
  'evidence_sources',
  'provenance_urls',
  'current_live_verification',
  'changed_files',
  'tests_run',
  'blocker',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function runGit(repoRoot, args) {
  const result = spawnSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30_000,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`STRUCTURED_OUTPUT_GIT_FAILED:${args[0]}:${result.status ?? result.error?.code ?? 'UNKNOWN'}`);
  }
  return (result.stdout || '').trim();
}

function changedPaths(repoRoot) {
  const status = runGit(repoRoot, ['status', '--porcelain=v1', '--untracked-files=all']);
  return status.split(/\r?\n/).filter(Boolean).map((line) => {
    const path = line.slice(3).trim().replaceAll('\\', '/');
    return path.includes(' -> ') ? path.split(' -> ').at(-1) : path;
  });
}

function normalizePath(value) {
  return String(value || '').replaceAll('\\', '/');
}

function exactStringArray(value, expected) {
  return Array.isArray(value)
    && value.length === expected.length
    && value.every((entry, index) => entry === expected[index]);
}

function expectedEvidenceSources(attestation) {
  return (attestation?.packet?.source_evidence || []).map((entry) => ({
    path: normalizePath(entry.path),
    sha256: entry.sha256,
  }));
}

function expectedProvenanceUrls(attestation) {
  return (attestation?.packet?.accepted_historical_recovery_evidence || [])
    .map((entry) => entry.provenance_url);
}

function equalEvidenceSources(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((entry, index) => {
      const expectedEntry = expected[index];
      return entry
        && Object.keys(entry).sort().join(',') === 'path,sha256'
        && normalizePath(entry.path) === expectedEntry.path
        && entry.sha256 === expectedEntry.sha256;
    });
}

export function validateStructuredModelOutput({ rawOutput, manifest, attestation }) {
  const errors = [];
  const raw = Buffer.isBuffer(rawOutput) ? rawOutput.toString('utf8') : String(rawOutput ?? '');
  if (Buffer.byteLength(raw, 'utf8') > MAX_STRUCTURED_OUTPUT_BYTES) errors.push('MODEL_OUTPUT_TOO_LARGE');
  let value = null;
  try {
    value = JSON.parse(raw);
  } catch {
    errors.push('MODEL_OUTPUT_JSON_INVALID');
  }
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return { ok: false, errors: [...new Set(errors.length ? errors : ['MODEL_OUTPUT_OBJECT_REQUIRED'])], value: null };
  }

  const keys = Object.keys(value).sort();
  const expectedKeys = [...REQUIRED_KEYS].sort();
  if (!exactStringArray(keys, expectedKeys)) errors.push('MODEL_OUTPUT_FIELDS_NOT_EXACT');
  if (value.schema_version !== STRUCTURED_MODEL_OUTPUT_SCHEMA) errors.push('MODEL_OUTPUT_SCHEMA_INVALID');
  if (value.status !== 'READY') errors.push(value.status === 'BLOCKED' ? 'MODEL_OUTPUT_DECLARED_BLOCKED' : 'MODEL_OUTPUT_STATUS_INVALID');
  if (value.blocker !== '') errors.push('MODEL_OUTPUT_READY_BLOCKER_MUST_BE_EMPTY');

  const packet = attestation?.packet;
  const task = packet?.task || {};
  const allowed = manifest?.issue_execution_policy?.allowed_files || [];
  if (allowed.length !== 1) errors.push('MODEL_OUTPUT_REQUIRES_SINGLE_ALLOWED_FILE');
  const allowedPath = normalizePath(allowed[0]);
  if (!allowedPath || allowedPath.startsWith('/') || allowedPath.startsWith('../') || allowedPath.includes('/../')) {
    errors.push('MODEL_OUTPUT_ALLOWED_PATH_INVALID');
  }
  if (value.base_sha !== task.base_sha) errors.push('MODEL_OUTPUT_BASE_SHA_MISMATCH');
  if (value.run_id !== task.run_id) errors.push('MODEL_OUTPUT_RUN_ID_MISMATCH');
  if (value.lease_id !== task.lease_id) errors.push('MODEL_OUTPUT_LEASE_ID_MISMATCH');
  if (value.authorization_id !== task.authorization_id) errors.push('MODEL_OUTPUT_AUTHORIZATION_ID_MISMATCH');
  if (value.attestation_sha256 !== attestation?.packet_sha256) errors.push('MODEL_OUTPUT_ATTESTATION_HASH_MISMATCH');
  if (!SHA256_PATTERN.test(value.attestation_sha256 || '')) errors.push('MODEL_OUTPUT_ATTESTATION_HASH_INVALID');
  if (normalizePath(value.target_path) !== allowedPath) errors.push('MODEL_OUTPUT_TARGET_NOT_ALLOWED');
  if (!exactStringArray(value.changed_files, [allowedPath])) errors.push('MODEL_OUTPUT_CHANGED_FILES_INVALID');
  if (value.current_live_verification !== false) errors.push('MODEL_OUTPUT_LIVE_VERIFICATION_CLAIM_FORBIDDEN');
  if (!exactStringArray(value.tests_run, [])) errors.push('MODEL_OUTPUT_TEST_CLAIM_FORBIDDEN');

  const expectedSources = expectedEvidenceSources(attestation);
  if (!equalEvidenceSources(value.evidence_sources, expectedSources)) errors.push('MODEL_OUTPUT_EVIDENCE_SOURCES_MISMATCH');
  const expectedUrls = expectedProvenanceUrls(attestation);
  if (!exactStringArray(value.provenance_urls, expectedUrls)) errors.push('MODEL_OUTPUT_PROVENANCE_MISMATCH');

  if (typeof value.content !== 'string' || Buffer.byteLength(value.content || '', 'utf8') < 256) {
    errors.push('MODEL_OUTPUT_CONTENT_TOO_SMALL');
  }
  if (Buffer.byteLength(value.content || '', 'utf8') > MAX_ARTIFACT_CONTENT_BYTES) errors.push('MODEL_OUTPUT_CONTENT_TOO_LARGE');
  if (TOKEN_PATTERN.test(value.content || '') || SECRET_TEXT_PATTERN.test(value.content || '')) errors.push('MODEL_OUTPUT_SECRET_SHAPED_CONTENT');
  TOKEN_PATTERN.lastIndex = 0;
  if (EXECUTABLE_TEXT_PATTERN.test(value.content || '')) errors.push('MODEL_OUTPUT_EXECUTABLE_CONTROL_TEXT');

  const requiredContentValues = [
    task.base_sha,
    task.run_id,
    task.lease_id,
    task.authorization_id,
    attestation?.packet_sha256,
    ...expectedSources.flatMap((entry) => [entry.path, entry.sha256]),
    ...expectedUrls,
  ].filter(Boolean);
  if (requiredContentValues.some((required) => !value.content.includes(required))) {
    errors.push('MODEL_OUTPUT_CONTENT_BINDINGS_INCOMPLETE');
  }
  if (!/current live verification was not performed/i.test(value.content || '')) {
    errors.push('MODEL_OUTPUT_MISSING_NO_LIVE_VERIFICATION_STATEMENT');
  }
  if (!/historical accepted/i.test(value.content || '') || !/resource-list\s*=\s*404/i.test(value.content || '') || !/deferred/i.test(value.content || '')) {
    errors.push('MODEL_OUTPUT_HISTORICAL_EVIDENCE_CLASSIFICATION_MISSING');
  }

  return { ok: errors.length === 0, errors: [...new Set(errors)], value };
}

export function applyStructuredModelOutput({
  repoRoot,
  rawOutput,
  manifest,
  attestation,
  afterAtomicWriteForTest = null,
}) {
  const before = changedPaths(repoRoot);
  if (before.length !== 0) throw new Error(`CONTROLLER_APPLY_WORKTREE_NOT_CLEAN:${before.join(',')}`);
  const validation = validateStructuredModelOutput({ rawOutput, manifest, attestation });
  if (!validation.ok) throw new Error(`MODEL_OUTPUT_REJECTED:${validation.errors.join(',')}`);

  const targetPath = normalizePath(validation.value.target_path);
  const absolute = resolve(repoRoot, targetPath);
  const rel = relative(resolve(repoRoot), absolute);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('CONTROLLER_APPLY_TARGET_ESCAPE');
  if (existsSync(absolute)) throw new Error('CONTROLLER_APPLY_TARGET_ALREADY_EXISTS');
  const contentBytes = Buffer.from(validation.value.content, 'utf8');
  const controllerContentSha256 = sha256(contentBytes);
  mkdirSync(dirname(absolute), { recursive: true });
  const temporary = `${absolute}.${randomUUID()}.gso-controller.tmp`;
  try {
    writeFileSync(temporary, contentBytes, { mode: 0o600, flag: 'wx' });
    renameSync(temporary, absolute);
    if (afterAtomicWriteForTest) afterAtomicWriteForTest({ absolutePath: absolute });
    const readbackBytes = readFileSync(absolute);
    const readbackSha256 = sha256(readbackBytes);
    if (readbackBytes.length !== contentBytes.length || readbackSha256 !== controllerContentSha256) {
      throw new Error('CONTROLLER_APPLY_READBACK_HASH_MISMATCH');
    }
    const after = changedPaths(repoRoot);
    if (!exactStringArray(after, [targetPath])) throw new Error(`CONTROLLER_APPLY_CHANGED_PATHS_INVALID:${after.join(',')}`);
    return {
      passed: true,
      mode: STRUCTURED_MODEL_OUTPUT_MODE,
      target_path: targetPath,
      content_sha256: controllerContentSha256,
      readback_sha256: readbackSha256,
      readback_hash_verified: true,
      content_bytes: contentBytes.length,
      changed_paths: after,
      model_wrote_files: false,
      controller_wrote_file: true,
    };
  } catch (error) {
    rmSync(temporary, { force: true });
    rmSync(absolute, { force: true });
    throw error;
  }
}

export function buildStubStructuredModelOutput({ fixture, manifest, attestation, content }) {
  const task = attestation.packet.task;
  const targetPath = manifest.issue_execution_policy.allowed_files[0];
  return {
    ...fixture,
    schema_version: STRUCTURED_MODEL_OUTPUT_SCHEMA,
    status: 'READY',
    base_sha: task.base_sha,
    run_id: task.run_id,
    lease_id: task.lease_id,
    authorization_id: task.authorization_id,
    attestation_sha256: attestation.packet_sha256,
    target_path: targetPath,
    content,
    evidence_sources: expectedEvidenceSources(attestation),
    provenance_urls: expectedProvenanceUrls(attestation),
    current_live_verification: false,
    changed_files: [targetPath],
    tests_run: [],
    blocker: '',
  };
}
