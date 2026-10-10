import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowsClockwise, CalendarBlank, CaretDown, CheckCircle, DownloadSimple, Eye, Info, Lightning, MagnifyingGlass, Pulse, Stack, WarningCircle, X, CurrencyDollar, Clock, ChartLine, Leaf, ShieldCheck, Graph, Database } from "@phosphor-icons/react";
import { modelQuotaAdapter } from "./modelQuotaAdapter.js";
import { buildPreviewFilters, clampUsagePreviewPage, filterUsagePreviewRows, isUsageCostRequestId, loadUsagePreviewSnapshot, projectUsagePreviewDetail, projectUsagePreviewRecord, USAGE_PREVIEW_PAGE_SIZE } from "./usageCostPreviewState.js";
import { getKnownCostShares, projectUsageDashboardKpis } from "./usageCostDashboard.js";
import { projectUsageChartPosition, USAGE_CHART_GRIDLINES } from "./usageCostChartGeometry.js";
import { AiVisualFixtureNotice, getAiVisualFixtureData } from "./aiVisualFixtureProvider.jsx";
import "../../styles.css";
import "./ai-feature.css";
import "./ai-visual-overrides.css";
import "./ai-visual-qa-fixes.css";
import "./usage-cost-preview.css";
import "./usage-cost-baseline-fix.css";
import { UsageRequestDetail } from "./UsageRequestDetail.jsx";
import "./usage-request-detail.css";
import { createUsageRangeRecords, projectUsageRange, usageDateWindow, aggregateUsageTrend, USAGE_BUDGET_KEY } from "./usageCostRangeFixture.js";
import { UsageBudgetDialog } from "./UsageBudgetDialog.jsx";

import "./usage-budget-dialog.css";

const providers = ["全部 Provider", "OpenAI", "DeepSeek", "Anthropic", "Google", "Other"];
const compactNumber = (value) => value == null ? "未知" : new Intl.NumberFormat("zh-CN").format(value);
const costText = (row) => row.costState === "未知" || row.cost == null ? "未知" : `$${row.cost.toFixed(4)}`;
const rangeOptions = ["今天", "近 7 天", "近 30 天", "本月", "自定义"];
const previewStates = ["默认", "加载中", "空数据", "读取失败", "权限不足", "未知成本"];
const modelTypeLabels = { "RPA Planner": "自动化规划", "RPA Worker": "自动化执行", "Chat Assistant": "对话助手", "Data Analysis": "数据分析", Others: "其他" };

