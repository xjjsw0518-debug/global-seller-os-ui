const safeText = (value, limit = 160) => typeof value === "string" ? value.trim().slice(0, limit) : "";

export const MODEL_DISCOVERY_TIMEOUT_MS = 90_000;

export async function discoverProviderModels(providerId, { signal, fetcher = fetch, timeoutMs = MODEL_DISCOVERY_TIMEOUT_MS } = {}) {
  const id = safeText(providerId, 128);
  if (!id) throw Object.assign(new Error("请先选择接入服务商。"), { code: "PROVIDER_REQUIRED" });

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TypeError("Discovery timeout must be positive and finite.");
  if (signal?.aborted) throw new DOMException("Model discovery cancelled.", "AbortError");
  const controller = new AbortController();
  let timer, rejectCancellation;
  const cancellation = new Promise((_, reject) => { rejectCancellation = reject; });
  const cancel = () => {
    rejectCancellation(new DOMException("Model discovery cancelled.", "AbortError"));
    controller.abort();
  };
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(Object.assign(new Error("读取模型目录超时，请检查服务地址后重试。"), { code: "TIMEOUT" }));
      controller.abort();
    }, timeoutMs);
  });
  const read = async () => {
    const response = await fetcher(`/api/v1/ai-providers/${encodeURIComponent(id)}/discover-models`, {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const responseCode = response.status === 401 || response.status === 403 ? "AUTH_ERROR"
        : response.status === 408 || response.status === 504 ? "TIMEOUT"
        : response.status === 429 ? "RATE_LIMITED"
        : response.status === 502 || response.status === 503 ? "CONNECTION_ERROR" : `HTTP_${response.status}`;
      const code = safeText(body?.detail?.code || body?.error_code, 80) || responseCode;
      throw Object.assign(new Error("模型目录读取失败，请检查接入服务商后重试。"), { code });
    }
  
    const status = safeText(body?.status, 48).toUpperCase();
    const models = Array.isArray(body?.models) ? body.models.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const idValue = safeText(row.model_id || row.model_name || row.id, 120);
      if (!idValue || /[\u0000-\u001f]/.test(idValue)) return [];
      const modelVendor = safeText(row.model_vendor, 48).toUpperCase();
      return [{ id: idValue, name: safeText(row.display_name || row.model_name || row.name, 160) || idValue, ...(modelVendor ? { modelVendor } : {}) }];
    }) : [];
    const uniqueModels = [...new Map(models.map((model) => [model.id, model])).values()];
    if (status !== "SUCCESS" && status !== "SUCCESS_EMPTY") {
      const code = safeText(body?.error_code || status, 80) || "DISCOVERY_FAILED";
      const messages = {
        AUTH_ERROR: "凭据不可用或认证失败，请更新密钥后重试。",
        TIMEOUT: "读取模型目录超时，请检查服务地址后重试。",
        RATE_LIMITED: "服务商请求频率受限，请稍后重试。",
        CONNECTION_ERROR: "暂时无法连接服务商，请检查服务地址后重试。",
        INVALID_ENDPOINT: "服务地址无效或未找到模型目录。",
        UNSUPPORTED: "此连接类型暂不支持自动读取模型目录。",
        SUCCESS_EMPTY: "接入服务商暂未返回可用模型。",
      };
      throw Object.assign(new Error(messages[code] || "接入服务商未能返回模型目录，请检查配置后重试。"), { code, status });
    }
    return { status, models: uniqueModels };
  };
  try { return await Promise.race([read(), deadline, cancellation]); }
  finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); }

}
