export function liveVendorModelRows(vendor, discoveredModels, accessProvider) {
  const candidates = new Map((vendor?.models || []).map(row => [row[0], row]));
  const directoryVendor = accessProvider?.modelVendor;
  const wholeDirectoryAssigned = Boolean(accessProvider) && (vendor?.id === "CUSTOM" || directoryVendor === vendor?.id);
  return (discoveredModels || []).flatMap(model => {
    if (model.modelVendor && model.modelVendor !== vendor?.id && vendor?.id !== "CUSTOM") return [];
    const known = candidates.get(model.id);
    if (known) return [known];
    if (!wholeDirectoryAssigned && model.modelVendor !== vendor?.id) return [];
    return [[model.id, model.name || model.id, "服务商实时目录", "未知", []]];
  });
}
