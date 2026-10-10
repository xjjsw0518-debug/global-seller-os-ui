const knownAmount = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const knownRemaining = (value) => typeof value === "number" && Number.isFinite(value) ? value : null;

export function projectModelBudgetRanking(items = [], limit = 5) {
  const validItems = Array.isArray(items) ? items : [];
  const ranked = validItems.map((item) => {
    const summary = item?.quotaSummary && typeof item.quotaSummary === "object" ? item.quotaSummary : null;
    const fixture = item?.__testFixture === true;
    const summaryKnown = summary?.status === "KNOWN" && typeof summary?.currency === "string" && /^[A-Z]{3}$/.test(summary.currency);
    const currency = summaryKnown ? summary.currency : fixture ? "CNY" : null;
    const total = summaryKnown ? knownAmount(summary.total) : fixture ? knownAmount(item?.quota) : null;
    const used = summaryKnown ? knownAmount(summary.used) : fixture ? knownAmount(item?.used) : null;
    const remaining = summaryKnown ? knownRemaining(summary.remaining) : fixture && total != null && used != null ? total - used : null;
    return {
      id: item?.id ?? item?.model_registry_id ?? item?.model ?? item?.displayName ?? "unknown",
      name: typeof item?.displayName === "string" ? item.displayName : typeof item?.model === "string" ? item.model : "Unknown model",
      provider: typeof item?.provider === "string" ? item.provider : "",
      remaining,
      total,
      used,
      currency,
      source: summary?.source ?? (fixture ? "TEST_FIXTURE" : "UNKNOWN"),
      status: summary?.status ?? (fixture ? "TEST_FIXTURE" : "UNKNOWN"),
    };
  });
  const known = ranked.filter((item) => item.remaining != null)
    .sort((a, b) => b.remaining - a.remaining || a.name.localeCompare(b.name));
  return {
    items: known.slice(0, Math.max(0, Number.isInteger(limit) ? limit : 5)),
    knownCount: known.length,
    unknownCount: ranked.length - known.length,
  };
}
