import test from "node:test";
import assert from "node:assert/strict";
import { initialWorkerResourceReadSnapshot, workerResourceListActionAvailability } from "./workerResourceListActions.js";

test("live overview starts in loading state before first read settles", () => {
  assert.deepEqual(initialWorkerResourceReadSnapshot({ getOverview() {} }), { state: "LOADING", connection: "INJECTED_TRANSPORT" });
  assert.equal(initialWorkerResourceReadSnapshot(null), null);
});

test("staging list can refresh but never enables bulk import or destructive deletion", () => {
  assert.deepEqual(workerResourceListActionAvailability({ liveRead: true, selectedCount: 1 }), {
    bulkDisabled: true,
    batchDeleteDisabled: true,
    batchDeleteReason: "批量删除对本轮保留的 TEST 验收资源不可用。",
    refreshDisabled: false,
    refreshLabel: "刷新",
    clearSelectionDisabled: false,
  });
});

test("staging refresh is disabled while its authenticated read is in flight", () => {
  const state = workerResourceListActionAvailability({ liveRead: true, loading: true, selectedCount: 1 });
  assert.equal(state.refreshDisabled, true);
  assert.equal(state.refreshLabel, "刷新中");
  assert.equal(state.bulkDisabled, true);
  assert.equal(state.batchDeleteDisabled, true);
});

test("preview batch delete still requires a selection", () => {
  const empty = workerResourceListActionAvailability();
  assert.equal(empty.batchDeleteDisabled, true);
  assert.equal(empty.clearSelectionDisabled, true);
  const selected = workerResourceListActionAvailability({ selectedCount: 2 });
  assert.equal(selected.batchDeleteDisabled, false);
  assert.equal(selected.clearSelectionDisabled, false);
});
