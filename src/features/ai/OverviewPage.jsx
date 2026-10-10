import React, { useState } from "react";
import {
  ArrowRight,
  ArrowsClockwise,
  CaretRight,
  Clock,
  Cube,
  Lightning,
  Pulse,
  WarningCircle,
} from "@phosphor-icons/react";
import ProviderLogo from "./ProviderLogo.jsx";
import { AiVisualFixtureNotice, getAiVisualFixtureData } from "./aiVisualFixtureProvider.jsx";
import "./overview-page.css";

const iconByName = { Cube, Lightning, Pulse, Clock, WarningCircle };

function DemoBadge({ children = "演示" }) {
  return <span className="ai-overview__demo-badge">{children}</span>;
}

function PanelHeading({ title, caption, href, linkLabel = "查看详情" }) {
  return (
    <div className="ai-overview__panel-heading">
      <div>
        <h2>{title}</h2>
        {caption && <p>{caption}</p>}
      </div>
      {href && (
        <a className="ai-overview__text-link" href={href}>
          {linkLabel}<CaretRight size={14} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

function AIOverviewLegacyPage() {
  const [period, setPeriod] = useState("today");
  const [notice, setNotice] = useState("");
  const visualFixture = getAiVisualFixtureData("overview");
  const providers = visualFixture?.providers || [];
  const models = visualFixture?.models || [];
  const snapshot = visualFixture?.snapshot || {};
  const kpis = visualFixture?.kpis || [];
  const sourceMix = visualFixture?.sourceMix || [];
  const series = snapshot[period] || { label: "未知", dates: [], requests: [], success: [] };

  return (
    <div className="ai-overview" data-testid="ai-overview-page">
      <AiVisualFixtureNotice />
      <header className="ai-overview__header">
        <div>
          <div className="ai-overview__eyebrow">AI 智能模型中心</div>
          <h1>AI 总览</h1>
          <p>统一管理模型与 Provider，查看 AI 用量与调度状态。</p>
        </div>
        <div className="ai-overview__header-actions">
          <DemoBadge>演示数据 · 非实时</DemoBadge>
          <button
            type="button"
            className="ai-overview__refresh"
            onClick={() => setNotice("当前页面使用静态示例数据，没有发起接口请求。")}
            aria-label="说明当前演示数据状态"
          >
            <ArrowsClockwise size={16} aria-hidden="true" />
            数据说明
          </button>
        </div>
      </header>

      <div className="ai-overview__disclosure" role="note">
        <span className="ai-overview__info-mark" aria-hidden="true">i</span>
        <div>
          <strong>本页为界面演示</strong>
          <span>带“演示”标记的数值仅用于展示布局；真实连接健康、业务就绪、成本及告警状态尚未从后端读取。</span>
        </div>
        {notice && <span className="ai-overview__live-note" role="status">{notice}</span>}
      </div>

      <section className="ai-overview__kpis" aria-label="AI 总览演示指标">
        {kpis.map(({ label, value, note, icon, tone }) => {
          const Icon = iconByName[icon] || Cube;
          return (
          <article className={`ai-overview__kpi ai-overview__kpi--${tone}`} key={label}>
            <div className="ai-overview__kpi-icon"><Icon size={22} weight="duotone" aria-hidden="true" /></div>
            <div className="ai-overview__kpi-text">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
            <small>{note}</small>
          </article>
          );
        })}
      </section>

      <section className="ai-overview__main-grid" aria-label="Provider 与调度概览">
        <article className="ai-overview__panel ai-overview__providers">
          <PanelHeading title="Provider 状态" caption="连接状态尚未读取" href="/ai-center/models" linkLabel="模型与额度" />
          <div className="ai-overview__table-scroll">
            <table>
              <thead><tr><th>Provider</th><th>连接状态</th><th>模型数</th></tr></thead>
              <tbody>
                {providers.map((provider) => (
                  <tr key={provider.name}>
                    <td><ProviderLogo provider={provider.name} /><span>{provider.name}</span></td>
                    <td><span className="ai-overview__unknown"><i />未检测</span></td>
                    <td><span className="ai-overview__sample-count">示例 {provider.models}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ai-overview__footnote">模型数量为静态示例；“未检测”不代表连接失败或成功。</p>
        </article>

        <article className="ai-overview__panel ai-overview__route-panel">
          <PanelHeading title="AI 调度链路" caption="结构示意 · 实际连通状态未加载" href="/ai-center/routing-advice" linkLabel="调度建议" />
          <div className="ai-overview__route-body">
            <div className="ai-overview__sources" aria-label="请求来源示例占比">
              <h3>请求来源 <DemoBadge /></h3>
              {sourceMix.map(([label, share], index) => (
                <div className="ai-overview__source-row" key={label}>
                  <span className={`ai-overview__source-icon ai-overview__source-icon--${index}`}><Cube size={14} aria-hidden="true" /></span>
                  <span>{label}</span><b>{share}</b>
                </div>
              ))}
            </div>
            <div className="ai-overview__route-visual">
              <div className="ai-overview__route-label"><span className="ai-overview__route-core"><Lightning size={25} weight="duotone" aria-hidden="true" /></span><b>AI 路由链路</b></div>
              <div className="ai-overview__route-steps" aria-label="AI 中心到模型服务的路由结构">
                {["AI 中心", "Gateway", "Router", "Provider"].map((label, index) => (
                  <React.Fragment key={label}>
                    <span className="ai-overview__route-step"><i>{index + 1}</i>{label}</span>
                    {index < 3 && <ArrowRight size={15} className="ai-overview__route-arrow" aria-hidden="true" />}
                  </React.Fragment>
                ))}
              </div>
              <small>此处仅展示逻辑关系，不代表服务在线或请求已成功。</small>
            </div>
            <div className="ai-overview__model-mix">
              <h3>模型与 Provider <DemoBadge /></h3>
              {providers.slice(0, 5).map((provider, index) => (
                <div className="ai-overview__mix-row" key={provider.name}>
                  <ProviderLogo provider={provider.name} /><span>{provider.name}</span>
                  <i><b style={{ width: `${[78, 61, 49, 37, 28][index]}%` }} /></i>
                </div>
              ))}
              <small>示例分布 · 非当前流量</small>
            </div>
          </div>
          <div className="ai-overview__route-note"><Pulse size={15} aria-hidden="true" />Gateway / Router / Worker / Runtime / RPA 的联动状态未在此页面验证。</div>
        </article>

        <article className="ai-overview__panel ai-overview__model-health">
          <PanelHeading title="模型状态摘要" caption="当前状态未知" href="/ai-center/models" linkLabel="查看模型" />
          <ul>
            {models.map((model) => (
              <li key={model.name}>
                <ProviderLogo provider={model.provider} />
                <span className="ai-overview__model-name"><b>{model.name}</b><small>{model.provider}</small></span>
                <span className="ai-overview__unknown ai-overview__unknown--compact"><i />未知</span>
              </li>
            ))}
          </ul>
          <p className="ai-overview__footnote">模型启用与连接测试记录未加载，不显示健康率或成功率。</p>
        </article>
      </section>

      <section className="ai-overview__trend-grid" aria-label="用量与成本演示趋势">
        <article className="ai-overview__panel ai-overview__chart-panel">
          <PanelHeading title="调用趋势" caption="相对示例指数 · 非业务数据" href="/ai-center/usage" linkLabel="用量与成本" />
          <div className="ai-overview__chart-controls" role="group" aria-label="演示趋势时间范围">
            {Object.entries(snapshot).map(([key, data]) => (
              <button type="button" key={key} className={period === key ? "is-selected" : ""} aria-pressed={period === key} onClick={() => setPeriod(key)}>{data.label}</button>
            ))}
          </div>
          <div className="ai-overview__chart" role="img" aria-label={`${series.label}演示请求与成功调用趋势，不是真实业务数据`}>
            <div className="ai-overview__chart-guides"><i /><i /><i /><i /></div>
            <div className="ai-overview__bars">
              {series.requests.map((height, index) => (
                <span className="ai-overview__bar-group" key={series.dates[index]}>
                  <i className="ai-overview__bar ai-overview__bar--requests" style={{ height: `${height}%` }} />
                  <i className="ai-overview__bar ai-overview__bar--success" style={{ height: `${series.success[index]}%` }} />
                  <small>{series.dates[index]}</small>
                </span>
              ))}
            </div>
          </div>
          <div className="ai-overview__legend"><span><i className="is-blue" />请求指数（样例）</span><span><i className="is-teal" />成功指数（样例）</span></div>
        </article>

        <article className="ai-overview__panel ai-overview__cost-panel">
          <PanelHeading title="成本与用量" caption="后端数据暂不可用" href="/ai-center/usage" linkLabel="查看用量" />
          <div className="ai-overview__unknown-card">
            <WarningCircle size={22} aria-hidden="true" />
            <div><strong>成本状态未知</strong><span>未接入真实费用、预算和 Token 记录。未知值不会显示为 0。</span></div>
          </div>
          <div className="ai-overview__cost-summary"><span>今日已知成本<b>—</b></span><span>待核实记录<b>—</b></span><span>预算状态<b>未读取</b></span></div>
        </article>

        <article className="ai-overview__panel ai-overview__alerts-panel">
          <PanelHeading title="告警与风险" caption="告警源尚未接入" />
          <div className="ai-overview__alert-state"><WarningCircle size={22} aria-hidden="true" /><div><strong>当前无法判断告警数量</strong><span>没有读取告警数据；这不表示没有告警。</span></div></div>
          <div className="ai-overview__alert-state ai-overview__alert-state--quiet"><Pulse size={20} aria-hidden="true" /><div><strong>业务链路状态未知</strong><span>Provider 状态不能替代 AI → 任务 → Runtime → RPA 验收。</span></div></div>
        </article>
      </section>

      <section className="ai-overview__bottom-grid" aria-label="AI 功能入口">
        <article className="ai-overview__panel ai-overview__entry-card">
          <div className="ai-overview__entry-icon ai-overview__entry-icon--blue"><Cube size={19} aria-hidden="true" /></div>
          <div><DemoBadge /><h2>模型与额度</h2><p>管理模型配置，并查看额度字段。</p></div>
          <a href="/ai-center/models" aria-label="进入模型与额度"><ArrowRight size={17} aria-hidden="true" /></a>
        </article>
        <article className="ai-overview__panel ai-overview__entry-card">
          <div className="ai-overview__entry-icon ai-overview__entry-icon--teal"><Pulse size={19} aria-hidden="true" /></div>
          <div><DemoBadge /><h2>用量与成本</h2><p>按周期查看调用、Token 与成本口径。</p></div>
          <a href="/ai-center/usage" aria-label="进入用量与成本"><ArrowRight size={17} aria-hidden="true" /></a>
        </article>
        <article className="ai-overview__panel ai-overview__entry-card">
          <div className="ai-overview__entry-icon ai-overview__entry-icon--violet"><Lightning size={19} aria-hidden="true" /></div>
          <div><DemoBadge /><h2>调度建议</h2><p>查看候选路由与建议状态。</p></div>
          <a href="/ai-center/routing-advice" aria-label="进入调度建议"><ArrowRight size={17} aria-hidden="true" /></a>
        </article>
        <article className="ai-overview__panel ai-overview__entry-card ai-overview__entry-card--disabled">
          <div className="ai-overview__entry-icon ai-overview__entry-icon--amber"><WarningCircle size={19} aria-hidden="true" /></div>
          <div><span className="ai-overview__demo-badge">本批未开发</span><h2>系统设置</h2><p>本批范围不包含设置页。</p></div>
          <span className="ai-overview__entry-arrow" aria-hidden="true"><CaretRight size={16} /></span>
        </article>
      </section>
      <footer className="ai-overview__footer">演示数据仅用于界面预览 · 未连接真实 AI Provider、Gateway、数据库或业务运行状态</footer>
    </div>
  );
}

// The adapter-backed dashboard replaces the broken static placeholder for A02/A03.
export { default } from "./OverviewDashboard.jsx";
