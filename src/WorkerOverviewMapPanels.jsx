import { CaretRight, MapPin } from "@phosphor-icons/react";
import { SectionCard } from "./ui/index.jsx";
import { projectWorkerMapResource } from "./workerMapProjection.js";
import "./workerOverviewMap.css";

const countText = (count) => count?.state === "KNOWN" ? String(count.value) : "—";
const display = (value) => typeof value === "string" && value.trim() ? value.trim() : "未知";
const freshnessLabel = (value) => ({ FRESH: "新鲜", STALE: "已过期", UNKNOWN: "未知" }[value] || "未知");

function metric(label, count) {
  return (
    <div className="worker-live-kpi" key={label}>
      <span>{label}</span>
      <strong>{countText(count)}</strong>
    </div>
  );
}

function resourceLabel(resource) {
  return resource.name || `VPS …${resource.id?.slice(-8) || "未知"}`;
}

export default function WorkerOverviewMapPanels({
  model,
  view = "global",
  countryCode = "",
  cityName = "",
  loading = false,
  error = null,
  onRetry,
  onNavigate,
  onOpenResource,
}) {
  const data = model?.state === "INCONSISTENT" ? null : model?.data;
  const resources = data?.resources || [];
  const selectedCountry = data?.countries?.find((item) => item.countryCode.toLowerCase() === String(countryCode).toLowerCase());
  const selectedCity = selectedCountry?.cities.find((item) => item.cityName.toLocaleLowerCase() === String(cityName).toLocaleLowerCase());
  const visibleResources = view === "city"
    ? selectedCity?.resources || []
    : view === "country"
      ? selectedCountry?.resources || []
      : resources;
  const points = visibleResources.map((resource) => ({ resource, point: projectWorkerMapResource(resource) })).filter((entry) => entry.point);
  const rangeX = points.length ? Math.max(...points.map(({ point }) => point.x)) - Math.min(...points.map(({ point }) => point.x)) : 0;
  const rangeY = points.length ? Math.max(...points.map(({ point }) => point.y)) - Math.min(...points.map(({ point }) => point.y)) : 0;
  const centerX = points.length ? (Math.min(...points.map(({ point }) => point.x)) + Math.max(...points.map(({ point }) => point.x))) / 2 : 50;
  const centerY = points.length ? (Math.min(...points.map(({ point }) => point.y)) + Math.max(...points.map(({ point }) => point.y))) / 2 : 50;
  const zoom = view === "global" || !points.length ? 1 : Math.min(4, Math.max(1, Math.min(rangeX ? 84 / rangeX : 4, rangeY ? 76 / rangeY : 4)));
  const mapTransform = view === "global" || !points.length ? "none" : `translate(${50 - centerX * zoom}%, ${50 - centerY * zoom}%) scale(${zoom})`;
  const locatedCount = resources.filter((resource) => resource.coordinateState === "LOCATED").length;
  const unlocatedCount = data?.unlocatedCount;
  const pageTitle = view === "city" ? `${selectedCity?.cityName || cityName}资源` : view === "country" ? `${selectedCountry?.countryName || countryCode}资源` : "全球资源";
  const drillRows = view === "global"
    ? (data?.countries || []).map((country) => ({ kind: "country", key: country.countryCode, label: country.countryName, detail: country.countryCode, count: country.resourceCount }))
    : view === "country"
      ? (selectedCountry?.cities || []).map((city) => ({ kind: "city", key: city.cityName, label: city.cityName, detail: "城市资源", count: city.resourceCount }))
      : visibleResources.map((resource) => ({ kind: "resource", key: resource.id, label: resourceLabel(resource), detail: `${display(resource.city)} · ${display(resource.statusRaw)}`, resource }));

  const navigateRow = (row) => {
    if (row.kind === "country") onNavigate?.("country", row.key);
    else if (row.kind === "city") onNavigate?.("city", countryCode, row.key);
    else onOpenResource?.(row.resource);
  };

  return (
    <div className="worker-live-overview" data-model-state={model?.state || "UNAVAILABLE"}>
      <div className="worker-live-kpi-strip" aria-label="真实资源指标">
        {metric("VPS资源总数", data?.kpis?.vpsTotal)}
        {metric("国家 / 地区数", data?.kpis?.countryCount)}
      </div>

      {loading && <div className="worker-live-state" role="status">正在读取 Worker 概览与地图数据…</div>}
      {error && (
        <div className="worker-live-state is-error" role="alert">
          <span>Worker 概览暂不可用{error.status ? `（HTTP ${error.status}）` : ""}。</span>
          <button type="button" onClick={onRetry}>重试</button>
        </div>
      )}
      {model?.state === "INCONSISTENT" && <div className="worker-live-state is-error" role="alert">概览与地图快照的资源身份或数量不一致；暂不合并展示。</div>}
      {model?.state === "PARTIAL" && <div className="worker-live-state" role="status">部分地图数据未知；未知字段不会以 0 或预览值代替。</div>}
      {!loading && !error && !model?.data && <div className="worker-live-state" role="status">尚无可展示的真实 Worker 地图快照。</div>}

      <SectionCard className={`map-section map-${view} worker-live-map-panel`}>
        <div className="map-heading">
          <h2>{pageTitle}分布</h2>
          <nav className="map-breadcrumb" aria-label="资源地图层级">
            <button type="button" onClick={() => onNavigate?.("global")}>全球</button>
            {view !== "global" && <><CaretRight size={11} /><button type="button" onClick={() => onNavigate?.("country", countryCode)}>{selectedCountry?.countryName || countryCode}</button></>}
            {view === "city" && <><CaretRight size={11} /><b>{selectedCity?.cityName || cityName}</b></>}
          </nav>
        </div>
        <div className="map-body worker-live-map-body">
          <aside className="map-summary" aria-label={`${pageTitle}数据摘要`}>
            <h2>{pageTitle}概览</h2>
            {view !== "global" && <div className="summary-country"><MapPin size={16} /><b>{view === "city" ? selectedCity?.cityName || cityName : selectedCountry?.countryName || countryCode}</b></div>}
            <div className="summary-list">
              <div><span>资源总数</span><b>{view === "global" ? countText(data?.kpis?.vpsTotal) : visibleResources.length}</b></div>
              {view === "global" && <div><span>已定位</span><b>{data ? locatedCount : "—"}</b></div>}
              <div><span>未定位</span><b>{data ? view === "global" ? countText(unlocatedCount) : visibleResources.filter((resource) => resource.coordinateState !== "LOCATED").length : "—"}</b></div>
              {view !== "global" && <div><span>Worker心跳</span><b>{visibleResources.length ? freshnessLabel(visibleResources.every((item) => item.workerPulseFreshness === "FRESH") ? "FRESH" : visibleResources.some((item) => item.workerPulseFreshness === "STALE") ? "STALE" : "UNKNOWN") : "未知"}</b></div>}
              {view !== "global" && <div><span>Runtime心跳</span><b>{visibleResources.length ? freshnessLabel(visibleResources.every((item) => item.runtimePulseFreshness === "FRESH") ? "FRESH" : visibleResources.some((item) => item.runtimePulseFreshness === "STALE") ? "STALE" : "UNKNOWN") : "未知"}</b></div>}
            </div>
            <small>位置仅来自真实 VPS 经纬度；缺失坐标不生成 Marker。状态与心跳新鲜度分别显示。</small>
          </aside>

          <div className="map-canvas worker-live-map-canvas" aria-label={`${pageTitle}地图`}>
            <div className="map-scene worker-live-map-scene" style={{ transform: mapTransform }}>
              <div className="map-grid" />
              {points.map(({ resource, point }) => (
                <button
                  key={resource.id}
                  type="button"
                  className="map-marker worker-live-map-marker"
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  title={`${resourceLabel(resource)} · ${display(resource.countryName)} · ${display(resource.city)} · ${display(resource.statusRaw)} · Worker ${freshnessLabel(resource.workerPulseFreshness)} · Runtime ${freshnessLabel(resource.runtimePulseFreshness)}`}
                  aria-label={`打开资源 ${resourceLabel(resource)}，${display(resource.countryName)}，${display(resource.city)}，${display(resource.statusRaw)}`}
                  onClick={() => view === "global" && resource.countryCode ? onNavigate?.("country", resource.countryCode) : view === "country" && resource.city ? onNavigate?.("city", countryCode, resource.city) : onOpenResource?.({ entityType: "VPS_RESOURCE", id: resource.id, name: resourceLabel(resource), countryCode: resource.countryCode, city: resource.city })}
                ><i /><span>{resourceLabel(resource)}<small>{display(resource.statusRaw)}</small></span></button>
              ))}
              {!points.length && <div className="worker-live-unlocated" role="status">当前范围没有带有效真实坐标的资源点。可从右侧列表继续下钻查看资源。</div>}
            </div>
          </div>

          <aside className="top-list" aria-label={`${pageTitle}下钻列表`}>
            <h2>{view === "global" ? "国家 / 地区" : view === "country" ? "城市" : "资源"}（{drillRows.length}）</h2>
            <div className="top-list-items">
              {drillRows.map((row, index) => (
                <button type="button" className="top-row worker-live-drill-row" key={`${row.kind}:${row.key}`} disabled={row.kind === "resource" && !row.resource.id} onClick={() => navigateRow(row)}>
                  <span className={`rank rank-${index + 1}`}>{index + 1}</span>
                  <span>{row.label}<small>{row.detail}</small></span>
                  {row.kind === "resource" ? <b>{freshnessLabel(row.resource.pulseFreshness)}</b> : <b>{row.count}</b>}
                  <CaretRight size={14} />
                </button>
              ))}
              {!drillRows.length && <div className="worker-live-empty">此范围暂无资源记录。</div>}
            </div>
          </aside>
        </div>
      </SectionCard>
    </div>
  );
}
