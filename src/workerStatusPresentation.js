const valuesByDimension = {
  agent: new Set(["运行中", "空闲", "离线", "异常"]),
  worker: new Set(["运行中", "空闲", "离线"]),
  runtime: new Set(["已就绪", "运行中", "更新中", "离线", "异常"]),
  final: new Set(["已就绪", "运行中", "异常", "离线"]),
};

const tonesByDimension = {
  agent: { 运行中: "green", 空闲: "muted", 离线: "muted", 异常: "danger" },
  worker: { 运行中: "green", 空闲: "muted", 离线: "muted" },
  runtime: { 已就绪: "cyan", 运行中: "green", 更新中: "warning", 离线: "muted", 异常: "danger" },
  final: { 已就绪: "green", 运行中: "warning", 异常: "danger", 离线: "muted" },
};
const runtimeApiLabels = Object.freeze({ READY: "已就绪", RUNNING: "运行中", UPDATING: "更新中", OFFLINE: "离线", STOPPED: "离线", FAILED: "异常", ERROR: "异常" });

export function workerStatusPresentation(value, dimension) {
  const raw = typeof value === "string" ? value.trim() : "";
  const label = dimension === "runtime" ? (runtimeApiLabels[raw.toUpperCase()] || raw) : raw;
  if (!label || !valuesByDimension[dimension]?.has(label)) {
    const detail = raw ? `：${[...raw].slice(0, 40).join("")}` : "";
    return { label: `未知状态${detail}`, tone: "muted", known: false };
  }
  return { label, tone: tonesByDimension[dimension][label], known: true };
}
