const CONFIG_FIELDS = Object.freeze([
  ["provider", "提供方", ""],
  ["model", "模型", ""],
  ["worker", "Worker", ""],
  ["runtime", "Runtime", ""],
  ["task", "任务", ""],
  ["usageStrategy", "使用策略", ""],
  ["rpm", "RPM", " 次/分钟"],
  ["tpm", "TPM", " tokens/分钟"],
  ["rpd", "RPD", " 次/天"],
]);

function show(value, unit) {
  if (value === null || value === undefined || value === "") return "UNKNOWN";
  return `${value}${unit}`;
}

export function projectRoutingAdviceConfigComparison(current = {}, recommended = {}) {
  return CONFIG_FIELDS.map(([key, label, unit]) => ({
    key,
    label,
    current: show(current[key], unit),
    recommended: show(recommended[key], unit),
  }));
}

export function formatRoutingAdviceTarget(target = {}) {
  const provider = target.provider || "UNKNOWN";
  const model = target.model || "UNKNOWN";
  if (target.provider && target.model) return `${provider} · ${model}`;
  return `Provider: ${provider} · Model: ${model}`;
}
