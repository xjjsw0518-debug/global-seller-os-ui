import test from "node:test";
import assert from "node:assert/strict";
import { projectModelBudgetRanking } from "./modelBudgetRanking.js";

test("ranks known remaining quotas from the existing read DTO and preserves zero", () => {
  const result = projectModelBudgetRanking([
    { id: "a", displayName: "A", quotaSummary: { total: 100, used: 70, remaining: 30, currency: "USD", source: "CONFIGURED", status: "KNOWN" } },
    { id: "b", displayName: "B", quotaSummary: { total: 200, used: 200, remaining: 0, currency: "USD", source: "CONFIGURED", status: "KNOWN" } },
    { id: "c", displayName: "C", quotaSummary: { total: 50, used: 0, remaining: 50, currency: "USD", source: "CONFIGURED", status: "KNOWN" } },
  ]);
  assert.deepEqual(result.items.map(({ id, remaining }) => [id, remaining]), [["c", 50], ["a", 30], ["b", 0]]);
  assert.equal(result.unknownCount, 0);
});

test("does not turn unknown quota fields into zero or rank them as known", () => {
  const result = projectModelBudgetRanking([
    { id: "unknown", displayName: "Unknown", quotaSummary: { total: null, used: null, remaining: null } },
    { id: "legacy-known", model: "Legacy", quota: 100, used: 25, __testFixture: true },
    { id: "server-over", displayName: "Over", quotaSummary: { total: 100, used: 120, remaining: -20, currency: "USD", source: "CONFIGURED", status: "KNOWN" } },
  ]);
  assert.deepEqual(result.items.map(({ id, remaining }) => [id, remaining]), [["legacy-known", 75], ["server-over", -20]]);
  assert.equal(result.unknownCount, 1);
});

test("empty and invalid inputs stay empty without synthetic budget rows", () => {
  assert.deepEqual(projectModelBudgetRanking(null), { items: [], knownCount: 0, unknownCount: 0 });
});
