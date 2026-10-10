import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle, Copy, FileText, Info, Warning, X } from "@phosphor-icons/react";
import { Button, StatusPill } from "./ui/index.jsx";
import "./packageConfigReadOnly.css";

const DEFAULT_RUNTIME_TEMPLATE = "WINDOWS_BROWSER_AI_FULL";
const statusLabels = {
  DISCOVERED: "待审核",
  DOWNLOADED: "已下载",
  VERIFIED: "已验证",
  CANDIDATE: "候选版本",
  APPROVED: "已批准",
  REJECTED: "已拒绝",
  DEPRECATED: "已弃用",
  UNKNOWN: "未知状态",
};
const statusTone = {
  APPROVED: "green",
  VERIFIED: "cyan",
  DOWNLOADED: "cyan",
  DISCOVERED: "warning",
  CANDIDATE: "warning",
  REJECTED: "danger",
  DEPRECATED: "muted",
  UNKNOWN: "muted",
};

function errorMessage(snapshot) {
  const status = snapshot?.error?.status;
  if (status === 401) return "Worker 登录会话已失效，请重新登录后刷新。";
  if (status === 403) return "当前账号无权读取 Worker 套餐目录。";
  if (status) return `Worker 套餐目录读取失败（HTTP ${status}）。`;
  return "Worker 套餐目录暂时无法连接，请稍后重试。";
}

export function PackageLogo({ name }) {
  const brands = {
    "Node.js LTS": "/assets/brand/nodejs.svg",
    Playwright: "/assets/brand/playwright.svg",
    Stagehand: "/assets/brand/stagehand.svg",
  };
  const asset = brands[name];
  return asset
    ? <img className="package-brand-logo" src={asset} alt="" aria-hidden="true" />
    : <FileText className="package-plan-logo" size={19} weight="duotone" aria-hidden="true" />;
}

