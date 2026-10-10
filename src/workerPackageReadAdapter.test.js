import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorkerResourceReadAdapter,
  mapPackageArtifactListDto,
  WORKER_READ_CANDIDATE_PATHS,
} from "./workerResourceReadAdapter.js";

const artifact = {
  package_id: "PLAYWRIGHT",
  name: "Playwright",
  version: "1.63.0",
  architecture: "X64",
  runtime_template: "WINDOWS_BROWSER_AI_FULL",
  required: true,
  approved: true,
  status: "APPROVED",
  install_order: 20,
  size_bytes: 1024,
  source_url: "https://private.example/download?token=must-not-leak",
  artifact_path: "/private/path",
  signature: "private-signature",
  silent_install_args: "private-install-args",
  detect_command: "private-detect-command",
  verify_command: "private-verify-command",
};

test("package catalog path uses the existing same-origin Worker API route", () => {
  assert.equal(
    WORKER_READ_CANDIDATE_PATHS.packageArtifacts("WINDOWS_BROWSER_AI_FULL"),
    "/__worker_staging/api/v1/zero-touch/artifacts?runtime_template=WINDOWS_BROWSER_AI_FULL",
  );
  assert.match(WORKER_READ_CANDIDATE_PATHS.packageArtifacts("TEMPLATE&x=1"), /TEMPLATE%26x%3D1$/);
});

test("package catalog mapper returns only safe display metadata", () => {
  const mapped = mapPackageArtifactListDto([artifact]);
  assert.equal(mapped.state, "AVAILABLE");
  assert.equal(mapped.contractAuthority, "LIVE_STAGING_READ_CONTRACT");
  assert.deepEqual(mapped.data.items[0], {
    packageId: "PLAYWRIGHT",
    name: "Playwright",
    version: "1.63.0",
    architecture: "X64",
    runtimeTemplate: "WINDOWS_BROWSER_AI_FULL",
    required: true,
    approved: true,
    status: "APPROVED",
    installOrder: 20,
    sizeBytes: 1024,
  });
  for (const field of ["source_url", "artifact_path", "signature", "silent_install_args", "detect_command", "verify_command"]) {
    assert.equal(Object.hasOwn(mapped.data.items[0], field), false);
  }
});

test("package catalog mapper distinguishes empty and invalid responses", () => {
  assert.equal(mapPackageArtifactListDto([]).state, "EMPTY");
  assert.equal(mapPackageArtifactListDto({ items: [] }).state, "INVALID_RESPONSE");
  assert.equal(mapPackageArtifactListDto([{ ...artifact, package_id: "" }]).state, "PARTIAL");
});

test("package catalog adapter preserves authenticated transport failures", async () => {
  const adapter = createWorkerResourceReadAdapter({
    transport: { get: async () => { throw Object.assign(new Error("unauthorized"), { status: 401 }); } },
  });
  const result = await adapter.getPackageArtifacts();
  assert.equal(result.state, "ERROR");
  assert.equal(result.error.status, 401);
});
