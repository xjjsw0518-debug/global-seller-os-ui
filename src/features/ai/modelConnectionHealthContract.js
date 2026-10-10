export const REQUIRED_MODEL_CONNECTION_CHECKS = Object.freeze([
  "Credential Validation",
  "Endpoint Connectivity",
  "Authentication",
  "Model Discovery",
  "Selected Model Exists",
  "Minimal Inference",
  "Capability Validation",
  "Latency",
]);

const PASS_STATUSES = new Set(["PASS", "PASSED", "SUCCESS", "READY"]);
const HEALTH_STATES = new Set([
  "READY", "DEGRADED", "RATE_LIMITED", "AUTH_ERROR", "TIMEOUT", "UNAVAILABLE", "DISABLED",
]);
const safeCode = (value) => /^[A-Z0-9_]{1,80}$/.test(String(value || "")) ? String(value) : "CONNECTION_TEST_FAILED";

export function normalizeModelConnectionHealthResponse(result) {
  const rawChecks = Array.isArray(result?.checks) ? result.checks : [];
  const checksByName = new Map();
  for (const item of rawChecks) {
    if (!item || !REQUIRED_MODEL_CONNECTION_CHECKS.includes(item.name) || checksByName.has(item.name)) continue;
    checksByName.set(item.name, item);
  }

  const checks = REQUIRED_MODEL_CONNECTION_CHECKS.map((name) => {
    const raw = checksByName.get(name);
    const status = String(raw?.status || "NOT_CHECKED").toUpperCase();
    return {
      name,
      status: PASS_STATUSES.has(status) || ["FAIL", "FAILED", "NOT_CHECKED"].includes(status) ? status : "NOT_CHECKED",
      message: "",
    };
  });
  const allChecksPassed = checks.length === REQUIRED_MODEL_CONNECTION_CHECKS.length
    && checks.every((item) => PASS_STATUSES.has(item.status));
  const declaredStatus = String(result?.status || "").toUpperCase();
  const status = declaredStatus === "READY" && allChecksPassed
    ? "READY"
    : HEALTH_STATES.has(declaredStatus) && declaredStatus !== "READY"
      ? declaredStatus
      : "DEGRADED";
  const errorCode = safeCode(result?.error_code || (status === "READY" ? "" : status));

  return {
    status,
    checks,
    allChecksPassed,
    errorCode,
    message: status === "READY" ? "八项健康检查全部通过。" : `连接未就绪：${errorCode}；详细响应已隐藏。`,
  };
}
