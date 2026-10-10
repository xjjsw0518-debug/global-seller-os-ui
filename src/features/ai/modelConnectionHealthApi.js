import { modelConfigurationSaveTimeoutMs } from "./modelConfigurationApi.js";

export function modelConnectionHealthTimeoutMs(payload) {
  return modelConfigurationSaveTimeoutMs({ connection: payload }, true);
}

export async function testAiModelConnection(payload, { fetcher = fetch, timeoutMs = modelConnectionHealthTimeoutMs(payload) } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TypeError("Connection timeout must be positive and finite.");
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = Object.assign(new Error("CONNECTION_TEST_TIMEOUT"), { code: "CONNECTION_TEST_TIMEOUT" });
      reject(error);
      controller.abort();
    }, timeoutMs);
  });
  const request = async () => {
    const response = await fetcher("/api/v1/ai-model-connection-tests", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const candidate = String(result?.detail?.code || result?.code || `HTTP_${response.status}`);
      const code = /^[A-Z0-9_]{1,80}$/.test(candidate) ? candidate : `HTTP_${response.status}`;
      throw Object.assign(new Error(code), { code, status: response.status });
    }
    return result;
  };
  try { return await Promise.race([request(), deadline]); }
  finally { clearTimeout(timer); }
}
