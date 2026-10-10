const asText = (value, max = 512) => typeof value === "string" ? value.trim().slice(0, max) : "";

export function configuredProviderSecretRef(provider) {
  if (provider?.credentialConfigured !== true) return "";
  const ref = asText(provider.secretRef, 160);
  return /^secret:\/\/[a-z0-9][a-z0-9._/-]{1,159}$/.test(ref) ? ref : "";
}

function rowsFromResponse(body) {
  if (Array.isArray(body)) return body;
  for (const key of ["items", "providers", "data"]) {
    if (Array.isArray(body?.[key])) return body[key];
  }
  return [];
}

export function normalizeAiProviderDirectoryResponse(body) {
  return rowsFromResponse(body).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const id = asText(row.id || row.provider_id, 128);
    if (!id) return [];
    const secretRef = asText(row.secret_ref, 160);
    const credentialConfigured = row.credential_configured === true || row.secret_configured === true;
    // Provider display names may be user-defined. Preserve explicit vendor identity
    // separately; a CUSTOM access provider alone does not identify a model vendor.
    const explicitVendor = asText(row.model_vendor, 48).toUpperCase();
    const providerName = asText(row.provider_name, 48).toUpperCase();
    const canonicalVendor = ["OPENAI", "DEEPSEEK", "DOUBAO"].includes(providerName) ? providerName : "";
    const modelVendor = explicitVendor || canonicalVendor;
    return [{
      id,
      ...(modelVendor ? { modelVendor } : {}),
      name: asText(row.provider_display_name || row.display_name || row.provider_name || row.provider_code, 160) || "Access Provider",
      baseUrl: asText(row.default_base_url || row.api_base_url, 512),
      secretRef: /^secret:\/\/[a-z0-9][a-z0-9._/-]{1,159}$/.test(secretRef) ? secretRef : "",
      credentialConfigured,
      enabled: row.enabled === true,
      providerStatus: asText(row.provider_status, 32).toUpperCase() || "UNKNOWN",
      providerType: asText(row.provider_type, 48).toUpperCase(),
      connectionType: asText(row.connection_type, 48).toUpperCase(),
      authType: asText(row.auth_type, 48).toUpperCase(),
    }];
  });
}
