import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  Check,
  CheckCircle,
  ClipboardText,
  CloudArrowUp,
  Copy,
  Cube,
  Desktop,
  DotsThree,
  DownloadSimple,
  Eye,
  FileText,
  GearSix,
  GlobeHemisphereWest,
  House,
  Info,
  Key,
  Lightning,
  List,
  MapPin,
  Monitor,
  PencilSimple,
  Play,
  Plus,
  Prohibit,
  Pulse,
  Repeat,
  RocketLaunch,
  Stack,
  DeviceMobile,
  Trash,
  UploadSimple,
  UsersThree,
  WarningCircle,
  WifiHigh,
  X,
  CircleNotch,
  Pause,
  Funnel,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import {
  Button,
  EmptyState,
  ErrorState,
  FilterDropdown,
  IconButton,
  LoadingState,
  ProgressBar,
  SectionCard,
  StateBanner,
  StatusPill,
} from "./ui/index.jsx";
import ModelQuotaPage from "./features/ai/ModelQuotaPage.jsx";
import AddModelPage from "./features/ai/AddModelPage.jsx";
import RoutingAdvicePage from "./features/ai/RoutingAdvicePage.jsx";
import { UsageCostPreview } from "./features/ai/UsageCostPreview.jsx";
import AIOverviewPage from "./features/ai/OverviewPage.jsx";
import { modelQuotaAdapter } from "./features/ai/modelQuotaAdapter.js";
import {
  globalResources,
  globalMapNodes,
  globalSummary,
  indonesiaSummary,
  jakartaResources,
  jakartaSummary,
  kpiSets,
  kpis,
  packageProfiles,
  providerConsoleUrls,
  resources,
  topCities,
  topCountries,
  countryPreviews,
  countryRows,
  cityRows,
} from "./mock/workerResources.js";
import { countries, countryByCode } from "./mock/countries.js";
import BulkImportV3 from "./BulkImportV3.jsx";
import BulkProgress from "./BulkProgress.jsx";
import PackageConfig, { PackageLogo } from "./PackageConfig.jsx";
import { cityZh } from "./mock/localization.js";
import { cityCoordinates } from "./mock/cityCoordinates.js";
import CountryOutlineMap, { getCountryMapLayout } from "./CountryOutlineMap.jsx";
import { BrandMark, NavigationMark } from "./ui/NavigationMarks.jsx";
import { workerStatusPresentation } from "./workerStatusPresentation.js";
import { initialWorkerResourceReadSnapshot, workerResourceListActionAvailability } from "./workerResourceListActions.js";
import { workerHeartbeatPreview } from "./workerHeartbeatPreview.js";
import { createWorkerResourceReadAdapter } from "./workerResourceReadAdapter.js";
import { buildWorkerOverviewMapModel } from "./workerOverviewMapModel.js";
import { createWorkerResourceWriteAdapter } from "./workerResourceWriteAdapter.js";
import { getRdpAddressErrors, formatRdpEndpoint } from "./workerRdpValidation.js";
import { filterWorkerRowsByGeography, isStableWorkerResource, projectWorkerResourceLocation } from "./workerCityLink.js";
import { projectWorkerMapResource, projectWorkerWorldCoordinate } from "./workerMapProjection.js";
import WorkerWorldOutlineMap from "./WorkerWorldOutlineMap.jsx";
import { getWorkerHomeFixtureScope, getWorkerVisualFixture, isWorkerVisualFixtureEnabled, WorkerVisualFixtureNotice } from "./workerVisualFixtureProvider.jsx";


const flags = Object.fromEntries(countries.map(({ code }) => {
  const normalized = code.toLowerCase();
  return [normalized, `/assets/flags/${normalized}.svg`];
}));
const navItems = [
  ["首页", House],
  ["产品中心", Cube],
  ["任务中心", ClipboardText],
  ["客户线索", UsersThree],
  ["合同管理中心", FileText],
  ["客服中心", WifiHigh],
  ["AI智能模型中心", Lightning],
  ["Worker资源中心", Stack],
  ["数据分析", Pulse],
  ["系统设置", GearSix],
];
const aiItems = ["AI总览", "模型与额度", "用量与成本", "调度建议", "设置"];

function Flag({ code }) {
  const normalized = String(code || "").toLowerCase();
  const label = countryByCode[normalized]?.english ? countryByCode[normalized].english + " flag" : "Unknown country flag";
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [normalized]);
  const localAsset = flags[normalized];
  return localAsset && !imageFailed ? (
    <img className="flag" src={localAsset} loading="lazy" alt={label} onError={() => setImageFailed(true)} />
  ) : (
    <span className="flag flag-unknown" role="img" aria-label={label} title="Unknown country/region code">
      <GlobeHemisphereWest size={12} aria-hidden="true" />
    </span>
  );
}
const providerNames = {
  aws: "AWS",
  digitalocean: "DigitalOcean",
  google: "Google Cloud",
  aliyun: "Alibaba Cloud",
  azure: "Microsoft Azure",
  hetzner: "Hetzner",
  vultr: "Vultr",
  tencent: "Tencent Cloud",
  linode: "Linode",
  rackspace: "Rackspace Technology",
  huawei: "Huawei Cloud",
};
const providerLogoAssets = {
  aws: "/assets/brand/provider-verifiable/aws.png",
  digitalocean: "/assets/brand/simple-icons-color/digitalocean.svg",
  google: "/assets/brand/simple-icons-color/googlecloud.svg",
  aliyun: "/assets/brand/simple-icons-color/alibabacloud.svg",
  azure: "/assets/brand/provider-verifiable/microsoft-azure.svg",
  hetzner: "/assets/brand/simple-icons-color/hetzner.svg",
  vultr: "/assets/brand/simple-icons-color/vultr.svg",
  tencent: "/assets/brand/provider-verifiable/tencent-cloud.svg",
  linode: "/assets/brand/provider-verifiable/linode-2021.png",
  rackspace: "/assets/brand/provider-verifiable/rackspace-technology-white.png",
  huawei: "/assets/brand/simple-icons-color/huawei.svg",
};
const providerLogoContrastPlateKeys = new Set(["aws", "tencent", "linode"]);
const providerAliases = {
  AWS: "aws",
  DigitalOcean: "digitalocean",
  "Google Cloud": "google",
  "Microsoft Azure": "azure",
  "Alibaba Cloud": "aliyun",
  "Tencent Cloud": "tencent",
  "Huawei Cloud": "huawei",
  阿里云: "aliyun",
  腾讯云: "tencent",
  华为云: "huawei",
  Hetzner: "hetzner",
  Vultr: "vultr",
  Linode: "linode",
  Rackspace: "rackspace",
};
function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch { return undefined; }
}
function ProviderCell({ row }) {
  const providerKey = providerAliases[row.provider] || row.provider;
  const providerName = row.provider === "自定义服务商" ? row.customProvider || row.provider : providerNames[providerKey] || row.provider || "未知服务商";
  const configuredUrl = row.provider_website_url || row.providerWebsiteUrl || row.consoleUrl;
  const href = configuredUrl ? safeHttpUrl(configuredUrl) : safeHttpUrl(providerConsoleUrls[row.provider]);
  const mark = <ProviderMark name={row.provider === "自定义服务商" ? row.customProvider : row.provider} customUrl={row.providerLogo || row.provider_logo_url} />;
  if (!href) {
    return <span className="provider-cell provider-cell-unavailable" role="note" aria-label={`${providerName}，后台链接未配置或无法验证`} title="后台链接未配置或无法验证">{mark}<span>{providerName}</span></span>;
  }
  const label = configuredUrl ? `${providerName}，用户配置后台链接（来源未核实），在新标签页打开` : `${providerName} 服务商控制台，在新标签页打开`;
  return <a className="provider-cell" href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>{mark}<span>{providerName}</span><span className="external" aria-hidden="true">↗</span></a>;
}
function ResourceStatus({ value, dimension }) {
  const status = workerStatusPresentation(value, dimension);
  return <StatusPill value={status.label} tone={status.tone} />;
}
function HeartbeatPreview({ row }) {
  const status = workerHeartbeatPreview(row);
  const timestamp = row?.fixtureOnly && Number.isFinite(row?.fixtureHeartbeatOffsetSeconds)
    ? new Date(Date.now() - row.fixtureHeartbeatOffsetSeconds * 1000).toISOString()
    : row?.last_heartbeat_at || row?.heartbeat;
  const liveRead = row?.readOnly === true;
  const runtimeHeartbeat = liveRead && row?.heartbeat_source === "RUNTIME";
  return (
    <span className="worker-heartbeat-preview" title={liveRead ? `${status.reason}；来自 staging API，${runtimeHeartbeat ? "仅展示关联 Runtime 心跳，Worker 心跳未知" : "overview 未提供 Worker 注册心跳字段"}` : `${status.reason}；当前为本地示例数据`}>
      <span>{status.registration === "REGISTERED" ? "已注册" : liveRead ? "注册数据未提供" : "注册未知"}</span>
      <StatusPill value={status.label} tone={status.tone} />
      <span>{timestamp ? `${runtimeHeartbeat ? "Runtime 心跳" : liveRead ? "后端时间" : "示例时间"} ${timestamp}${liveRead || row?.fixtureOnly ? "" : "（时区未标注）"}` : liveRead ? "后台未提供心跳时间" : "示例时间未提供"}</span>
    </span>
  );
}
function ProviderMark({ name, customUrl = "" }) {
  const key = providerAliases[name] || name;
  const label = providerNames[key] || name || "Custom";
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [customUrl, key]);
  const userSuppliedImage = Boolean(customUrl) && !providerAliases[name];
  const resolved = userSuppliedImage && !imageFailed ? customUrl : "";
  const sourceCheckedAsset = providerLogoAssets[key];
  const pendingLabel = "临时中性占位图标，非官方Logo；官方来源待核实";
  if (resolved) {
    return (
      <img
        className={`provider-logo provider-logo-${key}`}
        src={resolved}
        alt={`${label}，用户提供图片，来源未核实`}
        title={`${label}：用户提供图片，来源未核实`}
        onError={(event) => {
          event.currentTarget.style.display = "none";
          setImageFailed(true);
        }}
      />
    );
  }
  if (sourceCheckedAsset && !imageFailed) {
    return (
      <img
        className={`provider-logo provider-logo-${key} provider-logo-source-checked${providerLogoContrastPlateKeys.has(key) ? " provider-logo-contrast-plate" : ""}`}
        src={sourceCheckedAsset}
        alt={`${label} 品牌标记；来源记录见品牌资产清单`}
        title={`${label} 品牌标记，素材来源和快照哈希见 public/assets/brand/simple-icons-color/PROVENANCE.md`}
        onError={() => setImageFailed(true)}
      />
    );
  }
  return (
    <span className="provider-mark provider-mark-pending" role="img" aria-label={pendingLabel} title={`${label}：${pendingLabel}`}>
      <Cube size={15} />
    </span>
  );
}

