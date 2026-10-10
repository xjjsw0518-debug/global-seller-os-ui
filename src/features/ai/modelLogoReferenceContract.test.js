import test from "node:test";
import assert from "node:assert/strict";
import { AI_LOGO_ASSET_UPLOAD_PATH, buildAiLogoAssignment, createAiLogoAssetAdapter, getModelLogoPersistenceState, validateAiLogoAssetReference } from "./modelLogoReferenceContract.js";

const providerId = "123e4567-e89b-42d3-a456-426614174000";
const modelId = "223e4567-e89b-42d3-a456-426614174000";
const assetId = "323e4567-e89b-42d3-a456-426614174000";
const base = { version: 1, kind: "MODEL", assetId, providerId, modelId, status: "UNVERIFIED", licenseStatus: "UNKNOWN", mimeType: "image/png", sha256: "a".repeat(64), sourceUrl: null, sourceVersion: "", licenseNote: "" };

test("validates scoped model refs and builds only opaque assignment fields", () => {
  assert.equal(validateAiLogoAssetReference(base, { expectedKind: "MODEL", providerId, modelId }).valid, true);
  assert.deepEqual(buildAiLogoAssignment(base), { valid: true, payload: { model_logo_asset: `ai-logo-asset:${assetId}` } });
  assert.deepEqual(buildAiLogoAssignment({ ...base, kind: "PROVIDER", modelId: undefined }), { valid: true, payload: { logo_asset: `ai-logo-asset:${assetId}` } });
});

test("rejects mismatched entity, malformed ids, untrusted remote refs, and unverified provenance values", () => {
  assert.equal(validateAiLogoAssetReference({ ...base, providerId: "wrong" }).code, "LOGO_PROVIDER_ID_INVALID");
  assert.equal(validateAiLogoAssetReference({ ...base, assetId: "../../logo.png" }).code, "LOGO_ASSET_ID_INVALID");
  assert.equal(validateAiLogoAssetReference({ ...base, kind: "SCRIPT" }).code, "LOGO_REFERENCE_KIND_INVALID");
  assert.equal(validateAiLogoAssetReference({ ...base, mimeType: "image/svg+xml" }).code, "LOGO_MIME_INVALID");
  assert.equal(validateAiLogoAssetReference({ ...base, sourceUrl: "javascript:alert(1)" }).code, "LOGO_SOURCE_URL_INVALID");
  assert.equal(validateAiLogoAssetReference({ ...base, status: "APPROVED" }).code, "LOGO_PROVENANCE_STATUS_INVALID");
  assert.equal(validateAiLogoAssetReference(base, { modelId: "423e4567-e89b-42d3-a456-426614174000" }).code, "LOGO_MODEL_ID_INVALID");
});

test("fails closed when server API is not connected and validates upload response before returning it", async () => {
  const unavailable = createAiLogoAssetAdapter();
  assert.equal(unavailable.mode, "NOT_CONNECTED");
  await assert.rejects(unavailable.upload({ type: "image/png", size: 10 }), { code: "AI_LOGO_ASSET_API_NOT_CONNECTED" });

  const calls = [];
  const adapter = createAiLogoAssetAdapter({ request: async (...args) => { calls.push(args); return base; } });
  const ref = await adapter.upload({ type: "image/png", size: 10 });
  assert.equal(ref.assetId, assetId);
  assert.equal(calls[0][0], AI_LOGO_ASSET_UPLOAD_PATH);
  const bad = createAiLogoAssetAdapter({ request: async () => ({ ...base, assetId: "nope" }) });
  await assert.rejects(bad.upload({ type: "image/png", size: 10 }), { code: "LOGO_ASSET_ID_INVALID" });
});

test("checks upload boundaries and assignment scope before calling injected transport", async () => {
  const calls = [];
  const adapter = createAiLogoAssetAdapter({ request: async (...args) => { calls.push(args); return { ok: true }; } });
  await assert.rejects(adapter.upload({ type: "image/svg+xml", size: 10 }), { code: "LOGO_FILE_INVALID" });
  await assert.rejects(adapter.upload({ type: "image/png", size: 1024 * 1024 + 1 }), { code: "LOGO_FILE_INVALID" });
  await assert.rejects(adapter.assign(base, { kind: "MODEL", providerId, modelId: "423e4567-e89b-42d3-a456-426614174000", assignmentPath: "/api/v1/ai-model-configurations/x" }), { code: "LOGO_MODEL_ID_INVALID" });
  assert.equal(calls.length, 0);
  await adapter.assign(base, { kind: "MODEL", providerId, modelId, assignmentPath: "/api/v1/ai-model-configurations/x" });
  assert.equal(calls[0][1].body.model_logo_asset, `ai-logo-asset:${assetId}`);
});

test("never presents a memory preview or unassigned asset as server-saved", () => {
  assert.deepEqual(getModelLogoPersistenceState({ modelLogo: { kind: "custom-model", persistence: "MEMORY_ONLY", dataUrl: "data:image/png;base64,AA==" } }), {
    code: "MEMORY_ONLY", label: "Local preview only · not saved on server", serverSaved: false,
  });
  assert.equal(getModelLogoPersistenceState({ modelLogoReference: base }).code, "SERVER_ASSET_NOT_ASSIGNED");
  assert.equal(getModelLogoPersistenceState({ modelLogoReference: base, serverAssignmentConfirmed: true }).serverSaved, true);
  assert.equal(getModelLogoPersistenceState({ modelLogoReference: { ...base, assetId: "invalid" }, serverAssignmentConfirmed: true }).serverSaved, false);
});