export function UsageCostPreview({ readAdapter = modelQuotaAdapter } = {}) {
  const visualFixture = getAiVisualFixtureData("usage");
  const fixtureRecords = useMemo(() => visualFixture ? createUsageRangeRecords(visualFixture.records) : [], [visualFixture]);
  const [previewState, setPreviewState] = useState("默认");
  const [provider, setProvider] = useState("全部 Provider");
  const [model, setModel] = useState("");
  const [worker, setWorker] = useState("");
  const [runtime, setRuntime] = useState("");
  const [task, setTask] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("2026-10-01");
  const [dateTo, setDateTo] = useState("2026-10-08");
  const [range, setRange] = useState(visualFixture ? "本月" : "近 30 天");
  const [chartPeriod, setChartPeriod] = useState("按天");
  const [breakdownBy, setBreakdownBy] = useState("provider");
  const [selected, setSelected] = useState(null);
  const [detailState, setDetailState] = useState({ status: "idle", code: null });
  const [notice, setNotice] = useState("");
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [fixtureBudget, setFixtureBudget] = useState(() => {
    try { const amount = Number(localStorage.getItem(USAGE_BUDGET_KEY)); return amount > 0 && Number.isFinite(amount) ? amount : 500; } catch { return 500; }
  });
  const exportInFlight = useRef(false);
  const [page, setPage] = useState(1);
  const [snapshot, setSnapshot] = useState({ state: "loading", source: "LOCAL_MOCK" });
  const [requestKey, setRequestKey] = useState(0);
  const rangeIndex = rangeOptions.indexOf(range);
  const activeRange = rangeIndex === 1 ? "7d" : rangeIndex === 2 ? "30d" : rangeIndex === 3 ? "month" : rangeIndex === 4 ? "custom" : "today";
  const dateWindow = useMemo(() => usageDateWindow(activeRange, dateFrom, dateTo), [activeRange, dateFrom, dateTo]);
  const fixtureView = useMemo(() => projectUsageRange(fixtureRecords, dateWindow, { provider: provider === providers[0] ? "" : provider, model, worker, runtime, task, status: statusFilter, unknownCostsOnly: previewState === "未知成本" }), [fixtureRecords, dateWindow, provider, model, worker, runtime, task, statusFilter, previewState]);
  const fixtureMonth = useMemo(() => projectUsageRange(fixtureRecords, usageDateWindow("month")), [fixtureRecords]);
  const dashboardFixture = visualFixture ? fixtureView : { summary: {}, providerCosts: [], modelCosts: [], modelTypes: [], trend: [], hourlyHeat: [], budget: {}, alerts: [] };
  const filters = useMemo(() => ({ period: activeRange, dateFrom: activeRange === "custom" ? dateFrom : undefined, dateTo: activeRange === "custom" ? dateTo : undefined, providerId: undefined, search: provider === providers[0] ? undefined : provider, modelId: model, workerId: worker, runtimeId: runtime, taskId: task, status: statusFilter || undefined }), [activeRange, dateFrom, dateTo, provider, model, worker, runtime, task, statusFilter]);
  const injected = Boolean(visualFixture) || snapshot.state === "ready" || snapshot.state === "empty";
  useEffect(() => {
    let current = true;
    if (visualFixture) {
      const dashboard = fixtureView;
      setSnapshot({ state: "ready", source: "VISUAL_QA_ONLY", total: dashboard.records.length, page, pageSize: USAGE_PREVIEW_PAGE_SIZE, pageCount: Math.ceil(dashboard.records.length / USAGE_PREVIEW_PAGE_SIZE), windowLimitReached: false,
        summary: dashboard.summary,
        trends: dashboard.trend, breakdowns: { provider: dashboard.providerCosts.map((item) => ({ key: item.name, knownCost: item.cost, requestCount: item.requests })), model: dashboard.modelCosts.map((item) => ({ key: item.name, knownCost: item.cost })) }, records: [] });
      return () => { current = false; };
    }
    setSnapshot((old) => ({ ...old, state: "loading" }));
    loadUsagePreviewSnapshot(readAdapter, filters, page, USAGE_PREVIEW_PAGE_SIZE).then((next) => { if (current) setSnapshot(next); });
    return () => { current = false; };
  }, [readAdapter, filters, page, requestKey, visualFixture, fixtureView]);
  useEffect(() => {
    if (!injected) return;
    const clampedPage = clampUsagePreviewPage(page, snapshot.total, USAGE_PREVIEW_PAGE_SIZE);
    if (clampedPage !== page) setPage(clampedPage);
  }, [injected, page, snapshot.total]);
  useEffect(() => { setPage(1); }, [activeRange, provider, model, worker, runtime, task, statusFilter, dateFrom, dateTo]);
  const budget = snapshot.budget || { status: "UNKNOWN", limit: null, used: null, usedKnown: false, percent: null, source: snapshot.source === "LOCAL_MOCK" ? "LOCAL_MOCK" : "NOT_CONNECTED", ranking: { state: "NOT_PROVIDED", items: [] } };
  const statusClass = (status) => ["FAILED", "ERROR", "TIMEOUT", "失败"].includes(status) ? "failed" : ["RETRIED", "RETRY_SUCCESS", "重试后成功"].includes(status) ? "retried" : "success";
  const statusText = (status) => ({ SUCCESS: "成功", FAILED: "失败", ERROR: "失败", TIMEOUT: "超时", RETRIED: "重试中", RETRY_SUCCESS: "重试后成功" }[status] || status || "未知");
  const costStateText = (state) => state === "UNKNOWN" ? "未知" : state === "NEED_VERIFY" ? "待核验" : state || "未知";
  const snapshotRows = visualFixture ? fixtureView.records : injected ? snapshot.records.map(projectUsagePreviewRecord) : [];
  const displayRows = snapshotRows;
  const trendItems = visualFixture ? aggregateUsageTrend(fixtureView.records, chartPeriod) : injected ? snapshot.trends.slice(-12) : [];
  const dashboardMetrics = visualFixture
    ? dashboardFixture.summary
    : injected ? projectUsageDashboardKpis(snapshot.summary || {}, { injected: true, unknownMode: previewState === "未知成本" }) : { requestCount: null, successCount: null, failureCount: null, totalTokens: null, knownCost: null, unknownCostCount: null, averageCost: null, averageLatencyMs: null, peakQps: null, savings: null };
  const chartSeries = trendItems;
  const trendCallsMax = Math.max(1, ...chartSeries.map((item) => item.requestCount || 0));
  const trendUsageMax = Math.max(1, ...chartSeries.flatMap((item) => [item.requestCount, item.inputTokens, item.outputTokens]).filter((value) => typeof value === "number" && Number.isFinite(value)));
  const trendCostMax = Math.max(1, ...chartSeries.map((item) => item.knownCost).filter((value) => typeof value === "number" && Number.isFinite(value)));
  const chartX = (index) => chartSeries.length < 2 ? 450 : 58 + index * (784 / (chartSeries.length - 1));
  const chartY = (value, max) => projectUsageChartPosition(value, max).y;
  const trendPath = (key, max) => {
    let active = false;
    return chartSeries.map((item, index) => {
      const value = item[key];
      if (typeof value !== "number" || !Number.isFinite(value)) { active = false; return ""; }
      const point = `${active ? "L" : "M"}${chartX(index).toFixed(1)},${chartY(value, max).toFixed(1)}`;
      active = true;
      return point;
    }).filter(Boolean).join(" ");
  };
  const trendLabel = (value) => {
    if (typeof value !== "string" || value === "UNKNOWN") return "UNKNOWN";
    if (/^\d{2}-\d{2}$/.test(value)) return value;
    return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(5, 10) : "未知";
  };
  const formatUsd = (value, digits = 2) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? `$${value.toFixed(digits)}` : "未知";
  const colorForProvider = (name) => dashboardFixture.providerCosts.find((item) => item.name === name)?.color || "#9aaec2";
  const providerRows = visualFixture ? [...dashboardFixture.providerCosts] : injected
    ? (snapshot.breakdowns?.provider || []).map((item) => ({ name: item.key, cost: item.knownCost, requests: item.requestCount, color: colorForProvider(item.key) })) : [];
  const providerShares = getKnownCostShares(providerRows);
  const providerCostTotal = providerShares.reduce((sum, item) => sum + item.cost, 0);
  let providerAngle = 0;
  const providerDonutGradient = providerShares.length
    ? `conic-gradient(${providerShares.map((item) => { const start = providerAngle; providerAngle += item.share * 3.6; return `${item.color} ${start.toFixed(2)}deg ${providerAngle.toFixed(2)}deg`; }).join(",")})`
    : "conic-gradient(#284665 0deg 360deg)";
  const modelRankColors = ["#1598ef", "#15c79a", "#8c62f4", "#f5a637", "#ef5b6e", "#9aaec2"];
  const modelRankRows = visualFixture ? [...dashboardFixture.modelCosts] : injected
    ? (snapshot.breakdowns?.model || []).filter((item) => item.knownCost != null).map((item, index) => ({ name: item.key, cost: item.knownCost, share: null, color: modelRankColors[index % modelRankColors.length] })) : [];
  const modelRankMax = Math.max(1, ...modelRankRows.map((item) => item.cost));
  let typeAngle = 0;
  const typeDonutGradient = dashboardFixture.modelTypes.length ? `conic-gradient(${dashboardFixture.modelTypes.map((item) => { const start = typeAngle; typeAngle += item.share * 3.6; return `${item.color} ${start.toFixed(2)}deg ${typeAngle.toFixed(2)}deg`; }).join(",")})` : "conic-gradient(#284665 0deg 360deg)";
  const budgetLimit = visualFixture ? fixtureBudget : injected ? budget.limit : null;
  const budgetUsed = visualFixture ? fixtureMonth.summary.knownCost : injected ? budget.used : null;
  const budgetPercent = visualFixture ? budgetUsed / budgetLimit * 100 : injected ? budget.percent : budgetUsed == null ? null : budgetUsed / budgetLimit * 100;
  const budgetRemaining = budgetLimit != null && budgetUsed != null ? Math.max(0, budgetLimit - budgetUsed) : null;
  const budgetEstimate = visualFixture ? budgetUsed / 8 * 31 : null;
  const visibleRows = useMemo(() => filterUsagePreviewRows(displayRows, {
    provider: provider === providers[0] ? "" : provider,
    model,
    worker,
    runtime,
    task,
    status: statusFilter,
    unknownCostsOnly: previewState === "未知成本",
  }), [displayRows, provider, model, worker, runtime, task, statusFilter, previewState]);
  const pagedRows = visualFixture ? visibleRows.slice((page - 1) * USAGE_PREVIEW_PAGE_SIZE, page * USAGE_PREVIEW_PAGE_SIZE) : visibleRows;
  const breakdownRows = useMemo(() => {
    if (injected) {
      const rows = snapshot.breakdowns?.[breakdownBy];
      if (!Array.isArray(rows)) return [];
      return rows.filter((item) => item.knownCost != null).map((item) => ({ name: item.key, cost: item.knownCost, count: item.requestCount ?? 0, dimension: breakdownBy }));
    }
    const labels = { provider: "Provider", model: "模型", worker: "Worker", runtime: "Runtime", task: "Task" };
    const groups = new Map();
    for (const row of visibleRows) {
      if (row.cost == null || previewState === "未知成本") continue;
      const name = row[breakdownBy];
      const group = groups.get(name) || { name, cost: 0, count: 0 };
      group.cost += row.cost; group.count += 1; groups.set(name, group);
    }
    return [...groups.values()].sort((left, right) => right.cost - left.cost).slice(0, 5).map((item) => ({ ...item, dimension: labels[breakdownBy] }));
  }, [breakdownBy, visibleRows, previewState, injected, snapshot]);

  const refresh = () => { if (snapshot.source === "INJECTED_READ_DTO" || snapshot.source === "INJECTED_READ_TRANSPORT") { setRequestKey((value) => value + 1); return; } setPreviewState(previewStates[1]); setNotice("Local preview refreshed; no API or Provider call."); window.setTimeout(() => setPreviewState(previewStates[0]), 650); };
  const exportCsv = async () => {
    if (visualFixture) { setNotice("本地视觉预览不会导出或读取真实 CSV。"); return; }
    if (snapshot.source !== "INJECTED_READ_DTO" || typeof readAdapter.exportUsageCostCsv !== "function") { setNotice("CSV export is unavailable while the read adapter is NOT_CONNECTED; local mock rows were not exported."); return; }
    if (exportInFlight.current) { setNotice("CSV export is already in progress."); return; }
    exportInFlight.current = true;
    try {
      const result = await readAdapter.exportUsageCostCsv(buildPreviewFilters(filters));
      if (typeof result?.csv !== "string") throw Object.assign(new Error("Missing CSV text."), { code: "AI_USAGE_COST_BAD_CSV" });
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = href; anchor.download = "ai-usage-cost.csv"; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(href), 0);
      setNotice("CSV exported from the injected candidate read DTO; source is not production-verified.");
    } catch (error) { setNotice(`CSV export failed (${typeof error?.code === "string" ? error.code : "AI_USAGE_COST_EXPORT_FAILED"}); local preview remains available.`); }
    finally { exportInFlight.current = false; }
  };
  const clearFilters = () => { setProvider("全部 Provider"); setModel(""); setWorker(""); setRuntime(""); setTask(""); setStatusFilter(""); setDateFrom("2026-09-02"); setDateTo("2026-10-01"); setRange("近 30 天"); setPreviewState("默认");  setPage(1);};
  const openRecord = async (row) => {
    setSelected(row); setDetailState({ status: "idle", code: null });
    if (!injected || !isUsageCostRequestId(row.id) || typeof readAdapter.getUsageCostRecordDetail !== "function") return;
    setDetailState({ status: "loading", code: null });
    try {
      const detail = await readAdapter.getUsageCostRecordDetail(row.id);
      setSelected((current) => current?.id === row.id ? projectUsagePreviewDetail(row, detail) : current);
      setDetailState({ status: "ready", code: null });
    } catch (error) {
      setDetailState({ status: "error", code: typeof error?.code === "string" ? error.code : "AI_USAGE_COST_DETAIL_FAILED" });
    }
  };

  return (
    <div className={`ai-feature usage-cost-preview${visualFixture ? " is-visual-fixture" : ""}`}>
      <AiVisualFixtureNotice />
      <main className="usage-main">
        <header className="usage-heading">
          <div className="usage-title-block">
            <h1>用量与成本</h1>
            <p>查看 AI 模型使用情况、Token 消耗和成本，帮助优化资源使用与预算。</p>
            <span className={`usage-source-pill ${injected ? "is-connected" : "is-mock"}`} role="status">
              {visualFixture ? "本地视觉样例 · 不代表真实 API/DB" : injected ? "候选读取 DTO · NOT_CONNECTED 线上身份未验证" : "UNKNOWN · 未读取业务数据"}
            </span>
          </div>
          <div className="usage-heading-tools">
            <div className="usage-range-switch" role="group" aria-label="时间范围">
              {rangeOptions.map((option) => <button key={option} type="button" aria-pressed={range === option} className={range === option ? "is-active" : ""} onClick={() => setRange(option)}>{option}</button>)}
            </div>
            {range === "自定义" && <div className="usage-custom-dates">
              <label>开始日期 UTC<input type="date" value={dateFrom} onInput={(event) => setDateFrom(event.currentTarget.value)} onChange={(event) => setDateFrom(event.target.value)} /></label>
              <label>结束日期 UTC<input type="date" value={dateTo} onInput={(event) => setDateTo(event.currentTarget.value)} onChange={(event) => setDateTo(event.target.value)} /></label>
            </div>}
            <button type="button" className="usage-refresh" onClick={refresh}><ArrowsClockwise size={15}/>刷新</button>
            <button type="button" className="usage-primary" onClick={exportCsv}><DownloadSimple size={15}/>导出数据</button>
            <label className="usage-state-picker">预览状态<select aria-label="预览状态" value={previewState} onChange={(event) => { setPreviewState(event.target.value); setNotice(""); }}>
              {previewStates.map((state) => <option key={state}>{state}</option>)}
            </select><CaretDown size={12}/></label>
          </div>
        </header>

        {notice && <div className="usage-notice" role="status">{notice}</div>}
        {visualFixture && dateWindow.invalid && <div className="usage-date-error" role="alert">开始日期不能晚于结束日期，请填写有效日期。</div>}
        {visualFixture && !dateWindow.invalid && !fixtureView.records.length && <div className="usage-range-empty" role="status">当前时间范围没有请求记录，请调整日期或筛选条件。</div>}

        {previewState === "读取失败" ? <section className="usage-state usage-error" role="alert"><b><WarningCircle size={18}/>用量读取失败</b><span>本地模拟：请求超时，数据状态未确认；不会将未知成本记为零。</span><button onClick={refresh}>重试演示</button><small>NETWORK_TIMEOUT · LOCAL MOCK · 真实服务状态未验证</small></section>
          : previewState === "权限不足" ? <section className="usage-state usage-denied" role="alert"><b><WarningCircle size={18}/>权限不足状态预览</b><span>当前页面没有真实账号或角色信息。本状态仅用于检查提示，不代表已验证你的权限。</span><button onClick={() => setPreviewState("默认")}>返回预览数据</button><small>PERMISSION_DENIED · LOCAL MOCK</small></section>
          : previewState === "加载中" ? <section className="usage-skeleton" aria-label="加载中"><i/><i/><i/><i/><p>正在载入用量摘要、趋势与记录……</p></section>
          : previewState === "空数据" ? <section className="usage-state usage-empty"><b>当前筛选没有请求记录</b><span>调整时间范围或清除筛选条件后再查看。</span><button onClick={clearFilters}>清除筛选条件</button></section>
          : <>
            <section className="usage-kpis" aria-label="用量与成本摘要">
              {[
                { label: "总调用量", value: compactNumber(dashboardMetrics.requestCount), note: injected ? "当前筛选范围" : "↑ 12%　上月 114,230", icon: <Pulse size={21}/>, tone: "blue" },
                { label: "成功调用", value: compactNumber(dashboardMetrics.successCount), note: dashboardMetrics.successRate == null ? "成功率 UNKNOWN" : `成功率 ${dashboardMetrics.successRate.toFixed(1)}%`, icon: <CheckCircle size={21}/>, tone: "green" },
                { label: "Token 消耗", value: compactNumber(dashboardMetrics.totalTokens), note: injected ? "输入 + 输出 Token" : "↑ 8%　上月 825,430", icon: <Stack size={21}/>, tone: "cyan" },
                { label: "总成本 (USD)", value: formatUsd(dashboardMetrics.knownCost), note: "仅已知成本小计", icon: <DownloadSimple size={21}/>, tone: "green" },
                { label: "平均单次成本", value: formatUsd(dashboardMetrics.averageCost, 4), note: "仅完整已知请求可计算", icon: <Info size={21}/>, tone: "purple" },
                { label: "平均延迟", value: dashboardMetrics.averageLatencyMs == null ? "未知" : `${compactNumber(dashboardMetrics.averageLatencyMs)} ms`, note: "当前读取契约未提供均值", icon: <CalendarBlank size={21}/>, tone: "blue" },
                { label: "峰值 QPS", value: dashboardMetrics.peakQps == null ? "未知" : compactNumber(dashboardMetrics.peakQps), note: "当前读取契约未提供", icon: <Lightning size={21}/>, tone: "purple" },
                { label: "节省成本", value: formatUsd(dashboardMetrics.savings), note: injected ? "当前读取契约未提供" : "↑ 40%　相对按量计费", icon: <CheckCircle size={21}/>, tone: "green" },
              ].map((metric) => <article className={`usage-kpi usage-kpi-${metric.tone}`} key={metric.label}>
                <span className="usage-kpi-icon" aria-hidden="true">{visualFixture ? ({ "总调用量": <Graph size={27}/>, "成功调用": <ShieldCheck size={27}/>, "Token 消耗": <Database size={27}/>, "总成本 (USD)": <CurrencyDollar size={27}/>, "平均单次成本": <ChartLine size={27}/>, "平均延迟": <Clock size={27}/>, "峰值 QPS": <ChartLine size={27}/>, "节省成本": <Leaf size={27}/> }[metric.label]) : metric.icon}</span><div><small>{metric.label}</small><strong>{metric.value}</strong><span>{visualFixture ? (metric.label === "成功调用" ? (dashboardMetrics.successRate == null ? "暂无调用" : `成功率 ${dashboardMetrics.successRate.toFixed(1)}%`) : metric.label === "平均单次成本" ? "仅统计已知费用请求" : metric.label === "总成本 (USD)" ? `已知费用 · ${dashboardMetrics.unknownCostCount}条费用未知` : "当前所选时间范围") : metric.note}</span></div>
              </article>)}
            </section>

            <div className="usage-dashboard-grid">
            <div className="usage-dashboard-main">
            <section className="usage-analytics" aria-label="用量和成本分析">
              <article className="usage-panel usage-trend">
                <header><div><h2>调用量与成本走势</h2><p>每日请求量、Token 消耗与已知成本 · UTC</p></div><label className="usage-chart-period">{!visualFixture && "周期"}<select aria-label="走势周期" value={visualFixture ? chartPeriod : range} onChange={(event) => visualFixture ? setChartPeriod(event.target.value) : setRange(event.target.value)}>{(visualFixture ? ["按天", "按周", "按月"] : rangeOptions).map((option) => <option key={option}>{option}</option>)}</select></label></header>
                <div className="usage-chart-legend"><span><i className="legend-calls"/>调用量{visualFixture && `（0–${trendCallsMax}次）`}</span><span><i className="legend-input"/>输入 Token</span><span><i className="legend-output"/>输出 Token</span><span><i className="legend-cost"/>成本 (USD)</span>{dashboardMetrics.unknownCostCount > 0 && <span className="legend-unknown"><i/>未知成本 {compactNumber(dashboardMetrics.unknownCostCount)}</span>}</div>
                <div className="usage-chart-grid">
                  <div className="chart-y-axis"><span>{compactNumber(trendUsageMax)}</span><span>{compactNumber(trendUsageMax * .75)}</span><span>{compactNumber(trendUsageMax * .5)}</span><span>{compactNumber(trendUsageMax * .25)}</span><span>0</span></div>
                  <div className="chart-svg-wrap"><svg className="usage-combo-chart" viewBox="0 0 900 220" preserveAspectRatio="none" role="img" aria-label="每日调用量、Token 和已知成本趋势">
                    {USAGE_CHART_GRIDLINES.map((y) => <line key={y} x1="58" x2="842" y1={y} y2={y} className="chart-grid-line"/>)}
                    {chartSeries.map((item, index) => { const value = item.requestCount; if (value == null) return null; const x = chartX(index); const bar = projectUsageChartPosition(value, visualFixture ? trendCallsMax : trendUsageMax); return <rect key={`bar-${index}`} x={x - 8} y={bar.y} width="16" height={bar.height} rx="2" className="chart-call-bar"><title>{trendLabel(item.time)} · {value}次调用</title></rect>; })}
                    <path d={trendPath("inputTokens", trendUsageMax)} className="chart-series chart-series-input"/>
                    <path d={trendPath("outputTokens", trendUsageMax)} className="chart-series chart-series-output"/>
                    <path d={trendPath("knownCost", trendCostMax)} className="chart-series chart-series-cost"/>
                    {chartSeries.map((item, index) => <g key={`points-${index}`}>
                      {item.inputTokens != null && <circle cx={chartX(index)} cy={chartY(item.inputTokens, trendUsageMax)} r="3.2" className="chart-point-input"/>}
                      {item.outputTokens != null && <circle cx={chartX(index)} cy={chartY(item.outputTokens, trendUsageMax)} r="3.2" className="chart-point-output"/>}
                      {item.knownCost != null && <circle cx={chartX(index)} cy={chartY(item.knownCost, trendCostMax)} r="3.2" className="chart-point-cost"/>}
                     </g>)}
                    {!chartSeries.length && <text x="450" y="105" textAnchor="middle" className="chart-empty-label">当前范围暂无趋势数据</text>}
                   </svg><div className="usage-chart-xaxis" aria-label="日期刻度">{chartSeries.map((item, index) => chartSeries.length <= 12 || index % Math.ceil(chartSeries.length / 10) === 0 || index === chartSeries.length - 1 ? <span key={`date-${index}`} style={{ left: `${chartX(index) / 900 * 100}%` }}>{trendLabel(item.time)}</span> : null)}</div></div>
                  <div className="chart-right-axis"><span>${trendCostMax.toFixed(2)}</span><span>${(trendCostMax * .75).toFixed(0)}</span><span>${(trendCostMax * .5).toFixed(0)}</span><span>${(trendCostMax * .25).toFixed(0)}</span><span>$0</span></div>
                </div>
                <footer>未知成本不记为零；实际成本口径以读取 DTO 的 KNOWN 标记为准。</footer>
              </article>

              <article className="usage-panel usage-provider-panel">
                <header><div><h2>Provider 成本构成</h2><p>仅统计有成本值的项目 · USD</p></div><label>周期<select value={range} onChange={(event) => setRange(event.target.value)}>{rangeOptions.map((option) => <option key={option}>{option}</option>)}</select></label></header>
                <div className="usage-donut-layout">
                  {providerShares.length ? <div className="usage-donut" style={{ background: providerDonutGradient }} role="img" aria-label="Provider 已知成本分布">
                    <span><small>已知成本</small><strong>{formatUsd(dashboardMetrics.knownCost)}</strong></span>
                  </div> : <div className="usage-donut usage-donut-unknown"><span><small>已知成本</small><strong>{formatUsd(dashboardMetrics.knownCost)}</strong></span></div>}
                  <ul className="usage-share-list">{providerShares.map((item) => <li key={item.name}><span className="share-dot" style={{ backgroundColor: item.color }}/><span className="share-name">{item.name}</span><b>{item.share.toFixed(1)}%</b><strong>{formatUsd(item.cost)}</strong></li>)}{!providerShares.length && <li className="usage-share-empty">当前范围暂无已知费用</li>}</ul>
                </div>
                <footer>未知成本不参与构成百分比；真实 Provider 费用读取 NOT_CONNECTED。</footer>
              </article>

              
            </section>

            <section className="usage-secondary-grid" aria-label="成本分布细分">
              <article className="usage-panel usage-model-ranking">
                <header><div><h2>各模型成本排行</h2><p>已知成本小计 · USD</p></div><label>排序<select value="cost-desc" onChange={() => {}}><option value="cost-desc">按成本</option></select></label></header>
                {visualFixture && <div className="usage-ranking-head"><span>模型</span><span>成本占比</span><span>成本 (USD)</span></div>}
                {modelRankRows.length ? <div className="usage-model-list">{modelRankRows.slice(0, 6).map((item, index) => <div key={item.name}><span>{item.name}</span><i><b style={{ width: `${Math.max(4, item.cost / modelRankMax * 100)}%`, background: item.color || modelRankColors[index % modelRankColors.length] }}/></i><strong>{formatUsd(item.cost)}</strong><small>{item.share == null ? `${index + 1}` : `${item.share.toFixed(1)}%`}</small></div>)}</div> : <div className="usage-unavailable">当前范围暂无已知模型费用</div>}
                <footer>当前数据源：{injected ? "候选 DTO" : "本地合成样例"}；未知成本已排除。</footer>
              </article>

              <article className="usage-panel usage-heatmap-panel">
                <header><div><h2>分时段用量热力图</h2><p>本地合成分布 · 真实小时维度 NOT_PROVIDED</p></div><span className="usage-demo-tag">{injected ? "NOT_PROVIDED" : "合成样例"}</span></header>
                {visualFixture ? <><div className="usage-heatmap-legend" aria-label="视觉样例热度由低到高"><span>低</span>{[0,1,2,3,4].map((level) => <i key={level} data-level={level}/>)}<span>高</span></div><div className="usage-heatmap"><div className="heatmap-days">{["周一","周二","周三","周四","周五","周六","周日"].map((day) => <span key={day}>{day}</span>)}</div><div className="heatmap-cells">{dashboardFixture.hourlyHeat.flatMap((row, day) => row.map((level, hour) => <i key={`${day}-${hour}`} data-level={level === 0 ? 0 : Math.min(4, Math.ceil(level / Math.max(1, ...dashboardFixture.hourlyHeat.flat()) * 4))} title={`${["周一","周二","周三","周四","周五","周六","周日"][day]} ${hour * 2}:00 · ${level}次调用 · 视觉样例`}/>))}</div><div className="heatmap-hours">{["00:00","04:00","08:00","12:00","16:00","20:00"].map((hour) => <span key={hour}>{hour}</span>)}</div></div></> : <div className="usage-unavailable">小时级请求分布 UNKNOWN<br/>读取契约未提供该维度，不填充实时热度。</div>}
              </article>

              <article className="usage-panel usage-type-panel">
                <header><div><h2>模型类型成本分布</h2><p>类型分类未在候选读取 DTO 中提供</p></div><span className="usage-demo-tag">{injected ? "NOT_PROVIDED" : "合成样例"}</span></header>
                {visualFixture ? <div className="usage-type-layout"><div className="usage-type-donut" style={{ background: typeDonutGradient }} role="img" aria-label="视觉样例模型类型成本比例"><span><small>样例总成本</small><strong>{formatUsd(dashboardMetrics.knownCost)}</strong></span></div><ul>{dashboardFixture.modelTypes.map((item) => <li key={item.name}><i style={{ backgroundColor: item.color }}/><span>{modelTypeLabels[item.name] || item.name}</span><b>{item.share.toFixed(1)}%</b></li>)}</ul></div> : <div className="usage-unavailable">模型类型成本分布 UNKNOWN<br/>没有可用类型字段或聚合数据。</div>}</article>
            </section>

            </div>
            <article className="usage-panel usage-budget">
                <header><div><h2>预算与成本概览</h2><p>月度预算 (USD)</p></div><button type="button" className="usage-link-button" onClick={() => setBudgetOpen(true)}>设置预算 ›</button></header>
                <div className="usage-budget-total"><small>本月预算</small><b>{formatUsd(budgetLimit)}</b><div className="usage-budget-meter"><i style={{ width: budgetPercent == null ? "0%" : `${Math.min(100, Math.max(0, budgetPercent))}%` }}/></div><span>已使用（已知费用） {formatUsd(budgetUsed)}{budgetPercent == null ? " (UNKNOWN)" : ` (${budgetPercent.toFixed(1)}%)`}</span></div>
                <div className="usage-budget-stats"><div><small>{budgetUsed > budgetLimit ? "超支金额" : "剩余额度"}</small><b>{formatUsd(budgetUsed > budgetLimit ? budgetUsed - budgetLimit : budgetRemaining)}</b><span>{budgetPercent == null ? "UNKNOWN" : `${Math.max(0, 100 - budgetPercent).toFixed(1)}%`}</span></div><div><small>预计本月</small><b>{formatUsd(budgetEstimate)}</b><span>{visualFixture ? `${(budgetEstimate / budgetLimit * 100).toFixed(1)}%` : injected ? "NOT_PROVIDED" : "本地合成样例"}</span></div></div>
                <div className="usage-alerts"><b><WarningCircle size={13}/>异常成本告警 <em>{visualFixture ? dashboardFixture.alertCount : "未知"}</em></b>{visualFixture ? dashboardFixture.alerts.map((alert) => <div key={alert.model}><span><b>{alert.model}</b> {alert.text}<small>{alert.time} · 视觉样例</small></span><em className={alert.level === "高" ? "alert-high" : "alert-medium"}>{alert.level}</em></div>) : <p>当前读取契约未提供成本告警 · NOT_PROVIDED</p>}</div>
                <small className="usage-budget-contract">预算排行 NOT_PROVIDED；不推算 服务商 / 模型额度。</small>
              </article>
            </div>
            <section className="usage-panel usage-records">
              <header className="usage-record-heading"><div><h2>成本明细 <span>{injected ? compactNumber(snapshot.total) : "合成样例"}</span></h2><p>每行是一条请求；追踪字段可展开，详情请点对应记录。</p></div><div className="usage-record-tools">
                <label aria-label="模型筛选"><input value={model} onChange={(event) => setModel(event.target.value)} placeholder="全部模型"/></label>
                <label aria-label="Provider 筛选"><select value={provider} onChange={(event) => setProvider(event.target.value)}>{providers.map((option) => <option key={option}>{option}</option>)}</select></label>
                <label aria-label="状态筛选"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">全部状态</option><option value="SUCCESS">成功</option><option value="FAILED">失败</option><option value="RETRIED">重试</option><option value="TIMEOUT">超时</option></select></label>
                <details className="usage-advanced-filters"><summary>追踪筛选</summary><div className="usage-advanced-fields"><label>Worker ID<input value={worker} onChange={(event) => setWorker(event.target.value)} placeholder="全部 Worker"/></label><label>Runtime ID<input value={runtime} onChange={(event) => setRuntime(event.target.value)} placeholder="全部 Runtime"/></label><label>Task ID<input value={task} onChange={(event) => setTask(event.target.value)} placeholder="全部 Task"/></label></div></details>
                <button type="button" className="usage-filter-clear" onClick={clearFilters}>清除</button>
                <button className="usage-export" onClick={exportCsv}><DownloadSimple size={14}/>CSV</button>
              </div></header>
              <div className="usage-table-wrap"><table><thead><tr><th>日期 (UTC)</th><th>模型</th><th>服务商</th><th>输入 Token</th><th>输出 Token</th><th>调用量</th><th>成本 (USD)</th><th>状态</th><th>平均延迟</th><th>操作</th></tr></thead><tbody>
                {pagedRows.map((row) => <tr key={row.id}><td><time>{row.time}</time><small>{row.id}</small></td><td>{row.model}</td><td><span className="usage-record-provider"><span>{row.provider === "Other" ? "其他" : row.provider}</span></span></td><td>{compactNumber(row.input)}</td><td>{compactNumber(row.output)}</td><td>1</td><td className={row.cost == null ? "amount-unknown" : ""}>{costText(row)}<small>{row.cost == null ? (row.costState || row.source || "UNKNOWN") : "已知成本小计"}</small></td><td><em className={`usage-status ${statusClass(row.status)}`}>{row.status}</em></td><td>{row.latency || "UNKNOWN"}</td><td><button aria-label={`查看 ${row.id} 请求详情`} onClick={() => openRecord(row)}><Eye size={14}/>详情</button></td></tr>)}
              </tbody></table>{visibleRows.length === 0 && <div className="usage-table-empty">没有符合当前筛选条件的记录；未知成本不会被转为 0。</div>}</div>
              <footer className="usage-pagination"><span>{injected ? <>{compactNumber(snapshot.total)} 条请求 · 第 {snapshot.page} 页{snapshot.windowLimitReached && " · 仅前 5,000 条"}</> : <>8 条合成请求示例 · 汇总 KPI 为独立设计样例</>}</span><div><button disabled={!injected || page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button><b>{injected ? snapshot.page : 1}</b><button disabled={!injected || page * USAGE_PREVIEW_PAGE_SIZE >= (snapshot.total || 0)} onClick={() => setPage((value) => value + 1)}>下一页</button></div></footer>
            </section>
            <p className="usage-bottom-contract">真实读取/CSV 仍为 NOT_CONNECTED；当前 UI 保留合成样例。未知 Token、费用、预算、小时分布与模型类型数据不以零代替。</p>
          </>}

        {budgetOpen && <UsageBudgetDialog amount={budgetLimit} editable={Boolean(visualFixture)} onClose={() => setBudgetOpen(false)} onSave={(amount) => { localStorage.setItem(USAGE_BUDGET_KEY, String(amount)); setFixtureBudget(amount); setBudgetOpen(false); setNotice("样例预算已保存"); }} />}
        {selected && <UsageRequestDetail record={selected} detailState={detailState} onClose={() => setSelected(null)} />}
      </main>
    </div>
  );
}








