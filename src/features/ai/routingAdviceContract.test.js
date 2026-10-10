import test from "node:test";
import assert from "node:assert/strict";
import { projectRouteAdviceList, ROUTE_ADVICE_RISKS } from "./routingAdviceContract.js";

test("projects the candidate recommendation DTO risk and current/suggested values", () => {
  const result = projectRouteAdviceList([{
    recommendation_id: "rec-001",
    category: "STABILITY",
    risk_level: "HIGH",
    provider_id: "provider-current",
    model_id: "model-current",
    worker_id: "worker-01",
    runtime_id: "runtime-01",
    task_id: "task-01",
    problem_summary: "Provider throttling observed",
    current_config: { usage_strategy: "NORMAL", rpm_limit: 120 },
    suggested_config: { provider_id: "provider-next", model_id: "model-next", usage_strategy: "BACKUP", rpm: 80 },
    confidence: 0.82,
    eligible: true,
    connection_test_required: true,
    api_key: "must never be projected",
  }]);

  assert.equal(result.productionVerified, false);
  assert.equal(result.source, "LOCAL_SYNTHETIC_FIXTURE");
  assert.deepEqual(result.counts, { HIGH: 1, MEDIUM: 0, LOW: 0, UNKNOWN: 0 });
  assert.deepEqual(result.items[0], {
    id: "rec-001",
    title: "Provider throttling observed",
    category: "STABILITY",
    scope: null,
    risk: "HIGH",
    current: { provider: "provider-current", model: "model-current", worker: "worker-01", runtime: "runtime-01", task: "task-01", usageStrategy: "NORMAL", rpm: 120, tpm: null, rpd: null },
    recommended: { provider: "provider-next", model: "model-next", worker: null, runtime: null, task: null, usageStrategy: "BACKUP", rpm: 80, tpm: null, rpd: null },
    reason: "Provider throttling observed",
    confidence: 0.82,
    eligible: true,
    connectionTestRequired: true,
    requiredCapability: null,
    source: "LOCAL_SYNTHETIC_FIXTURE",
  });
  assert.equal(JSON.stringify(result).includes("must never be projected"), false);
});

test("classifies supported risk levels and counts unknown or malformed levels safely", () => {
  assert.deepEqual(ROUTE_ADVICE_RISKS, ["HIGH", "MEDIUM", "LOW", "UNKNOWN"]);
  const result = projectRouteAdviceList([
    { risk: "HIGH" }, { risk_level: "MEDIUM" }, { risk: "LOW" }, { risk: "CRITICAL" }, { risk: null },
  ]);
  assert.deepEqual(result.items.map((item) => item.risk), ["HIGH", "MEDIUM", "LOW", "UNKNOWN", "UNKNOWN"]);
  assert.deepEqual(result.counts, { HIGH: 1, MEDIUM: 1, LOW: 1, UNKNOWN: 2 });
});

test("keeps missing current and suggested configuration values unknown", () => {
  const result = projectRouteAdviceList([{ provider_id: "provider-only", model_id: "model-only" }]);
  assert.deepEqual(result.items[0].current, {
    provider: "provider-only", model: "model-only", worker: null, runtime: null, task: null,
    usageStrategy: null, rpm: null, tpm: null, rpd: null,
  });
  assert.deepEqual(result.items[0].recommended, {
    provider: null, model: null, worker: null, runtime: null, task: null,
    usageStrategy: null, rpm: null, tpm: null, rpd: null,
  });
  assert.equal(result.items[0].risk, "UNKNOWN");
});

test("normalizes blank text and rejects invalid list and row shapes", () => {
  assert.equal(projectRouteAdviceList([{ recommendation_id: " ", problem_summary: " " }]).items[0].id, "unknown-1");
  assert.equal(projectRouteAdviceList([{ problem_summary: " " }]).items[0].title, "未命名建议");
  assert.throws(() => projectRouteAdviceList(null), { code: "AI_ROUTE_ADVICE_BAD_LIST" });
  assert.throws(() => projectRouteAdviceList([null]), { code: "AI_ROUTE_ADVICE_BAD_ROW" });
  assert.throws(() => projectRouteAdviceList([[]]), { code: "AI_ROUTE_ADVICE_BAD_ROW" });
});