function Sidebar({ active, activeAiItem, onNavigate, onNotify, collapsed }) {
  const [aiOpen, setAiOpen] = useState(active === "AI智能模型中心");
  return (
    <aside className={`master-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="master-brand">
        <div className="brand-logo">
          <BrandMark />
        </div>
        <div>
          <b>Global Seller OS</b>
          <small>全球卖家智能系统</small>
        </div>
      </div>
      <nav className="master-nav">
        {navItems.map(([label]) => (
          <div key={label}>
            <button
              className={`master-nav-item ${active === label ? "active" : ""}`}
              onClick={() =>
                label === "AI智能模型中心"
                  ? setAiOpen((open) => !open)
                  : label === "Worker资源中心" ? onNavigate("global") : onNotify?.(`${label}不在当前 Worker UI 预览范围内`)
              }
            >
              <NavigationMark name={label} />
              <span>{label}</span>
              {label === "AI智能模型中心" && (
                <CaretDown className={aiOpen ? "rotate" : ""} size={13} />
              )}
            </button>
            {label === "AI智能模型中心" && aiOpen && (
              <div className="ai-subnav">
                {aiItems.map((item, index) => (
                  <button
                    className={active === "AI智能模型中心" && item === activeAiItem ? "active" : ""}
                    key={item}
                    onClick={() => index === 0 ? onNavigate("ai-overview") : item === "模型与额度" ? onNavigate("ai-models") : item === "用量与成本" ? onNavigate("ai-usage") : item === "调度建议" ? onNavigate("ai-routing-advice") : onNotify?.(`${item}不在当前 Worker UI 预览范围内`)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      <div className="sidebar-foot">
        <GlobeHemisphereWest size={150} weight="thin" />
        <span>
          Global Seller OS
          <br />
          v2.0.0
        </span>
      </div>
    </aside>
  );
}

function GlobalHeader({ onCollapse, activeCenter = "Worker资源中心" , activePage }) {
  const [profileOpen, setProfileOpen] = useState(false);
  return (
    <header className="master-header">
      <IconButton onClick={onCollapse} aria-label="折叠侧边栏">
        <List size={20} />
      </IconButton>
      <div className="master-breadcrumb">
        <span>Global Seller OS</span>
        <CaretRight size={12} />
        <span>{activeCenter}</span>
        <CaretRight size={12} />
        <b>{activePage ?? (activeCenter === "AI智能模型中心" ? "模型与额度" : "资源总览")}</b>
      </div>
      <button className="profile-menu" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}>
        <span className="avatar">A</span>
        <span>
          <b>Admin</b>
          <small>超级管理员</small>
        </span>
        <CaretDown size={14} />
      </button>
      {profileOpen && <div className="profile-popover" role="dialog" aria-label="账号信息"><b>Admin · 超级管理员</b><p>当前为 Worker UI 前端预览账号，不连接真实登录服务。</p><button onClick={() => setProfileOpen(false)}>关闭</button></div>}
    </header>
  );
}

function PageActions({
  onAdd,
  onBulk,
  onBatchDelete,
  onRefresh,
  loading,
  batchDisabled,
  bulkDisabled: bulkDisabledOverride,
  batchDeleteDisabled: batchDeleteDisabledOverride,
  batchDeleteReason = "",
  refreshDisabled: refreshDisabledOverride,
  readOnly = false,
  allowAddWhenReadOnly = false,
}) {
  const bulkUnavailable = bulkDisabledOverride ?? readOnly;
  const deleteUnavailable = batchDeleteDisabledOverride ?? (readOnly || batchDisabled);
  const refreshUnavailable = refreshDisabledOverride ?? (readOnly || loading);
  return (
    <div className={`page-actions ${readOnly ? "read-only-actions" : ""}`}>
      <Button variant="primary" icon={Plus} onClick={onAdd} disabled={readOnly && !allowAddWhenReadOnly}>
        添加资源
      </Button>
      <Button icon={UploadSimple} onClick={onBulk} disabled={bulkUnavailable}>
        批量导入
      </Button>
      <Button
        variant="danger"
        icon={Trash}
        onClick={onBatchDelete}
        disabled={deleteUnavailable}
        title={batchDeleteReason || undefined}
      >
        批量删除
      </Button>
      <Button icon={Repeat} onClick={onRefresh} disabled={refreshUnavailable}>
        {loading ? "刷新中" : "刷新"}
      </Button>
    </div>
  );
}

function PageTitle({ view, actions, countryCode = "id", cityName = "Jakarta", homeFixture = null, readOnly = false, allowAddWhenReadOnly = false }) {
  const preview = countryPreviews[countryCode] || countryPreviews.id;
  const fixtureCountry = homeFixture?.countries.find((item) => item.code === countryCode);
  const title =
    view === "country"
      ? `Worker资源中心 · ${fixtureCountry?.name || preview.name}`
      : view === "city"
        ? `Worker资源中心 · 城市下钻（${cityZh(cityName)}）`
        : "Worker资源中心";
  const subtitle =
    view === "city"
      ? `统一查看${cityZh(cityName)}城市资源、运行状态和远程连接能力`
      : "统一管理全球 VPS、手机RPA、业务执行Agent、客户消息监控Agent、Worker、Runtime 与资源开通状态";
  return (
    <div className="page-title-row">
      <div>
        <div className="page-kicker">GLOBAL OPERATIONS / RESOURCE CONTROL</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <PageActions {...actions} readOnly={readOnly} allowAddWhenReadOnly={allowAddWhenReadOnly} />
    </div>
  );
}

const statIcons = {
  cube: Cube,
  play: Play,
  pause: Pause,
  offline: Prohibit,
  install: ArrowsClockwise,
  ready: CheckCircle,
  desktop: Desktop,
  mobile: DeviceMobile,
  alert: WarningCircle,
};
function KpiStrip({ view, countryCode = "id", cityName = "Jakarta", homeFixture = null, liveModel = null }) {
  const preview = countryPreviews[countryCode] || countryPreviews.id;
  const cityTotal = Number(preview.cities.find(([name]) => name === cityName)?.[1] || 0);
  const fixtureScope = getWorkerHomeFixtureScope(homeFixture, view, countryCode, cityName);
  const liveData = liveModel?.state === "INCONSISTENT" ? null : liveModel?.data;
  const liveRows = liveData?.resources ? filterWorkerRowsByGeography(liveData.resources, { view, countryCode, cityName }) : null;
  const liveCount = liveRows ? liveRows.length : liveData?.kpis?.vpsTotal?.state === "KNOWN" ? liveData.kpis.vpsTotal.value : null;
  const items = fixtureScope?.kpis || (liveModel
    ? (kpiSets[view] || kpis).map((item, index) => ({ ...item, value: index === 0 ? (liveCount ?? "—") : "—" }))
    : (view === "country" ? kpiSets.country.map((item, index) => ({...item, value: [preview.total, preview.online, preview.offline, preview.abnormal, preview.ready, preview.vps, preview.mobile][index]})) : view === "city" ? kpiSets.city.map((item, index) => ({...item, value: index === 0 ? cityTotal : countryCode === "id" && cityName === "Jakarta" ? item.value : cityTotal === 0 ? 0 : [cityTotal, Math.max(0, cityTotal - 1), 1, 0, Math.max(0, cityTotal - 1), cityTotal, 0][index]})) : kpiSets[view] || kpis));
  return (
    <div className="kpi-strip">
      {items.map((item) => {
        const Icon = statIcons[item.icon];
        return (
          <div className={`kpi-card ${item.tone}`} key={item.label}>
            <div className="kpi-icon">
              <Icon size={27} weight="duotone" />
            </div>
            <div>
              <span>{item.label}</span>
              <b>{item.value}</b>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SummaryPanel({ view, countryCode = "id", cityName = "Jakarta", readOnlyRows = null, homeFixture = null, liveModel = null }) {
  if (liveModel && !liveModel.data) {
    return (
      <div className="map-summary" data-summary-source="real-unavailable">
        <h2>真实资源摘要</h2>
        <div className="summary-country"><MapPin size={16} /><b>{view === "global" ? "全球" : view === "country" ? (countryByCode[countryCode]?.chinese || countryCode.toUpperCase()) : cityZh(cityName)} · 只读</b></div>
        <div className="summary-list"><div><span><i className="summary-dot muted" />真实快照</span><b>暂不可用</b></div></div>
        <small>认证或真实 API 恢复后，此处将显示服务端快照；不会用预览数值代替。</small>
      </div>
    );
  }
  if (Array.isArray(readOnlyRows)) {
    const located = readOnlyRows.filter((row) => isStableWorkerResource(row) && projectWorkerMapResource(row)).length;
    const withoutLocation = readOnlyRows.length - located;
    return (
      <div className="map-summary" data-summary-source="dto-location">
        <h2>真实位置数据摘要</h2>
        <div className="summary-country"><MapPin size={16} /><b>{view === "global" ? "全球" : view === "country" ? (countryByCode[countryCode]?.chinese || countryCode.toUpperCase()) : cityZh(cityName)} · 只读</b></div>
        <div className="summary-list">
          <div><span><i className="summary-dot green" />已定位 VPS 资源</span><b>{located}</b></div>
          <div><span><i className="summary-dot muted" />未定位或身份未确认</span><b>{withoutLocation}</b></div>
        </div>
        <small>计数来自真实资源快照；未使用城市中心点或预览坐标代替资源位置。</small>
      </div>
    );
  }
  const preview = countryPreviews[countryCode] || countryPreviews.id;
  const cityTotal = Number(preview.cities.find(([name]) => name === cityName)?.[1] || 0);
  const fixtureScope = getWorkerHomeFixtureScope(homeFixture, view, countryCode, cityName);
  const rows = fixtureScope ? fixtureScope.summary :
    view === "city"
      ? countryCode === "id" && cityName === "Jakarta" ? jakartaSummary : jakartaSummary.map(([label, , tone], index) => [label, cityTotal === 0 ? 0 : [cityTotal, Math.max(0,cityTotal-1),1,0,Math.max(0,cityTotal-1),cityTotal,0][index], tone])
      : view === "country"
        ? indonesiaSummary.map(([label, , tone], index) => [label, [preview.total,preview.vps,preview.mobile,preview.online,preview.offline,preview.abnormal,preview.ready][index], tone])
        : globalSummary;
  const title =
    view === "city"
      ? `资源概览（${cityZh(cityName)}）`
      : view === "country"
        ? "国家资源概览"
        : fixtureScope ? (view === "global" ? "全球资源状态与构成" : `${view === "city" ? cityZh(cityName) : fixtureScope.country.name}资源状态与构成`) : "全球汇总（按状态）";
  return (
    <div className="map-summary">
      <h2>{title}</h2>
      {view === "country" && (
        <div className="summary-country">
          <Flag code={countryCode} />
          <b>{fixtureScope?.country.name || preview.name}</b>
        </div>
      )}
      {view === "city" && (
        <div className="summary-country">
          <MapPin size={16} />
          <b>{cityZh(cityName)}</b>
        </div>
      )}
      <div className="summary-list">
        {rows.map(([label, value, tone]) => (
          <div key={label}>
            <span>
              <i className={`summary-dot ${tone}`} />
              {label}
            </span>
            <b>{value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopList({ view, onDrill, onOpen, countryCode = "id", cityName = "Jakarta", readOnlyRows = null, homeFixture = null, liveModel = null }) {
  const preview = countryPreviews[countryCode] || countryPreviews.id;
  const fixtureScope = getWorkerHomeFixtureScope(homeFixture, view, countryCode, cityName);
  const isCountry = view === "country";
  const isCity = view === "city";
  const title = isCity
    ? `${cityZh(cityName)}资源列表（${Array.isArray(readOnlyRows) ? readOnlyRows.length : cityRows(countryCode, cityName).length}）`
    : isCountry
      ? "城市资源列表"
      : "TOP 5 国家 / 地区";
  const liveData = liveModel?.state === "INCONSISTENT" ? null : liveModel?.data;
  const liveCountry = liveData?.countries?.find((item) => item.countryCode.toLowerCase() === countryCode.toLowerCase());
  const liveCities = liveCountry?.cities || [];
  const liveCountries = liveData?.countries || [];
  const liveResources = liveData?.resources ? filterWorkerRowsByGeography(liveData.resources, { view, countryCode, cityName }) : [];
  const list = fixtureScope && view === "global"
    ? homeFixture.countries.slice().sort((a, b) => b.total - a.total).slice(0, 5).map((item) => [item.name, String(item.total), item.code])
    : liveModel && view === "global"
      ? liveCountries.slice().sort((a, b) => b.resourceCount - a.resourceCount).slice(0, 5).map((item) => [item.countryName || countryByCode[item.countryCode.toLowerCase()]?.chinese || item.countryCode, String(item.resourceCount), item.countryCode])
    : isCity
    ? (Array.isArray(readOnlyRows) ? readOnlyRows : cityRows(countryCode, cityName))
    : isCountry
      ? fixtureScope ? fixtureScope.cities.slice().sort((a, b) => b.count - a.count).map((item) => [item.name, String(item.count)]) : liveModel ? liveCities.slice().sort((a, b) => b.resourceCount - a.resourceCount).map((item) => [item.cityName, String(item.resourceCount)]) : preview.cities
      : topCountries;
  return (
    <div className="top-list">
      <h2>{title}</h2>
      <div className="top-list-items">
      {list.map((row, index) => {
        const label = isCity ? row.name : row[0];
        const readOnlyResource = isCity && Array.isArray(readOnlyRows);
        const canOpen = !readOnlyResource || isStableWorkerResource(row) || row.fixtureOnly === true;
        return (
          <button
            className="top-row"
            key={readOnlyResource ? (row.resourceRenderKey || row.entityId || row.name) : label}
            disabled={!canOpen}
            data-resource-id={readOnlyResource ? row.entityId || undefined : undefined}
            onClick={() =>
              isCity ? onOpen(row) : isCountry ? onDrill("city", countryCode, row[0]) : onDrill("country", row[2])
            }
          >
            <span className={`rank rank-${index + 1}`}>{index + 1}</span>
            {!isCity && !isCountry && <Flag code={row[2]} />}
            <span>
              {isCity ? label : isCountry ? cityZh(label) : label}
              {isCity && <small>{readOnlyResource ? `UUID …${row.entityId?.slice(-8) || "UNKNOWN"}` : cityZh(row.district)}</small>}
            </span>
            {isCity ? (
              readOnlyResource ? <span className="unknown-read-value">{canOpen ? "Read-only" : "ID unavailable"}</span> : <StatusPill value={row.final} tone={row.final === "异常" ? "danger" : "green"} />
            ) : (
              <b>{row[1]}</b>
            )}
            <CaretRight size={14} />
          </button>
        );
      })}
      {liveModel && !liveData && <div className="worker-live-empty">真实国家 / 城市数据暂不可用；没有使用预览数据替代。</div>}
      </div>
    </div>
  );
}

function MapMarker({ resource, view, onDrill, onOpen, located = false }) {
  return (
    <button
      title={
        view === "global"
          ? `查看 ${resource.country}`
          : view === "country"
            ? `查看 ${cityZh(resource.city)}`
            : `查看 ${resource.name}`
      }
      aria-label={resource.entityId ? `${resource.name}, UUID ${resource.entityId}` : resource.name}
      className={`map-marker ${resource.type === "手机RPA" ? "marker-purple" : resource.final === "异常" ? "marker-danger" : ""} ${located ? "located" : ""}`}
      data-resource-id={resource.entityId || undefined}
      data-resource-type={resource.entityType || undefined}
      data-city={resource.city || undefined}
      style={{ left: `${resource.x}%`, top: `${resource.y}%` }}
      onClick={() =>
        view === "city"
          ? onOpen(resource)
          : view === "global" ? onDrill("country", resource.countryCode) : onDrill("city", resource.countryCode, resource.city)
      }
    >
      <i />
      <span>
        {view === "global"
          ? resource.country
          : view === "country"
            ? cityZh(resource.city)
            : resource.name}
        <small>
          {view === "city"
            ? resource.name
            : view === "global"
              ? cityZh(resource.city)
              : resource.type}
        </small>
      </span>
    </button>
  );
}

function isValidGeoCoordinate(coordinates) {
  return Array.isArray(coordinates)
    && coordinates.length >= 2
    && typeof coordinates[0] === "number"
    && typeof coordinates[1] === "number"
    && Number.isFinite(coordinates[0])
    && Number.isFinite(coordinates[1])
    && coordinates[0] >= -85.05112878
    && coordinates[0] <= 85.05112878
    && coordinates[1] >= -180
    && coordinates[1] <= 180;
}

function visibleResourceRows(view, countryCode, cityName, overrides = {}, deletedNames = []) {
  const fixture = view === "city" ? cityRows(countryCode, cityName)
    : view === "country" ? countryRows(countryCode)
      : [...globalResources, ...Object.keys(countryPreviews).flatMap((code) => countryRows(code))]
        .filter((row, index, array) => array.findIndex((other) => other.name === row.name) === index);
  const fixtureNames = new Set(fixture.map((row) => row.name));
  const merged = fixture.map((row) => ({ ...row, ...overrides[row.name] }));
  const additional = Object.entries(overrides)
    .filter(([originalName]) => !fixtureNames.has(originalName))
    .map(([, row]) => row);
  return [...merged, ...additional].filter((row) => !deletedNames.includes(row.name) && (view === "global"
    || (row.countryCode === countryCode && (view !== "city" || row.city === cityName))));
}

function CityTileMap({ cityName, center: requestedCenter, onTileError }) {
  const layerRef = useRef(null);
  const [size, setSize] = useState([0, 0]);
  useEffect(() => {
    const node = layerRef.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => setSize([entry.contentRect.width, entry.contentRect.height]));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const centerSource = requestedCenter === undefined ? cityCoordinates[cityName] : requestedCenter;
  const center = isValidGeoCoordinate(centerSource) ? centerSource : null;
  const z = 11;
  const tiles = [];
  if (center && size[0] && size[1]) {
    const world = 256 * 2 ** z;
    const latitude = center[0] * Math.PI / 180;
    const centerX = (center[1] + 180) / 360 * world;
    const centerY = (1 - Math.log(Math.tan(latitude) + 1 / Math.cos(latitude)) / Math.PI) / 2 * world;
    const startX = Math.floor((centerX - size[0] / 2) / 256);
    const endX = Math.floor((centerX + size[0] / 2) / 256);
    const startY = Math.floor((centerY - size[1] / 2) / 256);
    const endY = Math.floor((centerY + size[1] / 2) / 256);
    for (let y = startY; y <= endY; y++) for (let x = startX; x <= endX; x++) {
      if (y < 0 || y >= 2 ** z) continue;
      tiles.push(<img key={`${z}-${x}-${y}`} src={`https://tile.openstreetmap.org/${z}/${((x % 2 ** z) + 2 ** z) % 2 ** z}/${y}.png`} alt="" loading="lazy" onError={onTileError} style={{left: x * 256 - centerX + size[0] / 2, top: y * 256 - centerY + size[1] / 2}} />);
    }
  }
  return <div className="city-tiles" ref={layerRef} aria-hidden="true">{tiles}</div>;
}
function ResourceMap({ view, onCountry, onOpen, countryCode = "id", cityName = "Jakarta", overrides = {}, deletedNames = [], readOnlyRows = null, homeFixture = null, liveModel = null }) {
  const preview = countryPreviews[countryCode] || countryPreviews.id;
  const fixtureScope = getWorkerHomeFixtureScope(homeFixture, view, countryCode, cityName);
  const countryLayout = view === "country" ? getCountryMapLayout(countryCode) : null;
  const [zoom, setZoom] = useState(1);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [dragPan, setDragPan] = useState({ x: 0, y: 0 });
  const [tileError, setTileError] = useState(false);
  const [dragging, setDragging] = useState(false);
  const mapCanvasRef = useRef(null);
  const [mapCanvasSize, setMapCanvasSize] = useState([0, 0]);
  const dragRef = useRef(null);
  useEffect(() => {
    const node = mapCanvasRef.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const next = [entry.contentRect.width, entry.contentRect.height];
      setMapCanvasSize((current) => current[0] === next[0] && current[1] === next[1] ? current : next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setZoom(1); setFocusIndex(-1); setDragPan({ x: 0, y: 0 }); setTileError(false); }, [view, countryCode, cityName]);
  const liveRows = liveModel?.state === "INCONSISTENT" ? [] : liveModel?.data?.resources || [];
  const liveMapData = liveModel?.state === "INCONSISTENT" ? null : liveModel?.data || null;
  const liveCountry = liveMapData?.countries?.find((item) => item.countryCode.toLowerCase() === countryCode.toLowerCase());
  const scopedLiveRows = liveModel ? filterWorkerRowsByGeography(liveRows, { view, countryCode, cityName }) : null;
  const locatedCityRows = view === "city" && Array.isArray(scopedLiveRows)
    ? scopedLiveRows.filter((row) => projectWorkerMapResource(row))
    : [];
  const liveCityMapCenter = locatedCityRows.length
    ? [
        locatedCityRows.reduce((sum, row) => sum + row.latitude, 0) / locatedCityRows.length,
        locatedCityRows.reduce((sum, row) => sum + row.longitude, 0) / locatedCityRows.length,
      ]
    : null;
  const projectLiveMapResource = (row) => {
    const worldPoint = projectWorkerMapResource(row);
    if (!worldPoint) return null;
    if (view === "country") {
      const point = countryLayout?.project([row.latitude, row.longitude]);
      return point ? { ...worldPoint, x: point[0] / 10, y: point[1] / 3 } : null;
    }
    if (view === "city") {
      if (!liveCityMapCenter || !mapCanvasSize[0] || !mapCanvasSize[1]) return null;
      const worldSize = 256 * 2 ** 11;
      const mercatorPoint = ([latitude, longitude]) => {
        const boundedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
        const radians = boundedLatitude * Math.PI / 180;
        return [
          (longitude + 180) / 360 * worldSize,
          (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2 * worldSize,
        ];
      };
      const [resourceX, resourceY] = mercatorPoint([row.latitude, row.longitude]);
      const [centerX, centerY] = mercatorPoint(liveCityMapCenter);
      return { ...worldPoint, x: 50 + (resourceX - centerX) / mapCanvasSize[0] * 100, y: 50 + (resourceY - centerY) / mapCanvasSize[1] * 100 };
    }
    return worldPoint;
  };
  const liveUiRows = scopedLiveRows?.map((row) => ({
    ...row,
    name: row.name || `VPS …${row.id?.slice(-8) || "未知"}`,
    entityId: row.id,
    country: row.countryName || countryByCode[row.countryCode?.toLowerCase()]?.chinese || row.countryCode || "—",
    type: "VPS RPA",
    readOnly: true,
    final: row.statusRaw || "UNKNOWN",
    remote: "UNKNOWN",
    x: projectLiveMapResource(row)?.x ?? null,
    y: projectLiveMapResource(row)?.y ?? null,
  })) || null;
  const sourceRows = homeFixture ? fixtureScope.rows : liveModel ? liveUiRows : Array.isArray(readOnlyRows)
    ? readOnlyRows
    : visibleResourceRows(view, countryCode, cityName, overrides, deletedNames)
      .filter((row, index, array) => view === "city" || array.findIndex((other) => view === "country" ? other.city === row.city : other.countryCode === row.countryCode) === index);
  const positions =
    view === "country"
        ? [
            [28, 66],
            [40, 71],
            [15, 26],
            [31, 68],
            [59, 48],
            [25, 34],
            [37, 68],
          ]
       : countryCode !== "id" || cityName !== "Jakarta" ? [[50, 50], [53, 53], [47, 54]] : [
            [50, 50],
            [48, 63],
            [36, 52],
            [51, 40],
            [64, 53],
            [55, 66],
          ];
  const placed = homeFixture ? [] : liveModel
    ? sourceRows.filter((row) => row.x !== null && row.y !== null && isStableWorkerResource(row))
    : Array.isArray(readOnlyRows)
    ? sourceRows.map((row) => ({ ...row, ...projectWorkerResourceLocation(row, cityCoordinates[cityName]) }))
      .filter((row) => row.x !== null && isStableWorkerResource(row))
    : sourceRows.map((row, index) => ({
      ...row,
      x: view === "global" ? countryPreviews[row.countryCode].anchor[0] : countryLayout && isValidGeoCoordinate(cityCoordinates[row.city]) ? countryLayout.project(cityCoordinates[row.city])[0] / 10 : positions[index % positions.length][0],
      y: view === "global" ? countryPreviews[row.countryCode].anchor[1] : countryLayout && isValidGeoCoordinate(cityCoordinates[row.city]) ? countryLayout.project(cityCoordinates[row.city])[1] / 3 : positions[index % positions.length][1],
    }));
  const visiblePlaced = homeFixture ? [] : liveModel
    ? (view === "city" ? placed : [])
    : Array.isArray(readOnlyRows)
    ? (view === "city" ? placed : [])
    : view === "country"
      ? placed.filter((row) => isValidGeoCoordinate(cityCoordinates[row.city]))
      : view === "city" && !isValidGeoCoordinate(cityCoordinates[cityName]) ? [] : placed;
  const locateTargets = liveModel ? placed : visiblePlaced;
  const focused = locateTargets[focusIndex];
  const panX = focused ? (50 - focused.x) * zoom : 0;
  const panY = focused ? (50 - focused.y) * zoom : 0;
  const changeZoom = (direction) => {
    const next = Math.max(1, Math.min(2.25, Math.round((zoom + direction * 0.25) * 100) / 100));
    setZoom(next);
    const limit = (next - 1) / (2 * next) * 100;
    setDragPan((current) => ({ x: Math.max(-limit, Math.min(limit, current.x)), y: Math.max(-limit, Math.min(limit, current.y)) }));
    if (next === 1) setFocusIndex(-1);
  };
  const locateResource = () => {
    if (!locateTargets.length) return;
    setDragPan({ x: 0, y: 0 });
    setFocusIndex((current) => (current + 1) % locateTargets.length);
    setZoom((current) => Math.max(current, 1.5));
  };
  const startMapDrag = (event) => {
    const hitTarget = document.elementFromPoint(event.clientX, event.clientY);
    if (event.button !== 0 || event.target.closest("button, a, input, select") || hitTarget?.closest("button, a, input, select")) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin: dragPan, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (zoom === 1) setZoom(1.25);
    setFocusIndex(-1);
    setDragging(true);
  };
  const moveMapDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    if (!drag.moved) return;
    const dragZoom = Math.max(1.25, zoom);
    const limit = (dragZoom - 1) / (2 * dragZoom) * 100;
    setDragPan({
      x: Math.max(-limit, Math.min(limit, drag.origin.x + dx / rect.width * 100)),
      y: Math.max(-limit, Math.min(limit, drag.origin.y + dy / rect.height * 100)),
    });
  };
  const endMapDrag = (event) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
    // Preserve `moved` until the synthesized click is suppressed.
    if (!dragRef.current.moved) dragRef.current = null;
  };
  return (
    <SectionCard className={`map-section map-${view} country-${countryCode} ${liveModel ? "map-live-real" : ""} ${view === "city" && cityName !== "Jakarta" ? "map-city-generic" : ""}`}>
      <div className="map-heading">
        <h2>
          {view === "city"
            ? `城市资源概览（${cityZh(cityName)}）`
            : view === "country"
              ? `${fixtureScope?.country.name || preview.name}资源分布`
              : "全球资源分布"}
        </h2>
        <div className="map-breadcrumb">
          <button onClick={() => onCountry("global")}>全球</button>
          <CaretRight size={11} />
          {view !== "global" && (
            <>
              <button onClick={() => onCountry("country", countryCode)}>{fixtureScope?.country.name || preview.name}</button>
              <CaretRight size={11} />
            </>
          )}
          {view === "city" && <b>{cityZh(cityName)}</b>}
        </div>
      </div>
      <div className="map-body">
        <SummaryPanel view={view} countryCode={countryCode} cityName={cityName} readOnlyRows={liveModel ? sourceRows : Array.isArray(readOnlyRows) ? sourceRows : null} homeFixture={homeFixture} liveModel={liveModel} />
          <div ref={mapCanvasRef} className={`map-canvas ${dragging ? "is-dragging" : ""}`} onPointerDown={startMapDrag} onPointerMove={moveMapDrag} onPointerUp={endMapDrag} onPointerCancel={endMapDrag} onClickCapture={(event) => { if (dragRef.current?.moved) { event.preventDefault(); event.stopPropagation(); dragRef.current = null; return; } if (view === "country" && !event.target.closest("button, a, input, select")) { const marker = document.elementFromPoint(event.clientX, event.clientY)?.closest("button.map-marker"); if (marker?.dataset.city) { event.preventDefault(); event.stopPropagation(); onCountry("city", countryCode, marker.dataset.city); } } }}>
          <div className="map-scene" style={{ transform: `translate(${panX + dragPan.x}%, ${panY + dragPan.y}%) scale(${zoom})` }}>
          {view === "global" && liveModel && <WorkerWorldOutlineMap />}
          {view === "city" && <CityTileMap cityName={cityName} center={liveModel ? liveCityMapCenter : undefined} onTileError={() => setTileError(true)} />}
          {view === "country" && <CountryOutlineMap countryCode={countryCode} />}
          <div className="map-grid" />
          {view === "global" && (homeFixture?.mapNodes || (liveModel ? (liveMapData?.countries || []).map((country) => {
            const countryRows = liveMapData?.resources?.filter((row) => row.countryCode?.toLowerCase() === country.countryCode.toLowerCase()) || [];
            const located = countryRows.map((row) => ({ row, point: projectWorkerMapResource(row) })).filter((entry) => entry.point);
            if (!located.length) return null;
            return { countryCode: country.countryCode.toLowerCase(), countryName: country.countryName || countryByCode[country.countryCode.toLowerCase()]?.chinese || country.countryCode, count: located.length, totalCount: country.resourceCount, x: located.reduce((sum, entry) => sum + entry.point.x, 0) / located.length, y: located.reduce((sum, entry) => sum + entry.point.y, 0) / located.length, tone: "blue", typeCounts: { vps: located.length, mobile: 0 }, status: "真实坐标聚合" };
          }).filter(Boolean) : globalMapNodes)).map((node, index) => (
            <button
              key={`cluster-${index}`}
              className={`map-cluster-dot ${node.tone}${node.typeCounts?.mobile > node.typeCounts?.vps ? " mobile-cluster" : ""}`}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              title={`${node.countryName || countryPreviews[node.countryCode].name} · 已定位 ${node.count || ""} 台${Number.isSafeInteger(node.totalCount) ? ` / 总资源 ${node.totalCount} 台` : ""} · VPS ${node.typeCounts?.vps ?? "—"} / 手机 ${node.typeCounts?.mobile ?? "—"} · ${node.status || node.tone}`}
              aria-label={`查看${node.countryName || countryPreviews[node.countryCode].name}资源：已定位 ${node.count || ""} 台${Number.isSafeInteger(node.totalCount) ? `，总资源 ${node.totalCount} 台` : ""}，${node.resourceType || "资源"}，${node.status || node.tone}`}
              onClick={() => onCountry("country", node.countryCode)}
            ><span>{node.count}</span></button>
          ))}
          {visiblePlaced.map((row) => (
            <MapMarker
              key={row.resourceRenderKey || row.name}
              resource={row}
              view={view}
              onDrill={onCountry}
              onOpen={onOpen}
              located={focusIndex >= 0 && (visiblePlaced[focusIndex]?.resourceRenderKey || visiblePlaced[focusIndex]?.entityId || visiblePlaced[focusIndex]?.name) === (row.resourceRenderKey || row.entityId || row.name)}
            />
          ))}
          {view === "global" && !homeFixture && !liveModel && (
            <>
              {[["us", "label-a"], ["id", "label-b"], ["jp", "label-c"], ["de", "label-d"], ["sg", "label-e"]].map(([code, position]) => <button key={code} className={`map-label ${position}`} aria-label={`${countryPreviews[code].name} VPS ${countryPreviews[code].vps} 台`} title={`${countryPreviews[code].name} · VPS ${countryPreviews[code].vps} 台`} onClick={() => onCountry("country", code)}><Flag code={code} /><b>{countryPreviews[code].vps}</b></button>)}
            </>
          )}
          {view === "global" && homeFixture && homeFixture.countries.slice().sort((a, b) => b.total - a.total).slice(0, 5).map((country, index) => {
            const position = ["label-a", "label-b", "label-c", "label-d", "label-e"][index];
            const vps = country.typeCounts.vps;
            return <button key={country.code} className={`map-label ${position}`} aria-label={`${country.name} ${country.total} 台，其中 VPS RPA ${vps} 台`} title={`${country.name} · ${country.total} 台 · VPS ${vps} / 手机 ${country.typeCounts.mobile}`} onClick={() => onCountry("country", country.code)}><Flag code={country.code} /><b>{country.total}</b></button>;
          })}
          {view === "country" && fixtureScope && countryLayout && fixtureScope.cities.map((city) => {
            const coordinates = cityCoordinates[city.name];
            if (!isValidGeoCoordinate(coordinates)) return null;
            const [x, y] = countryLayout.project(coordinates);
            const cityRowsInScope = fixtureScope.rows.filter((row) => row.city === city.name);
            const typeCounts = { vps: cityRowsInScope.filter((row) => row.type === "VPS RPA").length, mobile: cityRowsInScope.filter((row) => row.type === "手机RPA").length };
            return <button key={`city-${city.name}`} type="button" data-city-label={cityZh(city.name)} className={`map-cluster-dot city-aggregate ${typeCounts.mobile > typeCounts.vps ? "mobile-cluster" : ""}`} style={{ left: `${x / 10}%`, top: `${y / 3}%` }} aria-label={`查看城市 ${cityZh(city.name)}，${city.count} 台资源`} title={`${cityZh(city.name)} · ${city.count} 台 · VPS ${typeCounts.vps} / 手机 ${typeCounts.mobile}`} onClick={() => onCountry("city", countryCode, city.name)}><span>{city.count}</span></button>;
          })}
          {view === "country" && liveModel && liveCountry?.cities.map((city) => {
            const cityRows = city.resources || [];
            const located = cityRows.map((row) => ({ row, point: projectLiveMapResource(row) })).filter((entry) => entry.point);
            if (!located.length) return null;
            const x = located.reduce((sum, entry) => sum + entry.point.x, 0) / located.length;
            const y = located.reduce((sum, entry) => sum + entry.point.y, 0) / located.length;
            return <button key={`live-city-${city.cityName}`} type="button" data-city-label={cityZh(city.cityName)} className="map-cluster-dot city-aggregate" style={{ left: `${x}%`, top: `${y}%` }} aria-label={`查看城市 ${cityZh(city.cityName)}，${located.length} 台已定位资源${Number.isSafeInteger(city.resourceCount) ? `，总资源 ${city.resourceCount} 台` : ""}`} title={`${cityZh(city.cityName)} · 已定位 ${located.length} 台${Number.isSafeInteger(city.resourceCount) ? ` / 总资源 ${city.resourceCount} 台` : ""}`} onClick={() => onCountry("city", countryCode, city.cityName)}><span>{located.length}</span></button>;
          })}
          {view === "city" && liveModel && !visiblePlaced.length && <div className="city-map-unlocated" role="status">此范围没有可验证的真实经纬度；地图不生成虚构资源位置，可从右侧列表查看资源。</div>}
          {view === "city" && fixtureScope && (
            <div className="fixture-city-aggregate" role="status">
              <MapPin size={22} weight="fill" />
              <strong>{cityZh(cityName)} · {fixtureScope.rows.length} 台</strong>
              <span>地图仅展示城市聚合；资源详情请从右侧列表或下方资源表打开</span>
            </div>
          )}
           {view === "city" && !Array.isArray(readOnlyRows) && isValidGeoCoordinate(cityCoordinates[cityName]) && (
            <div className="map-label label-b">
               {cityZh(cityName)} <b>{fixtureScope?.rows.length ?? preview.cities.find(([name]) => name === cityName)?.[1] ?? cityRows(countryCode,cityName).length}</b>
            </div>
          )}
          </div>
          {view === "city" && !isValidGeoCoordinate(cityCoordinates[cityName]) && <div className="city-map-unlocated" role="status">此城市未配置精确坐标；地图仅展示城市聚合，不虚构资源位置。</div>}
          {view === "city" && tileError && <div className="city-tile-error" role="status">地图底图加载失败。当前资源位置为本地示例预览，请以资源列表为准。</div>}
          {focused && <div className="map-location-status" role="status"><MapPin size={15} weight="fill" />Located: {focused.name} · {focused.entityId || cityZh(focused.city)}</div>}
          <div className="map-legend">
            <span>
              <i className="green" />
              在线
            </span>
            <span>
              <i className="muted" />
              离线
            </span>
            <span>
              <i className="danger" />
              异常
            </span>
            <span>
              <i className="cyan" />
              已就绪
            </span>
            <span>
              <i className="blue-ring" />
              VPS RPA
            </span>
            <span>
              <i className="purple" />
              手机RPA
            </span>
          </div>
          <div className="map-controls" aria-label="地图控制">
            <button type="button" aria-label="放大地图" title="放大地图" disabled={zoom >= 2.25} onClick={() => changeZoom(1)}>+</button>
            <button type="button" aria-label="缩小地图" title="缩小地图" disabled={zoom <= 1} onClick={() => changeZoom(-1)}>−</button>
            <button type="button" className={focused ? "locating" : ""} aria-label="定位资源" title="定位资源，连续点击切换资源点" onClick={locateResource}><MapPin size={17} weight="duotone" /></button>
          </div>
          {view === "city" && <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>}
        </div>
        <TopList view={view} onDrill={onCountry} onOpen={onOpen} countryCode={countryCode} cityName={cityName} readOnlyRows={liveModel && view === "city" ? sourceRows : Array.isArray(readOnlyRows) || (homeFixture && view === "city") ? sourceRows : null} homeFixture={homeFixture} liveModel={liveModel} />
      </div>
    </SectionCard>
  );
}

function Filters({
  query,
  setQuery,
  type,
  setType,
  country,
  setCountry,
  status,
  setStatus,
  remote,
  setRemote,
  onClear,
  hasActiveFilters,
}) {
  return (
    <div className="table-filters">
      <FilterDropdown label="国家" value={country} onChange={setCountry} searchable
        options={[{ value: "全部国家", label: "全部国家" }, ...countries.map((item) => ({ value: item.code, label: item.chinese, code: item.code, searchText: item.english }))]}
        renderIcon={(option) => <Flag code={option.code} />} />
      <FilterDropdown label="全部状态" value={status} onChange={setStatus}
        options={["全部状态", "运行中", "空闲", "离线", "异常", "已就绪", "安装中", "失败"].map((item) => ({ value: item, label: item }))} />
      <FilterDropdown label="远程连接" value={remote} onChange={setRemote}
        options={["远程连接", "RDP", "手机远程"].map((item) => ({ value: item, label: item }))} />
      <label className="table-search">
        <MagnifyingGlass size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="资源名称 / IP / 方案"
        />
      </label>
      <button type="button" className="filter-clear-button" aria-label="清空筛选条件" title="清空筛选条件" disabled={!hasActiveFilters} onClick={onClear}>清空</button>
    </div>
  );
}

