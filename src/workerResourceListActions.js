export function workerResourceListActionAvailability({ liveRead = false, loading = false, selectedCount = 0 } = {}) {
  const stagingReadOnly = Boolean(liveRead);
  const selectionCount = Number.isSafeInteger(selectedCount) && selectedCount > 0 ? selectedCount : 0;
  return {
    bulkDisabled: stagingReadOnly,
    batchDeleteDisabled: stagingReadOnly || selectionCount === 0,
    batchDeleteReason: stagingReadOnly
      ? "批量删除对本轮保留的 TEST 验收资源不可用。"
      : selectionCount === 0 ? "请先选择资源。" : "",
    refreshDisabled: Boolean(loading),
    refreshLabel: loading ? "刷新中" : "刷新",
    clearSelectionDisabled: selectionCount === 0,
  };
}

export function initialWorkerResourceReadSnapshot(readAdapter) {
  return readAdapter ? { state: "LOADING", connection: "INJECTED_TRANSPORT" } : null;
}
