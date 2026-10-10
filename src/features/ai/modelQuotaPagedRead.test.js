import test from "node:test";
import assert from "node:assert/strict";
import { loadModelQuotaPages } from "./modelQuotaPagedRead.js";

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test("collects all pages while preserving first-page metadata and list contract", async () => {
  const calls = [];
  const result = await loadModelQuotaPages(async options => { calls.push(options); return { items: [{ id: options.page }], total: 3, totalPages: 3, source: "SERVER_READ_PROJECTION", summary: { enabled: 2 } }; });
  assert.deepEqual(result.items.map(x => x.id), [1, 2, 3]);
  assert.equal(result.total, 3); assert.equal(result.source, "SERVER_READ_PROJECTION"); assert.deepEqual(result.summary, { enabled: 2 });
  assert.deepEqual(calls, [{ page: 1, pageSize: 100 }, { page: 2, pageSize: 100 }, { page: 3, pageSize: 100 }]);
});

test("single-page visual fixture without totalPages retains identical items and labels", async () => {
  const fixture = { items: [{ id: "fixture" }], source: "VISUAL_QA_ONLY", summary: { visualFixtureId: "frozen" } };
  assert.deepEqual(await loadModelQuotaPages(async () => fixture), fixture);
});

test("first-page timeout returns canonical error", async () => {
  await assert.rejects(loadModelQuotaPages(() => new Promise(() => {}), { timeoutMs: 15 }), { code: "AI_MODEL_LIST_TIMEOUT" });
});

test("later-page timeout stops spinner and never schedules the next page after late completion", async () => {
  const pending = deferred(); const calls = [];
  const read = loadModelQuotaPages(async ({ page }) => { calls.push(page); return page === 1 ? { items: [1], totalPages: 3 } : pending.promise; }, { timeoutMs: 15 });
  await assert.rejects(read, { code: "AI_MODEL_LIST_TIMEOUT" });
  pending.resolve({ items: [2] }); await new Promise(r => setImmediate(r));
  assert.deepEqual(calls, [1, 2]);
});

test("stale request schedules no pages after its current read completes", async () => {
  const pending = deferred(); let current = true; const calls = [];
  const read = loadModelQuotaPages(async ({ page }) => { calls.push(page); return pending.promise; }, { isCurrent: () => current });
  current = false; pending.resolve({ items: [1], totalPages: 3 });
  await assert.rejects(read, { code: "AI_MODEL_LIST_SUPERSEDED" }); assert.deepEqual(calls, [1]);
});

test("later page failure is preserved and a fresh retry succeeds without partial results", async () => {
  await assert.rejects(loadModelQuotaPages(async ({ page }) => { if (page === 2) throw Object.assign(new Error("Denied"), { code: "HTTP_403" }); return { items: [1], totalPages: 2 }; }), { code: "HTTP_403" });
  const result = await loadModelQuotaPages(async () => ({ items: ["recovered"], totalPages: 1 })); assert.deepEqual(result.items, ["recovered"]);
});

test("timeout retains caller error metadata", async () => {
  await assert.rejects(loadModelQuotaPages(() => new Promise(() => {}), { timeoutMs: 15, makeTimeoutError: () => Object.assign(new Error("timeout"), { code: "AI_MODEL_LIST_TIMEOUT", mock: true }) }), { code: "AI_MODEL_LIST_TIMEOUT", mock: true });
});
