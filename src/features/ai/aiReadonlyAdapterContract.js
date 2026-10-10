export const AI_READONLY_METHODS = Object.freeze(["GET", "HEAD", "OPTIONS"]);

const SENSITIVE_NAME = /(?:authorization|cookie|api[_-]?key|token|secret|password|credential)/i;

const contractError = (code, status = null, retryable = false) => {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  error.retryable = retryable;
  error.productionVerified = false;
  return error;
};

export function classifyAiReadonlyHttpStatus(status) {
  const value = Number(status);
  if (value === 401) return Object.freeze({ state: "AUTH_REQUIRED", retryable: false });
  if (value === 403) return Object.freeze({ state: "PERMISSION_DENIED", retryable: false });
  if (value === 404) return Object.freeze({ state: "NOT_AVAILABLE", retryable: false });
  if (value === 409) return Object.freeze({ state: "STATE_CONFLICT", retryable: false });
  if (value >= 500 && value <= 599) return Object.freeze({ state: "SERVICE_FAILURE", retryable: true });
  return Object.freeze({ state: "READ_FAILED", retryable: false });
}

function assertSafeUrl(path) {
  const value = String(path || "");
  if (!value.startsWith("/") || value.startsWith("//")) throw contractError("AI_READONLY_SAME_ORIGIN_REQUIRED");
  const parsed = new URL(value, "https://readonly.invalid");
  for (const key of parsed.searchParams.keys()) {
    if (SENSITIVE_NAME.test(key)) throw contractError("AI_READONLY_SENSITIVE_QUERY_BLOCKED");
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function assertAiReadonlyRequest({ url, method = "GET", headers = {}, body } = {}) {
  const normalizedMethod = String(method || "GET").toUpperCase();
  if (!AI_READONLY_METHODS.includes(normalizedMethod)) throw contractError("AI_READONLY_METHOD_BLOCKED");
  if (body !== undefined && body !== null) throw contractError("AI_READONLY_PAYLOAD_BLOCKED");
  const safeHeaders = {};
  for (const [name, value] of Object.entries(headers || {})) {
    if (SENSITIVE_NAME.test(name)) throw contractError("AI_READONLY_SENSITIVE_HEADER_BLOCKED");
    safeHeaders[String(name)] = String(value);
  }
  return Object.freeze({ url: assertSafeUrl(url), method: normalizedMethod, headers: Object.freeze(safeHeaders) });
}

async function safeBody(response, method) {
  if (method === "HEAD" || response.status === 204) return null;
  return response.json().catch(() => null);
}

export function createAiReadonlyAdapter(fetcher = fetch) {
  if (typeof fetcher !== "function") throw new TypeError("A readonly fetch function is required.");
  return Object.freeze({
    source: "SERVER_READ_PROJECTION",
    productionVerified: false,
    async request(url, options = {}) {
      const request = assertAiReadonlyRequest({ url, ...options });
      const response = await fetcher(request.url, {
        method: request.method,
        credentials: "same-origin",
        headers: { Accept: "application/json", ...request.headers },
      });
      const body = await safeBody(response, request.method);
      if (!response.ok) {
        const classification = classifyAiReadonlyHttpStatus(response.status);
        const error = contractError(classification.state, response.status, classification.retryable);
        error.source = "AI_READONLY_API";
        throw error;
      }
      return Object.freeze({
        data: body?.data ?? body?.item ?? body,
        status: response.status,
        source: "SERVER_READ_PROJECTION",
        productionVerified: true,
      });
    },
  });
}

export function createAiReadonlyFixtureAdapter(fixtures = {}) {
  const snapshot = structuredClone(fixtures && typeof fixtures === "object" ? fixtures : {});
  return Object.freeze({
    source: "LOCAL_FIXTURE",
    productionVerified: false,
    async request(url, options = {}) {
      const request = assertAiReadonlyRequest({ url, ...options });
      return Object.freeze({
        data: structuredClone(snapshot[request.url] ?? null),
        status: snapshot[request.url] === undefined ? 404 : 200,
        source: "LOCAL_FIXTURE",
        productionVerified: false,
      });
    },
  });
}
