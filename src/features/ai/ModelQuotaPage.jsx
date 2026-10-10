import { modelTrendWindowQuery } from "./modelTrendRange.js";
import { loadModelQuotaPages } from "./modelQuotaPagedRead.js";
import { compareModelRows, matchesModelSearch } from "./modelTableSort.js";
import { presentModelQuotaMetric, presentModelQuotaReadSource } from "./modelQuotaMetricPresentation.js";
import { createPortal } from "react-dom";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getAiModelOperationsReadStatus, modelQuotaAdapter } from "./modelQuotaAdapter.js";
import "./ai-feature.css";
import "./ai-visual-overrides.css";
import "./ai-visual-qa-fixes.css";
import "./model-quota-parent-reference.css";
import { Plus, Gear, Power, ChartBar, ArrowsClockwise, MagnifyingGlass, DotsThree, CaretLeft, CaretRight, ArrowCounterClockwise, Cube, PlayCircle, ShareNetwork, CreditCard, Clock, WarningCircle, Check, Warning, X } from "@phosphor-icons/react";
import ProviderLogo from "./ProviderLogo.jsx";
import parentOpenAiLogo from "./assets/provider-logos/frozen-baseline/openai-parent.png";
import AddModelDialog from "./AddModelDialog.jsx";
import EditModelDialog from "./EditModelDialog.jsx";
import ToggleModelDialog from "./ToggleModelDialog.jsx";
import ModelDetailDialog from "./ModelDetailDialog.jsx";
import ModelConnectionTestDialog from "./ModelConnectionTestDialog.jsx";
import { presentAiAdapterFailure } from "./aiAdapterStatus.js";
import ModelDeleteDialog from "./ModelDeleteDialog.jsx";
import { projectModelBudgetRanking } from "./modelBudgetRanking.js";
import { AiVisualFixtureNotice, getAiVisualFixtureData, isAiVisualFixtureMode } from "./aiVisualFixtureProvider.jsx";

function ParentProviderLogo({ provider, visualFixture = false, ...props }) {
  if (provider === "Microsoft Azure" || provider === "Azure") {
    const inline = props.displayMode === "inline";
    return <span className={`provider-logo provider-logo--ai-tech-azure${inline ? " provider-logo--inline" : ""}`} role="img" aria-label="Azure 风格科技标记（自绘）" title="Azure 风格科技标记（自绘）"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2.8 29 26H18.2l-3.1-5.3h5.7L16 12.2 8.3 26H3z" fill="#168bff"/><path d="M16 2.8 8.8 15.7l3.1 5.4L16 14.2l4.7 8.4 3.1-5.4z" fill="#18e4ff"/><path d="m18.2 26-3.1-5.3h5.7L16 12.2l-2.3 4.1 4.7 8.3H29z" fill="#dffaff" fillOpacity=".95"/></svg></span>;
  }
  if (provider === "OpenAI" || (visualFixture && provider === "全部 Provider")) {
    return <span className={`provider-logo provider-logo--openai provider-logo--parent-reference${props.displayMode === "inline" ? " provider-logo--inline" : ""}`} role="img" aria-label="OpenAI 标识"><img src={parentOpenAiLogo} alt=""/></span>;
  }
  return <ProviderLogo provider={provider} {...props} />;
}

const money = (n, currency) => {
  if (n == null || !Number.isFinite(Number(n)) || !/^[A-Z]{3}$/.test(String(currency || ""))) return "—";
  const amount = Number(n);
  const formatted = new Intl.NumberFormat("zh-CN", { style: "currency", currency, minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 }).format(amount);
  return formatted.replace(/^([^\d-]+)(?=-?\d)/, "$1 ");
};
const MODEL_LIST_TIMEOUT_MS = 10_000;
const readUsageCost = async (path) => {
  const response = await fetch(path, { method: "GET", credentials: "same-origin", headers: { Accept: "application/json" } });
  if (!response.ok) throw Object.assign(new Error("Usage-cost read failed."), { code: `HTTP_${response.status}` });
  return response.json();
};

