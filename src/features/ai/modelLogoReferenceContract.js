/**
 * Candidate API contract for server-managed AI logo assets.
 * This module does not upload, persist, or fetch assets. The current UI adapter
 * remains a memory-only mock until a server implements this contract.
 */
export const AI_LOGO_REFERENCE_VERSION = 1;
export const AI_LOGO_ASSET_UPLOAD_PATH = "/api/v1/ai-logo-assets"; // proposed; not implemented by the historical candidate
export const AI_LOGO_REFERENCE_STATUS = Object.freeze(["VERIFIED", "UNVERIFIED", "REVOKED", "MISSING"]);
export const AI_LOGO_LICENSE_STATUS = Object.freeze(["VERIFIED", "UNVERIFIED", "UNKNOWN", "REVOKED"]);

const safeId = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const cleanText = (value, max) => typeof value === "string" && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const safeDigest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);

/** Validate only opaque, same-origin asset IDs; never accept arbitrary remote URLs. */
export function validateAiLogoAssetReference(reference, { expectedKind, providerId, modelId } = {}) {
  if (!reference || typeof reference !== "object" || Array.isArray(reference)) return { valid: false, code: "LOGO_REFERENCE_REQUIRED" };
  if (reference.version !== AI_LOGO_REFERENCE_VERSION) return { valid: false, code: "LOGO_REFERENCE_VERSION_UNSUPPORTED" };
  if (!["PROVIDER", "MODEL"].includes(reference.kind) || (expectedKind && reference.kind !== expectedKind)) return { valid: false, code: "LOGO_REFERENCE_KIND_INVALID" };
  if (!safeId(reference.assetId)) return { valid: false, code: "LOGO_ASSET_ID_INVALID" };
  if (!safeId(reference.providerId) || (providerId && reference.providerId !== providerId)) return { valid: false, code: "LOGO_PROVIDER_ID_INVALID" };
  if (reference.kind === "MODEL" && (!safeId(reference.modelId) || (modelId && reference.modelId !== modelId))) return { valid: false, code: "LOGO_MODEL_ID_INVALID" };
  if (!AI_LOGO_REFERENCE_STATUS.includes(reference.status) || !AI_LOGO_LICENSE_STATUS.includes(reference.licenseStatus)) return { valid: false, code: "LOGO_PROVENANCE_STATUS_INVALID" };
  if (!cleanText(reference.mimeType, 64) || !["image/png", "image/jpeg", "image/webp"].includes(reference.mimeType)) return { valid: false, code: "LOGO_MIME_INVALID" };
  if (!safeDigest(reference.sha256)) return { valid: false, code: "LOGO_DIGEST_INVALID" };
  if (reference.sourceUrl != null && (!cleanText(reference.sourceUrl, 1024) || !/^https:\/\//i.test(reference.sourceUrl))) return { valid: false, code: "LOGO_SOURCE_URL_INVALID" };
  if (!cleanText(reference.sourceVersion ?? "", 128) || !cleanText(reference.licenseNote ?? "", 512)) return { valid: false, code: "LOGO_PROVENANCE_TEXT_INVALID" };
  return { valid: true, reference: Object.freeze({ ...reference }) };
}

/** Build the historical Provider field plus a proposed model-specific field. */
export function buildAiLogoAssignment(reference) {
  const result = validateAiLogoAssetReference(reference);
  if (!result.valid) return result;
  const { kind, assetId } = result.reference;
  const assetRef = `ai-logo-asset:${assetId}`;
  return { valid: true, payload: kind === "PROVIDER" ? { logo_asset: assetRef } : { model_logo_asset: assetRef } };
}

/** UI state deliberately defaults to unsaved unless a persisted record is explicit. */
export function getModelLogoPersistenceState({ modelLogo, modelLogoReference, serverAssignmentConfirmed = false } = {}) {
  if (modelLogo?.kind === "custom-model" && modelLogo.persistence === "MEMORY_ONLY") {
    return { code: "MEMORY_ONLY", label: "Local preview only · not saved on server", serverSaved: false };
  }
  if (modelLogoReference) {
    const checked = validateAiLogoAssetReference(modelLogoReference, { expectedKind: "MODEL" });
    if (!checked.valid) return { code: "INVALID_SERVER_REFERENCE", label: "Server logo reference is invalid", serverSaved: false };
    if (serverAssignmentConfirmed === true) return { code: "SERVER_REFERENCE_SAVED", label: "Server logo reference confirmed", serverSaved: true };
    return { code: "SERVER_ASSET_NOT_ASSIGNED", label: "Server asset is not assigned to this model", serverSaved: false };
  }
  return { code: "PROVIDER_FALLBACK", label: "Using Provider logo fallback", serverSaved: false };
}

/** Explicitly disconnected until a real same-origin API adapter is supplied. */
export function createAiLogoAssetAdapter({ request } = {}) {
  if (typeof request !== "function") {
    const unavailable = async () => { const error = new Error("AI logo asset API is not connected; current upload is a local mock."); error.code = "AI_LOGO_ASSET_API_NOT_CONNECTED"; throw error; };
    return Object.freeze({ mode: "NOT_CONNECTED", upload: unavailable, assign: unavailable, resolve: unavailable });
  }
  return Object.freeze({
    mode: "SERVER_API",
    async upload(file) {
      if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type) || !(file.size > 0 && file.size <= 1024 * 1024)) {
        const error = new Error("Logo upload must be PNG, JPEG, or WebP and no larger than 1 MiB."); error.code = "LOGO_FILE_INVALID"; throw error;
      }
      const result = await request(AI_LOGO_ASSET_UPLOAD_PATH, { method: "POST", file });
      const checked = validateAiLogoAssetReference(result);
      if (!checked.valid) { const error = new Error("Server returned an invalid logo reference."); error.code = checked.code; throw error; }
      return checked.reference;
    },
    async assign(reference, entity) {
      const checked = validateAiLogoAssetReference(reference, { expectedKind: entity?.kind, providerId: entity?.providerId, modelId: entity?.modelId });
      if (!checked.valid) { const error = new Error("Logo reference does not match the target entity."); error.code = checked.code; throw error; }
      const built = buildAiLogoAssignment(checked.reference);
      return request(entity.assignmentPath, { method: "PATCH", body: built.payload });
    },
    async resolve(reference) {
      const checked = validateAiLogoAssetReference(reference);
      if (!checked.valid) { const error = new Error("Logo reference is invalid."); error.code = checked.code; throw error; }
      return request(`/api/v1/ai-logo-assets/${checked.reference.assetId}/file`, { method: "GET" });
    },
  });
}
