import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, Info, MagnifyingGlass, WarningCircle, X } from "@phosphor-icons/react";
import { projectRouteAdviceList, ROUTE_ADVICE_RISKS } from "./routingAdviceContract.js";
import { filterRouteAdviceItems, projectRouteAdviceFilterOptions, UNKNOWN_CATEGORY_FILTER, UNKNOWN_MODEL_FILTER } from "./routingAdviceFilters.js";
import { createRoutingAdviceRequestFlow } from "./routingAdviceRequestFlow.js";
import { AiVisualFixtureNotice, getAiVisualFixtureData } from "./aiVisualFixtureProvider.jsx";
import { createRoutingAdviceChangeCart } from "./routingAdviceChangeCart.js";
import { validateRoutingAdviceCart } from "./routingAdviceCartValidation.js";
import { createRoutingAdviceCandidateTestFlow, routingAdviceCandidateFingerprint } from "./routingAdviceCandidateTestFlow.js";
import { createRoutingAdvicePreviewOnlyReceipt, getRoutingAdviceActionAvailability } from "./routingAdviceApplyGate.js";
import RoutingAdviceSelect from "./RoutingAdviceSelect.jsx";
import { formatRoutingAdviceTarget, projectRoutingAdviceConfigComparison } from "./routingAdviceConfigComparison.js";
import "./ai-feature.css";
import "./routing-advice-page.css";
import "./routing-advice-dashboard.css";
import "./routing-advice-reference-layout.css";
import RoutingAdviceFrozenDashboard from "./RoutingAdviceFrozenDashboard.jsx";

const riskLabels = { HIGH: "高风险", MEDIUM: "中风险", LOW: "低风险", UNKNOWN: "未知" };
const routeAdviceVisualFixture = getAiVisualFixtureData("routingAdvice");
const routeAdviceRows = routeAdviceVisualFixture?.recommendations || [];
const fixture = projectRouteAdviceList(routeAdviceRows);
const initialResponse = Object.freeze({ source: routeAdviceVisualFixture ? "VISUAL_QA_ONLY" : "NOT_CONNECTED", recommendations: routeAdviceRows });
function projectLocalProposal(item) {
  const candidates = [
    ["model_id", item.current.model, item.recommended.model],
    ["provider_id", item.current.provider, item.recommended.provider],
    ["usage_strategy", item.current.usageStrategy, item.recommended.usageStrategy],
    ["rpm", item.current.rpm == null ? null : String(item.current.rpm), item.recommended.rpm == null ? null : String(item.recommended.rpm)],
  ];
  const candidate = candidates.find(([, current, proposed]) => current && proposed && current !== proposed);
  const worker = item.current.worker || item.recommended.worker;
  const runtime = item.current.runtime || item.recommended.runtime;
  if (!candidate || !worker || !runtime) return null;
  const proposal = { recommendationId: item.id, targetKey: `${worker}/${runtime}`, actionField: candidate[0], currentValue: candidate[1], proposedValue: candidate[2], targetProvider: item.recommended.provider, targetModel: item.recommended.model, currentConfigFingerprint: JSON.stringify(item.current), proposedConfigFingerprint: JSON.stringify(item.recommended), risk: item.risk, eligible: item.eligible, requiredCapability: item.requiredCapability, connectionTestRequired: item.connectionTestRequired };
  return { ...proposal, candidateFingerprint: routingAdviceCandidateFingerprint(proposal) };
}
const displayTarget = formatRoutingAdviceTarget;

