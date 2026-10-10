import { routingAdvicePreviewData } from "./routingAdvicePreviewData.js";

const text = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
const routeConfig = (values = {}) => ({
  provider_name: text(values.provider),
  model_name: text(values.model),
  worker_name: text(values.worker),
  runtime_name: text(values.runtime),
  task_name: text(values.task),
  usage_strategy: text(values.usageStrategy),
  rpm: typeof values.rpm === "number" && Number.isFinite(values.rpm) ? values.rpm : undefined,
  tpm: typeof values.tpm === "number" && Number.isFinite(values.tpm) ? values.tpm : undefined,
  rpd: typeof values.rpd === "number" && Number.isFinite(values.rpd) ? values.rpd : undefined,
});

/** Local-only preview adapter. It deliberately contains no fetch/client/network code. */
export function createRoutingAdvicePreviewAdapter({ delayMs = 250, failOnCalls = [], rows = routingAdvicePreviewData, candidateTestEnabled = false, failCandidateTestOnCalls = [] } = {}) {
  const delay = Number.isFinite(delayMs) ? Math.max(0, Math.min(5000, delayMs)) : 250;
  const failures = new Set(failOnCalls.filter((value) => Number.isInteger(value) && value > 0));
  const candidateFailures = new Set(failCandidateTestOnCalls.filter((value) => Number.isInteger(value) && value > 0));
  let callCount = 0;
  let candidateTestCallCount = 0;

  return Object.freeze({
    source: "LOCAL_SYNTHETIC_FIXTURE",
    get callCount() { return callCount; },
    get candidateTestCallCount() { return candidateTestCallCount; },
    ...(candidateTestEnabled ? { async testCandidateConnection(candidate) {
      const call = ++candidateTestCallCount;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      if (candidateFailures.has(call)) return { status: "FAILURE", candidateFingerprint: candidate?.candidateFingerprint, errorCode: "MOCK_CANDIDATE_CONNECTION_FAILED", source: "LOCAL_SYNTHETIC_FIXTURE" };
      return { status: "SUCCESS", candidateFingerprint: candidate?.candidateFingerprint, validForMs: 15_000, source: "LOCAL_SYNTHETIC_FIXTURE" };
    } } : {}),
    async reanalyze(filters = {}) {
      const call = ++callCount;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      if (failures.has(call)) throw Object.assign(new Error("Local preview failure with private-looking text"), { code: "MOCK_REANALYSIS_FAILED" });
      const recommendations = rows.map((row) => ({
        recommendation_id: row.id,
        category: text(row.category),
        risk_level: row.risk,
        provider_id: row.current?.provider,
        model_id: row.current?.model,
        worker_id: row.current?.worker,
        runtime_id: row.current?.runtime,
        problem_summary: `${row.title} · Mock run ${call}`,
        current_config: routeConfig(row.current),
        suggested_config: routeConfig(row.recommended),
        confidence: 0.7,
        eligible: row.risk !== "UNKNOWN",
        connection_test_required: row.risk === "HIGH",
        required_capability: row.required_capability || null,
      }));
      return { state: "NORMAL", read_only: true, source: "LOCAL_SYNTHETIC_FIXTURE", filters, recommendations };
    },
  });
}