export default function ModelQuotaPage({ addModelOpen: controlledAddModelOpen, onAddModelOpen, onAddModelClose, onAddModelSaved } = {}) {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [readSource, setReadSource] = useState("UNKNOWN");
  const [summary, setSummary] = useState({});
  const [usageRead, setUsageRead] = useState({ state: "loading", trends: [], records: [] });
  const [trendPeriod, setTrendPeriod] = useState("month");
  const [activityRead, setActivityRead] = useState({ state: "loading", items: [], code: null });
  const [totalCount, setTotalCount] = useState(0);

  const loadRequestId = useRef(0);
  const usageLoadRequestId = useRef(0);
  const mounted = useRef(false);
  const [provider, setProvider] = useState("全部 Provider");
  const [status, setStatus] = useState("全部状态");
  const [type, setType] = useState("全部类型");
  const [enabled, setEnabled] = useState("是否启用");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [localAddOpen, setLocalAddOpen] = useState(false);
  const isAddOpenControlled = typeof controlledAddModelOpen === "boolean";
  const addOpen = isAddOpenControlled ? controlledAddModelOpen : localAddOpen;
  const requestAddClose = () => { if (!isAddOpenControlled) setLocalAddOpen(false); onAddModelClose?.(); };
  const [editModel, setEditModel] = useState(null);
  const [toggleModel, setToggleModel] = useState(null);
  const [detailModel, setDetailModel] = useState(null);
  const [connectionTestModel, setConnectionTestModel] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const actionMenuContentsRef = useRef(null);
  const [actionMenuId, setActionMenuId] = useState(null);
  const [actionMenuPosition, setActionMenuPosition] = useState(null);
  const actionMenuRef = useRef(null);
  const [selected, setSelected] = useState("全部 Provider");
  const [distributionMode, setDistributionMode] = useState("count");
  const [showAllBudgetRows, setShowAllBudgetRows] = useState(false);
  const [showAllActivityRows, setShowAllActivityRows] = useState(false);
  const hasReadData = readSource === "SERVER_READ_PROJECTION" || readSource === "TEST_FIXTURE" || readSource === "VISUAL_QA_ONLY";
  const isReferenceVisualFixture = summary?.visualFixtureId === "VISUAL_QA_ONLY_771271_B01_v2";
  const visualFixture = isAiVisualFixtureMode() ? getAiVisualFixtureData("modelQuota") : null;

  const load = async () => {
    const requestId = ++loadRequestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await loadModelQuotaPages(modelQuotaAdapter.list.bind(modelQuotaAdapter), {
        timeoutMs: MODEL_LIST_TIMEOUT_MS,
        isCurrent: () => mounted.current && requestId === loadRequestId.current,
        makeTimeoutError: () => {
          const failure = new Error("Model-list read timed out.");
          failure.code = "AI_MODEL_LIST_TIMEOUT";
          failure.mock = getAiModelOperationsReadStatus().state === "NOT_CONNECTED";
          return failure;
        },
      });
      if (!mounted.current || requestId !== loadRequestId.current) return;
      const nextItems = result.items;
      setAll(nextItems);
      setTotalCount(Number.isFinite(Number(result.total)) ? Number(result.total) : nextItems.length);
      setSummary(result.summary || {});
      setReadSource(result.source || (result.demo ? "TEST_FIXTURE" : "UNKNOWN"));
    } catch (failure) {
      if (!mounted.current || requestId !== loadRequestId.current) return;
      setError(presentAiAdapterFailure(failure));
    } finally {
      if (mounted.current && requestId === loadRequestId.current) setLoading(false);
    }
  };
  const loadUsage = async (period = trendPeriod) => {
    const requestId = ++usageLoadRequestId.current;
    if (visualFixture) {
      const trends = (visualFixture.usagePeriods?.[period] || visualFixture.usage.trends).map((item) => ({ ...item, usedAmount: item.usedAmount ?? item.used_amount, totalQuota: item.totalQuota ?? item.total_quota }));
      setUsageRead({ state: "ready", trends: [...trends], records: [...visualFixture.usage.records] });
      return;
    }
    setUsageRead((current) => ({ ...current, state: "loading" }));
    try {
      const windowQuery = modelTrendWindowQuery(period);
      const [trends, records] = await Promise.all([
        readUsageCost(`/api/v1/ai-usage-cost/trends?${windowQuery}`),
        readUsageCost(`/api/v1/ai-usage-cost/records?${windowQuery}&page=1&page_size=5`),
      ]);
      if (!mounted.current || requestId !== usageLoadRequestId.current) return;
      if (trends?.contract !== "USAGE_COST_DATA_API_CONTRACT_V1" || !Array.isArray(trends.items)
        || records?.contract !== "USAGE_COST_DATA_API_CONTRACT_V1" || !Array.isArray(records.items)) {
        throw Object.assign(new Error("Usage-cost response contract is invalid."), { code: "AI_USAGE_COST_BAD_RESPONSE" });
      }
      const trendItems = trends.items.map((item) => ({ ...item, usedAmount: item.usedAmount ?? item.used_amount ?? null, totalQuota: item.totalQuota ?? item.total_quota ?? null }));
      setUsageRead({ state: trendItems.length || records.items.length ? "ready" : "empty", trends: trendItems, records: records.items });
    } catch (failure) {
      if (!mounted.current || requestId !== usageLoadRequestId.current) return;
      setUsageRead((current) => ({ ...current, state: "error", code: typeof failure?.code === "string" ? failure.code : "AI_USAGE_COST_READ_FAILED" }));
    }
  };
  const loadActivity = async ({ limit = 4 } = {}) => {
    if (visualFixture) {
      setActivityRead({ state: "ready", items: [...visualFixture.activity], code: null });
      return;
    }
    setActivityRead((current) => ({ ...current, state: "loading", code: null }));
    try {
      const response = await fetch(`/api/v1/ai-model-operations/recent-events?limit=${Math.max(1, Math.min(100, limit))}`, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw Object.assign(new Error("Model activity read failed."), { code: `HTTP_${response.status}` });
      const payload = await response.json();
      if (payload?.contract !== "AI_MODEL_ACTIVITY_READ_V1" || !Array.isArray(payload.items)
        || payload.items.some((item) => !item || typeof item.event_id !== "string"
          || typeof item.event_type !== "string" || typeof item.model_id !== "string"
          || typeof item.model_name !== "string")) {
        throw Object.assign(new Error("Model activity response contract is invalid."), { code: "AI_MODEL_ACTIVITY_BAD_RESPONSE" });
      }
      setActivityRead({ state: payload.items.length ? "ready" : "empty", items: payload.items, code: null });
    } catch (failure) {
      setActivityRead({ state: "error", items: [], code: typeof failure?.code === "string" ? failure.code : "AI_MODEL_ACTIVITY_READ_FAILED" });
    }
  };
  const refreshParent = () => { void load(); void loadUsage(); void loadActivity(); };
  const activityLabels = {
    "ai_model.created": "添加模型",
    "ai_model.updated": "更新配置",
    "ai_model.quota_alert": "额度告警",
    "ai_model.draft_saved": "保存模型草稿",
    "ai_model.enabled": "启用模型",
    "ai_model.disabled": "停用模型",
    "ai_model.archived": "归档模型",
    "ai_model.restored": "恢复模型",
  };
  const formatActivityTime = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "时间未知" : new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(date);
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      loadRequestId.current += 1;
      usageLoadRequestId.current += 1;
    };
  }, []);
  useEffect(() => { load(); }, []);
  useEffect(() => { loadUsage(trendPeriod); }, [trendPeriod]);
  useEffect(() => { loadActivity(); }, []);
  const filtered = useMemo(() => {
    return all.filter((m) => (provider === "全部 Provider" || m.provider === provider)
      && (selected === "全部 Provider" || m.provider === selected)
      && (status === "全部状态" || m.status === status)
      && (type === "全部类型" || m.type === type)
      && (enabled === "是否启用" || (enabled === "已启用" ? m.enabled === true : m.enabled === false))
      && matchesModelSearch(m, search))
      .sort((a, b) => compareModelRows(a, b, sort));
  }, [all, provider, selected, status, type, enabled, search, sort]);
  useEffect(() => setPage(1), [provider, selected, status, type, enabled, search, pageSize]);
  useEffect(() => {
    if (!actionMenuId) return;
    const onPointerDown = (event) => { if (!actionMenuRef.current?.contains(event.target) && !actionMenuContentsRef.current?.contains(event.target)) setActionMenuId(null); };
    const onKeyDown = (event) => { if (event.key === "Escape") setActionMenuId(null); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [actionMenuId]);
  useEffect(() => {
    if (!actionMenuId || !actionMenuContentsRef.current || !actionMenuPosition?.anchor) return;
    const menu = actionMenuContentsRef.current.getBoundingClientRect();
    const anchor = actionMenuPosition.anchor;
    const top = anchor.bottom + menu.height + 4 <= window.innerHeight - 8 ? anchor.bottom + 4 : Math.max(8, anchor.top - menu.height - 4);
    const left = Math.max(8, Math.min(anchor.right - menu.width, window.innerWidth - menu.width - 8));
    setActionMenuPosition((current) => current && current.top === top && current.left === left ? current : { ...current, top, left });
  }, [actionMenuId]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const enabledCount = !hasReadData ? "UNKNOWN" : Number.isInteger(summary.enabled) ? summary.enabled : all.every((m) => typeof m.enabled === "boolean") ? all.filter((m) => m.enabled).length : "UNKNOWN";
  const currencies = [...new Set(all.map((m) => m.currency).filter((value) => /^[A-Z]{3}$/.test(String(value || ""))))];
  const displayCurrency = currencies.length === 1 && all.every((m) => m.currency === currencies[0]) ? currencies[0] : null;
  const used = all.length > 0 && displayCurrency && all.every((m) => m.used != null && Number.isFinite(Number(m.used))) ? all.reduce((sum, m) => sum + Number(m.used), 0) : null;
  const quota = all.length > 0 && displayCurrency && all.every((m) => m.quota != null && Number.isFinite(Number(m.quota))) ? all.reduce((sum, m) => sum + Number(m.quota), 0) : null;
  const healthyCount = !hasReadData ? "UNKNOWN" : Number.isInteger(summary.healthy) ? summary.healthy : all.every((m) => m.healthStatus !== "UNKNOWN") ? all.filter((m) => m.healthStatus === "READY").length : "UNKNOWN";
  const needsCheckCount = isReferenceVisualFixture ? summary.needsCheck : hasReadData && all.every((m) => typeof m.enabled === "boolean" && m.healthStatus !== "UNKNOWN") ? all.filter((m) => m.enabled && ["UNAVAILABLE", "DEGRADED", "RATE_LIMITED", "AUTH_ERROR", "TIMEOUT"].includes(m.healthStatus)).length : "UNKNOWN";
  const disabledCount = isReferenceVisualFixture ? summary.unavailable : hasReadData && all.every((m) => typeof m.enabled === "boolean") ? all.filter((m) => !m.enabled || m.healthStatus === "DISABLED").length : "UNKNOWN";
  const referenceTopIds = visualFixture?.referenceTopIds || [];
  const budgetRanking = isReferenceVisualFixture
    ? { items: referenceTopIds.map((id) => { const model = all.find((item) => item.id === id); return model ? { id: model.id, name: model.model, provider: model.provider, total: Number(model.quota), remaining: Number(model.quota) - Number(model.used), currency: model.currency, status: "KNOWN", source: "VISUAL_QA_ONLY" } : null; }).filter(Boolean) }
    : projectModelBudgetRanking(all);
  const allBudgetRanking = isReferenceVisualFixture ? projectModelBudgetRanking(all, all.length) : projectModelBudgetRanking(all, all.length);
  const referenceProviderOrder = visualFixture?.referenceProviderOrder || [];
  const providers = [...new Set(all.map((m) => m.provider).filter((value) => typeof value === "string" && value.trim()))].sort((a, b) => isReferenceVisualFixture ? referenceProviderOrder.indexOf(a) - referenceProviderOrder.indexOf(b) : a.localeCompare(b, "zh-CN"));
  const providerCount = isReferenceVisualFixture ? summary.providerCount : providers.length;
  const providerBreakdown = providers;
  const countFor = (p) => all.filter((m) => m.provider === p).length;
  const quotaForProvider = (p) => {
    const rows = all.filter((m) => m.provider === p);
    if (!rows.length || !rows.every((m) => m.quota != null && Number.isFinite(Number(m.quota)) && m.currency === displayCurrency) || !displayCurrency) return null;
    return rows.reduce((sum, m) => sum + Number(m.quota), 0);
  };
  const providerShareValue = (p) => distributionMode === "count" ? countFor(p) : quotaForProvider(p);
  const distributionTotal = distributionMode === "count" ? totalCount : all.length && displayCurrency && all.every((m) => m.quota != null && Number.isFinite(Number(m.quota))) ? all.reduce((sum, m) => sum + Number(m.quota), 0) : null;
  const providerSummary = (provider) => {
    const count = countFor(provider);
    if (!hasReadData) return "—";
    if (distributionMode === "quota") {
      const amount = quotaForProvider(provider);
      return amount == null || distributionTotal == null ? "额度未知" : `${money(amount, displayCurrency)} (${Math.round(amount / distributionTotal * 100)}%)`;
    }
    if (!Number.isFinite(totalCount) || totalCount <= 0 || totalCount !== all.length) return count;
    return `${count} (${(count / totalCount * 100).toFixed(1)}%)`;
  };
  const usageRate = (m) => m.used == null || m.quota == null || !Number.isFinite(Number(m.used)) || !Number.isFinite(Number(m.quota)) || Number(m.quota) === 0 ? null : Number(m.used) / Number(m.quota);
  const donutStyle = useMemo(() => {
    const palette = ["#148dff", "#feb231", "#12caa8", "#498bff", "#ff8c35", "#5e81bb", "#8397ad"];
    let cursor = 0;
    const slices = providerBreakdown.map((name, index) => {
      const start = cursor;
      const value = providerShareValue(name);
      cursor += distributionTotal != null && distributionTotal > 0 && value != null ? value / distributionTotal * 100 : 0;
      return `${palette[index % palette.length]} ${start}% ${cursor}%`;
    });
    return { background: slices.length && distributionTotal != null ? `conic-gradient(${slices.join(",")})` : "#243f5c" };
  }, [all, distributionMode, distributionTotal]);
  const kpiTrends = isReferenceVisualFixture ? visualFixture?.kpiTrends || null : null;
  const canRenderTrendChart = usageRead.state === "ready" && usageRead.trends.length > 1
    && usageRead.trends.every((item) => Number.isFinite(item.usedAmount) && Number.isFinite(item.totalQuota));
  const trendChartMax = isReferenceVisualFixture ? visualFixture?.trendChartMax || 8000 : canRenderTrendChart ? Math.ceil(Math.max(...usageRead.trends.map((item) => Math.max(item.usedAmount, item.totalQuota))) / 1000) * 1000 : 0;
  const chartPoints = (key) => usageRead.trends.map((item, index) => `${usageRead.trends.length < 2 ? 0 : index * (520 / (usageRead.trends.length - 1))},${116 - (item[key] / trendChartMax) * 112}`).join(" ");
  const chartArea = (key) => `0,116 ${chartPoints(key)} 520,116`;
  const kpiCards = [
    ["模型总数", hasReadData ? totalCount : "UNKNOWN", <Cube size={31} weight="regular" />, kpiTrends?.[0]?.[0] || (hasReadData ? readSource : "UNKNOWN"), kpiTrends?.[0]?.[1] || "服务端列表总数"],
    ["已启用", enabledCount, <PlayCircle size={31} weight="regular" />, kpiTrends?.[1]?.[0] || (hasReadData ? readSource : "UNKNOWN"), kpiTrends?.[1]?.[1] || "服务端汇总"],
    ["服务商数量", hasReadData ? providerCount : "UNKNOWN", <ShareNetwork size={31} weight="regular" />, kpiTrends?.[2]?.[0] || (hasReadData ? readSource : "UNKNOWN"), kpiTrends?.[2]?.[1] || "当前列表去重"],
    ["总额度", money(quota, displayCurrency), <CreditCard size={30} weight="regular" />, kpiTrends?.[3]?.[0] || (quota == null ? "UNKNOWN" : readSource), kpiTrends?.[3]?.[1] || (quota == null ? "币种或额度未知" : displayCurrency)],
    ["已用额度", money(used, displayCurrency), <Clock size={31} weight="regular" />, kpiTrends?.[4]?.[0] || (used == null ? "UNKNOWN" : readSource), kpiTrends?.[4]?.[1] || (used == null ? "成本或币种未知" : displayCurrency)],
    ["告警模型", isReferenceVisualFixture ? needsCheckCount : "UNKNOWN", <Warning size={31} weight="regular" />, kpiTrends?.[5]?.[0] || "UNKNOWN", kpiTrends?.[5]?.[1] || "告警数据未知"],
    ["即将欠费", isReferenceVisualFixture ? 2 : all.every((m) => m.nextBillingAt || m.quotaDueAt || m.billingDueAt) ? all.filter((m) => { const due = new Date(m.nextBillingAt || m.quotaDueAt || m.billingDueAt).getTime(); return Number.isFinite(due) && due >= Date.now() && due <= Date.now() + 7 * 86400000; }).length : "UNKNOWN", <WarningCircle size={31} weight="regular" />, isReferenceVisualFixture ? "视觉样例" : "UNKNOWN", isReferenceVisualFixture ? "未来 7 天" : "账期数据未接入"],
  ];
  const toggleSort = (key) => setSort((s) => ({ key, dir: s?.key === key && s.dir === "asc" ? "desc" : "asc" }));
  const reset = () => { setProvider("全部 Provider"); setSelected("全部 Provider"); setStatus("全部状态"); setType("全部类型"); setEnabled("是否启用"); setSearch(""); };

  return <div className={`ai-feature${isAiVisualFixtureMode() ? " ai-visual-fixture-771271" : ""}`}><AiVisualFixtureNotice/><div className="ai-app ai-app--body-only"><section className="ai-workspace ai-workspace--body-only">      <main className="ai-main">
        <section className="model-quota-summary panel">
        <div className="page-heading"><div><h1>模型与额度</h1><p>管理 AI 模型配置、API Key、额度使用和运行状态。</p></div><div className="heading-actions"><button className="primary" onClick={() => { if (onAddModelOpen) { onAddModelOpen(); if (isAiVisualFixtureMode()) { const nextUrl = new URL(window.location.href); nextUrl.searchParams.set("aiVisualFixture", "1"); window.history.replaceState(window.history.state, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`); } } else setLocalAddOpen(true); }}><Plus size={15} weight="bold" /> 添加模型</button><button onClick={refreshParent} disabled={loading || usageRead.state === "loading" || activityRead.state === "loading"}><ArrowsClockwise size={15} /> 刷新</button></div></div>
        {error && <div className="ai-adapter-failure" role="alert" data-state={error.state}><b>{error.state}</b><span>{error.message}</span><small>{error.source} · production status unverified</small></div>}
        <section className="kpis">
          {kpiCards.map(([label, value, icon, trend, note], i) => <article className="kpi" key={label}><div className={`kpi-icon k${i}`}>{icon}</div><div className="kpi-copy"><small>{label}</small><strong>{isReferenceVisualFixture ? value : presentModelQuotaMetric(value)}</strong></div><div className="kpi-trend"><b className={isReferenceVisualFixture || trend === "SERVER_READ_PROJECTION" ? "is-current" : trend === "TEST_FIXTURE" ? "is-fixture" : "is-unknown"}>{presentModelQuotaReadSource(trend, isReferenceVisualFixture)}</b><span>{note}</span></div></article>)}
        </section>
        </section>
        <section className="data-layout">
          <aside className="provider-filter panel"><h2>服务商筛选</h2><button onClick={() => { setProvider("全部 Provider"); setSelected("全部 Provider"); }} className={provider === "全部 Provider" && selected === "全部 Provider" ? "chosen" : ""}><ParentProviderLogo provider="全部 Provider" visualFixture={isReferenceVisualFixture}/>全部服务商 <b>{hasReadData ? totalCount : "—"}</b></button>{providers.map((p) => <button className={selected === p || provider === p ? "chosen" : ""} key={p} onClick={() => { setSelected(p); setProvider("全部 Provider"); }}><ParentProviderLogo provider={p} visualFixture={isReferenceVisualFixture}/><span className="provider-filter-name" title={p}>{p}</span><b>{hasReadData ? countFor(p) : "—"}</b></button>)}</aside>
          <section className="model-table panel"><div className="table-title"><h2>模型列表 <span>{filtered.length}</span></h2><div className={`filters${provider !== "全部 Provider" || status !== "全部状态" || type !== "全部类型" || enabled !== "是否启用" || search ? " has-active-filter" : ""}`}><select aria-label="服务商筛选" value={provider} onChange={(e) => { setProvider(e.target.value); setSelected("全部 Provider"); }}><option value="全部 Provider">全部服务商</option>{providers.map((p) => <option key={p}>{p}</option>)}</select><select aria-label="状态筛选" value={status} onChange={(e) => setStatus(e.target.value)}><option>全部状态</option>{[...new Set(all.map((item) => item.status).filter(Boolean))].map((name) => <option key={name}>{name}</option>)}</select><select aria-label="类型筛选" value={type} onChange={(e) => setType(e.target.value)}><option>全部类型</option>{[...new Set(all.map((item) => item.type).filter(Boolean))].map((name) => <option key={name}>{name}</option>)}</select><select aria-label="启用筛选" value={enabled} onChange={(e) => setEnabled(e.target.value)}><option>是否启用</option><option>已启用</option><option>未启用</option></select><label className="searchbox"><input aria-label="搜索模型" placeholder="搜索模型名称、标识或描述..." value={search} onChange={(e) => setSearch(e.target.value)} /><MagnifyingGlass size={14} aria-hidden="true" /></label><button className="reset" onClick={reset}><ArrowCounterClockwise size={13} /> 重置</button></div></div>
            {error ? <div className="table-state"><b>数据暂时不可用</b><span>模型列表读取失败，请重试。</span><button onClick={load}>重试</button></div> : loading ? <div className="table-state"><span className="spinner"/><b>正在加载模型列表…</b></div> : filtered.length === 0 ? <div className="table-state"><b>没有匹配的模型</b><span>调整筛选条件或搜索词后重试。</span><button onClick={reset}>清除筛选</button></div> : <><div className="table-scroll"><table><thead><tr>{[["model", "模型名称"], ["provider", "服务商"], ["type", "类型"], ["context", "上下文"], ["used", "已用额度"], ["quota", "总额度"], ["usage", "使用率"], ["status", "状态"], ["priority", "路由优先级"], ["updated", "更新时间"]].map(([key, label]) => <th key={key}><button onClick={() => toggleSort(key)}>{label}{sort?.key === key ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}</button></th>)}<th>操作</th></tr></thead><tbody>{rows.map((m) => <tr key={m.id} data-source={m.readbackSource || "UNKNOWN"} data-model-id={m.id}><td><ParentProviderLogo provider={m.provider} modelLogo={m.modelLogo} modelName={m.model} visualFixture={isReferenceVisualFixture}/><b>{m.model}</b></td><td><ParentProviderLogo provider={m.provider} displayMode="inline" visualFixture={isReferenceVisualFixture}/>{m.provider}</td><td><em className="type-pill">{m.type}</em></td><td>{m.context}</td><td>{money(m.used, m.currency)}</td><td>{money(m.quota, m.currency)}</td><td><div className="usage-cell"><span>{usageRate(m) == null ? "—" : `${Math.round(usageRate(m) * 100)}%`}</span><i><b style={{ width: usageRate(m) == null ? "0%" : `${Math.min(100, usageRate(m) * 100)}%` }} className={usageRate(m) != null && usageRate(m) >= .85 ? "hot" : ""}/></i></div></td><td><span className={`state state-${m.status === "额度告警" ? "warn" : m.status === "已停用" ? "off" : (m.status === "运行正常" || m.status === "正常") ? "ready" : "pending"}`}><i/>{isReferenceVisualFixture && m.status === "额度告警" ? "告警" : m.status}</span></td><td><em className="priority">{m.priority}</em></td><td>{m.updated}</td><td className="action-cell"><div className="row-action-wrap" ref={actionMenuId === m.id ? actionMenuRef : null}><button type="button" className="more" aria-label={`${m.model} 更多操作`} aria-haspopup="menu" aria-expanded={actionMenuId === m.id} onClick={(event) => { if (actionMenuId === m.id) { setActionMenuId(null); return; } const rect = event.currentTarget.getBoundingClientRect(); setActionMenuPosition({ top: rect.bottom + 4, left: rect.right - 144, anchor: { top: rect.top, bottom: rect.bottom, right: rect.right } }); setActionMenuId(m.id); }} title="模型操作"><DotsThree size={18} weight="bold" /></button>{actionMenuId === m.id && createPortal(<div className="ai-feature model-actions-portal"><div ref={actionMenuContentsRef} className="row-action-menu" role="menu" style={{ top: actionMenuPosition?.top, left: actionMenuPosition?.left }}><button type="button" role="menuitem" onClick={() => { setEditModel(m); setActionMenuId(null); }}>编辑模型</button><button type="button" role="menuitem" onClick={() => { setToggleModel(m); setActionMenuId(null); }}>{m.enabled ? "停用模型" : "启用模型"}</button><button type="button" role="menuitem" onClick={() => { setDetailModel(m); setActionMenuId(null); }}>查看详情</button><button type="button" role="menuitem" onClick={() => { setConnectionTestModel(m); setActionMenuId(null); }}>测试连接</button><button type="button" role="menuitem" onClick={() => { setArchiveTarget(m); setActionMenuId(null); }}>删除模型</button></div></div>, document.body)}</div></td></tr>)}</tbody></table></div><footer className="pagination"><span>显示 {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} 条，共 {filtered.length} 条</span><div className="pages"><button aria-label="上一页" disabled={page === 1} onClick={() => setPage(page - 1)}><CaretLeft size={14} /></button>{Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => <button className={page === n ? "current" : ""} onClick={() => setPage(n)} key={n}>{n}</button>)}<button aria-label="下一页" disabled={page === pageCount} onClick={() => setPage(page + 1)}><CaretRight size={14} /></button><select aria-label="每页条数" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}><option value={6}>6 条/页</option><option value={10}>10 条/页</option><option value={12}>12 条/页</option></select></div></footer></>}
          </section>
          <aside className="right-stack"><section className="distribution panel"><div className="side-head"><h2>服务商分布</h2><div className="distribution-controls" aria-label="分布方式"><button type="button" className={distributionMode === "count" ? "selected" : ""} aria-pressed={distributionMode === "count"} onClick={() => setDistributionMode("count")}>按模型数</button><button type="button" className={distributionMode === "quota" ? "selected" : ""} aria-pressed={distributionMode === "quota"} onClick={() => setDistributionMode("quota")}>按额度</button></div></div><div className="distribution-body"><div className="donut" style={donutStyle}><div><b>{!hasReadData ? "UNKNOWN" : distributionMode === "count" ? totalCount : distributionTotal == null ? "UNKNOWN" : money(distributionTotal, displayCurrency)}</b><small>{distributionMode === "count" ? "模型总数" : "额度总额"}</small></div></div><ul>{providerBreakdown.map((p, i) => <li key={p}><i className={`dot dot-${i}`}/><span>{p}</span><b>{providerSummary(p)}</b></li>)}</ul></div></section><section className="health panel"><div className="side-head"><h2>模型健康度</h2><button type="button" onClick={() => document.querySelector("#model-health-details")?.showModal()}>查看全部 ›</button></div><div className="health-cards"><article><b><Check size={22} weight="regular" /></b><span>{isReferenceVisualFixture ? "正常运行" : "连接正常"}</span><strong>{healthyCount}</strong><small>占比 {Number.isFinite(healthyCount) && totalCount > 0 ? Math.round(healthyCount / totalCount * 100) + "%" : "—"}</small></article><article><b><Warning size={22} weight="regular" /></b><span>{isReferenceVisualFixture ? "告警模型" : "需检查"}</span><strong>{needsCheckCount}</strong><small>占比 {Number.isFinite(needsCheckCount) && totalCount > 0 ? Math.round(needsCheckCount / totalCount * 100) + "%" : "—"}</small></article><article><b><X size={22} weight="regular" /></b><span>{isReferenceVisualFixture ? "不可用" : "已停用"}</span><strong>{disabledCount}</strong><small>占比 {Number.isFinite(disabledCount) && totalCount > 0 ? Math.round(disabledCount / totalCount * 100) + "%" : "—"}</small></article></div></section></aside>
        </section>
        <section className="bottom-grid">
          <article className="panel quota-trend">
            <div className="trend-panel-heading"><h2>额度使用趋势</h2><div className="trend-period-controls" role="group" aria-label="趋势时间范围">{[["month", visualFixture ? "近 6 周" : "近 1 个月"], ["quarter", "近 3 个月"], ["halfYear", "近半年"]].map(([key, label]) => <button key={key} type="button" aria-pressed={trendPeriod === key} className={trendPeriod === key ? "selected" : ""} onClick={() => setTrendPeriod(key)}>{label}</button>)}</div><span className="chart-legend" aria-label="趋势图例"><i className="chart-legend-used">已用额度</i><i className="chart-legend-total">总额度</i></span></div>
            <div className="chart-placeholder" role="status">
              {usageRead.state === "period-unavailable" ? <div className="usage-read-empty"><span>真实趋势接口暂未提供该时间范围</span><button type="button" onClick={() => setTrendPeriod("month")}>查看近 1 个月</button></div> : usageRead.state === "loading" ? "正在读取额度趋势…" : usageRead.state === "error" ? (
                <div className="usage-read-empty"><span>额度趋势读取失败</span><button type="button" onClick={() => void loadUsage()}>重试</button></div>
              ) : canRenderTrendChart ? (
                <div className="chart-empty-shell chart-data-shell" role="img" aria-label="额度使用趋势图">
                  <div className="chart-y-axis" aria-hidden="true">{[8000, 6000, 4000, 2000, 0].map((value) => <i key={value}>¥ {new Intl.NumberFormat("zh-CN").format(trendChartMax * value / 8000)}</i>)}</div>
                  <div className="chart-plot">
                    <svg viewBox="0 0 520 120" preserveAspectRatio="none" aria-hidden="true">
                      <polygon className="chart-area-total" points={chartArea("totalQuota")} />
                      <polygon className="chart-area-used" points={chartArea("usedAmount")} />
                      <polyline className="chart-line-total" points={chartPoints("totalQuota")} />
                      <polyline className="chart-line-used" points={chartPoints("usedAmount")} />
                      {usageRead.trends.map((item, index) => <g key={`${item.time}-${index}`}><circle className="chart-point-total" cx={index * (520 / (usageRead.trends.length - 1))} cy={116 - (item.totalQuota / trendChartMax) * 112} r="3.5"/><circle className="chart-point-used" cx={index * (520 / (usageRead.trends.length - 1))} cy={116 - (item.usedAmount / trendChartMax) * 112} r="3.5"/></g>)}
                    </svg>
                    {isReferenceVisualFixture && <div className="chart-tooltip"><b>{visualFixture?.trendTooltip?.date}</b><span><i className="chart-legend-total"/>总额度 <strong>{visualFixture?.trendTooltip?.total}</strong></span><span><i className="chart-legend-used"/>已用额度 <strong>{visualFixture?.trendTooltip?.used}</strong></span></div>}
                  </div>
                  <div className="chart-x-axis">{usageRead.trends.map((item, index) => <i key={`${item.time}-${index}`} style={{left:`${index * 100 / Math.max(1,usageRead.trends.length - 1)}%`}}>{item.time}</i>)}</div>
                </div>
              ) : (
                <div className="chart-empty-shell" aria-label="暂无完整额度趋势数据"><div className="chart-y-axis" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <i key={index}>—</i>)}</div><div className="chart-plot"><span className="chart-empty-label">暂无数据</span></div><div className="chart-x-axis" aria-hidden="true">{Array.from({ length: 7 }, (_, index) => <i key={index}>—</i>)}</div></div>
              )}
            </div>
          </article>
          <article className="panel remaining">
            <h2>剩余额度 TOP {showAllBudgetRows ? allBudgetRanking.items.length : 5} <button type="button" aria-expanded={showAllBudgetRows} onClick={() => setShowAllBudgetRows((value) => !value)}>{showAllBudgetRows ? "收起" : "查看全部 ›"}</button></h2>
            <div className="remaining-header" aria-hidden="true"><span>模型名称</span><span>剩余比例</span><span>剩余额度</span></div>
            {(showAllBudgetRows ? allBudgetRanking.items : budgetRanking.items).length ? (showAllBudgetRows ? allBudgetRanking.items : budgetRanking.items).map((item) => (
              <div className="remaining-row" key={item.id}>
                <span className="remaining-model-identity" title={item.status + " · " + item.source}><ParentProviderLogo provider={item.provider === "Azure" ? "Microsoft Azure" : item.provider} modelName={item.name} visualFixture={isReferenceVisualFixture}/><span>{item.name}</span></span>
                <i><b style={{ width: (item.total > 0 ? Math.max(0, Math.min(100, item.remaining / item.total * 100 - (isReferenceVisualFixture ? 10 : 0))) : 0) + "%" }} /></i>
                <span className="remaining-values"><b>{money(item.remaining, item.currency)}</b><small>{item.total > 0 ? `${Math.round(item.remaining / item.total * 100)}%` : "—"}</small></span>
              </div>
            )) : <p className="remaining-empty">暂无可用于排行的已知额度</p>}
          </article>
          <article className="panel activity">
            <h2>最近操作记录 <button type="button" aria-expanded={showAllActivityRows} onClick={() => { const next = !showAllActivityRows; setShowAllActivityRows(next); if (next && !visualFixture) void loadActivity({ limit: 100 }); }}>{showAllActivityRows ? "收起" : "查看全部 ›"}</button></h2>
            {activityRead.state === "loading" ? (
              <p className="activity-state">正在读取最近操作…</p>
            ) : activityRead.state === "error" ? (
              <p className="activity-state" role="alert"><span>读取失败，请重试。</span><button type="button" onClick={loadActivity}>重试</button></p>
            ) : activityRead.items.length ? (
              <ul className="activity-events">
                {activityRead.items.slice(0, showAllActivityRows ? activityRead.items.length : 5).map((item) => (
                  <li key={item.event_id}>
                    <span className={`activity-event-icon activity-event-${item.event_type.split(".").at(-1)}`} aria-hidden="true">
                      {item.event_type.endsWith("enabled") || item.event_type.endsWith("disabled") ? <Power size={18}/> : item.event_type.endsWith("updated") ? <Gear size={18}/> : item.event_type.endsWith("quota_alert") || item.event_type.endsWith("archived") ? <ChartBar size={18}/> : <Plus size={18}/>}
                    </span>
                    <span className="activity-event-copy">{visualFixture ? <small>{item.event_type.endsWith("created") ? `成功添加 ${item.model_name} 模型` : item.event_type.endsWith("updated") ? (item.event_id === "visual-event-5" ? `更新配置　调整 ${item.model_name} 路由优先级` : `更新配置　修改 ${item.model_name} 新额度配置`) : item.event_type.endsWith("quota_alert") ? `额度告警　${item.model_name} 使用率超过 90%` : item.event_type.endsWith("enabled") ? `启用模型　启用 ${item.model_name}` : item.description || item.model_name}</small> : <><b>{activityLabels[item.event_type] || "模型操作"}</b><small>{item.description || item.model_name}</small></>}</span>
                    <time dateTime={item.occurred_at || undefined}><span>{visualFixture && item.occurred_at ? (item.event_id === "visual-event-5" ? "12-07 08:16" : item.occurred_at.slice(5,10)+" "+item.occurred_at.slice(11,16)) : formatActivityTime(item.occurred_at)}</span>{item.actor && <small>{visualFixture && item.event_id === "visual-event-5" ? "Admin" : item.actor}</small>}</time>
                  </li>
                ))}
              </ul>
            ) : <p className="activity-state">暂无操作记录</p>}
          </article>
        </section>
      </main>
    </section>
    {addOpen && <AddModelDialog adapter={modelQuotaAdapter} open={addOpen} onRequestClose={requestAddClose} onClose={requestAddClose} onSaved={async (...args) => { requestAddClose(); await load(); await onAddModelSaved?.(...args); }} />}
    {editModel && <EditModelDialog key={editModel.id} model={editModel} availableModels={all} adapter={modelQuotaAdapter} onClose={() => setEditModel(null)} onSaved={async () => { setEditModel(null); await load(); }} />}
    {toggleModel && <ToggleModelDialog model={toggleModel} adapter={modelQuotaAdapter} onClose={() => setToggleModel(null)} onSaved={async () => { setToggleModel(null); await load(); }} />}
    {detailModel && <ModelDetailDialog key={detailModel.id} model={detailModel} adapter={modelQuotaAdapter} onClose={() => setDetailModel(null)} />}
    {connectionTestModel && <ModelConnectionTestDialog model={connectionTestModel} adapter={modelQuotaAdapter} onClose={() => setConnectionTestModel(null)} />}
    {archiveTarget && <ModelDeleteDialog model={archiveTarget} adapter={modelQuotaAdapter} visualFixture={Boolean(visualFixture)} onClose={() => setArchiveTarget(null)} onDeleted={async (id) => { if (visualFixture) { setAll((items) => items.filter((item) => item.id !== id)); setTotalCount((count) => Math.max(0,count-1)); } else await load(); setArchiveTarget(null); }} />}
    <dialog id="model-health-details" className="model-health-details" onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }}>
      <header><div><small>运行状态明细</small><h2>模型健康度</h2><p>按当前已读取的模型状态展示；视觉样例不代表实时连接检查。</p></div><button type="button" aria-label="关闭模型健康度明细" onClick={() => document.querySelector("#model-health-details")?.close()}>×</button></header>
      <div className="model-health-details__summary"><span><i data-tone="good"/>正常运行 <b>{healthyCount}</b></span><span><i data-tone="warning"/>告警模型 <b>{needsCheckCount}</b></span><span><i data-tone="bad"/>不可用 <b>{disabledCount}</b></span></div>
      <ul>{all.map((model) => { const label = model.healthStatus === "READY" ? "正常运行" : model.healthStatus === "DEGRADED" || ["RATE_LIMITED", "AUTH_ERROR", "TIMEOUT"].includes(model.healthStatus) ? "告警" : model.healthStatus === "UNAVAILABLE" ? "不可用" : model.healthStatus === "DISABLED" ? "已停用" : "状态未知"; return <li key={model.id}><ParentProviderLogo provider={model.provider === "Azure" ? "Microsoft Azure" : model.provider} visualFixture={isReferenceVisualFixture}/><span><b>{model.model}</b><small>{model.provider} · {model.enabled ? "已启用" : "未启用"}</small></span><em data-health={label}>{label}</em></li>; })}</ul>
      <footer><button type="button" onClick={() => document.querySelector("#model-health-details")?.close()}>关闭</button></footer>
    </dialog>

  </div></div>;
}
























