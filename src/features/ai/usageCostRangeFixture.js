import { filterUsagePreviewRows } from "./usageCostPreviewState.js";
export const USAGE_DEMO_DATE = "2026-10-08";
export const USAGE_BUDGET_KEY = "ai-usage-visual-budget:2026-10";
const colors = ["#168df2", "#14c99a", "#f6a93c", "#8665fa", "#96a9bd"];
const types = ["RPA Planner", "RPA Worker", "Chat Assistant", "Data Analysis", "Others"];
const dateText = (date) => date.toISOString().slice(0, 10);
const shiftDate = (date, days) => { const next = new Date(`${date}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + days); return dateText(next); };
export function usageDateWindow(period, from, to) {
  const start = period === "today" ? USAGE_DEMO_DATE : period === "7d" ? shiftDate(USAGE_DEMO_DATE, -6) : period === "30d" ? shiftDate(USAGE_DEMO_DATE, -29) : period === "month" ? "2026-10-01" : from;
  const end = period === "custom" ? to : USAGE_DEMO_DATE;
  const invalid = !/^\d{4}-\d{2}-\d{2}$/.test(start || "") || !/^\d{4}-\d{2}-\d{2}$/.test(end || "") || start > end;
  return { start, end, invalid };
}
export function createUsageRangeRecords(seeds) {
  const rows = [];
  for (let day = 0; day < 38; day++) {
    const date = shiftDate("2026-09-01", day);
    seeds.forEach((seed, index) => {
      // Deliberately varied, deterministic local samples, never adapter data.
      if ((day + index) % 7 === 0) return;
      const weight = .65 + ((day * 3 + index * 5) % 13) / 10;
      const input = seed.input == null ? null : Math.round(seed.input * weight);
      const output = seed.output == null ? null : Math.round(seed.output * weight);
      const latencyMs = seed.latency === "超时" ? null : Math.round(parseFloat(seed.latency) * 1000 * (.7 + day % 5 / 10));
      const time = `${date} ${String(8 + index).padStart(2, "0")}:00:00`;
      rows.push({ ...seed, id: `req_visual_${date.replaceAll("-", "")}_${index}`, time, input, output, tokens: input == null || output == null ? null : input + output,
        cost: seed.cost == null ? null : seed.cost * weight, latencyMs, latency: latencyMs == null ? "超时" : `${(latencyMs / 1000).toFixed(2)} 秒`,
        modelType: types[(index + day % 3) % types.length], savingsFactor: .12 + day % 6 * .025,
        attempts: (seed.attempts || []).map((attempt) => ({ ...attempt, tokens: input == null || output == null ? "未知" : input + output, cost: seed.cost == null ? "未知" : seed.cost * weight, latency: latencyMs == null ? "超时" : `${(latencyMs / 1000).toFixed(2)} 秒` })) });
    });
  }
  const monthlyCost = rows.filter((row) => row.time.startsWith("2026-10")).reduce((sum, row) => sum + (row.cost ?? 0), 0);
  const scale = 243.5 / monthlyCost;
  return rows.map((row) => ({ ...row, cost: row.cost == null ? null : Math.round(row.cost * scale * 1e6) / 1e6,
    attempts: row.attempts.map((attempt) => ({ ...attempt, cost: typeof attempt.cost === "number" ? `$${(attempt.cost * scale).toFixed(4)}` : attempt.cost })) }));
}
export function aggregateUsageTrend(rows, period = "按天") {
  const buckets = new Map();
  for (const row of rows) {
    let date = row.time.slice(0, 10);
    if (period === "按月") date = `${date.slice(0, 7)}-01`;
    if (period === "按周") { const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); date = shiftDate(date, -(weekday + 6) % 7); }
    const bucket = buckets.get(date) || { time: date, requestCount: 0, inputTokens: null, outputTokens: null, knownCost: null };
    bucket.requestCount++;
    if (row.input != null) bucket.inputTokens = (bucket.inputTokens ?? 0) + row.input;
    if (row.output != null) bucket.outputTokens = (bucket.outputTokens ?? 0) + row.output;
    if (row.cost != null) bucket.knownCost = (bucket.knownCost ?? 0) + row.cost;
    buckets.set(date, bucket);
  }
  return [...buckets.values()].sort((a, b) => a.time.localeCompare(b.time));
}
export function projectUsageRange(rows, window, filters = {}) {
  const dateRows = window.invalid ? [] : rows.filter((row) => row.time.slice(0, 10) >= window.start && row.time.slice(0, 10) <= window.end);
  const records = filterUsagePreviewRows(dateRows, filters).sort((a, b) => b.time.localeCompare(a.time));
  const known = records.filter((row) => row.cost != null);
  const knownCost = known.length ? known.reduce((sum, row) => sum + row.cost, 0) : records.length ? null : 0;
  const successful = records.filter((row) => ["成功", "重试后成功"].includes(row.status));
  const latencies = records.filter((row) => row.latencyMs != null);
  const tokenRows = records.filter((row) => row.tokens != null);
  const seconds = new Map();
  const heat = Array.from({ length: 7 }, () => Array(12).fill(0));
  for (const row of records) { seconds.set(row.time, (seconds.get(row.time) || 0) + 1); heat[(new Date(`${row.time.slice(0, 10)}T00:00:00Z`).getUTCDay() + 6) % 7][Math.floor(Number(row.time.slice(11, 13)) / 2)]++; }
  const groupCosts = (key) => {
    const groups = new Map();
    for (const row of known) { const name = row[key]; const group = groups.get(name) || { name, cost: 0, requests: 0 }; group.cost += row.cost; group.requests++; groups.set(name, group); }
    return [...groups.values()].sort((a, b) => b.cost - a.cost).map((item, index) => ({ ...item, share: knownCost > 0 ? item.cost / knownCost * 100 : 0, color: colors[index % colors.length] }));
  };
  return { records, alertCount: records.filter((row) => row.status === "失败" || row.status === "重试后成功").length, summary: { requestCount: records.length, successCount: successful.length, failureCount: records.length - successful.length,
    totalTokens: tokenRows.length ? tokenRows.reduce((sum, row) => sum + row.tokens, 0) : records.length ? null : 0,
    knownCost, unknownCostCount: records.length - known.length, averageCost: known.length ? knownCost / known.length : null,
    averageLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, row) => sum + row.latencyMs, 0) / latencies.length) : null,
    peakQps: records.length ? Math.max(...seconds.values()) : 0, savings: known.length ? known.reduce((sum, row) => sum + row.cost * row.savingsFactor, 0) : null,
    successRate: records.length ? successful.length / records.length * 100 : null }, providerCosts: groupCosts("provider"), modelCosts: groupCosts("model"), modelTypes: groupCosts("modelType"),
    hourlyHeat: heat, alerts: records.filter((row) => row.status === "失败" || row.status === "重试后成功").slice(0, 2).map((row) => ({ model: row.model, text: row.status === "失败" ? "调用失败，费用待确认" : "发生重试，费用待确认", time: row.time.slice(5, 16), level: row.status === "失败" ? "高" : "中" })), trend: aggregateUsageTrend(records) };
}