function OperationMenu({ row, menuId, onDetail, onEdit, onLog, onDelete, onDismiss }) {
  const [logsOpen, setLogsOpen] = useState(false);
  const menuRef = useRef(null);
  const logKinds = [
    "RPA运行日志",
    "业务执行Agent日志",
    "客户消息监控Agent日志",
    "Worker日志",
    "Runtime日志",
    "安装/初始化日志",
  ];
  useEffect(() => {
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) onDismiss?.();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss?.({ restoreFocus: true });
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onDismiss]);
  const invoke = (action) => {
    onDismiss?.();
    action?.(row);
  };
  const submenuId = `resource-log-menu-${row.name.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <div className="operation-menu" id={menuId} ref={menuRef} role="menu" aria-label={`Resource actions for ${row.name}`}>
      <button role="menuitem" onClick={() => invoke(onDetail)}><FileText size={15} />详情</button>
      <button role="menuitem" onClick={() => invoke(onEdit)}><PencilSimple size={15} />编辑</button>
      <button type="button" role="menuitem" aria-haspopup="menu" aria-expanded={logsOpen} aria-controls={submenuId} onClick={() => setLogsOpen((current) => !current)}>
        <ClipboardText size={15} />日志 <CaretRight size={13} />
      </button>
      {logsOpen && (
        <div className="log-submenu" id={submenuId} role="menu" aria-label={`Log components for ${row.name}`}>
          {logKinds.map((kind) => (
            <button key={kind} role="menuitem" onClick={() => invoke((selectedRow) => onLog?.(selectedRow, kind))}>{kind}</button>
          ))}
        </div>
      )}
      <button role="menuitem" className="danger-text" onClick={() => invoke(onDelete)}><Trash size={15} />删除</button>
    </div>
  );
}
function projectWorkerReadEntityToRow(entity, index = 0) {
  const countryCode = typeof entity?.countryCode === "string" ? entity.countryCode.toLowerCase() : null;
  const country = (countryCode && countryByCode[countryCode]?.chinese) || entity?.countryName || "UNKNOWN";
  const entityType = entity?.entityType || "UNKNOWN";
  return {
    name: entity?.name || `Unnamed ${entityType} resource`,
    entityId: entity?.id || null,
    entityType,
    identityState: entity?.identityState || "UNKNOWN",
    resourceRenderKey: entity?.id ? `${entityType}:${entity.id}` : `${entityType}:unidentified-${index}`,
    type: entityType === "VPS_RESOURCE" ? "VPS" : entityType,
    rdpEnabled: entityType === "VPS_RESOURCE" ? entity?.rdpEnabled ?? false : null,
    countryCode: countryCode || "??",
    country,
    city: entity?.city || "UNKNOWN",
    provider: null,
    agent: "UNKNOWN",
    customerAgent: "UNKNOWN",
    worker: "UNKNOWN",
    runtime: entity?.runtimeBindingState === "BOUND" ? (workerStatusPresentation(entity.runtimeStatusRaw, "runtime").known ? workerStatusPresentation(entity.runtimeStatusRaw, "runtime").label : entity.runtimeStatusRaw || "UNKNOWN") : "UNKNOWN",
    plan: "UNKNOWN",
    remote: entity?.rdpEnabled === true ? "RDP" : entity?.rdpEnabled === false ? "NOT_ENABLED" : "UNKNOWN",
    progress: null,
    progressState: "UNKNOWN",
    final: "UNKNOWN",
    heartbeat: entity?.runtimeBindingState === "BOUND" ? entity.runtimeLastHeartbeatAt : null,
    last_heartbeat_at: entity?.runtimeBindingState === "BOUND" ? entity.runtimeLastHeartbeatAt : null,
    heartbeat_source: entity?.runtimeBindingState === "BOUND" ? "RUNTIME" : null,
    latitude: entity?.latitude ?? null,
    longitude: entity?.longitude ?? null,
    readOnly: true,
  };
}
function projectWorkerVpsDetailSummary(snapshot) {
  if (snapshot?.state !== "AVAILABLE" || !snapshot.data || snapshot.data.identityMismatch) return null;
  const collections = snapshot.data.collections || {};
  const workers = collections.workers?.items || [];
  const agents = collections.agents?.items || [];
  const runtimes = collections.runtimes?.items || [];
  const describe = (items, value) => items.length ? items.map((item) => value(item)).filter(Boolean).join(", ") : "UNKNOWN";
  return [
    `Worker ${describe(workers, (item) => item.actualStateRaw || "UNKNOWN")}`,
    `Agent ${describe(agents, (item) => `${item.roleRaw || "UNKNOWN"}: ${item.statusRaw || "UNKNOWN"}`)}`,
    `Runtime ${describe(runtimes, (item) => `${item.runtimeStatusRaw || "UNKNOWN"}${item.runtimeVersion ? ` · ${item.runtimeVersion}` : ""}`)}`,
    `Heartbeat ${describe(runtimes, (item) => item.lastHeartbeatAt || "UNKNOWN")}`,
  ].join(" · ");
}
function workerResourceSelectionKey(row) {
  return row?.entityId ? `${row.entityType || "RESOURCE"}:${row.entityId}` : row?.name || "";
}

function resourceActionMenuId(row) {
  return `resource-action-menu-${row.name.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function ResourceTable({
  view,
  countryCode = "id",
  cityName = "Jakarta",
  onDetail,
  onEdit,
  onLog,
  onDelete,
  onSelectionChange,
  overrides = {},
  deletedNames = [],
  readAdapter = null,
  readRetry = 0,
  onReadRetry,
  onReadSnapshotChange,
  homeFixture = null,
}) {
  const fixtureScope = getWorkerHomeFixtureScope(homeFixture, view, countryCode, cityName);
  const fixtureRows = fixtureScope
    ? fixtureScope.rows.filter((row) => !deletedNames.includes(row.name)).map((row) => ({ ...row, ...overrides[row.name] }))
    : visibleResourceRows(view, countryCode, cityName, overrides, deletedNames);
  const preview = countryPreviews[countryCode] || countryPreviews.id;
  const cityTotal = Number(preview.cities.find(([name]) => name === cityName)?.[1] || fixtureRows.length);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("全部类型");
  const [selectedTab, setSelectedTab] = useState("全部");
  const [country, setCountry] = useState("全部国家");
  const [status, setStatus] = useState("全部状态");
  const [remote, setRemote] = useState("远程连接");
  const [menu, setMenu] = useState(null);
  const [selected, setSelected] = useState([]);
  const selectionHeaderRef = useRef(null);
  const menuTriggerRef = useRef(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState({ key: "", direction: "asc" });
  const [readSnapshot, setReadSnapshot] = useState(() => readAdapter ? { state: "LOADING", connection: "INJECTED_TRANSPORT" } : null);
  useEffect(() => {
    if (!readAdapter) {
      setReadSnapshot(null);
      return undefined;
    }
    let active = true;
    const loadingSnapshot = { state: "LOADING", connection: "INJECTED_TRANSPORT" };
    setReadSnapshot(loadingSnapshot);
    onReadSnapshotChange?.(loadingSnapshot);
    Promise.resolve(readAdapter.getOverview())
      .then((result) => { if (active) { setReadSnapshot(result); onReadSnapshotChange?.(result); } })
      .catch(() => { if (active) { const result = { state: "ERROR", connection: "INJECTED_TRANSPORT", data: null, error: { kind: "TRANSPORT_ERROR", status: null } }; setReadSnapshot(result); onReadSnapshotChange?.(result); } });
    return () => { active = false; };
  }, [readAdapter, readRetry, onReadSnapshotChange]);
  const injectedReadMode = Boolean(readAdapter && readSnapshot?.connection === "INJECTED_TRANSPORT");
  const adapterRows = injectedReadMode
    ? (readSnapshot?.data?.entities || []).filter((entity) => entity.entityType === "VPS_RESOURCE").map(projectWorkerReadEntityToRow)
    : null;
  const baseRows = homeFixture ? fixtureRows : injectedReadMode
    ? filterWorkerRowsByGeography(adapterRows || [], { view, countryCode, cityName })
    : fixtureRows;
  const readPagination = readSnapshot?.data?.pagination;
  const fixtureTotal = homeFixture ? fixtureRows.length : view === "global" ? 482 : view === "country" ? preview.total : cityTotal;
  const sourceTotal = injectedReadMode
    ? (readPagination?.state === "PROVIDED" ? readPagination.total : baseRows.length)
    : fixtureTotal;
  const filteredRows = baseRows
    .filter((row) =>
      `${row.name} ${row.city} ${cityZh(row.city)} ${row.provider || "未知服务商"} ${row.customProvider || ""} ${row.plan || ""} ${row.ip || ""} ${row.deviceAddress || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .filter((row) => type === "全部类型" || row.type === type)
    .filter(
      (row) =>
        country === "全部国家" || row.countryCode === country,
    )
    .filter(
      (row) =>
        status === "全部状态" ||
        row.final === status ||
        row.agent === status ||
        row.customerAgent === status ||
        row.worker === status || row.runtime === status,
    )
    .filter((row) => remote === "远程连接" || row.remote === remote);
  const sortValues = {
    name: (row) => row.name, type: (row) => row.type, country: (row) => row.country, city: (row) => cityZh(row.city), provider: (row) => row.customProvider || row.provider,
    agent: (row) => row.agent, customerAgent: (row) => row.customerAgent, worker: (row) => row.worker, runtime: (row) => row.runtime, plan: (row) => row.plan, remote: (row) => row.remote,
    progress: (row) => row.progressState === "UNKNOWN" ? null : Number(row.progress), final: (row) => row.final, heartbeat: (row) => row.heartbeat,
  };
  const rows = useMemo(() => {
    if (!sort.key) return filteredRows;
    const valueFor = sortValues[sort.key];
    const direction = sort.direction === "asc" ? 1 : -1;
    return filteredRows.map((row, index) => ({ row, index, value: valueFor(row) }))
      .sort((a, b) => {
        const av = a.value ?? ""; const bv = b.value ?? "";
        const comparison = typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "zh-CN", { numeric: true, sensitivity: "base" });
        return comparison === 0 ? a.index - b.index : comparison * direction;
      })
      .map(({ row }) => row);
  }, [filteredRows, sort]);
  const changeSort = (key) => setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  const sortHeader = (label, key) => (
      <th aria-sort={sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="resource-sort-button" title={label} onClick={() => changeSort(key)} aria-label={`${label}排序，${sort.key === key && sort.direction === "asc" ? "当前升序，再次点击降序" : "点击升序"}`}>
        {label}{sort.key === key && <span aria-hidden="true">{sort.direction === "asc" ? " ↑" : " ↓"}</span>}
      </button>
    </th>
  );
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const activePage = Math.min(page, totalPages);
  const visibleRows = rows.slice((activePage - 1) * pageSize, activePage * pageSize);
  useEffect(() => setPage(1), [view, countryCode, cityName, query, type, country, status, remote, pageSize]);
  useEffect(() => {
    if (readAdapter && readSnapshot?.state === "LOADING") return;
    onSelectionChange?.(baseRows.filter((row) => selected.includes(workerResourceSelectionKey(row))));
  }, [selected, view, countryCode, cityName, overrides, deletedNames, readSnapshot]);
  useEffect(() => {
    if (readAdapter && readSnapshot?.state === "LOADING") return;
    setSelected((items) => {
      const kept = items.filter((key) => baseRows.some((row) => workerResourceSelectionKey(row) === key));
      return kept.length === items.length ? items : kept;
    });
  }, [view, countryCode, cityName, overrides, deletedNames, readSnapshot]);
  const toggleRow = (row) => {
    const key = workerResourceSelectionKey(row);
    setSelected((items) => items.includes(key) ? items.filter((item) => item !== key) : [...items, key]);
  };
  const selectedOnPageCount = visibleRows.filter((row) => selected.includes(workerResourceSelectionKey(row))).length;
  const allSelected = visibleRows.length > 0 && selectedOnPageCount === visibleRows.length;
  const partiallySelected = selectedOnPageCount > 0 && !allSelected;
  useEffect(() => {
    if (selectionHeaderRef.current) selectionHeaderRef.current.indeterminate = partiallySelected;
  }, [partiallySelected]);
  const hasActiveFilters = query !== "" || type !== "全部类型" || country !== "全部国家" || status !== "全部状态" || remote !== "远程连接";
  const resourceTypeTabs = homeFixture
    ? [
        ["全部", "全部类型", fixtureRows.length],
        ["VPS RPA", "VPS RPA", fixtureRows.filter((row) => row.type === "VPS RPA").length],
        ["手机RPA", "手机RPA", fixtureRows.filter((row) => row.type === "手机RPA").length],
        ["业务执行Agent", "全部类型", fixtureRows.filter((row) => row.businessAgentAttached).length],
        ["客户消息监控Agent", "全部类型", fixtureRows.filter((row) => row.customerAgentAttached).length],
        ["Worker", "全部类型", fixtureRows.filter((row) => row.workerRegistered).length],
        ["Runtime", "全部类型", fixtureRows.filter((row) => row.runtimeBound).length],
      ]
    : injectedReadMode
    ? [
        ["全部", "全部类型", baseRows.length],
        ...[...new Set(baseRows.map((row) => row.type).filter(Boolean))].map((resourceType) => [
          resourceType,
          resourceType,
          baseRows.filter((row) => row.type === resourceType).length,
        ]),
      ]
    : [
        ["全部", "全部类型", view === "global" ? 482 : view === "country" ? preview.total : cityTotal],
        ["VPS RPA", "VPS RPA", view === "global" ? 298 : view === "country" ? preview.vps : baseRows.filter((row) => row.type === "VPS RPA").length],
        ["手机RPA", "手机RPA", view === "global" ? 184 : view === "country" ? preview.mobile : baseRows.filter((row) => row.type === "手机RPA").length],
        ["业务执行Agent", "全部类型", view === "global" ? 386 : view === "country" ? Math.round(preview.total * 0.8) : Math.round(cityTotal * 0.8)],
        ["客户消息监控Agent", "全部类型", view === "global" ? 352 : view === "country" ? Math.round(preview.total * 0.73) : Math.round(cityTotal * 0.73)],
        ["Worker", "全部类型", view === "global" ? 482 : view === "country" ? preview.total : cityTotal],
        ["Runtime", "全部类型", view === "global" ? 482 : view === "country" ? preview.total : cityTotal],
      ];
  const renderResourceTypeTab = ([label, value, count]) => (
    <button
      key={label}
      className={(injectedReadMode ? type === value : selectedTab === label) ? "active" : ""}
      aria-pressed={injectedReadMode ? type === value : selectedTab === label}
      style={injectedReadMode ? { height: 22, borderRadius: 4 } : undefined}
      onClick={() => { setSelectedTab(label); setType(value); }}
    >
      {label} ({count})
    </button>
  );
  const clearFilters = () => {
    setQuery("");
    setType("全部类型");
    setSelectedTab("全部");
    setCountry("全部国家");
    setStatus("全部状态");
    setRemote("远程连接");
    setPage(1);
  };
  return (
    <SectionCard className="resource-table-card">
      {injectedReadMode && <style>{`
        @media (min-width: 901px) and (max-width: 1600px) {
          .worker-resource-list-page .page-title-row h1 { font-size: 20px; }
          .worker-resource-list-page .page-actions .ui-button { height: 30px; }
          .worker-resource-list-page .resource-table-card { border-radius: 8px; }
          .worker-resource-list-page .resource-table-card h2 { font-size: 14px; }
          .worker-resource-list-page .worker-live-list-controls { display: flex; align-items: center; flex: 1 1 auto; min-width: 0; gap: 8px; }
          .worker-resource-list-page .worker-live-list-controls > .table-tabs { flex: 0 0 auto; overflow: visible; }
          .worker-resource-list-page .worker-live-list-controls .resource-toolbar { flex: 1 1 auto; min-width: 0; min-height: 0; justify-content: flex-end; padding: 0; overflow-x: auto; }
          .worker-resource-list-page .worker-live-list-controls .table-filters { overflow: visible; }
          .worker-resource-list-page .table-head .table-tabs button { height: 22px; border-radius: 4px; }
          .worker-resource-list-page .resource-toolbar .table-filters label,
          .worker-resource-list-page .resource-toolbar .table-search { height: 26px; border-radius: 4px; }
          .worker-resource-list-page .resource-table th { height: 27px; padding: 0 6px; }
          .worker-resource-list-page .resource-table td { height: 30px; padding: 0 6px; }
          .worker-resource-list-page .table-footer { padding: 4px 10px; }
        }
        @media (max-width: 900px) {
          .worker-resource-list-page .worker-live-list-controls { display: contents; }
          .worker-resource-list-page .table-head .resource-toolbar { flex-basis: 100%; width: 100%; }
        }
        .worker-resource-list-page .table-scroll { min-width: 0; overflow-x: auto; overscroll-behavior-inline: contain; }
        .worker-resource-list-page .resource-table { width: 100%; min-width: 1090px; max-width: none; table-layout: fixed; }
        .worker-resource-list-page .resource-table th { height: 27px; padding: 0 6px; }
        .worker-resource-list-page .resource-table td { height: 30px; padding: 0 6px; }
        .worker-resource-list-page .resource-table th,
        .worker-resource-list-page .resource-table td { overflow: hidden; text-overflow: ellipsis; }
        .worker-resource-list-page .resource-table th:nth-child(1), .worker-resource-list-page .resource-table td:nth-child(1) { width: 30px; }
        .worker-resource-list-page .resource-table th:nth-child(2), .worker-resource-list-page .resource-table td:nth-child(2) { width: 102px; }
        .worker-resource-list-page .resource-table th:nth-child(3), .worker-resource-list-page .resource-table td:nth-child(3) { width: 44px; }
        .worker-resource-list-page .resource-table th:nth-child(4), .worker-resource-list-page .resource-table td:nth-child(4) { width: 48px; }
        .worker-resource-list-page .resource-table th:nth-child(5), .worker-resource-list-page .resource-table td:nth-child(5) { width: 64px; }
        .worker-resource-list-page .resource-table th:nth-child(6), .worker-resource-list-page .resource-table td:nth-child(6) { width: 96px; }
        .worker-resource-list-page .resource-table th:nth-child(7), .worker-resource-list-page .resource-table td:nth-child(7) { width: 68px; }
        .worker-resource-list-page .resource-table th:nth-child(8), .worker-resource-list-page .resource-table td:nth-child(8) { width: 76px; }
        .worker-resource-list-page .resource-table th:nth-child(9), .worker-resource-list-page .resource-table td:nth-child(9) { width: 68px; }
        .worker-resource-list-page .resource-table th:nth-child(10), .worker-resource-list-page .resource-table td:nth-child(10) { width: 68px; }
        .worker-resource-list-page .resource-table th:nth-child(11), .worker-resource-list-page .resource-table td:nth-child(11) { width: 80px; }
        .worker-resource-list-page .resource-table th:nth-child(12), .worker-resource-list-page .resource-table td:nth-child(12) { width: 60px; }
        .worker-resource-list-page .resource-table th:nth-child(13), .worker-resource-list-page .resource-table td:nth-child(13) { width: 72px; }
        .worker-resource-list-page .resource-table th:nth-child(14), .worker-resource-list-page .resource-table td:nth-child(14) { width: 72px; }
        .worker-resource-list-page .resource-table th:nth-child(15), .worker-resource-list-page .resource-table td:nth-child(15) { width: 104px; }
        .worker-resource-list-page .resource-table th:nth-child(16), .worker-resource-list-page .resource-table td:nth-child(16) { width: 38px; }
        .worker-resource-list-page .resource-table .resource-sort-button { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .worker-resource-list-page .resource-table .status-pill { max-width: 100%; min-width: 0; overflow: hidden; text-overflow: ellipsis; vertical-align: middle; }
        .worker-resource-list-page .resource-table .status-pill i { flex: 0 0 6px; }
        .worker-resource-list-page .resource-table .provider-cell { max-width: 100%; min-width: 0; gap: 4px; overflow: hidden; }
        .worker-resource-list-page .resource-table .provider-cell > span:not(.external) { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .worker-resource-list-page .resource-table .provider-logo { width: 30px; height: 23px; flex: 0 0 30px; object-fit: contain; filter: none !important; opacity: 1; }
        .worker-resource-list-page .resource-table .provider-logo-rackspace { padding: 2px; border: 1px solid rgba(111, 175, 255, .55); border-radius: 3px; background: #071a33; }
        .worker-resource-list-page .resource-table .provider-mark-pending { flex: 0 0 24px; min-width: 24px; height: 22px; }
        .worker-resource-list-page .resource-table .flag { width: 24px; height: 16px; flex: 0 0 24px; }
        .worker-resource-list-page .resource-table .country-cell { max-width: 100%; min-width: 0; gap: 4px; overflow: hidden; }
        .worker-resource-list-page .resource-table .heartbeat,
        .worker-resource-list-page .resource-table .worker-heartbeat-preview { display: block; max-width: 100%; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
        .worker-resource-list-page .resource-table .worker-heartbeat-preview > * { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
        .worker-resource-list-page .resource-table .plan-cell,
        .worker-resource-list-page .resource-table .resource-name { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
      `}</style>}
      {injectedReadMode && readSnapshot?.state === "LOADING" && (
        <div className="read-only-state center-state" role="status" aria-live="polite">
          <CircleNotch size={28} className="spin" /><b>Loading staging resource list</b><span>Save and Install use the isolated staging API.</span>
        </div>
      )}
      {injectedReadMode && ["ERROR", "INVALID_RESPONSE"].includes(readSnapshot?.state) && (
        <div className="read-only-state center-state error-state" role="alert">
          <WarningCircle size={28} /><b>{readSnapshot?.state === "INVALID_RESPONSE" ? "Invalid response" : "Read request failed"}</b>
          <span>{readSnapshot?.error?.status ? `${readSnapshot.error.kind} · HTTP ${readSnapshot.error.status}` : readSnapshot?.error?.kind || "INVALID_RESPONSE"}</span>
          <Button onClick={onReadRetry}>Retry read</Button>
        </div>
      )}
      {injectedReadMode && readSnapshot?.state === "PARTIAL" && (
        <div className="read-partial-notice" role="status">Partial response. Missing or invalid collections remain unknown.</div>
      )}
      <div className="table-head">
        <h2>资源列表 <span>（共{sourceTotal}条）</span></h2>
        {injectedReadMode && (
          <div className="worker-live-list-controls">
            <div className="table-tabs" aria-label="资源类型">{resourceTypeTabs.map(renderResourceTypeTab)}</div>
            <div className="resource-toolbar">
              <Filters {...{ query, setQuery, type, setType, country, setCountry, status, setStatus, remote, setRemote, onClear: clearFilters, hasActiveFilters }} />
            </div>
          </div>
        )}
      </div>
      {injectedReadMode && selected.length > 0 && (
        <div className="read-partial-notice" role="status" aria-live="polite">
          已选择 {selected.length} 个 staging 资源。当前保留的 TEST 验收资源受保护，批量删除不可用。
          <Button onClick={() => setSelected([])} aria-label="取消当前选择">取消选择</Button>
        </div>
      )}
      {!injectedReadMode && (
        <div className="resource-toolbar">
          <div className="table-tabs" aria-label="资源类型">{resourceTypeTabs.map(renderResourceTypeTab)}</div>
          <Filters {...{ query, setQuery, type, setType, country, setCountry, status, setStatus, remote, setRemote, onClear: clearFilters, hasActiveFilters }} />
        </div>
      )}
      <div className="table-scroll">
        <table className="resource-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  ref={selectionHeaderRef}
                  checked={allSelected}
                  onChange={() =>
                    setSelected(allSelected ? selected.filter((key) => !visibleRows.some((row) => workerResourceSelectionKey(row) === key)) : [...new Set([...selected, ...visibleRows.map(workerResourceSelectionKey)])])
                  }
                />
              </th>
              {sortHeader("资源名称", "name")}
              {sortHeader("资源类型", "type")}
              {sortHeader("国家", "country")}
              {sortHeader("城市", "city")}
              {sortHeader("来源 / 服务商", "provider")}
              {sortHeader("业务执行Agent状态", "agent")}
              {sortHeader("客户消息监控Agent状态", "customerAgent")}
              {sortHeader("Worker状态", "worker")}
              {sortHeader("Runtime状态", "runtime")}
              {sortHeader("RPA运行方案", "plan")}
              {sortHeader("远程连接", "remote")}
              {sortHeader("开通进度", "progress")}
              {sortHeader("最终状态", "final")}
              {sortHeader("最后心跳", "heartbeat")}
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.resourceRenderKey || row.name} data-resource-id={row.entityId || undefined} data-resource-type={row.entityType || undefined} data-identity-state={row.identityState || undefined}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.includes(workerResourceSelectionKey(row))}
                    onChange={() => toggleRow(row)}
                  />
                </td>
                <td title={[row.name, row.ip || row.deviceAddress].filter(Boolean).join(" · ")}>
                  <b className="resource-name">
                    <i className="resource-dot" />
                    {row.name}
                  </b>
                  {(row.ip || row.deviceAddress) && <small className="resource-address">{row.ip || row.deviceAddress}</small>}
                </td>
                <td title={row.type || "资源类型未提供"}>
                  <span
                    className={`type-badge ${row.type === "手机RPA" ? "mobile" : ""}`}
                  >
                    {row.type}
                  </span>
                </td>
                <td title={row.country || "国家未提供"}>
                  <span className="country-cell">
                    {row.countryCode !== "??" && <Flag code={row.countryCode} />}
                    {row.country === "印度尼西亚" ? "印尼" : row.country}
                  </span>
                </td>
                <td title={cityZh(row.city)}>{cityZh(row.city)}</td>
                <td title={row.customProvider || row.provider || "服务商未提供"}>
                  <ProviderCell row={row} />
                </td>
                <td title={homeFixture && row.businessAgentAttached === false ? "业务执行 Agent 未配置" : row.agent || "业务执行 Agent 状态未提供"}>
                  {homeFixture && row.businessAgentAttached === false ? <StatusPill value="未配置" tone="muted" /> : <ResourceStatus value={row.agent} dimension="agent" />}
                </td>
                <td title={homeFixture && row.customerAgentAttached === false ? "客户消息监控 Agent 未配置" : row.customerAgent || "客户消息监控 Agent 状态未提供"}>
                  {homeFixture && row.customerAgentAttached === false ? <StatusPill value="未配置" tone="muted" /> : <ResourceStatus value={row.customerAgent} dimension="agent" />}
                </td>
                <td title={row.worker || "Worker 状态未提供"}>
                  <ResourceStatus value={row.worker} dimension="worker" />
                </td>
                <td title={row.runtime || "Runtime 状态未提供"}>
                  <ResourceStatus value={row.runtime} dimension="runtime" />
                </td>
                <td className="plan-cell" title={row.plan || "RPA 方案未提供"}>{row.plan}</td>
                <td title={row.remote || "远程连接状态未提供"}>
                  <button className="remote-link" title={row.remote || "远程连接状态未提供"} disabled={injectedReadMode} onClick={() => onDetail(row)}>
                    {row.remote}
                  </button>
                </td>
                <td title={row.progressState === "UNKNOWN" ? "开通进度未知" : `开通进度 ${row.progress}%`}>
                  {row.progressState === "UNKNOWN" ? <span className="unknown-read-value">UNKNOWN</span> : <ProgressBar value={row.progress} />}
                </td>
                <td title={row.final || "最终状态未提供"}>
                  <ResourceStatus value={row.final} dimension="final" />
                  {row.lifecyclePreview?.archived && <span className="archive-preview-badge">ARCHIVED · LOCAL PREVIEW</span>}
                </td>
                <td className="heartbeat"><HeartbeatPreview row={row} /></td>
                <td className="operation-cell">
                  {injectedReadMode && isStableWorkerResource(row) && row.entityType === "VPS_RESOURCE" && <button type="button" className="more-button" aria-label={`Edit resource ${row.name}`} title={`编辑 ${row.name}`} onClick={() => onEdit(row)}><PencilSimple size={17} /></button>}
                  {injectedReadMode && isStableWorkerResource(row) && <button type="button" className="more-button" aria-label={`Open details for ${row.entityId}`} data-open-resource-id={row.entityId} onClick={() => onDetail(row)}><Eye size={18} /></button>}
                  {!injectedReadMode && <button
                    type="button"
                    className="more-button"
                    aria-label={`资源操作：${row.name}`}
                    aria-haspopup="menu"
                    aria-expanded={menu === row.name}
                    aria-controls={resourceActionMenuId(row)}
                    onClick={(event) => {
                      menuTriggerRef.current = event.currentTarget;
                      setMenu(menu === row.name ? null : row.name);
                    }}
                  >
                    <DotsThree size={19} />
                  </button>}
                  {!injectedReadMode && menu === row.name && (
                    <OperationMenu
                      row={row}
                      menuId={resourceActionMenuId(row)}
                      {...{ onDetail, onEdit, onLog, onDelete }}
                      onDismiss={({ restoreFocus } = {}) => {
                        setMenu(null);
                        if (restoreFocus) window.requestAnimationFrame(() => menuTriggerRef.current?.focus());
                      }}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && injectedReadMode && readSnapshot?.state === "EMPTY" && <div className="read-only-state center-state" role="status"><Check size={28} /><b>No VPS resources in this response</b><span>Empty response is distinct from an unverified or failed read.</span></div>}
        {rows.length === 0 && injectedReadMode && readSnapshot?.state !== "EMPTY" && !["LOADING", "ERROR", "INVALID_RESPONSE"].includes(readSnapshot?.state) && <div className="read-only-state center-state" role="status"><b>No matching fetched rows</b><span>Change or clear the local filters.</span></div>}
        {rows.length === 0 && !injectedReadMode && <EmptyState />}
      </div>
      <div className="table-footer">
        <span>
          {injectedReadMode || homeFixture ? `当前筛选 ${rows.length} 条 · 共 ${sourceTotal} 条 · 第 ${activePage}/${totalPages} 页 · 已选 ${selected.length} 条` : `已加载 ${rows.length} 条预览 / 统计展示 ${fixtureTotal} 条 · 已选 ${selected.length}`}
        </span>
        <div className="pagination">
          <button aria-label="上一页" disabled={activePage === 1} onClick={() => setPage(activePage - 1)}>‹</button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).filter((number) => totalPages <= 7 || number === 1 || number === totalPages || Math.abs(number - activePage) <= 2).map((number) => <button key={number} className={number === activePage ? "active" : ""} aria-current={number === activePage ? "page" : undefined} onClick={() => setPage(number)}>{number}</button>)}
          <button aria-label="下一页" disabled={activePage === totalPages} onClick={() => setPage(activePage + 1)}>›</button>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            <option value="10">10 条 / 页</option>
            <option value="50">50 条 / 页</option>
            <option value="100">100 条 / 页</option>
          </select>
        </div>
      </div>
    </SectionCard>
  );
}

function Field({
  label,
  hint,
  value = "",
  onChange,
  selectField = false,
  options = [],
  password = false,
  placeholder = "",
  wide = false,
}) {
  return (
    <label className={`field ${wide ? "wide" : ""}`}>
      <span>
        {label} {hint && <em>{hint}</em>}
      </span>
      {selectField ? (
        <select defaultValue={options[0]}>
          {options.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      ) : (
        <div className="input-wrap">
          <input
            type={password ? "password" : "text"}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange?.(e.target.value)}
          />
          {password && <Eye size={16} />}
        </div>
      )}
    </label>
  );
}

function AddResource({ initialType, onClose, onComplete, onZeroTouch }) {
  const [step, setStep] = useState(2);
  const [resourceType, setResourceType] = useState(initialType);
  const [packageName, setPackageName] = useState("Browser AI RPA");
  const [form, setForm] = useState({
    name: "IDN-JKT-001",
    city: "Jakarta",
    lat: "-6.2088",
    lng: "106.8456",
    ip: "103.10.10.11",
    port: "3389",
    username: "administrator",
    password: "••••••••",
  });
  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const packages =
    packageProfiles[packageName] || packageProfiles["Browser AI RPA"];
  return (
    <div className="add-page">
      <div className="add-header">
        <div>
          <div className="add-icon">
            <Cube size={26} />
          </div>
          <div>
            <h1>添加资源</h1>
            <p>按业务需求选择并配置各类资源，完成后即可生成配置</p>
          </div>
        </div>
        <Button icon={ArrowLeft} onClick={onClose}>
          返回资源中心
        </Button>
      </div>
      <div className="stepper">
        <button
          className={step === 1 ? "active" : ""}
          onClick={() => setStep(1)}
        >
          <span>1</span>
          <b>基础信息</b>
          <small>资源类型、地域、基础配置</small>
        </button>
        <i />
        <button
          className={step === 2 ? "active" : ""}
          onClick={() => setStep(2)}
        >
          <span>2</span>
          <b>Agent与运行配置</b>
          <small>选择Agent、运行环境及执行方案</small>
        </button>
      </div>
      {step === 1 ? (
        <AddStepOne
          form={form}
          update={update}
          resourceType={resourceType}
          setResourceType={setResourceType}
        />
      ) : (
        <AddStepTwo
          packageName={packageName}
          setPackageName={setPackageName}
          packages={packages}
          onZeroTouch={onZeroTouch}
        />
      )}
      <div className="add-footer">
        <span>
          <Info size={16} />
          PREVIEW_ONLY · BUSINESS_BACKEND_CONNECTED = NO
        </span>
        <div>
          {step === 2 && <Button onClick={() => setStep(1)}>上一步</Button>}
          {step === 1 ? (
            <Button
              variant="primary"
              icon={ArrowRight}
              onClick={() => setStep(2)}
            >
              下一步
            </Button>
          ) : (
            <Button
              variant="primary"
              icon={Check}
              onClick={() =>
                onComplete({
                  ...form,
                  type: resourceType,
                  package: packageName,
                })
              }
            >
              完成添加
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddStepOne({ form, update, resourceType, setResourceType }) {
  return (
    <div className="add-panel">
      <div className="add-panel-title">
        <Cube size={21} />
        <div>
          <h2>基础信息</h2>
          <p>填写资源的基础信息，用于资源识别与管理</p>
        </div>
      </div>
      <div className="resource-switch">
        <button
          className={resourceType === "VPS RPA" ? "active" : ""}
          onClick={() => setResourceType("VPS RPA")}
        >
          <Desktop size={20} />
          VPS RPA
        </button>
        <button
          className={resourceType === "手机RPA" ? "active mobile" : "mobile"}
          onClick={() => setResourceType("手机RPA")}
        >
          <WifiHigh size={20} />
          手机RPA
        </button>
      </div>
      <div className="form-grid">
        <Field
          label="资源名称"
          value={form.name}
          onChange={(value) => update("name", value)}
        />
        <Field
          label="模板"
          selectField
          options={[
            "通用 Windows 模板（推荐）",
            "Linux Worker 模板",
            "Mobile RPA 模板",
          ]}
        />
        <Field
          label="国家"
          selectField
          options={[
            "Indonesia（印度尼西亚）",
            "Vietnam（越南）",
            "Thailand（泰国）",
          ]}
        />
        <Field
          label="城市"
          hint="手工输入"
          value={form.city}
          onChange={(value) => update("city", value)}
        />
        <Field
          label="Latitude 纬度"
          value={form.lat}
          onChange={(value) => update("lat", value)}
        />
        <Field
          label="Longitude 经度"
          value={form.lng}
          onChange={(value) => update("lng", value)}
        />
        <Field
          label="Provider Name"
          selectField
          options={["AWS", "DigitalOcean", "Google Cloud", "Microsoft Azure"]}
        />
        <Field
          label="Provider Console URL"
          wide
          value="https://console.aws.amazon.com/"
        />
      </div>
      {resourceType === "VPS RPA" ? (
        <div className="rdp-block">
          <div className="add-panel-title">
            <Monitor size={21} />
            <div>
              <h2>RDP 远程桌面配置</h2>
              <p>配置 VPS 的 RDP 连接信息，用于远程访问和执行自动化任务</p>
            </div>
            <span className="switch-on">已启用</span>
          </div>
          <div className="form-grid four">
            <Field
              label="RDP IP 地址"
              value={form.ip}
              onChange={(value) => update("ip", value)}
            />
            <Field
              label="RDP 端口"
              value={form.port}
              onChange={(value) => update("port", value)}
            />
            <Field
              label="RDP 用户名"
              value={form.username}
              onChange={(value) => update("username", value)}
            />
            <Field
              label="RDP 密码"
              password
              value={form.password}
              onChange={(value) => update("password", value)}
            />
          </div>
        </div>
      ) : (
        <div className="rdp-block mobile-block">
          <div className="add-panel-title">
            <WifiHigh size={21} />
            <div>
              <h2>设备与远程控制</h2>
              <p>配置手机设备连接和远程屏幕控制能力</p>
            </div>
          </div>
          <div className="form-grid four">
            <Field
              label="设备连接方式"
              selectField
              options={["专用云设备网关", "HTTPS 远程网关", "WebRTC 远程连接"]}
            />
            <Field label="设备地址" placeholder="设备序列号或 IP 地址" />
            <Field label="远程屏幕" selectField options={["启用", "关闭"]} />
            <Field
              label="手机设备控制"
              selectField
              options={["启用云端控制", "仅查看"]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function AddStepTwo({ packageName, setPackageName, packages, onZeroTouch }) {
  const cards = [
    ["业务执行Agent", Lightning, "支持自动化业务流程执行"],
    ["客户消息监控Agent", UsersThree, "实时监控多渠道客户消息"],
    ["Worker", Stack, "提供稳定的运行环境"],
    ["Runtime", GearSix, "支持多种运行时环境"],
    ["MCP", Stack, "提供丰富的工具和插件能力"],
  ];

  return (
    <div className="config-area">
      <div className="config-card-grid">
        {cards.map(([label, Icon, desc]) => (
          <div className="config-card" key={label}>
            <div className="config-card-icon">
              <Icon size={25} />
            </div>
            <div className="config-card-copy">
              <h3>
                {label} <Info size={13} />
              </h3>
              <p>{desc}</p>
              <select>
                <option>请选择{label}</option>
                <option>默认配置（推荐）</option>
              </select>
              <span className="config-enabled">
                <i />
                已启用
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="config-lower">
        <div className="rpa-config config-card">
          <div className="config-card-copy">
            <h3>
              RPA运行方案 <Info size={13} />
            </h3>
            <p>选择RPA执行方案，用于定义RPA的运行方式和策略</p>
            <select
              value={packageName}
              onChange={(event) => setPackageName(event.target.value)}
            >
              {Object.keys(packageProfiles).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <div className="package-empty">
              <Cube size={25} />
              <b>已选择 {packageName} 对应的软件包</b>
              {packages.map((pkg) => (
                <span key={pkg}>
                  <CheckCircle size={14} />
                  {pkg}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="install-card config-card">
          <div className="config-card-copy">
            <h3>
              安装方案 <Info size={13} />
            </h3>
            <p>选择资源的安装部署方案</p>
          </div>
          <label className="radio-row">
            <input type="radio" defaultChecked name="install" />
            标准安装（推荐）<small>在线安装，自动配置运行环境</small>
          </label>
          <label className="radio-row">
            <input type="radio" name="install" />
            离线安装<small>通过离线包进行安装部署</small>
          </label>
        </div>
      </div>
      <div className="zero-touch-card">
        <div>
          <CloudArrowUp size={27} />
          <div>
            <h3>
              Zero-Touch 开通 <Info size={13} />
            </h3>
            <p>
              一键生成用于自动化开通的命令，支持 Agent / Worker / Runtime / RPA
              环境的批量部署
            </p>
          </div>
        </div>
        <button onClick={onZeroTouch}>
          <Copy size={17} />
          复制 Zero-Touch 命令
        </button>
      </div>
    </div>
  );
}

function Drawer({ row, onClose, onZeroTouch, onLifecyclePreview, onArchivePreview, onRestorePreview, onNotify }) {
  if (!row) return null;
  if (row.__notFound) {
    return (
      <div className="modal-backdrop">
        <aside className="resource-drawer" role="dialog" aria-modal="true" aria-labelledby="resource-missing-title">
          <div className="drawer-head">
            <div>
              <div className="page-kicker">LOCAL PREVIEW MOCK</div>
              <h2 id="resource-missing-title">Resource not found</h2>
              <p>No preview fixture matches {row.name}.</p>
            </div>
            <IconButton onClick={onClose}>
              <X size={20} />
            </IconButton>
          </div>
          <div className="drawer-foot">
            <Button onClick={onClose}>Return to resources</Button>
          </div>
        </aside>
      </div>
    );
  }
  return (
    <div className="modal-backdrop">
      <aside className="resource-drawer" data-resource-id={row.entityId || undefined} data-identity-state={row.identityState || undefined}>
        <div className="drawer-head">
          <div>
            <div className="page-kicker">RESOURCE DETAIL</div>
            <h2>{row.name}</h2>
            {!row.readOnly && <button type="button" className="lifecycle-preview-trigger" onClick={onLifecyclePreview}>Lifecycle preview</button>}
            {!row.readOnly && (row.lifecyclePreview?.archived && onRestorePreview ? <button type="button" className="restore-preview-trigger" onClick={() => onRestorePreview(row)}>Restore preview</button> : onArchivePreview && <button type="button" className="archive-preview-trigger" onClick={() => onArchivePreview(row)}>Archive preview</button>)}
            <p>
              {row.type} · {row.country} · {cityZh(row.city)}
            </p>
          </div>
          <IconButton onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        <div className="drawer-body">
{row.readOnly ? <p className="read-source-notice" role="note">Read-only overview DTO. {row.detailState === "LOADING" ? "Loading live resource detail…" : row.detailState === "ERROR" ? "Live resource detail is unavailable; overview fields remain read-only." : row.detailState === "AVAILABLE" ? row.detailSummary : "Related runtime state and heartbeat are not included in this response."}</p> : <div className="drawer-status">
            <ResourceStatus value={row.final} dimension="final" />
            <span>Heartbeat <HeartbeatPreview row={row} /></span>
          </div>}
          {row.lifecyclePreview?.archived && <div className="archive-preview-banner" role="status">Archived in local preview · {row.lifecyclePreview.reason}</div>}
<div className="drawer-grid">
            {row.readOnly ? <>
              <DetailItem label="Resource UUID" value={row.entityId || "UNKNOWN"} />
              <DetailItem label="Resource type" value={row.type} />
              <DetailItem label="Country / city" value={row.country + " · " + row.city} />
              <DetailItem label="RDP enabled (DTO)" value={row.remote === "UNKNOWN" ? "UNKNOWN" : row.remote} />
              <DetailItem label="Latitude / longitude (DTO)" value={Number.isFinite(row.latitude) && Number.isFinite(row.longitude) ? String(row.latitude) + " / " + String(row.longitude) : "UNKNOWN"} />
            </> : <>
            <DetailItem label="资源类型" value={row.type} />
            <DetailItem
              label="国家 / 城市"
              value={`${row.country} · ${cityZh(row.city)}`}
            />
            <DetailItem
              label="Provider"
              value={
                <span className="provider-cell">
                  <ProviderMark name={row.provider === "自定义服务商" ? row.customProvider : row.provider} customUrl={row.providerLogo} />
                  {row.provider === "自定义服务商" ? row.customProvider || row.provider : row.provider}
                </span>
              }
            />
            <DetailItem label="业务执行Agent" value={<ResourceStatus value={row.agent} dimension="agent" />} />
            <DetailItem label="客户消息监控Agent" value={<ResourceStatus value={row.customerAgent} dimension="agent" />} />
            <DetailItem label="Worker" value={<ResourceStatus value={row.worker} dimension="worker" />} />
            <DetailItem label="Runtime" value={<ResourceStatus value={row.runtime} dimension="runtime" />} />
            <DetailItem label="注册状态" value={workerHeartbeatPreview(row).registration === "REGISTERED" ? "已注册" : <span title="Preview fixture has no Worker ID">未知 · 示例数据</span>} />
            <DetailItem label="心跳状态" value={<HeartbeatPreview row={row} />} />
            <DetailItem label="RPA方案" value={row.plan} />
            <DetailItem label="远程连接" value={row.remote} />
            {row.template && <DetailItem label="模板" value={row.template} />}
            {(row.ip || row.deviceAddress) && <DetailItem label={row.type === "手机RPA" ? "设备网关" : "IP 地址"} value={row.ip || row.deviceAddress} />}
            {row.port && row.type !== "手机RPA" && <DetailItem label="RDP 端口" value={row.port} />}
            {row.username && row.type !== "手机RPA" && <DetailItem label="RDP 用户名" value={row.username} />}
            {row.consoleUrl && <DetailItem label="服务商后台" value={safeHttpUrl(row.consoleUrl) ? <a href={safeHttpUrl(row.consoleUrl)} target="_blank" rel="noreferrer">{row.consoleUrl}</a> : row.consoleUrl} />}
            <DetailItem label="密码" value="••••••••" />
          </>}
          </div>
{!row.readOnly && <div className="drawer-section"><h3>RPA progress</h3><ProgressBar value={row.progress} /></div>}
          {row.readOnly ? <div className="drawer-section" role="note"><h3>History</h3><p>Not included in this read-only overview DTO.</p></div> : <div className="drawer-section"><h3>Timeline</h3><div className="timeline"><span><i className="done" />Created<small>2024-01-14 09:06</small></span><span><i className="done" />Package ready<small>2024-01-14 12:18</small></span><span><i className="current" />Ready for Business<small>2024-01-14 12:32</small></span></div></div>}
          {!row.readOnly && <div className="drawer-section drawer-command">
            <div>
              <Key size={18} />
              <div>
                <h3>Zero-Touch Command</h3>
                <code>powershell -ExecutionPolicy Bypass -Command ...</code>
              </div>
            </div>
            <button onClick={onZeroTouch}>
              <Copy size={16} />
              查看命令
            </button>
          </div>}
        </div>
        <div className="drawer-foot">
          <Button onClick={onClose}>关闭</Button>
          {!row.readOnly && (
<Button variant="primary" icon={Monitor} onClick={() => onNotify?.(`远程连接预览：${row.ip || row.deviceAddress || "未配置地址"}。真实连接需安装并授权 Windows 桌面助手。`, "warning")}>
            打开远程桌面
          </Button>
          )}
        </div>
      </aside>
    </div>
  );
}
function LifecyclePreviewModal({ resource, onClose }) {
  const actions = ["RUN", "PAUSE", "MAINTENANCE", "DISABLE"];
  const outcomes = ["Success", "Forbidden", "Failure", "Timeout", "Stale response"];
  const [action, setAction] = useState(actions[0]);
  const [outcome, setOutcome] = useState(outcomes[0]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("Idle — no action has been submitted.");
  const requestRef = useRef(0);
  const submit = () => {
    if (!confirmed || busy) return;
    const requestId = ++requestRef.current;
    setBusy(true);
    setResult(`Simulating ${action}…`);
    window.setTimeout(() => {
      if (requestRef.current !== requestId) return;
      setBusy(false);
      setResult({
        Success: "Simulated success. The resource fixture was not changed.",
        Forbidden: "Simulated forbidden response. No resource state changed.",
        Failure: "Simulated failure. No resource state changed.",
        Timeout: "Simulated timeout. No resource state changed.",
        "Stale response": "Stale response ignored. No resource state changed.",
      }[outcome]);
    }, 400);
  };
  const cancel = () => { requestRef.current += 1; setBusy(false); onClose(); };
  return (
    <div className="modal-backdrop">
      <section className="center-modal lifecycle-preview-modal" role="dialog" aria-modal="true" aria-labelledby="lifecycle-preview-title" data-preview-only="true">
        <div className="drawer-head">
          <div><div className="page-kicker">LOCAL PREVIEW MOCK · NO WORKER COMMAND</div><h2 id="lifecycle-preview-title">Lifecycle action simulation</h2><p>{resource?.name || "Selected resource"} · fixture state remains unchanged</p></div>
          <IconButton aria-label="Close lifecycle preview" onClick={cancel}><X size={20} /></IconButton>
        </div>
        <div className="lifecycle-preview-body">
          <div className="lifecycle-preview-warning" role="note">Candidate API action names only. Deployed permission and transition rules are unverified.</div>
          <label className="lifecycle-preview-field">Candidate action<select aria-label="Candidate lifecycle action" value={action} disabled={busy} onChange={(event) => setAction(event.target.value)}>{actions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="lifecycle-preview-field">Simulated response<select aria-label="Simulated lifecycle response" value={outcome} disabled={busy} onChange={(event) => setOutcome(event.target.value)}>{outcomes.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="confirm-check lifecycle-preview-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} />Confirm local preview simulation</label>
          <div className="lifecycle-preview-result" role="status" aria-live="polite" data-busy={busy}>{result}</div>
        </div>
        <div className="modal-actions"><Button disabled={busy} onClick={cancel}>Cancel</Button><Button variant="primary" disabled={!confirmed || busy} onClick={submit}>{busy ? "Simulating…" : "Simulate action"}</Button></div>
      </section>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function StagingBootstrapModal({ session, resourceName = "Worker", onClose, onNotify }) {
  const command = typeof session?.bootstrap_command === "string" ? session.bootstrap_command : "";
  const copyCommand = async () => {
    if (!command) return;
    try { await navigator.clipboard.writeText(command); onNotify(`一次性 staging Bootstrap 命令已复制；请在 ${resourceName} 管理员 PowerShell 执行`); }
    catch { onNotify("复制失败；请检查浏览器剪贴板权限", "error"); }
  };
  return (
    <div className="modal-backdrop">
      <section className="center-modal" role="dialog" aria-modal="true" aria-labelledby="staging-bootstrap-title">
        <div className="drawer-head"><div><div className="page-kicker">STAGING · ONE-TIME ENROLLMENT</div><h2 id="staging-bootstrap-title">{resourceName} Zero-Touch</h2><p>Session {session?.id} · {session?.status || "PENDING"}</p></div><IconButton onClick={onClose}><X size={20} /></IconButton></div>
        <div className="zero-provisioning-disclosure" role="note"><strong>真实 staging Bootstrap</strong><span>命令只保留在当前页面内存，Enrollment Code 有效期由 staging API 控制。不要将命令粘贴到报告、日志或聊天中。</span></div>
        {command ? <div className="command-code"><span>一次性 PowerShell 命令</span><code>{command}</code><button type="button" aria-label="复制一次性 Bootstrap 命令" onClick={copyCommand}><Copy size={16} /></button></div> : <p role="alert">服务端未返回可执行的一次性命令。未标记安装成功。</p>}
        <div className="modal-actions"><Button onClick={onClose}>关闭</Button><Button variant="primary" disabled={!command} onClick={copyCommand}>复制并在管理员 PowerShell 执行</Button></div>
      </section>
    </div>
  );
}

function ZeroTouchModal({ onClose, onNotify, resource, provisioningPreview = null }) {
  const [version, setVersion] = useState(1);
  const packageName = provisioningPreview?.packageName || resource?.package || resource?.plan || "";
  const profileItems = provisioningPreview?.packages || (packageName ? packageProfiles[packageName] || [] : []);
  const agentSelections = provisioningPreview?.componentSelections || {};
  const componentNames = profileItems;
  const [componentStages, setComponentStages] = useState(() => Object.fromEntries(componentNames.map((name) => [name, "PENDING"])));
  const [events, setEvents] = useState(() => [{
    event_type: "PROVISIONING_PREVIEW_OPENED",
    component_name: null,
    status: "LOCAL_MOCK",
    message: "仅打开本地预览；未创建真实开通会话",
    payload: { source: "LOCAL_MOCK", resource_name: resource?.name || "IDN-JKT-001", profile: packageName || null, manifest_status: "UNVERIFIED", occurred_at_source: "LOCAL_PREVIEW_CLIENT_CLOCK", source_timezone: "UNKNOWN", received_at: null },
    occurred_at: new Date().toISOString(),
  }]);
  const name = resource?.name || "IDN-JKT-001";
  const command = packageName ? "./workerctl install --resource " + name + " --packages " + packageName.toLowerCase().replaceAll(" ", "-") + " --preview " + version : "";
  const localAgentStatus = (selection) => !selection ? "未知：无本地选择快照" : selection.enabled === false ? "本地已关闭" : selection.value ? "本地已选择" : "本地待配置";
  const stageOrder = ["PENDING", "INSTALLING_PREVIEW", "VERIFYING_PREVIEW", "LOCAL_PREVIEW_COMPLETE"];
  const stageLabel = { PENDING: "待模拟", INSTALLING_PREVIEW: "模拟安装中", VERIFYING_PREVIEW: "模拟验证中", LOCAL_PREVIEW_COMPLETE: "本地模拟完成", LOCAL_PREVIEW_FAILED: "模拟失败 · 可重试" };
  const [retryCounts, setRetryCounts] = useState({});
  const [reinstallCounts, setReinstallCounts] = useState({});
  const prependLocalEvent = (event) => setEvents((currentEvents) => [{ ...event, payload: { ...event.payload, source: "LOCAL_MOCK", resource_name: name, profile: packageName || null, manifest_status: "UNVERIFIED", occurred_at_source: "LOCAL_PREVIEW_CLIENT_CLOCK", source_timezone: "UNKNOWN", received_at: null }, occurred_at: new Date().toISOString() }, ...currentEvents]);
  const advanceComponent = (componentName) => {
    const current = componentStages[componentName] || "PENDING";
    if (current === "LOCAL_PREVIEW_FAILED") return;
    const next = stageOrder[Math.min(stageOrder.indexOf(current) + 1, stageOrder.length - 1)];
    if (next === current) return;
    setComponentStages((states) => ({ ...states, [componentName]: next }));
    prependLocalEvent({ event_type: "COMPONENT_PREVIEW_STAGE_CHANGED", component_name: componentName, status: next, message: componentName + " 状态仅在浏览器本地演示", payload: { stage: next } });
  };
  const failComponentPreview = (componentName) => {
    const current = componentStages[componentName] || "PENDING";
    if (current === "LOCAL_PREVIEW_COMPLETE" || current === "LOCAL_PREVIEW_FAILED") return;
    const attempt = (retryCounts[componentName] || 0) + 1;
    const attemptId = [name, componentName, attempt].join("::");
    setComponentStages((states) => ({ ...states, [componentName]: "LOCAL_PREVIEW_FAILED" }));
    prependLocalEvent({ event_type: "COMPONENT_INSTALL_FAILED", component_name: componentName, status: "FAILED_RETRYABLE", message: "本地模拟安装失败；未调用安装器或后端。", payload: { attempt, attempt_id: attemptId, failure_kind: "SYNTHETIC_UI_PREVIEW", retryable: true } });
  };
  const retryComponentPreview = (componentName) => {
    if (componentStages[componentName] !== "LOCAL_PREVIEW_FAILED") return;
    const attempt = (retryCounts[componentName] || 0) + 1;
    const attemptId = [name, componentName, attempt].join("::");
    setRetryCounts((counts) => ({ ...counts, [componentName]: attempt }));
    setComponentStages((states) => ({ ...states, [componentName]: "INSTALLING_PREVIEW" }));
    prependLocalEvent({ event_type: "PROVISIONING_RETRY_REQUESTED", component_name: componentName, status: "LOCAL_MOCK_RETRY_STARTED", message: "本地模拟重试 " + attempt + " 已开始；没有请求服务端重试。", payload: { attempt, attempt_id: attemptId, retry_scope: "LOCAL_PREVIEW_ONLY", idempotency: "NOT_TESTED" } });
  };
  const reinstallComponentPreview = (componentName) => {
    if (componentStages[componentName] !== "LOCAL_PREVIEW_COMPLETE") return;
    const attempt = (reinstallCounts[componentName] || 0) + 1;
    setReinstallCounts((counts) => ({ ...counts, [componentName]: attempt }));
    setComponentStages((states) => ({ ...states, [componentName]: "INSTALLING_PREVIEW" }));
    prependLocalEvent({ event_type: "LOCAL_REINSTALL_PREVIEW_REQUESTED", component_name: componentName, status: "LOCAL_MOCK_REINSTALL_STARTED", message: "本地模拟重装 " + attempt + " 已记录；未运行安装器或请求服务端。", payload: { attempt, reinstall_scope: "LOCAL_PREVIEW_ONLY", agent_association: "UNKNOWN", agent_mapping_status: "NOT_DEFINED", execution: "NOT_RUN" } });
  };
  const copy = async () => {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      onNotify?.("本地预览命令已复制");
    } catch {
      onNotify?.("复制失败，请检查浏览器剪贴板权限", "error");
    }
  };
  const download = () => {
    if (!command) return;
    const url = URL.createObjectURL(new Blob([command + "\r\n"], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "zero-touch-" + name + "-preview.txt";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    onNotify?.("仅本地预览命令文件已下载；没有执行安装");
  };
  return (
    <div className="modal-backdrop">
      <div className="center-modal zero-modal zero-provisioning-modal">
        <div className="drawer-head">
          <div>
            <div className="page-kicker">ZERO-TOUCH · LOCAL MOCK</div>
            <h2>Zero-Touch 本地开通预览</h2>
            <p>本页状态仅用于界面演练；未连接 Worker、安装器、API 或数据库。</p>
          </div>
          <IconButton onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        <div className="zero-meta">
          <span>资源名称 <b>{name}</b></span>
          <span>目标类型 <b>{resource?.type || "未知"}</b></span>
          <span>方案来源 <b>{packageName || "未选择"}</b></span>
        </div>
        <div className="zero-provisioning-disclosure" role="note">
          <strong>本地模拟 · 非真实开通</strong>
          <span>当前组件来自现有 UI profile 项目，不代表已签名或必需的后端 manifest。权威 required manifest ID、版本及 package ID 尚未核实。</span>
        </div>
        <section className="zero-provisioning-section" aria-labelledby="zero-agent-heading">
          <h3 id="zero-agent-heading">双逻辑 Agent · 独立本地选择状态</h3>
          <div className="zero-agent-grid">
            <div><span>业务执行 Agent</span><b>{localAgentStatus(agentSelections.businessAgent)}</b></div>
            <div><span>客户消息监控 Agent</span><b>{localAgentStatus(agentSelections.customerAgent)}</b></div>
          </div>
        </section>
        <section className="zero-provisioning-section zero-ready-gate" aria-label="Ready 门控"><strong>READY 未验证 · 不可据此投入生产</strong><span>当前只有前端 profile 与本地模拟事件；required manifest、双逻辑 Agent 的后端状态、Worker 注册及真实心跳均未核验。组件模拟完成不等于资源 Ready。</span></section>
        <section className="zero-provisioning-section" aria-labelledby="zero-components-heading">
          <h3 id="zero-components-heading">方案组件 · 前端 profile 快照（非 manifest）</h3>
          {componentNames.length ? <div className="zero-component-list" role="list">
            {componentNames.map((componentName) => {
              const status = componentStages[componentName] || "PENDING";
              return <div className="zero-component-row" role="listitem" key={componentName}>
                <div><b>{componentName}</b><span role="status">{stageLabel[status]}{retryCounts[componentName] ? " · 模拟重试 " + retryCounts[componentName] + " 次" : ""}{reinstallCounts[componentName] ? " · 模拟重装 " + reinstallCounts[componentName] + " 次" : ""}</span></div>
                {status === "LOCAL_PREVIEW_FAILED" ? <button type="button" onClick={() => retryComponentPreview(componentName)} aria-label={"本地模拟重试 " + componentName}>本地模拟重试</button> : <div className="zero-component-actions">
                  <button type="button" onClick={() => failComponentPreview(componentName)} disabled={status === "LOCAL_PREVIEW_COMPLETE"} aria-label={"注入本地模拟失败 " + componentName}>模拟失败事件</button>
                  <button type="button" onClick={() => advanceComponent(componentName)} disabled={status === "LOCAL_PREVIEW_COMPLETE"} aria-label={"模拟推进 " + componentName}>{status === "LOCAL_PREVIEW_COMPLETE" ? "已完成模拟" : "模拟下一阶段"}</button>
                  {status === "LOCAL_PREVIEW_COMPLETE" && <button type="button" onClick={() => reinstallComponentPreview(componentName)} aria-label={"本地模拟重装 " + componentName}>本地模拟重装</button>}
                </div>}
              </div>;
            })}
          </div> : <p className="zero-provisioning-empty">未选择方案。没有加载或推断任何 required manifest。</p>}
        </section>
        {command && <div className="command-code">
          <span>命令文本 · 不执行</span><code>{command}</code>
          <button aria-label="复制命令" onClick={copy}><Copy size={16} /></button>
        </div>}
        <div className="modal-actions">
          {command && <>
            <Button icon={Copy} onClick={copy}>复制预览命令</Button>
            <Button icon={ArrowsClockwise} onClick={() => { setVersion((value) => value + 1); onNotify?.("已更新本地预览命令"); }}>重新生成文本</Button>
            <Button icon={DownloadSimple} onClick={download}>下载预览文本</Button>
          </>}
        </div>
        <section className="zero-provisioning-section" aria-labelledby="zero-event-heading">
          <h3 id="zero-event-heading">结构化事件 · LOCAL_MOCK</h3>
          <div className="zero-event-list" role="list" aria-live="polite">
            {events.map((event, index) => <article className="zero-event-row" role="listitem" data-event-type={event.event_type} key={event.event_type + "-" + event.occurred_at + "-" + index}>
              <div><b>{event.event_type}</b><time dateTime={event.occurred_at}>{event.occurred_at}</time></div>
              <span>{redactWorkerLogText(event.component_name || "开通预览")} · {event.status}</span>
              <p>{redactWorkerLogText(event.message)}</p>
              <code>{redactWorkerLogText(JSON.stringify(event.payload))}</code>
            </article>)}
          </div>
        </section>
        
      </div>
    </div>
  );
}
function redactWorkerLogText(value) {
  const text = String(value ?? "");
  return text
    .replace(/(["']?(?:cookie|set-cookie)["']?\s*[:=]\s*)[^\r\n]*/gi, "$1[REDACTED]")
    .replace(/(["']?(?:password|passwd|pwd|token|access[_-]?token|refresh[_-]?token|api[_-]?key|secret|client[_-]?secret|authorization|proxy-authorization|private[_-]?key|session(?:[_-]?id)?|csrf|credentials?)["']?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\r\n,;}]+)/gi, "$1[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]");
}

function buildPreviewWorkerLogs(resourceName, modules) {
  if (!resourceName) return [];
  const now = Date.now();
  return Array.from({ length: 96 }, (_, index) => {
    const createdAt = new Date(now - index * 3 * 60 * 60 * 1000);
    const level = index % 13 === 0 ? "ERROR" : index % 5 === 0 ? "WARNING" : "SUCCESS";
    return {
      id: `preview-${resourceName}-${String(index + 1).padStart(3, "0")}`,
      resourceName,
      module: modules[index % modules.length],
      createdAt: createdAt.toISOString(),
      time: new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" }).format(createdAt),
      level,
      event: redactWorkerLogText(`Local preview mock event #${index + 1} for ${resourceName}. No live worker event is being read.${index === 0 ? ' token=PREVIEW_ONLY_TOKEN_001 password="PREVIEW_ONLY_PASSWORD_001 with spaces" api_key="PREVIEW_ONLY_API_KEY_001 with spaces" authorization="Bearer PREVIEW_ONLY_BEARER_001" cookie="session=PREVIEW_ONLY_COOKIE_001; theme=local" {"secret":"PREVIEW_ONLY_JSON_SECRET_001 with spaces"}' : ""}`),
      result: level === "ERROR" ? "FAILED (MOCK)" : level === "WARNING" ? "REVIEW (MOCK)" : "OK (MOCK)",
    };
  });
}

function LogModal({ row, onClose, kind = "RPA运行日志", onNotify }) {
  const [active, setActive] = useState(kind);
  const [level, setLevel] = useState("全部级别");
  const [time, setTime] = useState("最近24小时");
  const [keyword, setKeyword] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const logTableRef = useRef(null);
  const downloadGuardRef = useRef(false);
  const tabs = [
    "RPA运行日志",
    "业务执行Agent日志",
    "客户消息监控Agent日志",
    "Worker日志",
    "Runtime日志",
    "安装/初始化日志",
  ];
  const sourceEntries = useMemo(() => buildPreviewWorkerLogs(row?.name, tabs), [row?.name]);
  const entries = sourceEntries.filter((entry) => {
    const ageMs = Date.now() - Date.parse(entry.createdAt);
    const withinTime = time === "全部时间" || ageMs <= (time === "最近7天" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000);
    return entry.resourceName === row?.name && entry.module === active &&
      (level === "全部级别" || entry.level === level) && withinTime &&
      entry.event.toLowerCase().includes(keyword.toLowerCase());
  });
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const activePage = Math.min(page, totalPages);
  const pageEntries = entries.slice((activePage - 1) * pageSize, activePage * pageSize);
  useEffect(() => setPage(1), [active, level, time, keyword, pageSize]);
  useEffect(() => {
    if (autoScroll && !paused && logTableRef.current) {
      logTableRef.current.scrollTop = logTableRef.current.scrollHeight;
    }
  }, [active, level, time, keyword, autoScroll, paused, page]);
  const downloadLog = () => {
    if (downloadGuardRef.current) return;
    downloadGuardRef.current = true;
    let url = null;
    try {
      const safeResourceName = redactWorkerLogText(row?.name || "worker").replace(/[^a-zA-Z0-9_-]/g, "-");
      const lines = [
        redactWorkerLogText(`# ${row?.name || "worker"} · ${active} · ${time} · Local Preview Mock`),
        ...entries.map((entry) => [
          entry.time,
          entry.level,
          redactWorkerLogText(entry.module),
          redactWorkerLogText(entry.event),
          redactWorkerLogText(entry.result),
          redactWorkerLogText(entry.id),
        ].join("\t")),
      ];
      url = URL.createObjectURL(new Blob(["\ufeff", lines.join("\r\n")], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `worker-${safeResourceName}-preview.log`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      onNotify?.(`已下载 ${entries.length} 条预览日志`);
    } catch {
      if (url) {
        try { URL.revokeObjectURL(url); } catch { /* best-effort cleanup */ }
      }
      onNotify?.("日志下载失败，请重试。", "error");
    } finally {
      window.setTimeout(() => { downloadGuardRef.current = false; }, 500);
    }
  };
  return (
    <div className="modal-backdrop">
      <div className="center-modal log-modal" data-log-resource={row?.name || ""} data-refresh-count={refreshCount}>
        <div className="drawer-head">
          <div>
            <div className="page-kicker">RUNTIME LOG · LOCAL PREVIEW MOCK</div>
            <h2>{row?.name || "运行日志"}</h2>
          </div>
          <IconButton onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        <div className="log-tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={active === tab ? "active" : ""}
              onClick={() => setActive(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="log-controls">
          <select
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          >
            <option>全部级别</option>
            <option>SUCCESS</option>
            <option>WARNING</option>
            <option>ERROR</option>
          </select>
          <select
            value={time}
            onChange={(event) => setTime(event.target.value)}
          >
            <option>最近24小时</option>
            <option>最近7天</option>
            <option>全部时间</option>
          </select>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索日志关键词"
          />
          <label>
            <input
              type="checkbox"
              checked={autoScroll} aria-label="Auto-scroll logs"
              onChange={(event) => setAutoScroll(event.target.checked)}
            />
            自动滚动
          </label>
          <Button
            icon={paused ? Play : Pause}
            aria-pressed={paused}
            title={paused ? "Resume preview viewer" : "Pause preview viewer"}
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? "继续" : "暂停"}
          </Button>
        </div>
        <div className="log-table" ref={logTableRef}>
          <div className="log-table-head">
            <span>时间</span>
            <span>级别</span>
            <span>模块</span>
            <span>事件</span>
            <span>结果</span>
            <span>Execution ID</span>
          </div>
          {pageEntries.map((entry) => (
            <div key={entry.id} data-log-resource={entry.resourceName} data-log-component={entry.module}>
              <span>{entry.time}</span>
              <b
                className={
                  entry.level === "WARNING"
                    ? "warning-text"
                    : entry.level === "ERROR"
                      ? "danger-text"
                      : "success-text"
                }
              >
                {entry.level}
              </b>
              <span>{redactWorkerLogText(entry.module)}</span>
              <p>{redactWorkerLogText(entry.event)}</p>
              <span>{redactWorkerLogText(entry.result)}</span>
              <small>{redactWorkerLogText(entry.id)}</small>
            </div>
          ))}
        </div>
        {entries.length === 0 && <div className="log-empty-state" role="status">No preview mock logs match the selected filters.</div>}
        <div className="log-pagination" aria-label="Log pagination" data-page={activePage} data-page-size={pageSize}>
          <span>Showing {entries.length ? (activePage - 1) * pageSize + 1 : 0}–{Math.min(activePage * pageSize, entries.length)} of {entries.length} preview entries</span>
          <div>
            <button type="button" aria-label="Previous log page" disabled={activePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>‹</button>
            <span aria-live="polite">Page {activePage} of {totalPages}</span>
            <button type="button" aria-label="Next log page" disabled={activePage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>›</button>
            <label>Rows <select aria-label="Rows per log page" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option></select></label>
          </div>
        </div>
        <div className="modal-actions">
          <Button icon={Repeat} onClick={() => { setRefreshCount((value) => value + 1); setPage(1); onNotify?.("Local preview mock logs refreshed; no API request."); }}>
            刷新
          </Button>
          <Button icon={DownloadSimple} onClick={downloadLog}>下载日志</Button>
          <Button onClick={onClose}>关闭</Button>
        </div>
      </div>
    </div>
  );
}

function BulkImport({ onClose, onStart }) {
  const [size, setSize] = useState("100");
  return (
    <div className="modal-backdrop">
      <div className="center-modal bulk-modal">
        <div className="drawer-head">
          <div>
            <div className="page-kicker">BULK IMPORT</div>
            <h2>批量导入</h2>
            <p>支持 100 / 500 / 1000 条数据切换与校验预览。</p>
          </div>
          <IconButton onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        <div className="bulk-stepper">
          <span className="active">1 下载模板</span>
          <i />
          <span>2 上传文件</span>
          <i />
          <span>3 数据校验</span>
          <i />
          <span>4 开始导入</span>
        </div>
        <div className="bulk-type-row">
          <Button variant="primary">VPS资源</Button>
          <Button>手机RPA资源</Button>
          <Button icon={DownloadSimple}>下载模板</Button>
        </div>
        <div className="drop-zone">
          <CloudArrowUp size={36} />
          <b>将文件拖拽到此处，或点击上传</b>
          <span>支持 .xlsx、.xls 格式，单个文件不超过 10MB</span>
          <Button variant="primary">选择文件</Button>
        </div>
        <div className="validation-cards">
          <div>
            <span>总行数</span>
            <b>482</b>
          </div>
          <div className="valid">
            <span>校验通过</span>
            <b>436</b>
          </div>
          <div className="invalid">
            <span>错误行</span>
            <b>28</b>
          </div>
          <div className="duplicate">
            <span>重复行</span>
            <b>18</b>
          </div>
        </div>
        <div className="preview-toolbar">
          <b>
            数据预览 <small>（前 100 行）</small>
          </b>
          <label>
            每页显示{" "}
            <select value={size} onChange={(e) => setSize(e.target.value)}>
              <option>100</option>
              <option>500</option>
              <option>1000</option>
            </select>
          </label>
        </div>
        <div className="bulk-preview">
          <table>
            <thead>
              <tr>
                <th>行</th>
                <th>校验结果</th>
                <th>资源类型</th>
                <th>资源名称</th>
                <th>IP地址 / 设备ID</th>
                <th>国家 / 地区</th>
                <th>城市</th>
                <th>服务商</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {[
                "IDN-JKT-001",
                "US-LAX-001",
                "SG-001",
                "JP-TYO-002",
                "DE-FRA-003",
              ].map((name, index) => (
                <tr key={name}>
                  <td>{index + 1}</td>
                  <td>
                    <StatusPill
                      value={
                        index === 2 ? "错误" : index === 4 ? "重复" : "通过"
                      }
                      tone={
                        index === 2
                          ? "danger"
                          : index === 4
                            ? "warning"
                            : "green"
                      }
                    />
                  </td>
                  <td>
                    <span className="type-badge">
                      {index === 3 ? "手机RPA" : "VPS RPA"}
                    </span>
                  </td>
                  <td>{name}</td>
                  <td>{index === 3 ? "352099001234567" : "103.10.10.11"}</td>
                  <td>
                    <span className="country-cell">
                      <Flag code="id" />
                      Indonesia
                    </span>
                  </td>
                  <td>Jakarta</td>
                  <td>AWS</td>
                  <td>{index === 2 ? "IP地址不能为空" : "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="modal-actions">
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" icon={UploadSimple} onClick={onStart}>
            开始导入（436 条）
          </Button>
        </div>
      </div>
    </div>
  );
}

function RestorePreviewModal({ resource, onClose, onRestore }) {
  const cases = ["unknown", "ready", "missing-relationship", "name-conflict", "dependency-conflict"];
  const [scenario, setScenario] = useState(cases[0]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("Restore contract is unverified; choose a synthetic case.");
  const requestRef = useRef(0);
  const submit = () => {
    if (!confirmed || scenario === "unknown" || busy) return;
    const requestId = ++requestRef.current;
    setBusy(true);
    setResult("Simulating restore…");
    window.setTimeout(() => {
      if (requestRef.current !== requestId) return;
      if (scenario === "ready") { setBusy(false); onRestore(); return; }
      const messages = {
        "missing-relationship": "Synthetic preview blocked: Worker/Runtime relationship is missing. Archive marker is unchanged.",
        "name-conflict": "Synthetic preview blocked: name conflict. Archive marker is unchanged.",
        "dependency-conflict": "Synthetic preview blocked: active dependency conflict. Archive marker is unchanged.",
      };
      setBusy(false);
      setResult(messages[scenario]);
    }, 400);
  };
  const cancel = () => { requestRef.current += 1; setBusy(false); onClose(); };
  return (
    <div className="modal-backdrop">
      <section className="center-modal archive-preview-modal" role="dialog" aria-modal="true" aria-labelledby="restore-preview-title" data-preview-only="true">
        <div className="drawer-head"><div><div className="page-kicker">LOCAL PREVIEW MOCK · RESTORE NOT CONNECTED</div><h2 id="restore-preview-title">Restore resource preview</h2><p>{resource?.name} · archived marker can be cleared only in this preview</p></div><IconButton aria-label="Close restore preview" onClick={cancel}><X size={20} /></IconButton></div>
        <div className="archive-preview-body">
          <div className="lifecycle-preview-warning">Worker relationship and restore conflict semantics are not verified for the deployed backend.</div>
          <label className="lifecycle-preview-field">Synthetic restore case
            <select aria-label="Synthetic restore case" value={scenario} disabled={busy} onChange={(event) => { setScenario(event.target.value); setResult("Choose a synthetic case and simulate restore."); }}>
              <option value="unknown">Contract unknown — UNKNOWN</option><option value="ready">Synthetic: relationships available</option><option value="missing-relationship">Synthetic: missing Worker/Runtime relationship</option><option value="name-conflict">Synthetic: name conflict</option><option value="dependency-conflict">Synthetic: active dependency conflict</option>
            </select>
          </label>
          <label className="confirm-check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} />Confirm local restore simulation only</label>
          <div className="lifecycle-preview-result" role="status" aria-live="polite" data-busy={busy}>{result}</div>
        </div>
        <div className="modal-actions"><Button disabled={busy} onClick={cancel}>Cancel</Button><Button variant="primary" disabled={!confirmed || scenario === "unknown" || busy} onClick={submit}>{busy ? "Simulating…" : "Simulate restore"}</Button></div>
      </section>
    </div>
  );
}

function ArchivePreviewModal({ resource, onClose, onArchive }) {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const canArchive = reason.trim().length > 0 && confirmed;
  return (
    <div className="modal-backdrop">
      <section className="center-modal archive-preview-modal" role="dialog" aria-modal="true" aria-labelledby="archive-preview-title" data-preview-only="true">
        <div className="drawer-head"><div><div className="page-kicker">LOCAL PREVIEW MOCK · REVERSIBLE</div><h2 id="archive-preview-title">Archive resource preview</h2><p>{resource?.name} remains in the list; this does not call an API.</p></div><IconButton aria-label="Close archive preview" onClick={onClose}><X size={20} /></IconButton></div>
        <div className="archive-preview-body">
          <div className="lifecycle-preview-warning">Archive preview is reversible and distinct from delete. Fixture resource and status remain present.</div>
          <label className="lifecycle-preview-field">Preview reason<textarea aria-label="Archive preview reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} /></label>
          <label className="confirm-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />Confirm local archive preview only</label>
        </div>
        <div className="modal-actions"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!canArchive} onClick={() => onArchive({ reason: reason.trim(), archivedAt: new Date().toISOString() })}>Archive in preview</Button></div>
      </section>
    </div>
  );
}

function DeleteModal({ row, rows = [], onClose, onNotify }) {
  const list = rows.length ? rows : row ? [row] : [];
  const [confirmed, setConfirmed] = useState(false);
  const [dependencyCase, setDependencyCase] = useState("unknown");
  const [previewResult, setPreviewResult] = useState("Dependency state is unknown in this fixture; select a synthetic scenario to preview.");
  const countryCount = new Set(list.map((item) => item.country).filter(Boolean)).size;
  const cityCount = new Set(list.map((item) => `${item.country || ""}/${item.city || ""}`).filter((item) => item !== "/")).size;
  const previewImpact = () => {
    if (!confirmed || dependencyCase === "unknown") return;
    setPreviewResult({
      none: "Synthetic preview: no dependencies selected. No resource was deleted.",
      task: "Synthetic preview: active task warning shown. No resource was deleted.",
      enrollment: "Synthetic preview: active enrollment blocker shown; preview is blocked. No resource was deleted.",
    }[dependencyCase]);
  };
  const running = list.filter((item) => item.final === "运行中").length;
  const vps = list.filter((item) => item.type === "VPS RPA").length;
  const mobile = list.filter((item) => item.type === "手机RPA").length;
  const exportList = () => {
    const cell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const lines = [["资源名称", "资源类型", "国家", "城市", "服务商"], ...list.map((item) => [item.name, item.type, item.country, cityZh(item.city), item.provider])];
    const file = new Blob(["\ufeff", lines.map((line) => line.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "worker-resources-preview-delete-list.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    onNotify?.(`已导出 ${list.length} 条预览资源清单`);
  };
  return (
    <div className="modal-backdrop">
      <div className="center-modal delete-modal">
        <div className="confirm-icon">
          <Trash size={25} />
        </div>
        <h2>
          {list.length > 1
            ? `确认删除 ${list.length} 个资源？`
            : "确认删除资源？"}
        </h2>
        <p>选中的资源将从当前 Preview 列表移除，此操作不会调用生产 API。</p>
        <div className="bulk-delete-summary">
          <div className="dependency-preview">
            <p>Selected scope: {list.length} resources · {countryCount} countries · {cityCount} country/city pairs</p>
            <label>Dependency scenario <small>(synthetic only; this resource was not queried)</small>
              <select aria-label="Synthetic dependency scenario" value={dependencyCase} onChange={(event) => { setDependencyCase(event.target.value); setPreviewResult("Choose a synthetic scenario and run the preview."); }}>
                <option value="unknown">Fixture dependency data unavailable — UNKNOWN</option>
                <option value="none">Synthetic: no dependencies</option>
                <option value="task">Synthetic: active task warning</option>
                <option value="enrollment">Synthetic: active enrollment blocker</option>
              </select>
            </label>
            <div className="dependency-preview-result" role="status" aria-live="polite">{previewResult}</div>
            <small>Unverified candidate source: active task is a warning; active enrollment is a blocker.</small>
          </div>
          <span>
            资源总数<b>{list.length}</b>
          </span>
          <span>
            VPS<b>{vps}</b>
          </span>
          <span>
            手机RPA<b>{mobile}</b>
          </span>
          <span>
            运行中<b>{running}</b>
          </span>
        </div>
        <div className="modal-actions">
          <Button onClick={exportList}>
            导出清单
          </Button>
        </div>
        <label className="confirm-check">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          I understand this is a local preview simulation only.
        </label>
        <div className="modal-actions">
          <Button onClick={onClose}>取消</Button>
          <Button
            variant="primary"
            disabled={!confirmed || !list.length || dependencyCase === "unknown"}
            onClick={previewImpact}
          >
            Run impact preview
          </Button>
        </div>
      </div>
    </div>
  );
}

function DesignField({
  label,
  value = "",
  onChange,
  options,
  placeholder = "",
  wide = false,
  required = true,
  hint,
  provider = false,
  country = false,
}) {
  const control = options ? (
    <select value={value} onChange={(event) => onChange?.(event.target.value)}>
      <option value="">{placeholder || `请选择${label}`}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  ) : (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange?.(event.target.value)}
    />
  );
  return (
    <label className={`field design-field ${wide ? "wide" : ""}`}>
      <span>
        {label} {required && <em>*</em>} {hint && <small>{hint}</small>}
      </span>
      {provider ? (
        <div className="asset-field-control">
          <ProviderMark name={value} />
          {control}
        </div>
      ) : country ? (
        <div className="asset-field-control">
          <Flag
            code={
              value.startsWith("Indonesia")
                ? "id"
                : value.startsWith("Vietnam")
                  ? "vn"
                  : "th"
            }
          />
          {control}
        </div>
      ) : (
        control
      )}
    </label>
  );
}

function CountryPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const closeOnOutside = (event) => {
      if (!event.target.closest?.(".country-picker")) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
  const selected = countryByCode[value] || countryByCode.id;
  const matches = countries.filter((item) =>
    `${item.english} ${item.chinese} ${item.code}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className={`field design-field country-picker ${open ? "open" : ""}`}>
      <span>
        国家 <em>*</em>
      </span>
      <button
        type="button"
        className="country-trigger"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Flag code={selected.code} />
        <span>
          {selected.english}（{selected.chinese}）
        </span>
        <CaretDown size={14} />
      </button>
      {open && (
        <div className="country-options">
          <label>
            <MagnifyingGlass size={15} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索国家名称或 ISO 代码"
            />
          </label>
          <div className="country-option-scroll">
            {matches.map((item) => (
              <button
                type="button"
                key={item.code}
                onClick={() => {
                  onChange(item.code);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <Flag code={item.code} />
                <span>
                  {item.english}
                  <small>{item.chinese}</small>
                </span>
                <b>{item.code.toUpperCase()}</b>
              </button>
            ))}
            {matches.length === 0 && <p>没有匹配的国家</p>}
          </div>
          <small>覆盖 ISO 3166-1 国家 / 地区 · {countries.length} 项</small>
        </div>
      )}
    </div>
  );
}

const providerChoices = [
  "AWS", "Alibaba Cloud", "Tencent Cloud", "Huawei Cloud", "Google Cloud",
  "DigitalOcean", "Microsoft Azure", "Hetzner", "Vultr", "Linode", "Rackspace",
  "自定义服务商",
];

function ProviderPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);
  const matches = providerChoices.filter((name) =>
    name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div className="field design-field provider-picker" ref={rootRef} onKeyDown={(event) => {
      if (event.key === "Escape") { setOpen(false); setQuery(""); }
    }}>
      <span>来源服务商名称 <em>*</em></span>
      <button type="button" className="provider-trigger" aria-label="来源服务商名称" aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen((current) => !current)}>
        <ProviderMark name={value} />
        <span>{value || "请选择来源服务商名称"}</span>
        <CaretDown size={15} aria-hidden="true" />
      </button>
      {open && <div className="provider-options">
        <label><MagnifyingGlass size={15} aria-hidden="true" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索服务商" aria-label="搜索服务商" /></label>
        <div className="provider-option-scroll" role="listbox" aria-label="服务商列表">
          {matches.map((name) => <button type="button" role="option" aria-selected={value === name} key={name} onClick={() => {
            onChange(name);
            setOpen(false);
            setQuery("");
          }}>
            <ProviderMark name={name} />
            <span>{name}</span>
            {value === name && <Check size={15} aria-hidden="true" />}
          </button>)}
          {matches.length === 0 && <p>没有匹配的服务商</p>}
        </div>
      </div>}
    </div>
  );
}

function ProviderFields({ form, update, onNotify }) {
  const custom = form.provider === "自定义服务商";
  const providerName = custom ? form.customProvider : form.provider;
  const fetchUrl = () => {
    const found = providerConsoleUrls[form.provider];
    if (found) {
      update("consoleUrl", found);
      onNotify?.("已填入该服务商公开的控制台地址，可手工修改");
    } else onNotify?.("无法自动获取此服务商地址，请在下方手工填写", "warning");
  };
  return (
    <>
      <ProviderPicker
        value={form.provider}
        onChange={(value) => {
          update("provider", value);
          if (providerConsoleUrls[value])
            update("consoleUrl", providerConsoleUrls[value]);
          else if (value === "自定义服务商") update("consoleUrl", "");
          if (value !== "自定义服务商") update("providerLogo", "");
        }}
      />
      {custom && (
        <DesignField
          label="自定义服务商名字"
          value={form.customProvider || ""}
          onChange={(value) => update("customProvider", value)}
          placeholder="请输入正式服务商名称"
        />
      )}
      <div className="provider-url-field">
        <div className="provider-url-label">
          <span>
            服务商后台链接地址 <em>*</em>
          </span>
          <button type="button" onClick={fetchUrl}>
            <ArrowsClockwise size={15} />
            获取 URL
          </button>
        </div>
        <div className="provider-url-input">
          <input
            value={form.consoleUrl || ""}
            onChange={(event) => update("consoleUrl", event.target.value)}
            placeholder="自动获取失败时，请手工输入 https://..."
          />
          <span>可手工修改</span>
        </div>
        <small>公开控制台地址仅作辅助填充；最终以你填写的 URL 为准。</small>
      </div>
      {custom && (
        <DesignField
          label="官方 Logo / Favicon URL（可选）"
          value={form.providerLogo || ""}
          onChange={(value) => update("providerLogo", value)}
          placeholder="https://provider.example/logo.svg"
          required={false}
        />
      )}
      {custom && (
        <CustomProviderPreview name={providerName || "自定义服务商"} url={form.providerLogo} />
      )}
    </>
  );
}

function CustomProviderPreview({ name, url }) {
  const [candidate, setCandidate] = useState(0);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setCandidate(0); setLoaded(false); }, [url]);
  let sources = [];
  let invalid = false;
  if (url?.trim()) {
    try {
      const parsed = new URL(url.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("protocol");
      const direct = /\.(?:svg|png|jpe?g|webp|gif|ico)(?:$|[?#])/i.test(parsed.href);
      sources = direct ? [parsed.href] : [
        `${parsed.origin}/favicon.ico`,
        `${parsed.origin}/favicon.svg`,
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=64`,
      ];
    } catch { invalid = true; }
  }
  const failed = Boolean(url?.trim()) && (invalid || candidate >= sources.length);
  return <div className={`custom-provider-preview ${failed ? "preview-error" : ""}`} aria-live="polite">
    {!failed && sources[candidate] ? <img key={`${url}-${candidate}`} className="provider-logo" src={sources[candidate]} alt={`${name} 用户提供图片，来源未核实`} onLoad={() => setLoaded(true)} onError={() => { setLoaded(false); setCandidate((value) => value + 1); }} /> : <ProviderMark name={name} />}
    <span>{name} · {failed ? "图片读取失败；当前为非官方中性占位" : !url?.trim() ? "无Logo：非官方中性占位，来源待确认" : loaded ? "用户提供图片，来源未核实" : "正在读取用户提供图片…"}</span>
  </div>;
}

function AddStepOneV2({
  form,
  update,
  resourceType,
  setResourceType,
  onNotify,
  realMode = false,
}) {
  const isMobile = resourceType === "手机RPA";
  const [rdpState, setRdpState] = useState("未测试");
  const [rdpEnabled, setRdpEnabled] = useState(form.rdpEnabled !== false);
  const [showPassword, setShowPassword] = useState(false);
  const testRdp = () => {
    if (realMode) {
      setRdpState("真实连接测试接口尚未接通；未发起连接");
      return;
    }
    setRdpState("本地格式检查中（Mock；未连接）");
    window.setTimeout(() => {
      const errors = getRdpAddressErrors(form.ip, form.port);
      setRdpState(errors.length === 0 ? "格式检查通过（Mock；未连接）" : errors[0] + "（Mock；未连接）");
    }, 250);
  };
  return (
    <div className="add-v2-panel">
      <div className="add-v2-panel-head">
        <Cube size={24} />
        <div>
          <h2>基本信息</h2>
          <p>填写资源的基础信息，用于资源识别与管理</p>
        </div>
      </div>
      <div className="add-v2-form-grid">
        <DesignField
          label="资源类型"
          value={resourceType}
          options={["VPS RPA", "手机RPA"]}
          onChange={setResourceType}
        />
        <DesignField
          label="资源名称"
          value={form.name}
          onChange={(value) => update("name", value)}
          placeholder="请输入资源名称"
        />
        <DesignField
          label="模板"
          value={form.template}
          options={[
            "通用 Windows 模板（推荐）",
            "Linux Worker 模板",
            "Mobile RPA 模板",
          ]}
          onChange={(value) => update("template", value)}
          required={false}
        />
        <CountryPicker
          value={form.countryCode}
          onChange={(value) => update("countryCode", value)}
        />
        <DesignField
          label="城市"
          value={form.city}
          onChange={(value) => update("city", value)}
          placeholder="请输入城市名称"
        />
        <DesignField
          label="纬度 Latitude"
          value={form.lat}
          onChange={(value) => update("lat", value)}
          placeholder="请输入纬度，如 -6.2088"
          required={false}
        />
        <DesignField
          label="经度 Longitude"
          value={form.lng}
          onChange={(value) => update("lng", value)}
          placeholder="请输入经度，如 106.8456"
          required={false}
        />
        <ProviderFields form={form} update={update} onNotify={onNotify} />
      </div>
      {isMobile ? (
        <div className="add-v2-device-block">
          <div className="add-v2-panel-head">
            <WifiHigh size={24} />
            <div>
              <h2>设备与远程控制</h2>
              <p>配置手机设备的连接方式与远程控制能力</p>
            </div>
          </div>
          <div className="add-v2-device-grid">
            <div>
              <DesignField
                label="设备连接方式"
                value={form.connection}
                options={[
                  "专用云设备网关",
                  "HTTPS 远程网关",
                  "WebRTC 远程连接",
                  "VPN 内网连接",
                  "厂商云控制台",
                ]}
                onChange={(value) => update("connection", value)}
              />
              <small className="field-note">
                使用受控远程网络连接，无需本地线缆。
              </small>
            </div>
            <div>
              <DesignField
                label="设备地址 / 网关 URL"
                value={form.deviceAddress}
                onChange={(value) => update("deviceAddress", value)}
                placeholder="https://gateway.example.com/device/…"
              />
              <small className="field-note">
                填写设备公网地址、专用网关地址或控制台设备 URL。
              </small>
            </div>
            <div>
              <DesignField
                label="远程屏幕"
                value={form.remoteScreen}
                options={["启用", "关闭"]}
                onChange={(value) => update("remoteScreen", value)}
              />
              <small className="field-note">
                启用后可在浏览器中查看手机实时屏幕
              </small>
            </div>
            <div>
              <DesignField
                label="手机设备控制"
                value={form.deviceControl}
                options={["启用云端控制", "仅查看屏幕", "关闭"]}
                onChange={(value) => update("deviceControl", value)}
              />
              <small className="field-note">
                通过远程网关或厂商控制台进行设备操作。
              </small>
            </div>
          </div>
        </div>
      ) : (
        <div className="add-v2-device-block add-v2-rdp-block">
          <div className="add-v2-panel-head">
            <Monitor size={24} />
            <div>
              <h2>RDP 远程桌面配置</h2>
              <p>配置 VPS 的 RDP 连接信息，用于远程访问和执行自动化任务</p>
            </div>
            <label className="toggle-label">
              <span>启用 RDP</span>
              <input
                type="checkbox"
                checked={rdpEnabled}
                onChange={(event) => { setRdpEnabled(event.target.checked); update("rdpEnabled", event.target.checked); }}
              />
              <i />
            </label>
            <b className={`switch-on ${rdpEnabled ? "" : "off"}`}>{rdpEnabled ? "已启用" : "已关闭"}</b>
          </div>
          {rdpEnabled && (
            <>
              <div className="add-v2-device-grid four">
                <DesignField
                  label="RDP 主机名或 IP 地址"
                  value={form.ip}
                  onChange={(value) => update("ip", value)}
                />
                <DesignField
                  label="RDP 端口"
                  value={form.port}
                  onChange={(value) => update("port", value)}
                />
                <DesignField
                  label="RDP 用户名"
                  value={form.username}
                  onChange={(value) => update("username", value)}
                />
                <label className="field design-field">
                  <span>
                    RDP 密码 <em>*</em>
                  </span>
                  <div className="password-control">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.password || ""}
                      onChange={(event) =>
                        update("password", event.target.value)
                      }
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      <Eye size={17} />
                    </button>
                  </div>
                </label>
              </div>
              <div className="rdp-tip">
                <Info size={16} />
                <span>
                  请确保 VPS 已开放 RDP 端口（默认
                  3389）。预览阶段仅检查填写格式，不发送凭据或建立真实连接。
                </span>
              </div>
              <div className="rdp-test">
                <Button icon={WifiHigh} onClick={testRdp}>
                  远程桌面连接测试
                </Button>
                <small role="status" aria-live="polite"
                  className={
                    rdpState.startsWith("格式检查通过") ? "success-text" : ""
                  }
                >
                  {realMode ? "真实连接状态：" : "RDP 本地 Mock（未连接）："}{rdpState}
                </small>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AddStepTwoV2({
  packageName,
  setPackageName,
  packages,
  resourceName,
  osTemplate,
  componentSelections,
  onComponentChange,
  onZeroTouch,
  onNotify,
}) {
  const zeroTouchShellLabel = /linux/i.test(osTemplate || "") ? "Linux" : /windows/i.test(osTemplate || "") ? "Windows PowerShell" : "Unsupported template";
  const [installMode, setInstallMode] = useState("standard");
  const componentStatus = (key) => {
    const state = componentSelections[key];
    return (
      <>
        <label className="add-v2-component-toggle">
          <input type="checkbox" checked={state.enabled} aria-label={"Enable " + key} onChange={(event) => onComponentChange(key, { enabled: event.target.checked })} />
          <span>{state.enabled ? "启用" : "禁用"}</span>
        </label>
        <span className={"add-v2-component-state" + (state.enabled ? " is-enabled" : " is-disabled")} role="status" aria-live="polite">
          <i />{!state.enabled ? "已禁用" : state.value ? "已选择默认配置" : "待选择配置"}
        </span>
        {!state.enabled && <small className="add-v2-disabled-note">此组件已关闭；本预览不会进行安装、下载或外部连接。</small>}
      </>
    );
  };
  const cards = [
    { key: "businessAgent", label: "业务执行Agent", Icon: Lightning, desc: "用于执行业务流程的智能Agent，支持多种业务场景", bullets: ["支持自动化业务流程执行", "兼容多种应用系统和业务场景", "可与RPA方案联动实现端到端自动化"] },
    { key: "customerAgent", label: "客户消息监控Agent", Icon: UsersThree, desc: "用于监控和处理客户消息，触发业务流程", bullets: ["实时监控多渠道客户消息", "智能识别并触发业务流程", "支持与业务执行Agent协同工作"] },
    { key: "worker", label: "Worker", Icon: Stack, desc: "选择Worker资源，用于运行Agent和RPA流程", bullets: ["提供稳定的运行环境", "支持多种规格和地域部署", "可弹性扩展，满足业务需求"] },
    { key: "runtime", label: "Runtime", Icon: GearSix, desc: "选择运行时环境，支持多种运行时类型", bullets: ["支持多种运行时环境", "提供应用隔离和资源管理", "适配不同的业务场景需求"] },
  ];
  return (
    <div className="add-v2-config">
      <div className="add-v2-config-grid">
        {cards.map(({ key, label, Icon, desc, bullets }) => {
          const state = componentSelections[key];
          return (
            <div className="add-v2-config-card" key={key}>
              <div className="add-v2-config-icon"><Icon size={25} /></div>
              <h3>{label} <Info size={13} /></h3>
              <p>{desc}</p>
              <ul className="config-bullets add-v2-feature-list">{bullets.map((item) => <li key={item}><span>{item}</span></li>)}</ul>
              <select value={state.value} disabled={!state.enabled} aria-label={label + " configuration"} onChange={(event) => onComponentChange(key, { value: event.target.value })}>
                <option value="">请选择配置</option>
                <option value="default">默认配置（推荐）</option>
              </select>
              {componentStatus(key)}
            </div>
          );
        })}
      </div>
      <div className="add-v2-config-lower">
        <div className="add-v2-config-card">
          <div className="add-v2-config-icon">
            <Stack size={25} />
          </div>
          <h3>
            MCP <Info size={13} />
          </h3>
          <p>选择MCP服务，用于扩展Agent的能力</p>
          <select value={componentSelections.mcp.value} disabled={!componentSelections.mcp.enabled} aria-label="MCP configuration" onChange={(event) => onComponentChange("mcp", { value: event.target.value })}>
            <option value="">请选择MCP</option>
            <option value="default">默认 MCP Connector</option>
          </select>
          {componentStatus("mcp")}
          <div className="config-bullets">
            <span>提供丰富的工具和插件能力</span>
            <span>支持第三方系统集成</span>
            <span>可按需选择和配置MCP服务</span>
          </div>
          <small className="add-v2-dependency-note">具体依赖映射待确认；本预览不自动联动其他组件。</small>
        </div>
        <div className="add-v2-config-card add-v2-rpa-plan">
          <div className="add-v2-config-icon">
            <FileText size={25} />
          </div>
          <h3>
            RPA运行方案 <Info size={13} />
          </h3>
          <p>选择RPA执行方案，用于定义RPA的运行方式和策略</p>
          <select
            value={packageName}
            onChange={(event) => { const nextPlan = event.target.value; setPackageName(nextPlan); setZeroCommand(buildZeroCommand(nextPlan, resourceName, osTemplate, zeroTouchVersion)); }}
          >
            <option value="">请选择RPA运行方案</option>
            {Object.keys(packageProfiles).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <div className="rpa-package-preview" aria-live="polite">
            <div className="rpa-package-preview-head">
              <Cube size={22} aria-hidden="true" />
              <div>
                <strong>{packageName ? `${packageName} 对应软件包` : "对应软件包"}</strong>
                <small>{packageName ? `已匹配 ${packages.length} 个组件 · 预览数据` : "选择方案后查看所需组件"}</small>
              </div>
            </div>
            {packageName ? (
              <ul className="rpa-package-list">
                {packages.map((pkg) => (
                  <li key={pkg}><CheckCircle size={15} weight="fill" aria-hidden="true" /><span>{pkg}</span></li>
                ))}
              </ul>
            ) : <p className="rpa-package-prompt">请在上方选择 RPA 运行方案</p>}
          </div>
        </div>
        <div className="add-v2-config-card">
          <div className="add-v2-config-icon">
            <DownloadSimple size={25} />
          </div>
          <h3>
            安装方案 <Info size={13} />
          </h3>
          <p>选择资源的安装部署方案</p>
          <label className="install-radio">
            <input
              type="radio"
              checked={installMode === "standard"}
              onChange={() => setInstallMode("standard")}
              name="install-v2"
            />
            <span>
              <b>标准安装（推荐）</b>
              <small>在线安装，自动配置运行环境</small>
            </span>
          </label>
          <label className="install-radio">
            <input
              type="radio"
              checked={installMode === "offline"}
              onChange={() => setInstallMode("offline")}
              name="install-v2"
            />
            <span>
              <b>离线安装</b>
              <small>通过离线包进行安装部署</small>
            </span>
          </label>
          {installMode === "offline" && (
            <div className="offline-package">
              <strong>Worker Offline Package</strong>
              <span>版本：2.0.1 · 86 MB</span>
              <Button
                icon={DownloadSimple}
                onClick={() => onNotify("当前没有可下载的离线安装包文件；需由安装服务提供正式文件与校验信息", "warning")}
              >
                下载离线包
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="add-v2-zero-touch">
        <div>
          <CloudArrowUp size={29} />
          <div>
            <h3>
              Zero-Touch 开通 <Info size={13} />
            </h3>
            <p>
              一键生成用于自动化开通的命令，支持 Agent / Worker / Runtime / RPA
              环境的批量部署
            </p>
            <code className="inline-zero-command">
              {`目标平台：${zeroTouchShellLabel} · staging 安装命令将在保存并触发真实 Install 后生成`}
            </code>
            <small>本地模拟脚本已关闭。只有 staging API 创建成功后才会显示一次性 Bootstrap 命令。</small>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddResourceV2({
  initialType,
  initialData = null,
  realMode = false,
  edit = false,
  onClose,
  onComplete,
  onZeroTouch,
  onNotify,
  saving = false,
  saveError = "",
}) {
  const mobile = initialType === "手机RPA";
  const [step, setStep] = useState(1);
  const [resourceType, setResourceType] = useState(initialType);
  const [packageName, setPackageName] = useState(() => {
    const prior = initialData?.package || initialData?.plan;
    const legacyPlans = { "TikTok场景版": "TikTok RPA", "YouTube版": "YouTube RPA", "多平台版": "Browser AI RPA", "Amazon版": "Amazon RPA" };
    return packageProfiles[prior] ? prior : legacyPlans[prior] || (mobile ? "Mobile RPA" : "Browser AI RPA");
  });
  const [form, setForm] = useState(() =>
    initialData
      ? {
          ...initialData,
          countryCode: initialData.countryCode || "id",
          template: initialData.template || "通用 Windows 模板（推荐）",
          consoleUrl:
            initialData.consoleUrl ||
            providerConsoleUrls[initialData.provider] ||
            "",
          ip: initialData.ip || (realMode ? "" : "103.10.10.11"),
          port: initialData.port || "3389",
          username: initialData.username || (realMode ? "" : "administrator"),
          password: initialData.password || "",
        }
      : realMode
        ? mobile
          ? {
              name: "",
              template: "Mobile RPA 模板",
              countryCode: "id",
              city: "",
              lat: "",
              lng: "",
              provider: "",
              consoleUrl: "",
              connection: "",
              deviceAddress: "",
              remoteScreen: "",
              deviceControl: "",
            }
          : {
              name: "",
              template: "通用 Windows 模板（推荐）",
              countryCode: "id",
              city: "",
              lat: "",
              lng: "",
              provider: "",
              consoleUrl: "",
              ip: "",
              port: "3389",
              username: "",
              password: "",
              rdpEnabled: false,
            }
        : mobile
        ? {
            name: "IDN-MOB-001",
            template: "Mobile RPA 模板",
            countryCode: "id",
            city: "Jakarta",
            lat: "-6.2088",
            lng: "106.8456",
            provider: "AWS",
            consoleUrl: "https://console.aws.amazon.com/",
            connection: "专用云设备网关",
            deviceAddress: "https://gateway.example.com/device/001",
            remoteScreen: "启用",
            deviceControl: "启用云端控制",
          }
        : {
            name: "IDN-JKT-001",
            template: "通用 Windows 模板（推荐）",
            countryCode: "id",
            city: "Jakarta",
            lat: "-6.2088",
            lng: "106.8456",
            provider: "AWS",
            consoleUrl: "https://console.aws.amazon.com/",
            ip: "103.10.10.11",
            port: "3389",
            username: "administrator",
            password: "",
          },
  );
  const [componentSelections, setComponentSelections] = useState({
    businessAgent: { enabled: true, value: "" },
    customerAgent: { enabled: true, value: "" },
    worker: { enabled: true, value: "" },
    runtime: { enabled: true, value: "" },
    mcp: { enabled: true, value: "" },
  });
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const initialEditState = useRef(null);
  if (initialEditState.current === null) initialEditState.current = JSON.stringify({ form, packageName, componentSelections });
  const hasUnsavedChanges = edit && initialEditState.current !== JSON.stringify({ form, packageName, componentSelections });
  const requestClose = () => {
    if (hasUnsavedChanges) setCancelConfirm(true);
    else onClose?.();
  };
  const updateComponentSelection = (key, patch) => setComponentSelections((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  const [stepErrors, setStepErrors] = useState([]);
  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setStepErrors([]);
  };
  const changeResourceType = (value) => {
    setResourceType(value);
    setStepErrors([]);
  };
  const validateStepOne = () => {
    const errors = [];
    if (!resourceType) errors.push("请选择资源类型。");
    if (!form.name?.trim()) errors.push("请输入资源名称。");
    if (!form.countryCode || !countryByCode[form.countryCode]) errors.push("请选择国家。");
    if (!form.city?.trim()) errors.push("请输入城市。");
    if (!realMode && (!form.provider || (form.provider === "自定义服务商" && !form.customProvider?.trim()))) errors.push("请选择服务商并填写服务商名称。");
    if (!realMode && !safeHttpUrl(form.consoleUrl)) errors.push("请输入有效的 HTTP(S) 服务商控制台 URL。");
    if (form.lat?.trim() && (!Number.isFinite(Number(form.lat)) || Number(form.lat) < -90 || Number(form.lat) > 90)) errors.push("纬度须在 -90 至 90 之间。");
    if (form.lng?.trim() && (!Number.isFinite(Number(form.lng)) || Number(form.lng) < -180 || Number(form.lng) > 180)) errors.push("经度须在 -180 至 180 之间。");
    if (resourceType === "VPS RPA" && form.rdpEnabled !== false) {
      errors.push(...getRdpAddressErrors(form.ip, form.port));
      if (!form.username?.trim()) errors.push("请输入 RDP 用户名。");
      if (!edit && !form.password) errors.push("请输入 RDP 密码。");
    }
    if (resourceType === "手机RPA") {
      if (!form.connection?.trim()) errors.push("请选择设备连接方式。");
      if (!form.deviceAddress?.trim()) errors.push("请输入设备地址或网关 URL。");
      if (!form.remoteScreen?.trim()) errors.push("请选择远程屏幕状态。");
      if (!form.deviceControl?.trim()) errors.push("请选择手机设备控制方式。");
    }
    setStepErrors(errors);
    return errors.length === 0;
  };
  const goToStepTwo = () => {
    if (validateStepOne()) setStep(2);
  };
  const packages = packageProfiles[packageName] || [];
  return (
    <div className="add-v2-page">
      <div className="add-v2-title">
        <div>
          <div className="add-icon">
            <Cube size={26} />
          </div>
          <div>
            <h1>添加资源</h1>
            <p>按业务需求选择并配置各类资源，完成后即可生成配置</p>
          </div>
        </div>
        <span>支持多种部署方式 · 灵活组合 · 快速交付</span>
      </div>
      <div className="add-v2-stepper">
        <button
          className={step === 1 ? "active" : ""}
          onClick={() => setStep(1)}
        >
          <span>1</span>
          <b>基础信息</b>
          <small>填写资源基础信息</small>
        </button>
        <i />
        <button
          className={step === 2 ? "active" : ""}
          onClick={goToStepTwo}
        >
          <span>2</span>
          <b>Agent与运行配置</b>
          <small>配置Agent及运行参数</small>
        </button>
      </div>
      {step === 1 ? (
        <AddStepOneV2
          {...{ form, update, resourceType, onNotify, realMode }}
          setResourceType={changeResourceType}
        />
      ) : (
        <AddStepTwoV2
          packageName={packageName}
          setPackageName={setPackageName}
          packages={packages}
          resourceName={form.name}
          osTemplate={form.template}
          componentSelections={componentSelections}
          onComponentChange={updateComponentSelection}
          onZeroTouch={(selection) => onZeroTouch?.({
            resource: { name: form.name, type: resourceType, os: form.template },
            ...selection,
          })}
          onNotify={onNotify}
        />
      )}
      {step === 1 && stepErrors.length > 0 && (
        <div className="add-v2-validation-summary" role="alert" aria-live="assertive">
          <strong>请先修正以下信息，再继续：</strong>
          <ul>{stepErrors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      )}
      {saveError && <div className="add-v2-validation-summary" role="alert" aria-live="assertive"><strong>保存未完成</strong><p>{saveError}</p></div>}
      <div className="add-v2-footer">
        <Button onClick={requestClose}>取消</Button>
        {step === 2 && <Button onClick={() => setStep(1)}>上一步</Button>}
        {step === 1 ? (
          <Button
            variant="primary"
            icon={ArrowRight}
            onClick={goToStepTwo}
          >
            下一步
          </Button>
        ) : (
          <Button
            variant="primary"
            icon={Check}
            disabled={saving}
            onClick={() => {
              if (edit && !validateStepOne()) {
                setStep(1);
                return;
              }
              const completedForm = { ...form, name: form.name || "IDN-JKT-001", type: resourceType, package: packageName };
              if (edit && !form.password) delete completedForm.password;
              onComplete(completedForm);
            }}
          >
            {saving ? "保存中…" : edit ? "保存修改" : "保存并继续到安装触发"}
          </Button>
        )}
      </div>
      {edit && cancelConfirm && (
        <div className="modal-backdrop">
          <div className="center-modal" role="dialog" aria-modal="true" aria-labelledby="discard-edit-title">
            <div className="drawer-head">
              <div>
                <h2 id="discard-edit-title">Discard unsaved changes?</h2>
                <p>Your local preview edits have not been saved.</p>
              </div>
            </div>
            <div className="modal-actions">
              <Button onClick={() => setCancelConfirm(false)}>Continue editing</Button>
              <Button variant="primary" onClick={() => onClose?.()}>Discard changes</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BulkImportV2({ onClose, onStart, onNotify }) {
  const [size, setSize] = useState("100");
  const [resourceType, setResourceType] = useState("VPS资源");
  const [provider, setProvider] = useState("全部");
  const providers = [
    ["AWS", "aws"],
    ["阿里云", "aliyun"],
    ["腾讯云", "tencent"],
    ["华为云", "huawei"],
    ["谷歌云", "google"],
    ["DigitalOcean", "digitalocean"],
    ["Microsoft Azure", "azure"],
  ];
  const rows = [
    [
      "IDN-JKT-001",
      "通过",
      "VPS资源",
      "103.10.10.11",
      "印度尼西亚",
      "Jakarta",
      "AWS",
      "2核 4GB 50GB",
      "root",
      "••••••••",
      "--",
    ],
    [
      "US-LAX-001",
      "通过",
      "VPS资源",
      "45.76.12.33",
      "美国",
      "Los Angeles",
      "DigitalOcean",
      "2核 8GB 100GB",
      "root",
      "••••••••",
      "--",
    ],
    [
      "SG-001",
      "错误",
      "VPS资源",
      "",
      "新加坡",
      "Singapore",
      "阿里云",
      "4核 8GB 100GB",
      "root",
      "••••••••",
      "IP地址不能为空",
    ],
    [
      "JP-TYO-002",
      "通过",
      "手机RPA",
      "352099001234567",
      "日本",
      "Tokyo",
      "AWS",
      "Android 12",
      "--",
      "--",
      "--",
    ],
    [
      "DE-FRA-003",
      "重复",
      "VPS资源",
      "18.194.23.11",
      "德国",
      "Frankfurt",
      "腾讯云",
      "4核 16GB 200GB",
      "admin",
      "••••••••",
      "与第12行重复",
    ],
    [
      "GB-LON-001",
      "通过",
      "VPS资源",
      "51.140.11.22",
      "英国",
      "London",
      "Microsoft Azure",
      "4核 8GB 100GB",
      "azureuser",
      "••••••••",
      "--",
    ],
    [
      "CA-YVR-001",
      "通过",
      "手机RPA",
      "358240051234567",
      "加拿大",
      "Vancouver",
      "Google Cloud",
      "Android 11",
      "--",
      "--",
      "--",
    ],
    [
      "AU-SYD-001",
      "错误",
      "VPS资源",
      "",
      "澳大利亚",
      "Sydney",
      "华为云",
      "2核 4GB 50GB",
      "root",
      "••••••••",
      "缺少必要字段",
    ],
    [
      "BR-GRU-001",
      "通过",
      "VPS资源",
      "177.54.23.11",
      "巴西",
      "Sao Paulo",
      "AWS",
      "4核 16GB 200GB",
      "root",
      "••••••••",
      "--",
    ],
    [
      "IN-BOM-001",
      "重复",
      "手机RPA",
      "356938051234567",
      "印度",
      "Mumbai",
      "DigitalOcean",
      "Android 13",
      "--",
      "--",
      "与第25行重复",
    ],
  ];
  return (
    <div className="bulk-v2-page">
      <div className="bulk-v2-title">
        <div>
          <div className="page-kicker">RESOURCE ONBOARDING</div>
          <h1>批量导入</h1>
          <p>
            支持批量导入 Worker
            资源（VPS、手机RPA），请先下载模板，按模板格式填写后上传
          </p>
        </div>
        <button
          className="help-link"
          onClick={() => onNotify("请按模板填写资源信息，校验通过后再开始导入")}
        >
          ? 使用说明
        </button>
      </div>
      <div className="bulk-v2-stepper">
        <span className="active">
          <b>1</b>
          <strong>下载模板</strong>
          <small>选择资源类型，下载对应模板</small>
        </span>
        <i />
        <span>
          <b>2</b>
          <strong>上传文件</strong>
          <small>支持拖拽或点击上传 Excel 文件</small>
        </span>
        <i />
        <span>
          <b>3</b>
          <strong>数据校验</strong>
          <small>系统自动校验数据，展示校验结果</small>
        </span>
        <i />
        <span>
          <b>4</b>
          <strong>开始导入</strong>
          <small>确认无误后，开始导入资源</small>
        </span>
      </div>
      <section className="bulk-v2-section bulk-template">
        <h2>
          <b>1</b>选择资源类型并下载模板
        </h2>
        <div className="bulk-template-controls">
          <div className="bulk-resource-type">
            <span>资源类型</span>
            <label>
              <input
                type="radio"
                checked={resourceType === "VPS资源"}
                onChange={() => setResourceType("VPS资源")}
              />
              VPS资源
            </label>
            <label>
              <input
                type="radio"
                checked={resourceType === "手机RPA资源"}
                onChange={() => setResourceType("手机RPA资源")}
              />
              手机RPA资源
            </label>
          </div>
          <div className="bulk-provider-filter">
            <span>选择云服务商（可多选）</span>
            <button
              className={provider === "全部" ? "active" : ""}
              onClick={() => setProvider("全部")}
            >
              全部
            </button>
            {providers.map(([name, key]) => (
              <button
                key={key}
                className={provider === name ? "active" : ""}
                onClick={() => setProvider(name)}
              >
                <ProviderMark name={key} />
                {name}
              </button>
            ))}
          </div>
          <div className="bulk-downloads">
            <Button
              variant="primary"
              icon={DownloadSimple}
              onClick={() => onNotify("VPS资源模板下载已准备（Preview Mock）")}
            >
              下载VPS模板
            </Button>
            <Button
              variant="primary"
              icon={DownloadSimple}
              onClick={() => onNotify("手机RPA模板下载已准备（Preview Mock）")}
            >
              下载手机RPA模板
            </Button>
          </div>
        </div>
      </section>
      <section className="bulk-v2-section bulk-upload">
        <h2>
          <b>2</b>上传模板文件
        </h2>
        <div className="bulk-upload-grid">
          <div className="bulk-drop-zone">
            <CloudArrowUp size={49} />
            <strong>将文件拖拽到此处，或点击上传</strong>
            <span>支持 .xlsx、.xls 格式，单个文件不超过 10MB</span>
            <Button
              variant="primary"
              icon={UploadSimple}
              onClick={() => onNotify("文件选择器为 Preview Mock")}
            >
              选择文件
            </Button>
          </div>
          <div className="bulk-file-card">
            <h3>已选文件</h3>
            <div>
              <FileText size={27} />
              <p>
                <b>worker_import_20240114.xlsx</b>
                <small>9.2 MB · 2024-01-14 12:32</small>
              </p>
              <StatusPill value="上传成功" tone="green" />
              <button
                onClick={() => onNotify("已移除上传文件（Preview Mock）")}
              >
                <Trash size={17} />
              </button>
            </div>
          </div>
          <div className="bulk-validation">
            <div className="bulk-validation-head">
              <h3>文件校验结果</h3>
              <Button
                icon={ArrowsClockwise}
                onClick={() => onNotify("正在重新校验（Preview Mock）")}
              >
                重新校验
              </Button>
            </div>
            <div className="bulk-validation-grid">
              <div>
                <FileText size={25} />
                <span>
                  总行数<b>482</b>
                </span>
              </div>
              <div className="good">
                <CheckCircle size={25} />
                <span>
                  校验通过<b>436</b>
                </span>
              </div>
              <div className="bad">
                <WarningCircle size={25} />
                <span>
                  错误行<b>28</b>
                  <a>查看错误行 ›</a>
                </span>
              </div>
              <div className="warn">
                <WarningCircle size={25} />
                <span>
                  重复行<b>18</b>
                  <a>查看重复行 ›</a>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="bulk-v2-section bulk-preview-section">
        <div className="bulk-preview-head">
          <h2>
            <b>3</b>数据预览 <small>（前 100 行）</small>
          </h2>
          <div>
            <span>共 482 行</span>
            <label>
              显示
              <select
                value={size}
                onChange={(event) => setSize(event.target.value)}
              >
                <option>100</option>
                <option>500</option>
                <option>1000</option>
              </select>
            </label>
            <label className="bulk-search">
              ⌕ <input placeholder="请输入关键字搜索（IP、名称等）" />
            </label>
          </div>
        </div>
        <div className="bulk-v2-table-scroll">
          <table className="bulk-v2-table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" />
                </th>
                <th>行号</th>
                <th>校验结果</th>
                <th>资源类型</th>
                <th>资源名称</th>
                <th>IP地址/设备ID</th>
                <th>国家/地区</th>
                <th>城市</th>
                <th>服务商</th>
                <th>配置/机型</th>
                <th>账号用户名</th>
                <th>账号密码</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row[0]}>
                  <td>
                    <input type="checkbox" />
                  </td>
                  <td>{index + 1}</td>
                  <td>
                    <StatusPill
                      value={row[1]}
                      tone={
                        row[1] === "错误"
                          ? "danger"
                          : row[1] === "重复"
                            ? "warning"
                            : "green"
                      }
                    />
                  </td>
                  <td>
                    <span
                      className={`type-badge ${row[2] === "手机RPA" ? "mobile" : ""}`}
                    >
                      {row[2]}
                    </span>
                  </td>
                  <td>{row[0]}</td>
                  <td>{row[3] || "--"}</td>
                  <td>{row[4]}</td>
                  <td>{row[5]}</td>
                  <td>
                    <ProviderMark name={row[6]} /> {row[6]}
                  </td>
                  <td>{row[7]}</td>
                  <td>{row[8]}</td>
                  <td>{row[9]}</td>
                  <td className={row[10] !== "--" ? "danger-text" : ""}>
                    {row[10]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bulk-v2-table-footer">
          <span>
            每页显示{" "}
            <select
              value={size}
              onChange={(event) => setSize(event.target.value)}
            >
              <option>100</option>
              <option>500</option>
              <option>1000</option>
            </select>
          </span>
          <span>共 482 行</span>
          <div className="pagination">
            <button className="active">1</button>
            <button>2</button>
            <button>3</button>
            <button>4</button>
            <button>5</button>
            <span>…</span>
            <button>49</button>
            <button>›</button>
          </div>
        </div>
      </section>
      <div className="bulk-v2-footer">
        <span>
          <Info size={16} />
          导入后将自动创建 Worker 资源。如需帮助，请查看使用说明。
        </span>
        <div>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" icon={UploadSimple} onClick={onStart}>
            开始导入（436 条）
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReadyDetailContent({ resource, type, formatTime }) {
  const mobile = type === "手机RPA";
  const groups = [
    ["基础信息", [["资源名称", resource?.name || "预览示例"], ["资源类型", type], ["资源模板", resource?.template || "—"], ["RPA 运行方案", resource?.package || "—"]]],
    ["地理位置", [["国家 / 地区", <span className="ready-detail-flag"><Flag code={resource?.countryCode || "id"} />{countryByCode[resource?.countryCode || "id"]?.chinese || "—"}</span>], ["城市", cityZh(resource?.city || "Jakarta")], ["纬度", resource?.lat || "—"], ["经度", resource?.lng || "—"]]],
    ["服务商", [["服务商名称", resource?.provider === "自定义服务商" ? resource?.customProvider || "自定义服务商" : resource?.provider || "—"], ["后台链接", resource?.consoleUrl ? <a href={resource.consoleUrl} target="_blank" rel="noreferrer">{resource.consoleUrl}</a> : "—"], ["Logo URL", resource?.provider === "自定义服务商" ? resource?.providerLogo || "未单独配置" : "使用服务商官方 Logo"]]],
    ["连接配置", mobile ? [["连接方式", resource?.connection || "—"], ["设备地址", resource?.deviceAddress || "—"], ["远程屏幕", resource?.remoteScreen || "—"], ["设备控制", resource?.deviceControl || "—"]] : [["RDP", resource?.rdpEnabled === false ? "未启用" : "已启用（预览）"], ["主机名 / IP 地址", resource?.ip || "—"], ["端口", resource?.port || "3389"], ["用户名", resource?.username || "—"], ["密码", resource?.password ? "已配置（不显示明文）" : "未配置"]]],
    ["生命周期与状态", [["创建时间", formatTime(resource?.createdAt)], ["就绪时间", formatTime(resource?.readyAt)], ["操作系统", resource?.os || "待设备 API 返回"], ["运行状态", resource?.status || "待资源 API 返回"], ["数据来源", "前端 Mock / 本次表单数据"]]],
  ];
  return <div className="ready-detail-grid">{groups.map(([title, rows]) => <section key={title}><h3>{title}</h3><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>)}</div>;
}

function ReadyPage({ type = "VPS RPA", resource, onBack, onFinish, onNotify }) {
  const mobile = type === "手机RPA";
  const [dialog, setDialog] = useState(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
  const formatTime = (value) => value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";
  const readyAt = resource?.readyAt || null;
  const createdAt = resource?.createdAt || null;
  const elapsedMinutes = resource?.startedAt ? Math.max(0, Math.floor((now - new Date(resource.startedAt).getTime()) / 60000)) : null;
  const uptime = elapsedMinutes === null ? "待接入运行状态" : `${Math.floor(elapsedMinutes / 1440)} 天 ${Math.floor(elapsedMinutes % 1440 / 60)} 小时 ${elapsedMinutes % 60} 分`;
  const command = `./workerctl install --resource ${resource?.name || (mobile ? "IDN-MOB-001" : "IDN-JKT-001")} --rpa ${(resource?.package || (mobile ? "Mobile RPA" : "Browser AI RPA")).toLowerCase().replaceAll(" ", "-")} --packages all --preview`;
  const copyCommand = async () => { try { await navigator.clipboard.writeText(command); onNotify?.("本地预览命令文本已复制；未执行安装"); } catch { onNotify?.("复制失败，请检查浏览器剪贴板权限", "error"); } };
  const checks = mobile
    ? [
        "手机设备",
        "业务执行Agent",
        "客户消息监控Agent",
        "Worker",
        "Runtime",
        "Mobile RPA",
        "远程屏幕",
        "云端设备控制",
      ]
    : [
        "VPS 连接",
        "业务执行Agent",
        "客户消息监控Agent",
        "Worker",
        "Runtime",
        "RPA",
        "MCP",
        "RDP（如果开启）",
      ];
  return (
    <div className="ready-page">
      <div className="ready-hero">
        <div className="ready-hero-art ready-art-unknown">
          {mobile ? <DeviceMobile size={82} weight="duotone" /> : <Cube size={82} weight="duotone" aria-hidden="true" />}
        </div>
        <div className="ready-hero-title">
          <h1>
            {type} 资源<span className="ready-title-unknown">状态未验证</span>
          </h1>
          <p>本地预览 · 真实就绪状态待资源与安装 API 核验</p>
        </div>
        <div className="ready-hero-stats">
          <div>
            <Cube size={26} />
            <span>
              资源状态<b className="ready-text-unknown">未知 · 未核验</b>
            </span>
          </div>
          <div>
            <Pulse size={26} />
            <span>
              检查完成时间<b>{formatTime(readyAt)}</b>
            </span>
          </div>
          <div>
            <RocketLaunch size={26} />
            <span>
              准备耗时<b>{createdAt && readyAt ? `${Math.max(0,Math.floor((new Date(readyAt)-new Date(createdAt))/60000))} 分钟` : "待接入"}</b>
            </span>
          </div>
        </div>
        <div className="ready-hero-success ready-hero-unverified" role="status">
          <span aria-hidden="true">●</span>
          <span>
            READY 未验证 · 当前不可宣称可用
            <small>双逻辑 Agent、必需组件 manifest、Worker 注册与心跳均需真实数据确认。</small>
          </span>
        </div>
      </div>
      <div className="ready-grid">
        <section className="ready-checks ready-card">
          <h2>
            <b>01</b>就绪检查项 <small>已核验 0 / {checks.length} 项 · 当前状态未知</small>
          </h2>
          <div className="ready-check-table">
            <div className="ready-check-head">
              <span>检查项</span>
              <span>状态</span>
              <span>详情</span>
              <span>检查时间</span>
            </div>
            {checks.map((item, index) => (
              <div key={item}>
                <span>
                  <span className="ready-unknown-marker" aria-hidden="true">?</span>
                  {item}
                </span>
                <span className="ready-unknown-state">未核验</span>
                <span>等待真实资源/安装状态</span>
                <time>未提供</time>
              </div>
            ))}
            <div className="ready-all-pass ready-all-unknown" role="note">
              <span aria-hidden="true">?</span>
              <span>
                <b>检查项未核验 · Ready 门控未通过</b>
                <small>前端预览数据不构成安装、注册、心跳或生产可用证据。</small>
              </span>
            </div>
          </div>
        </section>
        <section className="ready-info ready-card">
          <h2>
            <b>02</b>资源信息
          </h2>
          <div className="ready-info-list">
            <span>
              资源名称<b>{resource?.name || (mobile ? "IDN-MOB-001" : "IDN-JKT-001")}</b>
            </span>
            <span>
              资源类型<b>{type}</b>
            </span>
            <span>
              国家 / 地区<b>{countryByCode[resource?.countryCode || "id"]?.chinese || "印度尼西亚"}</b>
            </span>
            <span>
              城市<b>{cityZh(resource?.city || "Jakarta")}</b>
            </span>
            <span>
              资源规格<b>{resource?.spec || "待资源 API 返回"}</b>
            </span>
            <span>
              {mobile ? "设备地址" : "主机名 / IP 地址"}
              <b>{mobile ? (resource?.deviceAddress || "未提供") : (resource?.ip || "未提供")}</b>
            </span>
            <span>
              操作系统<b>{resource?.os || "待接入设备信息"}</b>
            </span>
            <span>
              运行时长<b>{uptime}</b>
            </span>
            <span>
              创建时间<b>{formatTime(createdAt)}</b>
            </span>
            <span>
              就绪时间<b>{formatTime(readyAt)}</b>
            </span>
            <span>
              资源状态<b className="ready-text-unknown">未知 · 未核验</b>
            </span>
            <span>
              用途<b>业务执行 / RPA 自动化</b>
            </span>
          </div>
        </section>
        <section className="ready-packages ready-card">
          <h2>
            <b>03</b>软件安装与组件状态 <small className="ready-package-disclosure">候选组件 · 版本和安装状态未核验</small>
          </h2>
          <div className="package-status-head">
            <span>软件 / 组件</span>
            <span>版本</span>
            <span>状态</span>
          </div>
          {(mobile
            ? [
                "Mobile Connector",
                "Remote Device Gateway",
                "Mobile RPA Engine",
                "Worker Package",
                "Agent Package",
                "RPA运行方案",
                "MCP 组件",
              ]
            : [
                "Chrome Runtime",
                "Playwright",
                "Stagehand",
                "Browser Extension",
                "Worker Package",
                "Agent Package",
                "RPA运行方案",
                "MCP 组件",
              ]
          ).map((item, index) => (
            <div className="package-status-row" key={item}>
              <span>
                <PackageLogo name={item === "Agent Package" ? "业务执行Agent Package" : item === "MCP 组件" ? "MCP Connector" : item} />
                {item}
              </span>
              <span>
                {
                  [
                    "未核验",
                    "未核验",
                    "未核验",
                    "未核验",
                    "未核验",
                    "未核验",
                    "未核验",
                    "未核验",
                  ][index]
                }
              </span>
              <span className="ready-unknown-state">未核验</span>
            </div>
          ))}
          <div className="ready-other">
            <h2>
              <b>04</b>其他信息
            </h2>
            <span>
              Zero-Touch 预览命令 · 不执行
              <code>{command}</code>
              <Copy size={15} />
            </span>
            <span>
              资源详情链接
              <code>前端预览暂无正式资源详情链接</code>
              <Copy size={15} />
            </span>
          </div>
        </section>
      </div>
      <div className="ready-footer">
        <Button
          icon={FileText}
          onClick={() => setDialog("detail")}
        >
          进入资源详情
        </Button>
        <Button
          icon={Monitor}
          onClick={() => setDialog("remote")}
        >
          {mobile ? "打开远程屏幕" : "打开远程桌面"}
        </Button>
        <Button
          icon={Copy}
          onClick={copyCommand}
        >
          复制预览命令
        </Button>
        <Button variant="primary" icon={Check} onClick={onFinish}>
          完成
        </Button>
      </div>
      {dialog && <div className="ready-dialog-backdrop" onClick={() => setDialog(null)}><section className={`ready-dialog ${dialog === "detail" ? "ready-dialog-wide" : ""}`} role="dialog" aria-modal="true" aria-label={dialog === "detail" ? "资源详情" : "远程连接"} onClick={(event) => event.stopPropagation()}><header><h2>{dialog === "detail" ? "资源详情 · 前端预览" : mobile ? "远程屏幕连接" : "RDP 远程桌面连接"}</h2><button type="button" aria-label="关闭" onClick={() => setDialog(null)}><X size={20}/></button></header>{dialog === "detail" ? <ReadyDetailContent resource={resource} type={type} formatTime={formatTime} /> : <div className="ready-dialog-list"><p>{!mobile && resource?.rdpEnabled === false ? "此资源未启用 RDP，请返回基础信息开启后再连接。" : "此页面是 UI 预览，未连接 Windows 桌面助手，不能直接建立远程会话。"}</p><span>{mobile ? "设备地址" : "RDP 地址"}<b>{mobile ? resource?.deviceAddress || "未配置" : resource?.ip ? formatRdpEndpoint(resource.ip, resource.port || 3389) : "未配置"}</b></span><span>连接方式 <b>{mobile ? resource?.connection || "云端设备网关" : "Windows 桌面助手＋系统凭据库（待接入）"}</b></span></div>}<footer><Button onClick={() => setDialog(null)}>关闭</Button></footer></section></div>}
    </div>
  );
}

function PreviewSwitcher({ view, onChange }) {
  if (!import.meta.env.DEV) return null;
  const items = [
    ["global", "主页面"],
    ["country", "印度尼西亚"],
    ["city", "雅加达"],
    ["add-vps", "Add VPS"],
    ["add-mobile", "Add Mobile"],
    ["bulk", "Bulk Import"],
    ["bulk-progress", "Bulk Progress"],
    ["package", "Package Config"],
    ["package-mobile", "Mobile Package"],
    ["ready-vps", "Ready VPS"],
    ["ready-mobile", "Ready Mobile"],
  ];
  return (
    <div className="preview-switcher">
      <span>DEV PREVIEW</span>
      <select value={view} onChange={(e) => onChange(e.target.value)}>
        {items.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

function App() {
  const path = window.location.pathname;
  const initialView = path.includes("/country/")
    ? "country"
    : path.includes("/city/")
      ? "city"
      : path.includes("/add/vps")
        ? "add-vps"
        : path.includes("/add/mobile")
          ? "add-mobile"
          : path.includes("/package/mobile")
            ? "package-mobile"
          : path.includes("/package/")
            ? "package"
          : path.includes("/bulk-import")
            ? "bulk"
            : path.includes("/ready/mobile")
              ? "ready-mobile"
              : path.includes("/ready/vps")
                ? "ready-vps"
                : "global";
  const [view, setView] = useState(initialView);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [editRow, setEditRow] = useState(null);
  const notify = (message, tone = "success") => {
    setToast({ message, tone });
    window.clearTimeout(window.__previewToast);
    window.__previewToast = window.setTimeout(() => setToast(null), 2800);
  };
  const changeView = (next) => {
    setView(next);
    setError(false);
    const routes = {
      global: "/ui-v2/worker-resources",
      country: "/ui-v2/worker-resources/country/indonesia",
      city: "/ui-v2/worker-resources/city/jakarta",
      "add-vps": "/ui-v2/worker-resources/add/vps",
      "add-mobile": "/ui-v2/worker-resources/add/mobile",
      package: "/ui-v2/worker-resources/package/browser",
      "package-mobile": "/ui-v2/worker-resources/package/mobile",
      bulk: "/ui-v2/worker-resources/bulk-import",
      "ready-vps": "/ui-v2/worker-resources/ready/vps",
      "ready-mobile": "/ui-v2/worker-resources/ready/mobile",
    };
    window.history.pushState({}, "", routes[next] || routes.global);
  };
  const refresh = () => {
    notify("当前为 Mock 预览，尚未接入实时资源 API", "warning");
  };
  const mainView = ["global", "country", "city"].includes(view)
    ? view
    : "global";
  const actions = {
    onAdd: () => changeView("add-vps"),
    onBulk: () => changeView("bulk"),
    onBatchDelete: () => setModal({ type: "delete", rows: selectedRows }),
    onRefresh: refresh,
    loading,
    batchDisabled: selectedRows.length === 0,
  };
  const completeAdd = (row) => {
    setModal(null);
    changeView("global");
    notify(`资源 ${row.name || "IDN-JKT-001"} 添加成功（Preview Mock）`);
  };
  return (
    <div className={`master-shell ${collapsed ? "sidebar-is-collapsed" : ""}`}>
      <Sidebar
        active="Worker资源中心"
        onNavigate={changeView}
        onNotify={notify}
        collapsed={collapsed}
      />
      <div className="shell-content">
        <GlobalHeader onCollapse={() => setCollapsed((current) => !current)} />
        {view === "bulk" ? (
          <BulkImport
            onClose={() => changeView("global")}
            onStart={() => {
              notify("批量导入已开始 · 436 条资源进入队列");
              changeView("global");
            }}
          />
        ) : view.startsWith("add-") ? (
          <AddResource
            initialType={view === "add-mobile" ? "手机RPA" : "VPS RPA"}
            onClose={() => changeView("global")}
            onComplete={completeAdd}
            onZeroTouch={() => setModal({ type: "zero" })}
          />
        ) : (
          <main className="main-content">
            <PageTitle view={mainView} actions={actions} />
            <KpiStrip view={mainView} />
            {error ? (
              <SectionCard className="state-card-panel">
                <ErrorState onRetry={() => setError(false)} />
              </SectionCard>
            ) : loading ? (
              <SectionCard className="state-card-panel">
                <LoadingState />
              </SectionCard>
            ) : (
              <>
                <ResourceMap
                  view={mainView}
                  onCountry={changeView}
                  onOpen={(row) => setDrawer(row)}
                />
                <ResourceTable
                  view={mainView}
                  onDetail={(row) => setDrawer(row)}
                  onEdit={(row) => notify(`编辑 ${row.name}（Preview Mock）`)}
                  onLog={(row) => setModal({ type: "log", row })}
                  onDelete={(row) => setModal({ type: "delete", row })}
                />
              </>
            )}
          </main>
        )}
        {drawer && (
          <Drawer
            row={drawer}
            onClose={() => setDrawer(null)}
            onZeroTouch={() => setModal({ type: "zero" })}
            onNotify={notify}
          />
        )}
        {modal?.type === "zero" && (
          <ZeroTouchModal onClose={() => setModal(null)} onNotify={notify} resource={drawer} />
        )}
        {modal?.type === "log" && (
          <LogModal row={modal.row} onClose={() => setModal(null)} onNotify={notify} />
        )}
        {modal?.type === "delete" && (
          <DeleteModal
            row={modal.row}
            onClose={() => setModal(null)}
            onConfirm={() => {
              setModal(null);
              notify("资源已删除（Preview Mock）");
            }}
          />
        )}
      </div>
      <PreviewSwitcher view={view} onChange={changeView} />
      {toast && (
        <StateBanner
          title={toast.message}
          kind={toast.tone === "error" ? "error" : "success"}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

function WorkerAuthBootstrap({ onAuthenticated }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!username.trim() || !password || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/__worker_staging/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!response.ok) {
        setMessage(response.status === 401 ? "用户名或密码不正确。" : `登录失败（HTTP ${response.status}）。`);
        return;
      }
      setPassword("");
      setOpen(false);
      onAuthenticated();
    } catch {
      setMessage("无法连接 Worker 认证服务，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="worker-auth-bootstrap">
      <button type="button" className="ui-button secondary worker-auth-toggle" aria-expanded={open} onClick={() => { setOpen((value) => !value); setMessage(""); }}>
        {open ? "收起登录" : "登录 Worker API"}
      </button>
      {open && (
        <form className="worker-auth-form" onSubmit={submit}>
          <label>用户名<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} disabled={busy} /></label>
          <label>密码<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} /></label>
          {message && <span className="worker-auth-message" role="alert">{message}</span>}
          <div className="worker-auth-actions">
            <button type="button" className="ui-button secondary" onClick={() => { setOpen(false); setUsername(""); setPassword(""); setMessage(""); }} disabled={busy}>取消</button>
            <button type="submit" className="ui-button primary" disabled={busy || !username.trim() || !password}>{busy ? "正在登录…" : "登录并重试"}</button>
          </div>
        </form>
      )}
    </div>
  );
}

function AppV2({ workerReadAdapter: suppliedReadAdapter } = {}) {
  const visualFixtureMode = isWorkerVisualFixtureEnabled();
  const workerHomeFixture = visualFixtureMode ? getWorkerVisualFixture("workerHome") : null;
  const workerReadAdapter = useMemo(() => {
    // Fixture mode is strictly local preview: skip every overview/map/API adapter.
    if (visualFixtureMode) return null;
    if (suppliedReadAdapter !== undefined) {
      if (suppliedReadAdapter?.getOverview) return suppliedReadAdapter;
      return suppliedReadAdapter ? createWorkerResourceReadAdapter({ transport: suppliedReadAdapter }) : null;
    }
    const injectedTransport = window.__WORKER_RESOURCE_READ_TRANSPORT__;
    if (injectedTransport) return createWorkerResourceReadAdapter({ transport: injectedTransport });
    return createWorkerResourceReadAdapter({ transport: { get: async (path, { signal } = {}) => {
      const response = await fetch(path, { credentials: "same-origin", signal, headers: { Accept: "application/json" } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw Object.assign(new Error("Worker staging read failed"), { status: response.status });
      return payload;
    } } });
  }, [suppliedReadAdapter, visualFixtureMode]);
  const path = window.location.pathname;
  const scopedCountryCode = path.match(/\/(?:country|city)\/cc-([a-z]{2})(?:\/|$)/i)?.[1]?.toLowerCase();
  const pathCountry = scopedCountryCode || Object.values(countryPreviews).find((item) => path.includes(`/country/${item.slug}`))?.code || (path.includes("/city/") && path.split("/city/")[1]?.split("/")[0] in countryPreviews ? path.split("/city/")[1].split("/")[0] : "id");
  const pathCity = path.includes("/city/") ? decodeURIComponent(path.split("/city/")[1]?.split("/").slice(-1)[0] || "Jakarta") : "Jakarta";
  const initialCityName = pathCity.toLocaleLowerCase() === "jakarta" ? "Jakarta" : pathCity;
  const initialCityNeedsFallback = !workerReadAdapter && !visualFixtureMode && path.includes("/city/")
    && visibleResourceRows("city", pathCountry, initialCityName).length > 0
    && !isValidGeoCoordinate(cityCoordinates[initialCityName]);
  const initialView = path === "/ai-center/models/add"
    ? "ai-add-model"
    : path === "/ai-center/overview"
      ? "ai-overview"
    : path === "/ai-center/routing-advice"
      ? "ai-routing-advice"
    : path === "/ai-center/models"
      ? "ai-models"
      : path === "/ai-center/usage"
        ? "ai-usage"
        : path.includes("/country/")
    ? "country"
    : path.includes("/city/")
      ? (initialCityNeedsFallback ? "country" : "city")
      : path.includes("/add/vps")
        ? "add-vps"
        : path.includes("/add/mobile")
          ? "add-mobile"
          : path.includes("/package/mobile")
            ? "package-mobile"
          : path.includes("/package/")
            ? "package"
          : path.includes("/bulk-import")
            ? "bulk"
            : path.includes("/bulk-progress")
              ? "bulk-progress"
            : path.includes("/ready/mobile")
              ? "ready-mobile"
              : path.includes("/ready/vps")
                ? "ready-vps"
                : "global";
  const [view, setView] = useState(initialView);
  const [coordinateFallback, setCoordinateFallback] = useState(initialCityNeedsFallback ? initialCityName : null);
  useEffect(() => {
    const syncHistoryRoute = () => {
      const currentPath = window.location.pathname;
      if (currentPath === "/ai-center/models/add") setView("ai-add-model");
      else if (currentPath === "/ai-center/overview") setView("ai-overview");
      else if (currentPath === "/ai-center/routing-advice") setView("ai-routing-advice");
      else if (currentPath === "/ai-center/models") setView("ai-models");
      else if (currentPath === "/ai-center/usage") setView("ai-usage");
      else if (currentPath.includes("/add/vps")) setView("add-vps");
      else if (currentPath.includes("/add/mobile")) setView("add-mobile");
      else if (currentPath.includes("/bulk-progress")) setView("bulk-progress");
      else if (currentPath.includes("/bulk-import")) setView("bulk");
      else if (currentPath.includes("/package/mobile")) setView("package-mobile");
      else if (currentPath.includes("/package/")) setView("package");
      else if (currentPath.includes("/ready/mobile")) setView("ready-mobile");
      else if (currentPath.includes("/ready/vps")) setView("ready-vps");
      else if (currentPath.includes("/country/")) {
        setView("country");
        const code = currentPath.match(/\/country\/cc-([a-z]{2})(?:\/|$)/i)?.[1]?.toLowerCase()
          || Object.values(countryPreviews).find((item) => currentPath.includes(`/country/${item.slug}`))?.code;
        if (code) setCountryCode(code);
      }
      else if (currentPath.includes("/city/")) {
        setView("city");
        const code = currentPath.match(/\/city\/cc-([a-z]{2})(?:\/|$)/i)?.[1]?.toLowerCase()
          || (currentPath.split("/city/")[1]?.split("/")[0] in countryPreviews ? currentPath.split("/city/")[1].split("/")[0] : null);
        const city = decodeURIComponent(currentPath.split("/city/")[1]?.split("/").slice(-1)[0] || "Jakarta");
        if (code) setCountryCode(code);
        setCityName(city);
      }
      else setView("global");
    };
    window.addEventListener("popstate", syncHistoryRoute);
    return () => window.removeEventListener("popstate", syncHistoryRoute);
  }, []);
  const [countryCode, setCountryCode] = useState(pathCountry);
  const [cityName, setCityName] = useState(initialCityName);
  useEffect(() => {
    if (!initialCityNeedsFallback) return;
    window.history.replaceState({}, "", `/ui-v2/worker-resources/country/${countryPreviews[pathCountry].slug}`);
  }, []);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [workerDetailSnapshot, setWorkerDetailSnapshot] = useState(null);
  const [workerReadSnapshot, setWorkerReadSnapshot] = useState(() => initialWorkerResourceReadSnapshot(workerReadAdapter));
  const [workerReadRefreshKey, setWorkerReadRefreshKey] = useState(0);
  const [workerMapReadSnapshot, setWorkerMapReadSnapshot] = useState(() => workerReadAdapter ? { state: "LOADING", connection: "INJECTED_TRANSPORT", data: null, error: null } : null);
  const workerOverviewMapModel = useMemo(() => workerReadAdapter
    ? buildWorkerOverviewMapModel(workerReadSnapshot, workerMapReadSnapshot)
    : null, [workerReadAdapter, workerReadSnapshot, workerMapReadSnapshot]);
  useEffect(() => {
    if (!workerReadAdapter || !["global", "country", "city"].includes(view)) return undefined;
    const controller = new AbortController();
    let current = true;
    setWorkerMapReadSnapshot((previous) => ({ ...previous, state: "LOADING", error: null }));
    if (typeof workerReadAdapter.getMapData !== "function") {
      setWorkerMapReadSnapshot({ state: "ERROR", connection: "INJECTED_TRANSPORT", data: null, error: { kind: "CONTRACT_ERROR", status: null } });
      return () => { current = false; controller.abort(); };
    }
    workerReadAdapter.getMapData({ signal: controller.signal }).then((snapshot) => {
      if (current) setWorkerMapReadSnapshot(snapshot);
    }).catch((error) => {
      if (!current || controller.signal.aborted) return;
      const status = Number.isInteger(error?.status) ? error.status : null;
      setWorkerMapReadSnapshot({ state: "ERROR", connection: "INJECTED_TRANSPORT", data: null, error: { kind: status ? "HTTP_ERROR" : "TRANSPORT_ERROR", status } });
    });
    return () => { current = false; controller.abort(); };
  }, [workerReadAdapter, workerReadRefreshKey, view]);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [editRow, setEditRow] = useState(null);
  const [readyResource, setReadyResource] = useState(null);
  const workerWriteAdapter = useMemo(() => createWorkerResourceWriteAdapter(), []);
  const workerReadFailed = workerReadAdapter && workerReadSnapshot?.state === "ERROR";
  const [workerWriteBusy, setWorkerWriteBusy] = useState(false);
  const [workerWriteError, setWorkerWriteError] = useState("");
  const [editedResources, setEditedResources] = useState({});
  const [deletedResources, setDeletedResources] = useState([]);
  const [bulkRows, setBulkRows] = useState(null);
  useEffect(() => {
    const syncDetailFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const requestedId = params.get("resource_id");
      const requestedType = params.get("resource_type");
      const requestedName = params.get("resource");
      if (requestedId) {
        if (!workerReadAdapter || !workerReadSnapshot?.data?.entities) return;
        const entity = workerReadSnapshot.data.entities.find((item) => item.id === requestedId && item.entityType === requestedType);
        setDrawer(entity ? projectWorkerReadEntityToRow(entity) : { name: requestedId, entityId: requestedId, __notFound: true, readOnly: true });
        return;
      }
      if (!requestedName) { setDrawer(null); return; }
      const rows = workerHomeFixture?.rows || visibleResourceRows("global", "id", "Jakarta", editedResources, deletedResources);
      const match = rows.find((item) => item.name === requestedName);
      setDrawer(match || { name: requestedName, __notFound: true });
    };
    syncDetailFromUrl();
    window.addEventListener("popstate", syncDetailFromUrl);
    return () => window.removeEventListener("popstate", syncDetailFromUrl);
  }, [editedResources, deletedResources, workerReadAdapter, workerReadSnapshot, workerHomeFixture]);
  useEffect(() => {
    const resourceId = drawer?.entityId;
    if (!workerReadAdapter || drawer?.readOnly !== true || drawer?.entityType !== "VPS_RESOURCE" || !resourceId || typeof workerReadAdapter.getVpsDetail !== "function") {
      setWorkerDetailSnapshot(null);
      return undefined;
    }
    const controller = new AbortController();
    setWorkerDetailSnapshot({ state: "LOADING", resourceId, data: null, error: null });
    workerReadAdapter.getVpsDetail(resourceId, { signal: controller.signal }).then((snapshot) => {
      if (!controller.signal.aborted) setWorkerDetailSnapshot({ ...snapshot, resourceId });
    }).catch(() => {
      if (!controller.signal.aborted) setWorkerDetailSnapshot({ state: "ERROR", resourceId, data: null, error: { kind: "TRANSPORT_ERROR", status: null } });
    });
    return () => controller.abort();
  }, [workerReadAdapter, drawer?.entityId, drawer?.entityType, drawer?.readOnly]);
  const openDetail = (row) => {
    if (!row?.name) return;
    if (workerReadAdapter && !isStableWorkerResource(row)) return;
    setDrawer(row);
    const nextUrl = new URL(window.location.href);
    if (workerReadAdapter) {
      nextUrl.searchParams.delete("resource");
      nextUrl.searchParams.set("resource_id", row.entityId);
      nextUrl.searchParams.set("resource_type", row.entityType);
    } else nextUrl.searchParams.set("resource", row.name);
    window.history.pushState({ workerDetailOpen: true }, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  };
  const closeDetail = () => {
    if (window.history.state?.workerDetailOpen) {
      window.history.back();
      return;
    }
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("resource");
    nextUrl.searchParams.delete("resource_id");
    nextUrl.searchParams.delete("resource_type");
    window.history.replaceState(window.history.state, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    setDrawer(null);
  };
  useEffect(() => {
    if (!drawer || modal) return undefined;
    const closeDetailOnEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeDetail();
    };
    document.addEventListener("keydown", closeDetailOnEscape);
    return () => document.removeEventListener("keydown", closeDetailOnEscape);
  }, [drawer, modal, closeDetail]);
  const notify = (message, tone = "success") => {
    setToast({ message, tone });
    window.clearTimeout(window.__previewToast);
    window.__previewToast = window.setTimeout(() => setToast(null), 2800);
  };
  const returnToAiModelList = () => {
    setView("ai-models");
    setError(false);
    window.history.replaceState({}, "", "/ai-center/models");
  };
  const changeView = (next, code = countryCode, city = cityName) => {
    const fixtureCountry = workerHomeFixture?.countries.find((item) => item.code === code);
    const nextCode = countryPreviews[code] || fixtureCountry ? code : "id";
    const selectedCountry = workerHomeFixture?.countries.find((item) => item.code === nextCode);
    const requestedCity = next === "city" ? city || selectedCountry?.cities[0]?.name || countryPreviews[nextCode].cities[0][0] : city;
    const fallbackCity = !workerHomeFixture && next === "city"
      && visibleResourceRows("city", nextCode, requestedCity, editedResources, deletedResources).length > 0
      && !isValidGeoCoordinate(cityCoordinates[requestedCity]) ? requestedCity : null;
    const resolvedView = fallbackCity ? "country" : next;
    if (resolvedView === "country" || resolvedView === "city") setCountryCode(nextCode);
    if (next === "city") setCityName(requestedCity);
    setCoordinateFallback(fallbackCity);
    setView(resolvedView);
    setError(false);
    const routes = {
      global: "/ui-v2/worker-resources",
      "ai-overview": "/ai-center/overview",
      "ai-models": "/ai-center/models",
      "ai-add-model": "/ai-center/models/add",
      "ai-routing-advice": "/ai-center/routing-advice",
      "ai-usage": "/ai-center/usage",
      country: `/ui-v2/worker-resources/country/cc-${nextCode}`,
      city: `/ui-v2/worker-resources/city/cc-${nextCode}/${encodeURIComponent(requestedCity)}`,
      "add-vps": "/ui-v2/worker-resources/add/vps",
      "add-mobile": "/ui-v2/worker-resources/add/mobile",
      package: "/ui-v2/worker-resources/package/browser",
      "package-mobile": "/ui-v2/worker-resources/package/mobile",
      bulk: "/ui-v2/worker-resources/bulk-import",
      "bulk-progress": "/ui-v2/worker-resources/bulk-progress",
      "ready-vps": "/ui-v2/worker-resources/ready/vps",
      "ready-mobile": "/ui-v2/worker-resources/ready/mobile",
    };
    const target = new URL(routes[resolvedView] || routes.global, window.location.origin);
    if (visualFixtureMode) target.searchParams.set("workerVisualFixture", "1");
    window.history.pushState({}, "", `${target.pathname}${target.search}${target.hash}`);
  };
  const changeWorkerMapView = (next, code = countryCode, city = cityName) => {
    if (next === "global") {
      setView("global");
      setCoordinateFallback(null);
      setError(false);
      const target = new URL("/ui-v2/worker-resources", window.location.origin);
      if (visualFixtureMode) target.searchParams.set("workerVisualFixture", "1");
      window.history.pushState({}, "", `${target.pathname}${target.search}`);
      return;
    }
    const nextCode = typeof code === "string" && /^[a-z]{2}$/i.test(code) ? code.toLowerCase() : "id";
    setCountryCode(nextCode);
    setCoordinateFallback(null);
    setError(false);
    if (next === "city") setCityName(city);
    setView(next === "city" ? "city" : "country");
    const route = next === "city"
      ? `/ui-v2/worker-resources/city/cc-${nextCode}/${encodeURIComponent(city)}`
      : `/ui-v2/worker-resources/country/cc-${nextCode}`;
    const target = new URL(route, window.location.origin);
    if (visualFixtureMode) target.searchParams.set("workerVisualFixture", "1");
    window.history.pushState({}, "", `${target.pathname}${target.search}`);
  };
  const refresh = () => {
    if (workerReadAdapter) {
      setWorkerReadRefreshKey((value) => value + 1);
      return;
    }
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      notify("资源状态已刷新");
    }, 700);
  };
  const mainView = ["global", "country", "city"].includes(view)
    ? view
    : "global";
  const listActionAvailability = workerResourceListActionAvailability({
    liveRead: Boolean(workerReadAdapter),
    loading: workerReadAdapter ? workerReadSnapshot?.state === "LOADING" : loading,
    selectedCount: selectedRows.length,
  });
  const detailSnapshotMatchesDrawer = workerDetailSnapshot && workerDetailSnapshot.resourceId === drawer?.entityId;
  const detailSummary = detailSnapshotMatchesDrawer ? projectWorkerVpsDetailSummary(workerDetailSnapshot) : null;
  const drawerDisplayRow = drawer ? {
    ...drawer,
    detailState: detailSnapshotMatchesDrawer ? workerDetailSnapshot.state : "LOADING",
    detailSummary,
  } : null;
  const actions = {
    onAdd: () => changeView("add-vps"),
    onBulk: () => changeView("bulk"),
    onBatchDelete: () => setModal({ type: "delete", rows: selectedRows }),
    onRefresh: refresh,
    loading: workerReadAdapter ? workerReadSnapshot?.state === "LOADING" : loading,
    batchDisabled: selectedRows.length === 0,
    bulkDisabled: listActionAvailability.bulkDisabled,
    batchDeleteDisabled: listActionAvailability.batchDeleteDisabled,
    batchDeleteReason: listActionAvailability.batchDeleteReason,
    refreshDisabled: listActionAvailability.refreshDisabled,
  };
  const completeAdd = async (row) => {
    if (visualFixtureMode) {
      const resource = { ...row, entityId: `VISUAL-${Date.now()}`, persisted: false, fixtureOnly: true };
      setReadyResource(resource);
      notify("本地视觉演示：资源未保存，未调用 API/DB。可继续查看配置页面。", "warning");
      changeView(resource.type === "手机RPA" ? "package-mobile" : "package");
      return;
    }
    if (row.type === "手机RPA") {
      setWorkerWriteError("当前 Worker API 未提供手机资源创建接口；未发送请求，也未创建资源。");
      return;
    }
    if (String(row.provider || "").trim() || String(row.consoleUrl || "").trim()) {
      setWorkerWriteError("当前 Worker API 不支持保存服务商名称和后台链接；未发送请求，也未创建不完整资源。");
      return;
    }
    if (workerWriteBusy) return;
    setWorkerWriteBusy(true);
    setWorkerWriteError("");
    try {
      const saved = await workerWriteAdapter.saveResource(row);
      const resource = { ...row, entityId: saved.vps.id, vpsKey: saved.vps.vps_key, createdAt: saved.vps.created_at, persisted: true };
      setReadyResource(resource);
      setModal({ type: "install", resource });
      notify(saved.idempotentReuse ? "已读取并复用匹配的 staging VPS 记录" : "资源已保存到 staging VPS");
    } catch (error) {
      setWorkerWriteError(error?.code === "RDP_NOT_IN_SCOPE" ? `${row.name || "该资源"} 的 RDP 接线尚未实现；请关闭 RDP 后重试。` : error?.status === 401 ? "staging 会话已失效，请在 staging 页面重新登录后重试。" : error?.status === 403 ? "当前 staging 用户没有 Worker 资源写入权限。" : error?.status === 409 ? "资源标识已存在，但字段与现存资源不一致；未创建重复记录。" : "保存失败。请检查 staging API 状态后重试。");
    } finally { setWorkerWriteBusy(false); }
  };
  const triggerWorkerInstall = async (resource) => {
    if (visualFixtureMode) {
      setModal({ type: "zero", provisioningPreview: { resource, fixtureOnly: true, command: "# 本地视觉预览命令；不会执行或发送" } });
      notify("本地视觉演示：未触发安装或写入 Runtime/session。", "warning");
      return;
    }
    if (workerWriteBusy) return;
    setWorkerWriteBusy(true);
    setWorkerWriteError("");
    try {
      const result = await workerWriteAdapter.triggerInstall({ vpsId: resource.entityId, resourceName: resource.name });
      const sessionId = result.session?.session_id || result.session?.id;
      setReadyResource({ ...resource, runtimeId: result.runtime.id || result.runtime.runtime_id, provisioningSessionId: sessionId });
      if (result.alreadyReady) {
        setModal({ type: "ready-reused", session: result.session });
        notify("已复用现有 READY session；资源已就绪，无需重新安装");
        return;
      }
      setModal({ type: "bootstrap", session: result.session, resource });
      notify("Install Trigger 已写入 staging Runtime 与 Zero-Touch session");
    } catch (error) {
      setWorkerWriteError(error?.status === 401 ? "staging 会话已失效，请重新登录后重试。" : error?.status === 403 ? "当前 staging 用户没有 Install Trigger 权限。" : "Install Trigger 失败；未显示成功状态。请检查 staging API 错误并重试。");
    } finally { setWorkerWriteBusy(false); }
  };
  const aiPageIndex = {
    "ai-overview": 0,
    "ai-models": 1,
    "ai-add-model": 1,
    "ai-usage": 2,
    "ai-routing-advice": 3,
  }[view];
  const activeAiPage = aiPageIndex === undefined ? undefined : aiItems[aiPageIndex];
  const shell = (content) => (
    <div className={`master-shell ${collapsed ? "sidebar-is-collapsed" : ""}`}>
      <Sidebar
        active={(view === "ai-overview" || view === "ai-models" || view === "ai-add-model" || view === "ai-routing-advice" || view === "ai-usage") ? "AI智能模型中心" : "Worker资源中心"}
        activeAiItem={activeAiPage}
        onNavigate={changeView}
        onNotify={notify}
        collapsed={collapsed}
      />
      <div className="shell-content">
        <GlobalHeader activeCenter={(view === "ai-overview" || view === "ai-models" || view === "ai-add-model" || view === "ai-routing-advice" || view === "ai-usage") ? "AI智能模型中心" : "Worker资源中心"} activePage={activeAiPage} onCollapse={() => setCollapsed((current) => !current)} />
        {visualFixtureMode && view !== "bulk" && <WorkerVisualFixtureNotice message={`当前页面：${window.location.pathname} · 仅本地预览，不代表真实功能结果`} />}
        {content}
        {drawer && (
          <Drawer
            row={drawerDisplayRow}
            onClose={closeDetail}
            onZeroTouch={() => setModal({ type: "zero" })}
            onLifecyclePreview={() => setModal({ type: "lifecycle", resource: drawer })}
            onArchivePreview={(resource) => setModal({ type: "archive-preview", resource })}
            onRestorePreview={(resource) => setModal({ type: "restore-preview", resource })}
            onNotify={notify}
          />
        )}
        {modal?.type === "install" && (
          <div className="modal-backdrop">
            <div className="center-modal" role="dialog" aria-modal="true" aria-labelledby="worker-install-title">
              <div className="drawer-head"><div><h2 id="worker-install-title">触发 Zero-Touch 安装</h2><p>已保存 staging VPS：{modal.resource.name} · {modal.resource.entityId}</p></div></div>
              {workerWriteError && <p role="alert">{workerWriteError}</p>}
              <div className="modal-actions"><Button disabled={workerWriteBusy} onClick={() => setModal(null)}>稍后</Button><Button variant="primary" disabled={workerWriteBusy} onClick={() => triggerWorkerInstall(modal.resource)}>{workerWriteBusy ? "处理中…" : "触发安装"}</Button></div>
            </div>
          </div>
        )}
        {modal?.type === "ready-reused" && (
          <div className="modal-backdrop">
            <section className="center-modal zero-modal zero-provisioning-modal" role="dialog" aria-modal="true" aria-labelledby="worker-ready-reused-title">
              <div className="drawer-head">
                <div>
                  <div className="page-kicker">STAGING · EXISTING RESOURCE</div>
                  <h2 id="worker-ready-reused-title">资源已就绪</h2>
                  <p>已复用现有 READY session · {modal.session?.id}</p>
                </div>
                <IconButton onClick={() => setModal(null)}><X size={20} /></IconButton>
              </div>
              <div className="zero-provisioning-disclosure" role="status">
                <strong>Worker 与 Runtime 已就绪</strong>
                <span>此资源已完成注册和就绪检查，无需重新安装。现有 VPS、Worker、Runtime 与 session 均已保留。</span>
              </div>
              <div className="modal-actions"><Button variant="primary" onClick={() => setModal(null)}>完成</Button></div>
            </section>
          </div>
        )}
        {modal?.type === "bootstrap" && <StagingBootstrapModal session={modal.session} resourceName={modal.resource?.name} onClose={() => setModal(null)} onNotify={notify} />}
        {modal?.type === "zero" && (
          <ZeroTouchModal onClose={() => setModal(null)} onNotify={notify} resource={modal?.provisioningPreview?.resource || drawer || readyResource} provisioningPreview={modal?.provisioningPreview} />
        )}
        {modal?.type === "lifecycle" && (
          <LifecyclePreviewModal resource={modal.resource} onClose={() => setModal(null)} />
        )}
        {modal?.type === "archive-preview" && (
          <ArchivePreviewModal resource={modal.resource} onClose={() => setModal(null)} onArchive={({ reason, archivedAt }) => {
            const lifecyclePreview = { archived: true, reason, archivedAt };
            setEditedResources((current) => ({ ...current, [modal.resource.name]: { ...current[modal.resource.name], lifecyclePreview } }));
            setDrawer((current) => current?.name === modal.resource.name ? { ...current, lifecyclePreview } : current);
            setModal(null);
            notify("Archived in local preview only; resource remains in the list.");
          }} />
        )}
        {modal?.type === "restore-preview" && (
          <RestorePreviewModal resource={modal.resource} onClose={() => setModal(null)} onRestore={() => {
            const name = modal.resource.name;
            setEditedResources((current) => {
              const next = { ...current };
              const { lifecyclePreview, ...rest } = next[name] || {};
              if (Object.keys(rest).length) next[name] = rest; else delete next[name];
              return next;
            });
            setDrawer((current) => {
              if (current?.name !== name) return current;
              const { lifecyclePreview, ...rest } = current;
              return rest;
            });
            setModal(null);
            notify("Restored in local preview only; fixture relationships are unchanged.");
          }} />
        )}
        {modal?.type === "log" && (
          <LogModal
            row={modal.row}
            kind={modal.kind}
            onClose={() => setModal(null)}
            onNotify={notify}
          />
        )}
        {modal?.type === "delete" && (
          <DeleteModal
            row={modal.row}
            rows={modal.rows}
            onClose={() => setModal(null)}
            onNotify={notify}

          />
        )}
      </div>
      <PreviewSwitcher view={view} onChange={changeView} />
      {toast && (
        <StateBanner
          title={toast.message}
          kind={toast.tone === "error" ? "error" : "success"}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
  if (view === "ai-overview") return shell(<AIOverviewPage />);
  if (view === "ai-models") return shell(<ModelQuotaPage onAddModelOpen={() => changeView("ai-add-model")} />);
  if (view === "ai-add-model") return shell(<AddModelPage adapter={modelQuotaAdapter} onCancel={returnToAiModelList} onSaved={returnToAiModelList} />);
  if (view === "ai-routing-advice") return shell(<RoutingAdvicePage adapter={null} />);
  if (view === "ai-usage") return shell(<UsageCostPreview />);
  if (view === "bulk")
    return shell(
      <BulkImportV3
        onClose={() => changeView("global")}
        onStart={(rows) => {
          setBulkRows(rows);
          notify("批量导入已进入前端预览队列（未连接业务 API）");
          changeView("bulk-progress");
        }}
        onNotify={notify}
      />,
    );
  if (view === "bulk-progress")
    return shell(
      <BulkProgress
        rows={bulkRows}
        onBack={() => changeView("bulk")}
        onFinish={() => changeView("global")}
        onNotify={notify}
      />,
    );
  if (view === "package" || view === "package-mobile")
    return shell(
      <PackageConfig
        resource={readyResource || (view === "package-mobile" ? { type: "手机RPA" } : { type: "VPS RPA" })}
        readAdapter={workerReadAdapter}
        onBack={() => changeView(readyResource?.type === "手机RPA" ? "add-mobile" : "add-vps")}
        onNotify={notify}
      />,
    );
  if (view === "ready-vps" || view === "ready-mobile")
    return shell(
      <ReadyPage
        type={view === "ready-mobile" ? "手机RPA" : "VPS RPA"}
        resource={readyResource}
        onBack={() => changeView("global")}
        onFinish={() => changeView("global")}
        onNotify={notify}
      />,
    );
  if (editRow)
    return shell(
      <AddResourceV2
        initialType={editRow.type === "VPS" ? "VPS RPA" : editRow.type}
        initialData={{ ...editRow, lat: editRow.latitude == null ? "" : String(editRow.latitude), lng: editRow.longitude == null ? "" : String(editRow.longitude) }}
        realMode={Boolean(workerReadAdapter)}
        edit
        saving={workerWriteBusy}
        saveError={workerWriteError}
        onClose={() => setEditRow(null)}
        onComplete={async (row) => {
          if (workerReadAdapter && editRow.entityType === "VPS_RESOURCE" && editRow.entityId) {
            setWorkerWriteBusy(true);
            setWorkerWriteError("");
            try {
              const result = await workerWriteAdapter.updateResource({ vpsId: editRow.entityId, form: row });
              setWorkerReadRefreshKey((value) => value + 1);
              setEditRow(null);
              notify(`资源 ${editRow.name} 已保存；经纬度已由 Worker API 回读确认`);
              return result;
            } catch (error) {
              setWorkerWriteError(error?.status === 401 ? "staging 会话已失效，请重新登录后重试。" : error?.status === 403 ? "当前 staging 用户没有资源编辑权限。" : error?.code === "READBACK_MISMATCH" ? "保存请求已发送，但经纬度回读不一致；请刷新核对后再试。" : "保存失败；没有显示成功状态，请检查 Worker API 后重试。");
              return;
            } finally {
              setWorkerWriteBusy(false);
            }
          }
          const plan = row.package || row.plan || "";
          const nextRow = {
            ...editRow, ...row, plan, package: plan,
            country: countryByCode[row.countryCode]?.chinese || row.country || editRow.country,
            providerKey: providerAliases[row.provider] || row.providerKey,
            remote: row.type === "手机RPA" ? "手机远程" : row.rdpEnabled === false ? "未启用" : "RDP",
          };
          setEditedResources((current) => ({ ...current, [editRow.name]: nextRow }));
          setEditRow(null);
          notify(`资源 ${row.name} 已保存修改（Preview Mock）`);
        }}
        onZeroTouch={(provisioningPreview) => setModal({ type: "zero", provisioningPreview })}
        onNotify={notify}
      />,
    );
  if (view === "add-vps" || view === "add-mobile")
    return shell(
      <AddResourceV2
        initialType={view === "add-mobile" ? "手机RPA" : "VPS RPA"}
        initialData={readyResource?.type === (view === "add-mobile" ? "手机RPA" : "VPS RPA") ? readyResource : null}
        realMode={Boolean(workerReadAdapter)}
        saving={workerWriteBusy}
        saveError={workerWriteError}
        onClose={() => changeView("global")}
        onComplete={completeAdd}
        onZeroTouch={(provisioningPreview) => setModal({ type: "zero", provisioningPreview })}
        onNotify={notify}
      />,
    );
  return shell(
    <main className={`main-content${workerReadAdapter && mainView === "global" ? " worker-resource-list-page" : ""}${workerHomeFixture ? " worker-fixture-active" : ""}${workerHomeFixture && mainView === "global" ? " worker-home-fixture" : ""}`}>
       <PageTitle view={mainView} actions={actions} countryCode={countryCode} cityName={cityName} homeFixture={workerHomeFixture} readOnly={Boolean(workerReadAdapter && !workerReadFailed)} allowAddWhenReadOnly={Boolean(workerWriteAdapter)} />
       {workerReadFailed && <div className="worker-auth-required"><p className="metric-contract-notice" role="alert">Worker staging 列表暂不可读（HTTP {workerReadSnapshot?.error?.status || "network"}）。请使用 Worker API 账号建立真实会话后重试。</p><WorkerAuthBootstrap onAuthenticated={refresh} /></div>}
       {!workerReadAdapter && !workerHomeFixture && <p className="metric-contract-notice" role="note">示例数据 · 统计口径待核实：分母、状态定义及重叠关系尚未确认</p>}
       {coordinateFallback && mainView === "country" && <p className="metric-contract-notice" role="status">城市 {coordinateFallback} 缺少有效坐标，已回退到国家资源汇总；地图不展示该城市的虚构位置。当前为本地预览。</p>}
       <KpiStrip view={mainView} countryCode={countryCode} cityName={cityName} homeFixture={workerHomeFixture} liveModel={workerReadAdapter ? workerOverviewMapModel : null} />
      {error ? (
        <SectionCard className="state-card-panel">
          <ErrorState onRetry={() => setError(false)} />
        </SectionCard>
      ) : loading ? (
        <SectionCard className="state-card-panel">
          <LoadingState />
        </SectionCard>
      ) : (
        <>
          <ResourceMap
            view={mainView}
            countryCode={countryCode}
            cityName={cityName}
            overrides={editedResources}
            deletedNames={deletedResources}
            readOnlyRows={null}
            homeFixture={workerHomeFixture}
            liveModel={workerReadAdapter ? workerOverviewMapModel : null}
            onCountry={changeView}
            onOpen={openDetail}
          />
          <ResourceTable
            view={mainView}
            readAdapter={workerReadAdapter}
            readRetry={workerReadRefreshKey}
            onReadRetry={refresh}
             countryCode={countryCode}
             cityName={cityName}
            overrides={editedResources}
            deletedNames={deletedResources}
            onReadSnapshotChange={setWorkerReadSnapshot}
            homeFixture={workerHomeFixture}
            onSelectionChange={setSelectedRows}
            onDetail={openDetail}
            onEdit={(row) => setEditRow(row)}
            onLog={(row, kind) => setModal({ type: "log", row, kind })}
            onDelete={(row) => setModal({ type: "delete", row })}
          />
        </>
      )}
    </main>,
  );
}

export { AppV2 as App };


