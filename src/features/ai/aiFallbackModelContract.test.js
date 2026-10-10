import test from "node:test";
import assert from "node:assert/strict";
import { eligibleAiFallbackModels } from "./aiFallbackModelContract.js";

test("fallback choices require a real enabled ready model and use its registry id", () => {
  const rows = [
    { id: "registry-1", modelId: "gpt-5", model: "GPT-5", provider: "Provider A", enabled: true, healthStatus: "READY" },
    { id: "registry-2", modelId: "disabled", enabled: false, healthStatus: "DISABLED" },
    { id: "registry-3", modelId: "degraded", enabled: true, healthStatus: "DEGRADED" },
    { modelId: "missing-registry-id", enabled: true, healthStatus: "READY" },
  ];
  assert.deepEqual(eligibleAiFallbackModels(rows, "current"), [
    { id: "registry-1", modelId: "gpt-5", model: "GPT-5", provider: "Provider A" },
  ]);
});

test("fallback choices exclude the model being configured and fail closed on bad data", () => {
  assert.deepEqual(eligibleAiFallbackModels([
    { id: "registry-1", modelId: "current", enabled: true, healthStatus: "READY" },
  ], "current"), []);
  assert.deepEqual(eligibleAiFallbackModels(null, "current"), []);
});


import { loadModelQuotaPages } from "./modelQuotaPagedRead.js";
import { readFile } from "node:fs/promises";

test("fallback catalog includes eligible models after first hundred rows", async () => {
  const pages = [];
  const result = await loadModelQuotaPages(async ({ page }) => {
    pages.push(page);
    return { totalPages: 2, items: page === 1
      ? Array.from({ length: 100 }, (_, i) => ({ id: `disabled-${i}`, modelId: `disabled-${i}`, enabled: false, healthStatus: "DISABLED" }))
      : [{ id: "page2-ready", modelId: "page2-ready", enabled: true, healthStatus: "READY" }] };
  });
  assert.deepEqual(pages, [1, 2]);
  assert.deepEqual(eligibleAiFallbackModels(result.items, "current").map(row => row.id), ["page2-ready"]);
});

test("fallback catalog fails closed on later-page errors", async () => {
  await assert.rejects(loadModelQuotaPages(async ({ page }) => {
    if (page === 2) throw Object.assign(new Error("Unavailable"), { code: "HTTP_503" });
    return { totalPages: 2, items: [{ id: "first", modelId: "first", enabled: true, healthStatus: "READY" }] };
  }), { code: "HTTP_503" });
});

test("fallback catalog shares bounded supersession-aware pagination", async () => {
  const source = await readFile(new URL("./AddModelPage.jsx", import.meta.url), "utf8");
  assert.ok(source.includes("loadModelQuotaPages((query) => aiModelOperationsApi.list(query), { isCurrent: () => active })"));
  const effect = source.slice(source.indexOf('if (step !== 3 || stepThreeArea !== "routing")'), source.indexOf("const pickLogo ="));
  assert.ok(effect.includes("return () => { active = false; }"));
  assert.ok(effect.includes("setFallbackModels([])"));
});
