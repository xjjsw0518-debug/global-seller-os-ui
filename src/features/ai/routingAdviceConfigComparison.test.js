import test from "node:test";
import assert from "node:assert/strict";
import { formatRoutingAdviceTarget, projectRoutingAdviceConfigComparison } from "./routingAdviceConfigComparison.js";

test("shows current and recommended config values with units and preserves explicit zero", () => {
  const rows = projectRoutingAdviceConfigComparison(
    { provider: "Provider A", model: "model-a", usageStrategy: "NORMAL", rpm: 0, tpm: 1200, rpd: 7 },
    { provider: "Provider B", model: "model-b", usageStrategy: "BACKUP", rpm: 80, tpm: 0, rpd: 3 },
  );
  assert.deepEqual(rows.filter(({ key }) => ["provider", "model", "usageStrategy", "rpm", "tpm", "rpd"].includes(key)), [
    { key: "provider", label: "提供方", current: "Provider A", recommended: "Provider B" },
    { key: "model", label: "模型", current: "model-a", recommended: "model-b" },
    { key: "usageStrategy", label: "使用策略", current: "NORMAL", recommended: "BACKUP" },
    { key: "rpm", label: "RPM", current: "0 次/分钟", recommended: "80 次/分钟" },
    { key: "tpm", label: "TPM", current: "1200 tokens/分钟", recommended: "0 tokens/分钟" },
    { key: "rpd", label: "RPD", current: "7 次/天", recommended: "3 次/天" },
  ]);
});

test("keeps missing and null values UNKNOWN without manufacturing a recommendation", () => {
  const rows = projectRoutingAdviceConfigComparison({ provider: "Provider A", rpm: null }, { model: "model-b" });
  assert.equal(rows.find(({ key }) => key === "provider").recommended, "UNKNOWN");
  assert.equal(rows.find(({ key }) => key === "model").current, "UNKNOWN");
  assert.equal(rows.find(({ key }) => key === "rpm").current, "UNKNOWN");
  assert.equal(rows.find(({ key }) => key === "rpm").recommended, "UNKNOWN");
});

test("marks partial route targets explicitly instead of implying a complete model", () => {
  assert.equal(formatRoutingAdviceTarget({ provider: "Provider A" }), "Provider: Provider A · Model: UNKNOWN");
  assert.equal(formatRoutingAdviceTarget({}), "Provider: UNKNOWN · Model: UNKNOWN");
  assert.equal(formatRoutingAdviceTarget({ provider: "Provider A", model: "model-a" }), "Provider A · model-a");
});