export default function RoutingAdvicePage({ adapter = null, validationFacts = {} } = {}) {
  const flow = useMemo(() => createRoutingAdviceRequestFlow({ adapter, initialData: initialResponse }), [adapter]);
  const candidateTestFlow = useMemo(() => createRoutingAdviceCandidateTestFlow({ adapter }), [adapter]);
  const request = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
  const candidateTest = useSyncExternalStore(candidateTestFlow.subscribe, candidateTestFlow.getSnapshot, candidateTestFlow.getSnapshot);
  useEffect(() => () => flow.invalidate(), [flow]);
  useEffect(() => () => candidateTestFlow.invalidate(), [candidateTestFlow]);
  const [risk, setRisk] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [model, setModel] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const responseRows = Array.isArray(request.data?.recommendations) ? request.data.recommendations
    : Array.isArray(request.data?.items) ? request.data.items : routeAdviceRows;
  const data = useMemo(() => projectRouteAdviceList(responseRows), [responseRows]);
  const selected = data.items.find((item) => item.id === selectedId) || null;
  const isRoutingAdviceTestMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("routingAdviceTestMode") === "1";
  const selectedProposal = selected ? projectLocalProposal(selected) : null;
  const selectedConfigRows = selected ? projectRoutingAdviceConfigComparison(selected.current, selected.recommended) : [];
  const selectedFingerprint = selectedProposal?.candidateFingerprint || null;
  const cartRef = useRef(null);
  if (!cartRef.current) cartRef.current = createRoutingAdviceChangeCart();
  const [cart, setCart] = useState(() => cartRef.current.getSnapshot());
  const [cartNotice, setCartNotice] = useState("");
  const [validationResult, setValidationResult] = useState(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewReceipt, setPreviewReceipt] = useState(null);
  const [validationClock, setValidationClock] = useState(() => Date.now());
  const [preflightExpired, setPreflightExpired] = useState(false);
  const previewTriggerRef = useRef(null);
  useEffect(() => {
    candidateTestFlow.select(selectedProposal);
    setValidationResult(null);
    setPreviewReceipt(null);
    setPreflightExpired(false);
  }, [candidateTestFlow, selectedFingerprint]);
  useEffect(() => {
    if (!previewDialogOpen) return undefined;
    const cancelOnEscape = (event) => { if (event.key === "Escape") setPreviewDialogOpen(false); };
    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, [previewDialogOpen]);
  useEffect(() => {
    const expiry = validationResult?.evidenceValidUntil;
    if (!Number.isFinite(expiry)) return undefined;
    const timer = setTimeout(() => {
      setValidationClock(Date.now());
      setValidationResult((current) => current?.evidenceValidUntil === expiry && expiry <= Date.now() ? null : current);
      setPreflightExpired(true);
    }, Math.max(0, expiry - Date.now()));
    return () => clearTimeout(timer);
  }, [validationResult]);
  const filterOptions = useMemo(() => projectRouteAdviceFilterOptions(data.items), [data]);
  const visible = useMemo(() => filterRouteAdviceItems(data.items, { category, model, risk, search }), [data, category, model, risk, search]);
  const hasActiveFilters = category !== "ALL" || model !== "ALL" || risk !== "ALL" || Boolean(search.trim());
  const runMockPreflight = () => {
    const facts = {};
    const evidenceExpiries = [];
    for (const item of cart.items) {
      const known = validationFacts && typeof validationFacts === "object" ? validationFacts[item.recommendationId] : null;
      const currentRecommendation = data.items.find((candidate) => candidate.id === item.recommendationId);
      const currentProposal = currentRecommendation ? projectLocalProposal(currentRecommendation) : null;
      const candidateStillCurrent = Boolean(currentProposal?.candidateFingerprint && currentProposal.candidateFingerprint === item.candidateFingerprint);
      const candidateEvidence = candidateStillCurrent && item.candidateFingerprint ? candidateTestFlow.getEvidence(item.candidateFingerprint) : null;
      if (item.connectionTestRequired === true && candidateEvidence) evidenceExpiries.push(candidateEvidence.validUntil);
      const evidence = Boolean(candidateEvidence);
      facts[item.recommendationId] = { ...(known && typeof known === "object" ? known : {}), fingerprintFresh: candidateStillCurrent ? known?.fingerprintFresh : false, connectionTestPassed: Boolean(evidence) };
    }
    const result = validateRoutingAdviceCart(cart, facts);
    const withFreshness = { ...result, evaluatedAt: Date.now(), evidenceValidUntil: evidenceExpiries.length ? Math.min(...evidenceExpiries) : null };
    setValidationClock(Date.now());
    setPreflightExpired(false);
    setValidationResult(withFreshness);
    return withFreshness;
  };
  const routeActionAvailability = getRoutingAdviceActionAvailability(cart, validationResult && (!Number.isFinite(validationResult.evidenceValidUntil) || validationResult.evidenceValidUntil > validationClock) ? validationResult : null);
  const openPreviewOnlyReview = () => {
    const result = runMockPreflight();
    if (getRoutingAdviceActionAvailability(cart, result).previewOnlyEnabled) setPreviewDialogOpen(true);
  };
  const cancelPreviewOnlyReview = () => setPreviewDialogOpen(false);
  const confirmPreviewOnlyReview = () => {
    const result = runMockPreflight();
    const receipt = createRoutingAdvicePreviewOnlyReceipt(cart, result);
    if (!receipt) { setPreviewDialogOpen(false); return; }
    setPreviewReceipt(receipt);
    setPreviewDialogOpen(false);
  };
  const runCandidateConnectionTest = () => { if (selectedProposal) void candidateTestFlow.run(selectedProposal); };
  const runReanalysis = () => {
    void flow.reanalyze({ risk_level: risk === "ALL" ? null : risk, search: search.trim() || null });
  };
  const addSelectedChange = () => {
    if (!selectedProposal) return;
    const result = cartRef.current.add(selectedProposal);
    setCart(cartRef.current.getSnapshot());
    setValidationResult(null);
    setPreviewReceipt(null);
    setPreflightExpired(false);
    setCartNotice(result.accepted ? "LOCAL MOCK · 已加入变更集合" : result.error?.code || "INVALID_CHANGE");
  };
  const removeChange = (changeId) => {
    const result = cartRef.current.remove(changeId);
    setCart(result.snapshot);
    setValidationResult(null);
    setPreviewReceipt(null);
    setPreflightExpired(false);
    setCartNotice(result.removed ? "LOCAL MOCK · 已移除变更" : result.error?.code || "CHANGE_NOT_FOUND");
  };
  const requestLabel = request.status === "NOT_CONNECTED" ? "接口未连接 · 本地示例"
    : request.status === "IDLE" ? "Mock 接口就绪"
      : request.status === "LOADING" ? "正在重新分析…"
        : request.status === "SUCCESS" ? "Mock 分析完成"
          : `重新分析失败 (${request.error?.code || "ROUTING_ADVICE_REQUEST_FAILED"})`;

  if (!isRoutingAdviceTestMode && (routeAdviceVisualFixture || !adapter)) return <RoutingAdviceFrozenDashboard />;
  return <div className="ai-feature routing-advice-page">
    <AiVisualFixtureNotice />
    <main className="routing-advice">
      <header className="routing-advice__heading">
        <div className="routing-advice__actions"><span className={`routing-advice__request-state state-${request.status.toLowerCase()}`} role="status" aria-live="polite">{requestLabel}</span><button type="button" className="routing-advice__reanalyze" onClick={runReanalysis} disabled={request.status === "NOT_CONNECTED" || request.status === "LOADING"}>{request.status === "LOADING" ? "正在分析" : "模拟重新分析"}</button></div>
        <div><span className="routing-advice__eyebrow">AI CENTER / ROUTING ADVICE</span><h1>调度建议</h1><p>查看风险分类与当前/推荐路由值；当前页面仅展示本地合成样例。</p></div>
      </header>

      <div className="routing-advice__disclosure" role="note"><Info size={17} /><span><b>本地样例 · 只读预览</b> · 未连接真实路由或遥测数据；此页不会应用或回滚配置。</span></div>

      <section className="routing-advice__risk-summary" aria-label="风险分类计数">
        {ROUTE_ADVICE_RISKS.map((level) => <button type="button" key={level} className={`routing-advice__risk-card risk-${level.toLowerCase()} ${risk === level ? "is-selected" : ""}`} onClick={() => setRisk(risk === level ? "ALL" : level)} aria-pressed={risk === level}>
          <span>{riskLabels[level]}</span><strong>{data.counts[level]}</strong><small>合成样例</small>
        </button>)}
      </section>

      <section className="routing-advice__kpis" aria-label="本地建议摘要">
        {[['建议条目',data.items.length,'来自合成 fixture'],['高风险建议',data.counts.HIGH,'风险标签计数'],['有资格候选',data.items.filter(item=>item.eligible).length,'仍需逐项检查与测试'],['预计节省','UNKNOWN','无计价基线'],['运行成功率','UNKNOWN','未连接遥测'],['有效路由版本','UNKNOWN','只读状态']].map(([label,value,note],index)=><article key={label}><i>{['＄','△','✓','¥','▥','◈'][index]}</i><span><small>{label}</small><b>{value}</b><em>{note}</em></span></article>)}
      </section>

      <section className="routing-advice__overview" aria-label="Routing strategy and engine overview">
        <article className="routing-advice__strategy panel">
          <header><div><h2>智能调度策略</h2><p>基于演示规则的策略分类，不代表线上生效配置</p></div><span className="routing-advice__demo-tag">本地示例</span></header>
          <div className="routing-advice__strategy-grid">
            {[['成本优先','在满足能力要求时优先检查低成本候选','¥'],['稳定性优先','优先关注可用状态与连接测试要求','✓'],['性能平衡','综合观察延迟与成功率信号','↗'],['负载均衡','检查路由流量分配建议','◉'],['智能切换','切换建议需逐项校验与预检','⇄'],['时段优化','可用性未知时保留未知状态','◷']].map(([title,desc,icon])=><div className="routing-advice__strategy-card" key={title}><i>{icon}</i><span><b>{title}</b><small>{desc}</small></span></div>)}
          </div>
        </article>
        <article className="routing-advice__engine panel">
          <header><div><h2>调度优化引擎</h2><p>推荐投影 · 未连接实时遥测</p></div><span className="routing-advice__engine-state"><i/>本地预览</span></header>
          <div className="routing-advice__engine-body"><div className="routing-advice__signal-list"><span>建议样例 <b>{data.items.length}</b></span><span>风险分类 <b>{ROUTE_ADVICE_RISKS.length}</b></span><span>状态遥测 <b>UNKNOWN</b></span><span>成本数据 <b>UNKNOWN</b></span></div><div className="routing-advice__engine-core"><div className="routing-advice__cube"><i/><i/><i/><i/></div><b>AI 调度引擎</b><small>只读 · 合成数据</small></div><div className="routing-advice__signal-list"><span>候选过滤 <b>✓</b></span><span>能力校验 <b>UNKNOWN</b></span><span>连接测试 <b>按项执行</b></span><span>配置应用 <b>未连接</b></span></div></div>
          <footer>显示值均来自本地 fixture；不会调用上游或修改有效路由</footer>
        </article>
        <article className="routing-advice__rules panel"><header><div><h2>规则概览</h2><p>规则详情尚未连接</p></div><span className="routing-advice__demo-tag">演示规则</span></header><div className="routing-advice__rule-list">{[['◈','成本信号','UNKNOWN'],['♧','健康状态','UNKNOWN'],['▤','配额信号','UNKNOWN'],['◷','连接测试','按项要求']].map(([icon,label,value])=><div key={label}><i>{icon}</i><span><b>{label}</b><small>只读状态</small></span><em>{value}</em></div>)}</div></article>
        <article className="routing-advice__version-panel panel"><header><div><h2>策略版本</h2><p>未连接历史版本</p></div><span className="routing-advice__demo-tag">未连接</span></header><div className="routing-advice__version"><small>当前有效版本</small><b>UNKNOWN</b><span>未连接版本记录</span></div></article>
      </section>

      <div className="routing-advice__impact-row">
      <section className="routing-advice__impact panel" aria-label="关键维度影响预览">
        <header><div><h2>关键维度影响预览</h2><p>尚无可验证的历史基线，数值保持 UNKNOWN</p></div><span><i/>当前状态　<i/>建议值</span></header>
        <div className="routing-advice__impact-grid">{[['预计成本变化','UNKNOWN','未连接计价数据'],['成功率变化','UNKNOWN','未连接运行遥测'],['响应延迟','UNKNOWN','未连接性能数据']].map(([title,value,note])=><article key={title}><i>{title==='响应延迟'?'ϟ':title==='成功率变化'?'▥':'¥'}</i><span><b>{title}</b><strong>{value}</strong><small>{note}</small></span><div className="routing-advice__unknown-bars"><i/><i/></div></article>)}</div>
      </section>

      <section className="routing-advice__effects panel" aria-label="优化效果预览">
        <header><div><h2>优化效果预览</h2><p>运行遥测未连接，实际变化暂不可估</p></div><span><i/>当前值　<i/>建议值</span></header>
        <div className="routing-advice__effects-grid">{[['任务成功率','UNKNOWN'],['平均响应延迟','UNKNOWN'],['单次任务成本','UNKNOWN'],['每日处理量','UNKNOWN']].map(([label,value])=><article key={label}><span><b>{label}</b><strong>{value}</strong></span><div className="routing-advice__unknown-bars"><i/><i/></div></article>)}</div>
      </section>
      </div>

      <section className="routing-advice__list-panel">
        <header><div><h2>建议列表 <span>{visible.length}</span></h2><p>分类按接口返回值筛选；缺失字段保持 UNKNOWN。</p></div></header>
        <div className="routing-advice__filters" aria-label="建议列表筛选">
          <div className="routing-advice__category-tabs" role="group" aria-label="推荐分类">
            <button type="button" className={category === "ALL" ? "is-selected" : ""} aria-pressed={category === "ALL"} data-testid="advice-category-all" onClick={() => setCategory("ALL")}>全部 <b>{data.items.length}</b></button>
            {filterOptions.categories.map(({ value, count }) => <button type="button" key={value} className={category === value ? "is-selected" : ""} aria-pressed={category === value} data-testid={`advice-category-${value}`} onClick={() => setCategory(value)}>{value} <b>{count}</b></button>)}
            {filterOptions.unknownCategoryCount > 0 && <button type="button" className={category === UNKNOWN_CATEGORY_FILTER ? "is-selected" : ""} aria-pressed={category === UNKNOWN_CATEGORY_FILTER} data-testid="advice-category-unknown" onClick={() => setCategory(UNKNOWN_CATEGORY_FILTER)}>UNKNOWN / 未提供 <b>{filterOptions.unknownCategoryCount}</b></button>}
          </div>
          <div className="routing-advice__filter-controls">
            <div className="routing-advice__select-field"><span>模型</span><RoutingAdviceSelect ariaLabel="推荐模型筛选" testId="advice-model-filter" value={model} onChange={setModel} options={[{ value: "ALL", label: "全部模型" }, ...filterOptions.models.map(({ value, count }) => ({ value, label: `${value} (${count})` })), ...(filterOptions.unknownModelCount > 0 ? [{ value: UNKNOWN_MODEL_FILTER, label: `UNKNOWN / 未知模型 (${filterOptions.unknownModelCount})` }] : [])]} /></div>
            <label className="is-unavailable"><span>状态</span><select aria-label="状态筛选不可用：当前 DTO 未提供推荐状态" data-testid="advice-status-filter" value="UNKNOWN" disabled title="当前 DTO 未提供 recommendation status。eligible 和 connection_test_required 不能等同于状态。"><option value="UNKNOWN">UNKNOWN · DTO 未提供</option></select></label>
            <div className="routing-advice__select-field"><span>风险级别</span><RoutingAdviceSelect ariaLabel="风险级别筛选" testId="advice-risk-filter" value={risk} onChange={setRisk} options={[{ value: "ALL", label: "全部风险" }, ...ROUTE_ADVICE_RISKS.map((level) => ({ value: level, label: riskLabels[level] }))]} /></div>
            <label className="routing-advice__search"><MagnifyingGlass size={15} /><input data-testid="advice-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索建议、任务、Worker 或模型…" aria-label="搜索建议、任务、Worker 或模型" /></label>
            {hasActiveFilters && <button type="button" className="routing-advice__clear-filters" data-testid="advice-clear-filters" onClick={() => { setCategory("ALL"); setModel("ALL"); setRisk("ALL"); setSearch(""); }}>清除筛选</button>}
          </div>
          <p className="routing-advice__filter-note" role="note"><WarningCircle size={13} /> 分类仅列出 DTO 实际提供的值；状态筛选不可用（DTO 未提供 status 字段）。</p>
        </div>
        {visible.length ? <div className="routing-advice__table-wrap"><table><thead><tr><th>风险</th><th>建议</th><th>作用范围</th><th>当前值</th><th>推荐路由</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id} onClick={() => setSelectedId(item.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(item.id); } }} aria-label={`查看 ${item.title} 路由对照`}>
          <td><span className={`routing-advice__risk-pill risk-${item.risk.toLowerCase()}`}>{riskLabels[item.risk]}</span></td><td><b>{item.title}</b><small>{item.id}</small></td><td>{item.scope || "未知"}</td><td>{displayTarget(item.current)}</td><td><span className="routing-advice__recommended">{displayTarget(item.recommended)}<ArrowRight size={14} /></span></td>
        </tr>)}</tbody></table></div> : <div className="routing-advice__empty"><b>没有匹配的建议</b><span>调整风险分类或搜索条件。</span></div>}
        <footer>来源：{fixture.source} · 生产验证：否</footer>
      </section>

      {selected && <div className="routing-advice__backdrop" role="presentation" onClick={() => setSelectedId(null)}><aside className="routing-advice__drawer" role="dialog" aria-modal="true" aria-labelledby="routing-advice-detail-title" onClick={(event) => event.stopPropagation()}>
        <header className="routing-advice__detail-header"><div><small id="routing-advice-detail-title">建议详情</small><span className="routing-advice__detail-type">{selected.category || "UNKNOWN"}</span></div><button type="button" aria-label="关闭建议详情" onClick={() => setSelectedId(null)}><X size={18} /></button></header>
        <div className="routing-advice__detail-content">
          <section className="routing-advice__detail-summary"><h2><small>建议标题</small>{selected.title}</h2><div className="routing-advice__detail-problem"><b>问题描述</b><p>{selected.reason || "UNKNOWN"}</p></div></section>
          <section className="routing-advice__route-recommendation" aria-label="推荐调整">
            <h3>推荐调整</h3>
            <div className="routing-advice__route-compare" data-testid="advice-route-comparison">
              <div><small>当前模型</small><b>{displayTarget(selected.current)}</b><p className="routing-advice__traffic-share"><span>当前流量占比</span><b>{selected.current.trafficShare ?? "UNKNOWN"}</b></p></div>
              <ArrowRight size={18} aria-hidden="true" />
              <div><small>目标模型</small><b>{displayTarget(selected.recommended)}</b><p className="routing-advice__traffic-share"><span>建议流量占比</span><b>{selected.recommended.trafficShare ?? "UNKNOWN"}</b></p></div>
            </div>
          </section>
          <section className="routing-advice__estimated-effects" aria-label="预计效果" data-testid="advice-estimated-effects">
            <h3>预计效果</h3><div>{[["预计节省成本", "UNKNOWN"], ["预计成功率", "UNKNOWN"], ["预计延迟变化", "UNKNOWN"]].map(([label, value]) => <article key={label}><small>{label}</small><b>{value}</b><span>暂无可验证数据</span></article>)}</div>
          </section>
          {isRoutingAdviceTestMode && <section className="routing-advice__test-mode" data-testid="advice-test-mode" aria-label="Routing advice test mode">
            <header><b>TEST MODE · LOCAL ONLY</b><span>辅助配置与候选测试，不属于正式建议预览</span></header>
            <details className="routing-advice__full-config" open data-testid="advice-full-config">
              <summary>完整配置</summary>
              <section className="routing-advice__config-comparison" aria-label="完整配置对比" data-testid="advice-config-comparison">
                <header><b>当前配置与建议配置</b><span>缺失信息保持 UNKNOWN</span></header>
                <div className="routing-advice__config-comparison-head"><span>字段</span><span>当前</span><span>建议</span></div>
                {selectedConfigRows.map((row) => <div className="routing-advice__config-comparison-row" key={row.key} data-config-field={row.key}><b>{row.label}</b><span>{row.current}</span><span>{row.recommended}</span></div>)}
              </section>
            </details>
            <div className="routing-advice__test-tools">
              {selectedProposal ? <button type="button" className="routing-advice__cart-add" onClick={addSelectedChange}>加入提案集 · Mock</button> : <p className="routing-advice__cart-unavailable">当前建议缺少可比较配置，无法加入提案集。</p>}
              {selectedProposal && <section className="routing-advice__candidate-test" aria-label="候选连接测试">
                <button type="button" className="routing-advice__candidate-test-button" onClick={runCandidateConnectionTest} disabled={candidateTest.status === "NOT_CONNECTED" || candidateTest.status === "LOADING"} data-testid="candidate-connection-test">
                  {candidateTest.status === "LOADING" ? "测试中 · Mock" : candidateTest.status === "NOT_CONNECTED" ? "候选连接测试 · 未连接" : "测试候选连接 · Mock"}
                </button>
                <div className={"routing-advice__candidate-test-state state-" + candidateTest.status.toLowerCase()} role="status" aria-live="polite" data-testid="candidate-connection-state" data-status={candidateTest.status}>
                  <b>{candidateTest.status}</b>{candidateTest.error && <span>{candidateTest.error.code}</span>}
                  {candidateTest.result && <small>候选配置测试凭据 · 有效至 {new Date(candidateTest.result.validUntil).toISOString()} · 本地 Mock</small>}
                  <small>模拟测试，不会更改当前生效路由。</small>
                </div>
              </section>}
              {cartNotice && <p className="routing-advice__cart-feedback" role="status">{cartNotice}</p>}
            </div>
          </section>}
        </div>
        <footer className="routing-advice__detail-actions"><button type="button" onClick={() => setSelectedId(null)} data-testid="advice-detail-cancel">取消</button><button type="button" disabled aria-disabled="true" title="真实应用需要连接后端和权限校验" data-testid="advice-detail-apply">应用建议 · 未连接</button></footer>
      </aside></div>}
      <section className="routing-advice__history panel"><header><div><h2>近期执行记录</h2><p>当前没有已生效的路由变更记录</p></div><span>只读</span></header><div className="routing-advice__history-empty"><b>暂无执行记录</b><span>提议车与预检仅保存在当前页面内存，不生成已应用版本。</span></div></section>

      <section className="routing-advice__change-cart" aria-label="Local change proposal set">
        <div className="routing-advice__action-boundary" role="note">
          <b>Effective route version: UNKNOWN</b><span>Cart revision {cart.version} is local proposal state, not an applied version.</span>
          <span>Real apply: NOT_CONNECTED · Rollback snapshot: UNKNOWN</span>
        </div>
        {preflightExpired && <p className="routing-advice__preflight-expired" role="status">Candidate test evidence expired; rerun the candidate test and mock preflight.</p>}
        <div className="routing-advice__route-actions">
          <button type="button" disabled data-testid="route-apply-disabled">Apply route · NOT_CONNECTED</button>
          <button type="button" disabled data-testid="route-rollback-disabled">Rollback · SNAPSHOT_UNKNOWN</button>
          <button type="button" ref={previewTriggerRef} onClick={openPreviewOnlyReview} disabled={!routeActionAvailability.previewOnlyEnabled} data-testid="route-preview-only">Review proposal · PREVIEW_ONLY</button>
        </div>
        {previewReceipt && <div className="routing-advice__preview-receipt" role="status" data-testid="preview-only-receipt">
          <b>PREVIEW_ONLY · REVIEWED</b><span>Local proposal revision {previewReceipt.cartVersion}; effective route version UNKNOWN.</span><span>Effective route unchanged · Policy / Router / Runtime mutations: 0</span>
        </div>}
        <header><div><h2>本地变更集合 <span>{cart.summary.itemCount}</span></h2><p>LOCAL MOCK · 提议不会改变实际路由</p></div><b>版本 {cart.version}</b></header>
        {cart.items.length ? <ul>{cart.items.map((item) => <li key={item.changeId}><span className={`routing-advice__risk-pill risk-${item.risk.toLowerCase()}`}>{riskLabels[item.risk]}</span><div><b>{item.actionField}</b><small>{item.currentValue ?? "UNKNOWN"} → {item.proposedValue}</small><small>{item.targetKey}</small></div><button type="button" aria-label={`移除 ${item.changeId}`} onClick={() => removeChange(item.changeId)}>移除</button></li>)}</ul>
          : <div className="routing-advice__change-cart-empty">当前没有提议项。有效配置保持只读。</div>}
        <footer><span>条目 {cart.summary.itemCount}</span><span>UNKNOWN 风险 {cart.summary.riskCounts.UNKNOWN}</span><span>预计月节省 {cart.summary.estimatedMonthlySavings ?? "UNKNOWN"}</span><span>成本状态 {cart.summary.costStatus}</span></footer>
        <button type="button" className="routing-advice__cart-validate" onClick={runMockPreflight}>模拟安全预检 (Mock)</button>
        {validationResult && <div className={`routing-advice__validation-result status-${validationResult.status.toLowerCase()}`} role="status" aria-live="polite" data-status={validationResult.status}>
          <b>{validationResult.status}</b>{validationResult.blockers.length > 0 && <span>阻断：{validationResult.blockers.join(" · ")}</span>}{validationResult.warnings.length > 0 && <span>提醒：{validationResult.warnings.join(" · ")}</span>}
          <small>有效路由未变更 · Policy / Router / Runtime mutations: 0</small>
        </div>}
        <div className="routing-advice__change-cart-note" role="status" aria-live="polite">{cartNotice || "Policy / Router / Runtime changes: 0"}</div>
      </section>
      {previewDialogOpen && <div className="routing-advice__preview-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) cancelPreviewOnlyReview(); }}>
        <section className="routing-advice__preview-dialog" role="dialog" aria-modal="true" aria-labelledby="routing-preview-only-title">
          <header><div><small>LOCAL SYNTHETIC REVIEW</small><h2 id="routing-preview-only-title">PREVIEW_ONLY · no route changes</h2></div><button type="button" aria-label="Close preview review" onClick={cancelPreviewOnlyReview}>×</button></header>
          <p>Review these proposal values only. Confirming this preview creates no applied version, snapshot, persistence, or route change. Effective route version: UNKNOWN.</p>
          <ol>{cart.items.map((item) => <li key={item.changeId}><b>{item.targetKey}</b><span>{item.actionField}: {item.currentValue ?? "UNKNOWN"} → {item.proposedValue ?? "UNKNOWN"}</span><small>Risk: {item.risk} · recommendation: {item.recommendationId}</small></li>)}</ol>
          <footer><button type="button" onClick={cancelPreviewOnlyReview} data-testid="preview-only-cancel">Cancel / Back</button><button type="button" onClick={confirmPreviewOnlyReview} data-testid="preview-only-confirm">Confirm preview only</button></footer>
        </section>
      </div>}
    </main>
  </div>;
}
