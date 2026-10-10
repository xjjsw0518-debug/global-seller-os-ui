// The isolated shared Vite proxy currently forwards the ai-model-configurations
// prefix, so use its feature-owned registry alias without changing shared config.
const ENDPOINT = "/api/v1/ai-model-configurations/capability-registry";

function safeFailure(response, body) {
  return String(body?.detail?.code || body?.code || `HTTP_${response.status}`).replace(/[^A-Z0-9_]/g, "").slice(0, 80) || "REGISTRY_UNAVAILABLE";
}

export async function readModelCapabilityRegistry({ providerId, modelVendor, modelId, modelIdentityType = "OFFICIAL" }, fetcher = fetch, { timeoutMs = 10_000 } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TypeError("Registry timeout must be positive and finite.");
  const identity = {
    providerId: String(providerId || "").trim(),
    modelVendor: String(modelVendor || "").trim().toUpperCase(),
    modelId: String(modelId || "").trim(),
    modelIdentityType: String(modelIdentityType || "OFFICIAL").trim().toUpperCase(),
  };
  if (!identity.providerId || !identity.modelVendor || !identity.modelId
    || !["OFFICIAL", "CUSTOM", "PRIVATE", "LOCAL"].includes(identity.modelIdentityType)) {
    const error = new TypeError("A complete model capability identity is required.");
    error.code = "CAPABILITY_REGISTRY_IDENTITY_REQUIRED";
    throw error;
  }
  const controller = new AbortController();
  const query = new URLSearchParams({
    provider_id: identity.providerId,
    model_vendor: identity.modelVendor,
    model_id: identity.modelId,
    model_identity_type: identity.modelIdentityType,
  });
  const read = async () => {
    const response = await fetcher(`${ENDPOINT}?${query}`, {
      credentials: "same-origin",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(safeFailure(response, body)), { code: safeFailure(response, body), status: response.status });
    const data = body?.data ?? body?.item ?? body;
    const capabilities = Array.isArray(data?.capabilities) ? data.capabilities.filter((row) =>
      row && typeof row.capability_code === "string"
        && ["VERIFIED", "UNSUPPORTED", "UNKNOWN"].includes(row.verification_status)
        && ["PROVIDER_ADAPTER", "MODEL_METADATA", "MANUAL_USER_SUPPLEMENT"].includes(row.evidence_source)
        && typeof row.verification_method === "string"
    ) : [];
    return { ...data, capabilities };
  };
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(Object.assign(new Error("CAPABILITY_REGISTRY_TIMEOUT"), { code: "CAPABILITY_REGISTRY_TIMEOUT" }));
      controller.abort();
    }, timeoutMs);
  });
  try { return await Promise.race([read(), deadline]); }
  finally { clearTimeout(timer); }
}

export const verifiedModelCapabilitySources = (registry, identityType = "OFFICIAL", identity = null) => {
  if (identity && (registry?.provider_id !== String(identity.providerId || "")
    || registry?.model_vendor !== String(identity.modelVendor || "").trim().toUpperCase()
    || registry?.model_id !== String(identity.modelId || "").trim()
    || registry?.model_identity_type !== identityType)) return {};
  return Object.fromEntries(
  (registry?.capabilities || [])
    .filter((row) => row.verification_status === "VERIFIED"
      && (identityType !== "OFFICIAL" || ["PROVIDER_ADAPTER", "MODEL_METADATA"].includes(row.evidence_source))
      && (identityType === "OFFICIAL" || row.evidence_source === "MANUAL_USER_SUPPLEMENT"))
    .map((row) => [row.capability_code, row.evidence_source]),
);
};
