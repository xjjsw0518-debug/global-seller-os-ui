export const UNKNOWN_CATEGORY_FILTER = "__UNKNOWN_CATEGORY__";
export const UNKNOWN_MODEL_FILTER = "__UNKNOWN_MODEL__";

const cleanText = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
const keyOf = (value) => cleanText(value)?.toLocaleLowerCase() ?? null;
const categoryOf = (item) => {
  const value = cleanText(item?.category);
  return !value || value.toLocaleUpperCase() === "UNKNOWN" ? null : value;
};
const modelValuesOf = (item) => [cleanText(item?.current?.model), cleanText(item?.recommended?.model)].filter(Boolean);

export function projectRouteAdviceFilterOptions(items) {
  const safeItems = Array.isArray(items) ? items : [];
  const categories = new Map();
  const models = new Map();
  let unknownCategoryCount = 0;
  let unknownModelCount = 0;
  for (const item of safeItems) {
    const category = categoryOf(item);
    if (category) categories.set(keyOf(category), { value: category, count: (categories.get(keyOf(category))?.count || 0) + 1 });
    else unknownCategoryCount += 1;
    const values = modelValuesOf(item);
    if (values.length === 0) unknownModelCount += 1;
    for (const model of new Set(values)) {
      const key = keyOf(model);
      models.set(key, { value: models.get(key)?.value || model, count: (models.get(key)?.count || 0) + 1 });
    }
  }
  return {
    categories: [...categories.values()].sort((a, b) => a.value.localeCompare(b.value)),
    models: [...models.values()].sort((a, b) => a.value.localeCompare(b.value)),
    unknownCategoryCount,
    unknownModelCount,
  };
}

export function filterRouteAdviceItems(items, filters = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const category = filters.category || "ALL";
  const model = filters.model || "ALL";
  const risk = filters.risk || "ALL";
  const query = keyOf(filters.search) || "";
  return safeItems.filter((item) => {
    const itemCategory = categoryOf(item);
    const models = modelValuesOf(item);
    const unknownCategoryFilter = category === UNKNOWN_CATEGORY_FILTER || keyOf(category) === "unknown";
    const matchesCategory = category === "ALL"
      || (unknownCategoryFilter ? itemCategory === null : keyOf(itemCategory) === keyOf(category));
    const matchesModel = model === "ALL"
      || (model === UNKNOWN_MODEL_FILTER ? models.length === 0 : models.some((value) => keyOf(value) === keyOf(model)));
    const matchesRisk = risk === "ALL" || item?.risk === risk;
    const haystack = [item?.title, item?.scope, item?.reason, itemCategory, item?.current?.provider, ...models, item?.recommended?.provider]
      .map(keyOf).filter(Boolean).join(" ");
    return matchesCategory && matchesModel && matchesRisk && (!query || haystack.includes(query));
  });
}
