import React, { useEffect, useMemo, useState } from "react";
import { ArrowsClockwise, CaretRight, Clock, Cube, Lightning, Pulse, Robot, WarningCircle } from "@phosphor-icons/react";
import ProviderLogo from "./ProviderLogo.jsx";
import { modelQuotaAdapter } from "./modelQuotaAdapter.js";
import { AiVisualFixtureNotice, getAiVisualFixtureData } from "./aiVisualFixtureProvider.jsx";
import { formatOverviewValue, projectOverviewModels, projectOverviewSuccessRate, projectOverviewUsage } from "./overviewDashboardModel.js";
import "./overview-page.css";
import "./overview-dashboard.css";
import "./overview-dashboard-a04.css";
import "./overview-dashboard-a01.css";

const PERIODS = ["today", "7d", "30d"];
const METRICS = [
  { key: "models", label: "模型总数", icon: Cube, tone: "blue" },
  { key: "enabled", label: "已启用模型", icon: Lightning, tone: "cyan" },
  { key: "providers", label: "在线 Provider", icon: Pulse, tone: "violet" },
  { key: "requests", label: "今日调用量", icon: Cube, tone: "blue" },
  { key: "success", label: "成功率", icon: Pulse, tone: "teal" },
  { key: "latency", label: "平均延迟", icon: Clock, tone: "cyan" },
  { key: "cost", label: "今日成本", icon: Cube, tone: "violet" },
  { key: "alerts", label: "告警数", icon: WarningCircle, tone: "red" },
];

const metricFoot = {
  models: "来自模型配置读取",
  enabled: "启用状态汇总",
  providers: "按当前模型清单统计",
  requests: "来自用量摘要接口",
  success: "成功 / (成功 + 失败)",
  latency: "当前数据源未提供",
  cost: "未知成本保持未知",
  alerts: "告警数据源未连接",
};

function PanelHeading({ title, caption, href, linkLabel = "查看全部" }) {
  return <div className="ai-overview__panel-heading"><div><h2>{title}</h2>{caption && <p>{caption}</p>}</div>{href && <a className="ai-overview__text-link" href={href}>{linkLabel}<CaretRight size={14} aria-hidden="true" /></a>}</div>;
}

function DemoBadge({ children }) { return <span className="ai-overview__demo-badge">{children}</span>; }

function MetricCard({ label, value, foot, icon: Icon, tone }) {
  return <article className={`ai-overview__kpi ai-overview__kpi--${tone}`}><div className="ai-overview__kpi-icon"><Icon size={22} weight="duotone" aria-hidden="true" /></div><div className="ai-overview__kpi-text"><span>{label}</span><strong>{value}</strong></div><small>{foot}</small></article>;
}

function TrendChart({ items, label }) {
  const catalog = [
    { field: "requestCount", color: "#168fff", label: "总调用量" },
    { field: "successCount", color: "#13c9ac", label: "成功调用" },
    { field: "failureCount", color: "#ed6681", label: "失败调用" },
  ];
  const series = catalog.filter((entry) => items.filter((item) => typeof item[entry.field] === "number").length >= 2);
  return <>
    <div className="ai-overview__trend-chart"><div className="ai-overview__trend-axis" aria-hidden="true">{[0, 1, 2, 3, 4].map((tick) => <span key={tick}>—</span>)}</div><svg viewBox="0 0 300 112" role="img" aria-label={label + "趋势坐标图"} preserveAspectRatio="none"><path d="M14 16H286M14 42H286M14 68H286M14 94H286M14 16V94M150 16V94M286 16V94" className="ai-overview__gridline" />{series.map(({ field, color }) => { const maximum = Math.max(1, ...items.map((item) => item[field]).filter((value) => typeof value === "number")); const coords = items.map((item, index) => typeof item[field] === "number" ? (14 + index * (272 / Math.max(items.length - 1, 1)) + "," + (94 - (item[field] / maximum) * 78)) : null).filter(Boolean).join(" "); return <polyline key={field} points={coords} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />; })}</svg>{series.length === 0 && <span className="ai-overview__trend-empty" role="status">{label}数据暂不可用</span>}<div className="ai-overview__chart-labels"><span>{items[0]?.time || "起始时间未知"}</span><span>{items.at(-1)?.time || "结束时间未知"}</span></div></div>
    <div className="ai-overview__legend">{catalog.map((item) => <span key={item.field}><i className={series.some((entry) => entry.field === item.field) ? "" : "is-unavailable"} style={{ "--series-color": item.color }} />{item.label}</span>)}</div>
  </>;
}
function sumIfComplete(rows, key) {
  const values = rows.map((item) => item[key]);
  return values.length > 0 && values.every((value) => typeof value === "number") ? values.reduce((sum, value) => sum + value, 0) : null;
}

