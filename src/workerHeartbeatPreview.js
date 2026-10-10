const HEARTBEAT_MINIMUM_STALE_SECONDS = 60;

/**
 * Preview-only adapter for the candidate Worker heartbeat fields. The current
 * UI fixtures do not include these fields, so they must render UNKNOWN.
 */
export function workerHeartbeatPreview(worker, nowMs = Date.now()) {
  if (worker?.fixtureOnly === true) {
    const online = !["离线", "异常"].includes(worker?.fixtureStatus);
    return { state: online ? "ONLINE" : "OFFLINE", registration: "REGISTERED", label: online ? "在线" : "离线", tone: online ? "green" : "muted", reason: "集中式本地视觉夹具预览" };
  }
  const hasWorkerRecord = [worker?.worker_id, worker?.id].some(value => typeof value === "string" && value.trim());
  if (!hasWorkerRecord) {
    return { state: "UNKNOWN", registration: "UNKNOWN", label: "未知", tone: "muted", reason: "缺少 Worker 注册记录 ID" };
  }
  const lastSeen = worker?.last_seen_at;
  if (typeof lastSeen !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(lastSeen)) {
    return { state: "UNKNOWN", registration: "REGISTERED", label: "未知", tone: "muted", reason: "缺少带时区的 last_seen_at" };
  }
  const heartbeatMs = Date.parse(lastSeen);
  const interval = Number(worker?.heartbeat_interval_seconds);
  if (!Number.isFinite(heartbeatMs) || !Number.isFinite(interval) || interval <= 0 || !Number.isFinite(nowMs)) {
    return { state: "UNKNOWN", registration: "REGISTERED", label: "未知", tone: "muted", reason: "心跳时间或间隔字段无效" };
  }
  const staleAfterMs = Math.max(HEARTBEAT_MINIMUM_STALE_SECONDS, 3 * interval) * 1000;
  const online = heartbeatMs >= nowMs - staleAfterMs;
  return { state: online ? "ONLINE" : "OFFLINE", registration: "REGISTERED", label: online ? "在线" : "离线", tone: online ? "green" : "muted", reason: "基于本地候选规则" };
}
