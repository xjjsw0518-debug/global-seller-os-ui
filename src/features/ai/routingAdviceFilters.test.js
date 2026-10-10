import test from "node:test";
import assert from "node:assert/strict";
import { filterRouteAdviceItems, projectRouteAdviceFilterOptions, UNKNOWN_CATEGORY_FILTER, UNKNOWN_MODEL_FILTER } from "./routingAdviceFilters.js";
import { createRoutingAdvicePreviewAdapter } from "./routingAdvicePreviewAdapter.js";

const items = [
  { id: "a", category: "dto-category-a", risk: "HIGH", title: "Reduce cost", scope: "worker-a", current: { model: "model-1" }, recommended: { model: "model-2" } },
  { id: "b", category: "dto-category-b", risk: "MEDIUM", title: "Improve latency", scope: "worker-b", current: { model: "model-2" }, recommended: { model: "model-3" } },
  { id: "c", category: null, risk: "UNKNOWN", title: "Missing route", scope: "worker-c", current: { model: null }, recommended: { model: null } },
];

test("filter options derive only observed DTO category/model values and count unknowns", () => {
  assert.deepEqual(projectRouteAdviceFilterOptions(items), {
    categories: [{ value: "dto-category-a", count: 1 }, { value: "dto-category-b", count: 1 }],
    models: [{ value: "model-1", count: 1 }, { value: "model-2", count: 2 }, { value: "model-3", count: 1 }],
    unknownCategoryCount: 1,
    unknownModelCount: 1,
  });
  assert.deepEqual(projectRouteAdviceFilterOptions(null), { categories: [], models: [], unknownCategoryCount: 0, unknownModelCount: 0 });
});

test("category chips match exact observed values and isolate unclassified rows", () => {
  assert.deepEqual(filterRouteAdviceItems(items, { category: "dto-category-a" }).map((item) => item.id), ["a"]);
  assert.deepEqual(filterRouteAdviceItems(items, { category: UNKNOWN_CATEGORY_FILTER }).map((item) => item.id), ["c"]);
});

test("model filter matches current or recommended model and groups rows with no model as UNKNOWN", () => {
  assert.deepEqual(filterRouteAdviceItems(items, { model: "model-2" }).map((item) => item.id), ["a", "b"]);
  assert.deepEqual(filterRouteAdviceItems(items, { model: UNKNOWN_MODEL_FILTER }).map((item) => item.id), ["c"]);
});

test("category, model, risk and search filters combine without widening matches", () => {
  assert.deepEqual(filterRouteAdviceItems(items, { category: "dto-category-a", model: "model-2", risk: "HIGH", search: "WORKER-A" }).map((item) => item.id), ["a"]);
  assert.deepEqual(filterRouteAdviceItems(items, { category: "dto-category-a", model: "model-3" }), []);
  assert.deepEqual(filterRouteAdviceItems(items, { risk: "UNKNOWN", search: "missing route" }).map((item) => item.id), ["c"]);
});

test("cleared filters restore all items and unknown categories remain explicit", () => {
  assert.deepEqual(filterRouteAdviceItems(items, { category: "ALL", model: "ALL", risk: "ALL", search: "" }), items);
  assert.deepEqual(filterRouteAdviceItems(items, { category: "UNKNOWN" }).map((item) => item.id), ["c"]);
});

test("preview reanalysis preserves missing category as UNKNOWN instead of inventing a label", async () => {
  const adapter = createRoutingAdvicePreviewAdapter({ delayMs: 0, rows: [{ id: "unknown-category", risk: "LOW", current: { model: "model-a" }, recommended: { model: "model-b" } }] });
  const result = await adapter.reanalyze();
  assert.equal(result.recommendations[0].category, null);
  assert.equal(projectRouteAdviceFilterOptions([{ category: result.recommendations[0].category }]).unknownCategoryCount, 1);
});