export default function PackageConfig({ resource, readAdapter, onBack, onNotify }) {
  const mobileCatalogUnavailable = resource?.type === "手机RPA" && !resource?.runtimeTemplate;
  const runtimeTemplate = resource?.runtimeTemplate || (mobileCatalogUnavailable ? "" : DEFAULT_RUNTIME_TEMPLATE);
  const [snapshot, setSnapshot] = useState(() => ({ state: mobileCatalogUnavailable ? "UNSUPPORTED" : readAdapter?.getPackageArtifacts ? "LOADING" : "NOT_CONNECTED", data: null, error: null }));
  const [reloadKey, setReloadKey] = useState(0);
  const [details, setDetails] = useState(null);
  const packages = snapshot?.data?.items || [];
  const counts = useMemo(() => {
    const approved = packages.filter((item) => item.status === "APPROVED" && item.approved === true).length;
    const required = packages.filter((item) => item.required === true).length;
    const unapproved = packages.length - approved;
    return { approved, required, unapproved, optional: packages.filter((item) => item.required === false).length };
  }, [packages]);
  const approvalRate = packages.length ? Math.round((counts.approved / packages.length) * 100) : 0;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (mobileCatalogUnavailable) {
      setSnapshot({ state: "UNSUPPORTED", connection: "NO_MOBILE_PACKAGE_TEMPLATE_CONTRACT", data: null, error: null });
      return () => { active = false; controller.abort(); };
    }
    if (typeof readAdapter?.getPackageArtifacts !== "function") {
      setSnapshot({ state: "NOT_CONNECTED", connection: "NOT_CONNECTED", data: null, error: null });
      return () => { active = false; controller.abort(); };
    }
    setSnapshot({ state: "LOADING", connection: "SAME_ORIGIN_WORKER_API", data: null, error: null });
    readAdapter.getPackageArtifacts({ runtimeTemplate, signal: controller.signal }).then((next) => {
      if (active) setSnapshot(next);
    }).catch((error) => {
      if (active) setSnapshot({ state: "ERROR", connection: "SAME_ORIGIN_WORKER_API", data: null, error: { status: error?.status || null } });
    });
    return () => { active = false; controller.abort(); };
  }, [mobileCatalogUnavailable, readAdapter, runtimeTemplate, reloadKey]);

  useEffect(() => {
    if (!details) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setDetails(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [details]);

  const copyPackageId = async (item) => {
    try {
      await navigator.clipboard.writeText(item.packageId);
      onNotify?.(`已复制套餐标识：${item.packageId}`);
    } catch {
      onNotify?.("复制失败，请检查浏览器剪贴板权限。", "error");
    }
  };

  const loading = snapshot?.state === "LOADING";
  const failed = snapshot?.state === "ERROR" || snapshot?.state === "NOT_CONNECTED" || snapshot?.state === "INVALID_RESPONSE";
  const empty = snapshot?.state === "EMPTY";
  const unsupported = snapshot?.state === "UNSUPPORTED";

  return (
    <main className="package-config-page">
      <header className="package-config-header">
        <div>
          <h1>添加资源 — 软件Package配置</h1>
          <p>套餐目录来自 Worker 后端登记数据；本页只读，不执行安装或升级。</p>
        </div>
        <div className="package-config-steps"><span>① 基础信息</span><i /><b>② Agent与运行配置</b></div>
        <Button icon={ArrowLeft} onClick={onBack}>返回上一步</Button>
      </header>

      <section className="package-config-panel">
        <div className="package-config-heading"><h2>运行配置</h2><span>{unsupported ? "Worker 后端尚未登记移动端套餐模板" : "展示当前 Worker 后端的真实套餐目录"}</span></div>
        <div className="package-config-options">
          <div className="package-config-option">
            <strong>运行方案模板</strong>
            <select value={runtimeTemplate} disabled aria-label="运行方案模板">
              <option value={runtimeTemplate}>{runtimeTemplate || "移动端套餐模板未配置"}</option>
            </select>
            <small>{unsupported ? "未回退读取 VPS 套餐目录" : "模板由 Worker API 查询参数限定"}</small>
          </div>
          {[
            ["套餐数", packages.length],
            ["必需依赖", counts.required],
            ["已批准", counts.approved],
            ["未批准", counts.unapproved],
          ].map(([label, value]) => (
            <div className="package-config-option" key={label}>
              <span><strong>{label}</strong><b>{loading || failed || unsupported ? "—" : value}</b></span>
              <small>{unsupported ? "没有移动端套餐契约" : loading ? "正在读取后端目录" : failed ? "尚未取得真实数据" : "Worker 套餐登记目录"}</small>
              <em>{loading ? "读取中" : failed || unsupported ? "不可用" : "真实只读数据"}</em>
            </div>
          ))}
        </div>
      </section>

      <div className="package-config-main">
        <section className="package-config-panel package-config-table-panel">
          <div className="package-config-heading">
            <h2>软件Package配置</h2>
            <span>{unsupported ? "移动端套餐目录未配置" : loading ? "正在读取真实套餐目录…" : failed ? "当前未取得 Worker API 套餐数据" : `Worker 套餐目录 · ${packages.length} 项`}</span>
          </div>
          <div className="package-config-table-scroll">
            <table>
              <thead><tr><th>#</th><th>软件名称</th><th>版本</th><th>目录状态</th><th>安装状态</th><th>耗时</th><th>操作</th></tr></thead>
              <tbody>
                {packages.map((item, index) => (
                  <tr key={item.packageId}>
                    <td>{index + 1}</td>
                    <td><span className="package-name"><PackageLogo name={item.name} />{item.name}</span></td>
                    <td>{item.version}</td>
                    <td><StatusPill value={statusLabels[item.status] || statusLabels.UNKNOWN} tone={statusTone[item.status] || "muted"} /></td>
                    <td title="当前套餐目录接口不提供目标机器安装状态">未读取</td>
                    <td>—</td>
                    <td><div className="package-row-actions"><button type="button" onClick={() => setDetails(item)}>查看详情</button><button type="button" onClick={() => copyPackageId(item)}>复制包ID</button></div></td>
                  </tr>
                ))}
                {!packages.length && (
                  <tr><td colSpan={7}>
                    <div className="package-catalog-state" role={failed ? "alert" : "status"}>
                      <span>{unsupported ? "Worker 后端尚未登记移动端套餐模板；当前未读取 VPS 套餐。" : loading ? "正在读取 Worker 套餐目录…" : failed ? errorMessage(snapshot) : empty ? "当前模板暂无套餐登记记录。" : "尚无可展示的真实套餐数据。"}</span>
                      {(failed || empty) && !unsupported && <button type="button" onClick={() => setReloadKey((value) => value + 1)}>重新读取</button>}
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="package-config-aside">
          <section className="package-config-panel">
            <h2>套餐目录审批情况</h2>
            <div className="package-progress-summary">
              <div className="package-progress-ring" style={{ "--ring-progress": `${approvalRate}%` }}><strong>{loading || failed || unsupported ? "—" : `${approvalRate}%`}</strong></div>
              <div className="package-stage-list">
                <span><i className="stage-成功" />已批准<b>{loading || failed || unsupported ? "—" : counts.approved}</b></span>
                <span><i className="stage-排队" />未批准<b>{loading || failed || unsupported ? "—" : counts.unapproved}</b></span>
                <span><i className="stage-验证中" />必需依赖<b>{loading || failed || unsupported ? "—" : counts.required}</b></span>
                <span><i className="stage-未开始" />可选依赖<b>{loading || failed || unsupported ? "—" : counts.optional}</b></span>
              </div>
            </div>
            <p>{loading ? "正在查询 Worker 套餐登记表" : failed ? "读取失败时不显示本地或模拟数据" : "审批统计来自后端套餐登记表，不代表机器安装进度。"}</p>
          </section>
          <section className="package-config-panel">
            <h2>目标机安装状态</h2>
            <p>当前只读套餐接口不包含 VPS 安装状态；本批次不会执行安装、升级或创建资源。</p>
            <div className="package-readonly-notice"><Info size={17} />安装状态需由目标 Worker Agent/Runtime 回报后再显示。</div>
          </section>
        </aside>
      </div>

      <footer className="package-config-footer">
        <span><Info size={17} />数据源：Worker Artifact Package Registry · 只读审查</span>
        <div><Button onClick={onBack}>上一步</Button><Button variant="primary" icon={CheckCircle} disabled title="B40 只做真实目录读取，不执行新增、安装或升级">本批次为只读</Button></div>
      </footer>

      {details && <div className="package-config-log-backdrop" onClick={() => setDetails(null)}>
        <section className="package-config-log" role="dialog" aria-modal="true" aria-labelledby="package-detail-title" onClick={(event) => event.stopPropagation()}>
          <header><div><small>WORKER API · READ ONLY</small><h2 id="package-detail-title">{details.name} 套餐详情</h2></div><button aria-label="关闭详情" onClick={() => setDetails(null)}><X size={20} /></button></header>
          <p><FileText size={17} />套餐标识：{details.packageId}</p>
          <p>版本：{details.version} · 架构：{details.architecture || "未提供"}</p>
          <p>模板：{details.runtimeTemplate} · 安装顺序：{details.installOrder ?? "未提供"}</p>
          <p>依赖：{details.required === true ? "必需" : details.required === false ? "可选" : "未提供"} · 审批：{details.approved === true ? "已批准" : details.approved === false ? "未批准" : "未提供"}</p>
          <p><Warning size={17} />详情仅含登记元数据；来源 URL、签名与安装命令不会传入页面状态。</p>
        </section>
      </div>}
    </main>
  );
}
