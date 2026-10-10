export function eligibleAiFallbackModels(items, currentModelId) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item.id === "string" && item.id
      && typeof item.modelId === "string" && item.modelId
      && item.modelId !== currentModelId
      && item.enabled === true
      && item.healthStatus === "READY")
    .map((item) => ({
      id: item.id,
      modelId: item.modelId,
      model: item.model || item.modelId,
      provider: item.provider || "UNKNOWN",
    }));
}