function RequestSourcePanel({ sourceMix = [], visualFixture = false }) {
  const rows = visualFixture ? sourceMix.slice(0, 3) : [["API 调用", "未知"], ["任务中心", "未知"], ["RPA 执行", "未知"]];
  const palette = ["#168fff", "#ffba45", "#13c9ac", "#8b7aff", "#6f8eb4"];
  let offset = 0;
  const slices = visualFixture ? sourceMix.map(([, share], index) => { const start = offset; offset += Number.parseFloat(share) || 0; return `${palette[index % palette.length]} ${start}% ${offset}%`; }).join(", ") : "";
  return <div className="ai-overview__source-unknown"><div className="ai-overview__empty-ring" style={visualFixture ? { background: `conic-gradient(${slices})` } : undefined} aria-label={visualFixture ? "视觉样例请求来源占比" : "请求来源占比未知"} /><ul>{rows.map(([label, share], index) => <li key={label}><i style={visualFixture ? { background: palette[index % palette.length] } : undefined} /> <span>{label}</span><b>{visualFixture ? share : "未知"}</b></li>)}</ul></div>;
}
function DailyCostChart({ rows, knownCost, unknownCount }) {
  const hasKnown = rows.some((row) => typeof row.knownCost === "number");
  return <>
    <div className="ai-overview__cost-trend">{hasKnown ? rows.map((row) => <div className="ai-overview__cost-bar-cell" key={row.time} title={row.time + ": " + (typeof row.knownCost === "number" ? row.knownCost : "未知")}><i className={typeof row.knownCost === "number" ? "" : "is-unknown"} style={typeof row.knownCost === "number" ? { height: Math.max(4, row.knownCost / Math.max(...rows.map((point) => point.knownCost ?? 0), 1) * 100) + "%" } : undefined} /><small>{row.time}</small></div>) : <div className="ai-overview__cost-skeleton" role="status"><svg viewBox="0 0 240 76" preserveAspectRatio="none" aria-hidden="true"><path d="M18 8H236M18 26H236M18 44H236M18 62H236M18 8V62M127 8V62M236 8V62" /></svg><span>成本趋势数据暂不可用</span><div>{[0,1,2,3,4,5,6].map((tick) => <i key={tick}>—</i>)}</div></div>}</div>
    <div className="ai-overview__cost-foot"><span>已知成本</span><b>{formatOverviewValue(knownCost)}</b><span>未知成本记录</span><b>{formatOverviewValue(unknownCount)}</b></div>
  </>;
}
function RoutePanorama({ providers, sourceMix = [], visualFixture = false }) {
  const sourceTypes = ["电商平台", "独立站", "ERP 系统", "客服系统", "其他来源"];
  return <article className="ai-overview__panel ai-overview__route-panel"><PanelHeading title="AI 请求调度全景" caption="请求来源与 Provider 分布概览" href="/ai-center/routing-advice" linkLabel="调度建议" />
    <div className="ai-overview__route-body">
      <div className="ai-overview__sources"><h3>来源类型示意 <DemoBadge>{visualFixture ? "视觉样例" : "占比未知"}</DemoBadge></h3><div className="ai-overview__source-list" aria-label={visualFixture ? "来源类型视觉样例" : "来源类型示意；各来源占比未知"}>{sourceTypes.map((name, index) => <div className="ai-overview__source-row" key={name}><span className={"ai-overview__source-icon ai-overview__source-icon--" + index}><Cube size={13} aria-hidden="true" /></span><span>{name}</span><b>{visualFixture ? sourceMix[index]?.[1] || "—" : "未知"}</b></div>)}</div><small className="ai-overview__unknown-note">{visualFixture ? "合成样例 · 不代表实时请求分布。" : "来源比例数据未接入。"}</small></div>
      <div className="ai-overview__route-visual"><svg className="ai-overview__route-branches" viewBox="0 0 360 132" preserveAspectRatio="none" aria-hidden="true"><g className="ai-overview__route-branch-lines"><path d="M0 12 C72 12 104 88 194 101"/><path d="M0 34 C73 34 108 90 194 101"/><path d="M0 55 C75 55 111 94 194 101"/><path d="M0 77 C75 77 111 108 194 101"/><path d="M0 99 C73 99 108 112 194 101"/><path d="M0 120 C72 120 104 114 194 101"/><path d="M206 101 C256 88 288 12 360 12"/><path d="M206 101 C259 90 287 34 360 34"/><path d="M206 101 C261 94 285 55 360 55"/><path d="M206 101 C261 108 285 77 360 77"/><path d="M206 101 C259 112 287 99 360 99"/><path d="M206 101 C256 114 288 120 360 120"/></g><g className="ai-overview__route-branch-nodes"><circle cx="4" cy="12" r="2.5"/><circle cx="4" cy="34" r="2.5"/><circle cx="4" cy="55" r="2.5"/><circle cx="4" cy="77" r="2.5"/><circle cx="4" cy="99" r="2.5"/><circle cx="4" cy="120" r="2.5"/><circle cx="356" cy="12" r="2.5"/><circle cx="356" cy="34" r="2.5"/><circle cx="356" cy="55" r="2.5"/><circle cx="356" cy="77" r="2.5"/><circle cx="356" cy="99" r="2.5"/><circle cx="356" cy="120" r="2.5"/><circle cx="200" cy="101" r="4"/></g></svg><div className="ai-overview__route-label"><span className="ai-overview__route-core"><Cube size={108} weight="duotone" aria-hidden="true" /></span><b>AI 调度引擎</b></div><small>路由路径示意，不代表实时健康或请求状态。</small></div>
      <div className="ai-overview__model-mix"><h3>Provider / 模型数</h3>{providers.slice(0, 5).map((provider) => <div className="ai-overview__mix-row" key={provider.name}><ProviderLogo provider={provider.name} /><span>{provider.name}</span><b>{formatOverviewValue(provider.modelCount)}</b></div>)}{providers.length === 0 && <p className="ai-overview__unknown-note">Provider 清单尚不可用。</p>}<small>仅汇总当前读到的模型清单</small></div>
    </div>
    <div className="ai-overview__route-note"><Pulse size={15} aria-hidden="true" />Gateway / Router / Runtime / RPA 的在线状态未由本页接口验证。</div>
  </article>;
}
export default function OverviewDashboard() {
  const [period, setPeriod] = useState("today");
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modelPage, setModelPage] = useState(null);
  const [usageResult, setUsageResult] = useState({});
  const [readError, setReadError] = useState(null);
  const visualFixture = getAiVisualFixtureData("overview");
  const modelFixture = getAiVisualFixtureData("modelQuota");

  useEffect(() => {
    let active = true;
    if (visualFixture && modelFixture) {
      const items = modelFixture.models.map((model) => ({
        displayName: model.model, provider: model.provider, enabled: model.enabled, healthStatus: model.healthStatus,
        successRate: model.successRate, averageLatencyMs: model.averageLatencyMs, requestCount: model.requestCount, quotaSummary: model.quotaSummary,
      }));
      const summary = visualFixture.usageSummary;
      const trends = visualFixture.snapshot[period].dates.map((time, index) => ({
        time,
        requestCount: visualFixture.snapshot[period].requests[index],
        successCount: visualFixture.snapshot[period].success[index],
        failureCount: visualFixture.snapshot[period].requests[index] - visualFixture.snapshot[period].success[index],
        knownCost: visualFixture.costs[period][index],
        unknownCostCount: index % 2,
      }));
      setModelPage({ items, total: 24, readMode: "VISUAL_QA_ONLY" });
      setUsageResult({ summary: { summary }, trends: { items }, breakdowns: {} });
      setReadError(null);
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    const dateRange = { period };
    Promise.allSettled([
      modelQuotaAdapter.list({ page: 1, pageSize: 20 }),
      modelQuotaAdapter.getUsageCostSummary(dateRange),
      modelQuotaAdapter.getUsageCostTrends(dateRange),
      modelQuotaAdapter.getUsageCostBreakdowns(dateRange),
    ]).then(([modelsResult, summaryResult, trendsResult, breakdownsResult]) => {
      if (!active) return;
      const results = [modelsResult, summaryResult, trendsResult, breakdownsResult];
      const failures = results.filter((result) => result.status === "rejected");
      const disconnectedOnly = failures.length > 0 && failures.every((result) => result.reason?.code === "AI_USAGE_COST_READ_NOT_CONNECTED");
      setReadError(failures.length === 0 ? null : disconnectedOnly
        ? { kind: "not-connected", message: "用量接口未连接；相关数据保持未知。" }
        : { kind: "error", message: "部分数据读取失败；未返回的指标保持未知，可重试读取。" });
      if (modelsResult.status === "fulfilled") setModelPage(modelsResult.value);
      setUsageResult({
        ...(summaryResult.status === "fulfilled" ? { summary: summaryResult.value } : {}),
        ...(trendsResult.status === "fulfilled" ? { trends: trendsResult.value } : {}),
        ...(breakdownsResult.status === "fulfilled" ? { breakdowns: breakdownsResult.value } : {}),
      });
      setLoading(false);
    });
    return () => { active = false; };
  }, [period, refreshKey, visualFixture, modelFixture]);

  const modelData = useMemo(() => projectOverviewModels(modelPage), [modelPage]);
  const usageSource = visualFixture ? {
    summary: { summary: visualFixture.usageSummary },
    trends: { items: visualFixture.snapshot[period].dates.map((time, index) => ({
      time,
      requestCount: visualFixture.snapshot[period].requests[index],
      successCount: visualFixture.snapshot[period].success[index],
      failureCount: visualFixture.snapshot[period].requests[index] - visualFixture.snapshot[period].success[index],
      knownCost: visualFixture.costs[period][index],
      unknownCostCount: visualFixture.usageSummary.unknownCostCount,
    })) },
  } : usageResult;
  const usage = useMemo(() => projectOverviewUsage(usageSource), [usageSource]);
  const enabledCount = modelPage?.items?.filter((item) => item.enabled === true).length ?? null;
  const metrics = {
    models: loading && !modelPage ? "…" : formatOverviewValue(modelData.total),
    enabled: formatOverviewValue(enabledCount),
    providers: visualFixture ? formatOverviewValue(Number(visualFixture.kpis.find((item) => item.label === "Provider 数量")?.value || new Set(modelData.providers.map((provider) => provider.name)).size)) : "未知",
    requests: formatOverviewValue(usage.requestCount),
    success: formatOverviewValue(projectOverviewSuccessRate(usage.successCount, usage.failureCount), "%"),
    latency: visualFixture ? `${Math.round(modelData.models.reduce((sum, model) => sum + (model.latencyMs || 0), 0) / Math.max(modelData.models.filter((model) => model.latencyMs).length, 1))} ms` : "未知",
    cost: formatOverviewValue(usage.knownCost),
    alerts: visualFixture ? formatOverviewValue(visualFixture.alertCount) : "未知",
  };
  const sourceLabel = visualFixture ? "本地视觉样例 · 非实时" : modelData.demo ? "本地演示数据 · 非实时" : modelData.readMode === "INJECTED_READ_ONLY" ? "注入只读数据" : "数据接口未连接";

  return <main className="ai-overview" data-testid="ai-overview-page" data-read-mode={visualFixture ? "VISUAL_QA_ONLY" : modelData.readMode} data-loading={loading}>
    <AiVisualFixtureNotice />
    <header className="ai-overview__header"><div><h1>AI 智能模型中心</h1><p>统一管理多模态大模型，智能调度最优资源，让 AI 为你的业务创造更大的价值。</p></div><div className="ai-overview__header-actions">{readError && <span className="ai-overview__read-error" data-state={readError.kind} role={readError.kind === "error" ? "alert" : "status"}>{readError.message}</span>}<span className="ai-overview__value-proposition">更智能 · 更低成本 · 更大的业务收益 <Robot size={24} weight="duotone" aria-hidden="true" /></span><DemoBadge>{sourceLabel}</DemoBadge><button type="button" className="ai-overview__refresh" onClick={() => setRefreshKey((key) => key + 1)} aria-label="刷新 AI 总览"><ArrowsClockwise size={16} aria-hidden="true" />刷新</button></div></header>
    <section className="ai-overview__kpis" aria-label="AI 核心指标">{METRICS.map(({ key, label, icon, tone }) => <MetricCard key={key} label={label} value={metrics[key]} foot={metricFoot[key]} icon={icon} tone={tone} />)}</section>

    <section className="ai-overview__main-grid" aria-label="Provider、调度与模型健康">
      <article className="ai-overview__panel ai-overview__providers"><PanelHeading title="Provider 状态" caption={visualFixture ? "本地合成样例 · 非实时" : "连接与用量状态按当前数据源显示"} href="/ai-center/models" linkLabel="模型与额度" /><div className="ai-overview__table-scroll"><table><thead><tr><th>Provider</th><th>状态</th><th>模型数</th><th>今日调用量</th><th>延迟</th></tr></thead><tbody>{modelData.providers.slice(0, 6).map((provider) => <tr key={provider.name}><td><ProviderLogo provider={provider.name} /><span>{provider.name}</span></td><td><span className="ai-overview__unknown"><i />{visualFixture ? provider.health : "未知"}</span></td><td>{formatOverviewValue(provider.modelCount)}</td><td>{formatOverviewValue(provider.requestCount)}</td><td>{visualFixture ? formatOverviewValue(provider.averageLatencyMs, " ms") : "未知"}</td></tr>)}</tbody></table>{loading && modelData.providers.length === 0 && <div className="ai-overview__empty-row" role="status">正在读取 Provider…</div>}{!loading && modelData.providers.length === 0 && <div className="ai-overview__empty-row">当前没有可显示的 Provider。</div>}</div></article>
      <RoutePanorama providers={modelData.providers} sourceMix={visualFixture?.sourceMix || []} visualFixture={Boolean(visualFixture)} />
      <article className="ai-overview__panel ai-overview__model-health"><PanelHeading title="模型健康度 TOP 5" caption="健康、成功率和延迟来自模型运行状态读取" href="/ai-center/models" linkLabel="查看模型" /><div className="ai-overview-v2__health-head"><span>模型名称</span><span>状态</span><span>成功率</span><span>平均延迟</span></div><ul className="ai-overview__health-list">{modelData.models.slice(0, 5).map((model) => <li key={`${model.provider}-${model.name}`}><ProviderLogo provider={model.provider} /><span className="ai-overview__model-name"><b>{model.name}</b><small>{model.provider}</small></span><span className={`ai-overview__unknown ai-overview__unknown--compact ai-overview__state--${model.health?.toLowerCase() || "unknown"}`}><i />{model.health || "未知"}</span><b>{formatOverviewValue(model.successRate, "%")}</b><b>{formatOverviewValue(model.latencyMs, " ms")}</b></li>)}</ul>{loading && modelData.models.length === 0 && <div className="ai-overview__empty-row" role="status">正在读取模型…</div>}{!loading && modelData.models.length === 0 && <div className="ai-overview__empty-row">当前没有可显示的模型。</div>}</article>
    </section>

    <section className="ai-overview__trend-grid" aria-label="用量与成本趋势">
      <article className="ai-overview__panel ai-overview__chart-panel"><PanelHeading title="调用量趋势" caption="来自当前只读 usage-cost 数据" href="/ai-center/usage" linkLabel="用量与成本" /><div className="ai-overview__chart-controls" role="group" aria-label="趋势时间范围">{PERIODS.map((key, index) => <button type="button" key={key} className={period === key ? "is-selected" : ""} aria-pressed={period === key} onClick={() => setPeriod(key)}>{["今天", "近 7 天", "近 30 天"][index]}</button>)}</div><TrendChart items={usage.trends} label="调用趋势" /></article>
      <article className="ai-overview__panel ai-overview__cost-panel"><PanelHeading title="请求来源分布" caption={visualFixture ? "本地合成样例 · 非实时" : "来源分类当前不可用"} /><RequestSourcePanel sourceMix={visualFixture?.sourceMix || []} visualFixture={Boolean(visualFixture)} /></article>
      <article className="ai-overview__panel ai-overview__daily-cost"><PanelHeading title="今日成本趋势" caption="仅展示已知成本" href="/ai-center/usage" linkLabel="查看用量" /><DailyCostChart rows={usage.trends} knownCost={usage.knownCost} unknownCount={usage.unknownCostCount} /></article>
    </section>

    <section className="ai-overview__bottom-grid" aria-label="配额、告警与调度摘要">
      <article className="ai-overview__panel ai-overview__quota-panel"><PanelHeading title="配额消耗" caption={visualFixture ? "本地合成样例 · 非实时" : "当前只读适配器未提供模型配额明细"} href="/ai-center/models" linkLabel="查看模型" /><div className="ai-overview__quota-head"><span>模型</span><span>剩余额度</span><span>使用率</span></div>{modelData.models.slice(0, 4).map((model) => <div className="ai-overview__quota-row" key={`${model.provider}-${model.name}`}><ProviderLogo provider={model.provider} /><span>{model.name}</span><b>{visualFixture && model.quotaRemaining !== null ? `¥ ${model.quotaRemaining.toLocaleString("zh-CN")}` : "未知"}</b><i><span style={visualFixture && model.quotaUsagePercent !== null ? { width: `${model.quotaUsagePercent}%` } : undefined} /></i></div>)}{modelData.models.length === 0 && <div className="ai-overview__empty-row">配额数据未知</div>}<p className="ai-overview__footnote">{visualFixture ? "视觉样例 · 不代表真实配额。" : "未知额度不会推算为 0。"}</p></article>
      <article className="ai-overview__panel ai-overview__alerts-panel"><PanelHeading title="近期告警" caption="告警数据源未连接" /><div className="ai-overview__alert-state"><WarningCircle size={22} aria-hidden="true" /><div><strong>当前无法判断告警数量</strong><span>没有读取到告警数据；这不表示没有告警。</span></div></div><div className="ai-overview__alert-state ai-overview__alert-state--quiet"><Pulse size={20} aria-hidden="true" /><div><strong>运行状态未知</strong><span>Provider、Gateway、Runtime 与 RPA 状态尚未验证。</span></div></div></article>
      <article className="ai-overview__panel ai-overview__routing-summary"><PanelHeading title="调度建议摘要" caption={visualFixture ? "本地合成样例 · 非实时" : "当前调度建议服务未连接"} href="/ai-center/routing-advice" linkLabel="查看全部" /><div className="ai-overview__routing-rows"><div><span>调度状态</span><b>{visualFixture ? visualFixture.routingSummary.status : "未知"}</b></div><div><span>候选建议</span><b>{visualFixture ? getAiVisualFixtureData("routingAdvice")?.recommendations?.length || 0 : "未知"}</b></div><div><span>可执行项</span><b>{visualFixture ? visualFixture.routingSummary.executableCount : "未知"}</b></div></div><p className="ai-overview__footnote">{visualFixture ? "演示建议不可执行，不代表实时路由状态。" : "建议服务未连接，暂不可用。"}</p></article>
    </section>
    <footer className="ai-overview__footer"><span>Global Seller OS · AI Overview</span><span role={readError ? "alert" : "status"}>{readError?.message || (loading ? "正在刷新" : `${sourceLabel} · 数据已刷新`)}</span></footer>
  </main>;
}






