import { useMemo, useState } from "react";
import { ArrowsClockwise, CheckCircle, Copy, DownloadSimple, FileText, Info, X } from "@phosphor-icons/react";
import { Button, ProgressBar, StatusPill } from "./ui/index.jsx";
import { bulkProgressPreview } from "./mock/workerResources.js";
import { countryByCode, flagUrl } from "./mock/countries.js";
import { cityZh } from "./mock/localization.js";

const stages = ["待处理", "初始化", "安装中", "验证中", "成功", "失败"];
const progressByStage = { 待处理: 0, 初始化: 20, 安装中: 64, 验证中: 86, 成功: 100, 失败: 58 };

function scriptFor(row) {
  const args = `./workerctl install --resource ${row.name} --packages all`;
  return row.type === "手机RPA" ? `bash ${args}` : `powershell -ExecutionPolicy Bypass -Command "${args}"`;
}

export default function BulkProgress({ rows, onBack, onFinish, onNotify }) {
  const initialRows = useMemo(() => rows?.length ? rows.map((row, index) => {
    const stage = stages[index % stages.length];
    return { ...row, stage, progress: progressByStage[stage], reason: stage === "失败" ? "模拟：初始化超时，请查看日志后重试" : "" };
  }) : bulkProgressPreview, [rows]);
  const [items, setItems] = useState(initialRows);
  const [pageSize, setPageSize] = useState(100);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const counts = Object.fromEntries(stages.map((stage) => [stage, items.filter((row) => row.stage === stage).length]));
  const visible = items.slice((page - 1) * pageSize, page * pageSize);
  const totalProgress = Math.round(items.reduce((sum, row) => sum + row.progress, 0) / items.length);
  const retry = (name) => {
    setItems((current) => current.map((row) => row.name === name ? { ...row, stage: "初始化", progress: 20, reason: "" } : row));
    onNotify?.(`${name} 已重新加入预览队列`);
  };
  const copy = async (row) => {
    try { await navigator.clipboard.writeText(scriptFor(row)); onNotify?.("Zero-Touch 命令已复制"); }
    catch { onNotify?.("复制失败，请检查剪贴板权限", "error"); }
  };
  const download = (row) => {
    const url = URL.createObjectURL(new Blob([scriptFor(row) + "\n"], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${row.name}-zero-touch.${row.type === "手机RPA" ? "sh" : "ps1"}`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return <main className="bulk-progress-page">
    <header className="bulk-progress-header">
      <div><h1>批量导入进度</h1><p>PREVIEW_ONLY · 使用 Mock 状态演示资源开通流程，不会调用业务 API</p></div>
      <div><Button onClick={onBack}>返回导入</Button><Button variant="primary" onClick={onFinish}>完成</Button></div>
    </header>
    <div className="bulk-progress-kpis">
      {[["总数", items.length], ...stages.map((stage) => [stage, counts[stage]])].map(([label, count]) =>
        <div key={label} className="bulk-progress-kpi"><span>{label}</span><strong>{count}</strong></div>)}
    </div>
    <section className="bulk-progress-overall"><span>总体进度</span><ProgressBar value={totalProgress} /><small>{totalProgress}% · 前端状态预览</small></section>
    <section className="bulk-progress-table-card">
      <div className="bulk-progress-table-head"><h2>资源开通清单</h2><label>每页显示 <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={100}>100</option><option value={500}>500</option><option value={1000}>1000</option></select></label></div>
      <div className="bulk-progress-scroll"><table><thead><tr><th>资源</th><th>类型</th><th>国家 / 城市</th><th>阶段</th><th>总体进度</th><th>失败原因</th><th>操作</th></tr></thead><tbody>
        {visible.map((row) => <tr key={row.name}><td><b>{row.name}</b></td><td>{row.type}</td><td><span className="country-cell"><img className="flag" src={flagUrl(row.countryCode || "id")} alt="" loading="lazy" />{countryByCode[row.countryCode]?.chinese || row.country} / {cityZh(row.city)}</span></td><td><StatusPill value={row.stage} tone={row.stage === "失败" ? "danger" : row.stage === "成功" ? "green" : row.stage === "待处理" ? "muted" : "cyan"} /></td><td><ProgressBar value={row.progress} /></td><td className="bulk-progress-reason">{row.reason || "—"}</td><td><button onClick={() => setSelected(row)}>详情</button>{row.stage === "失败" && <button onClick={() => retry(row.name)}>重试</button>}</td></tr>)}
      </tbody></table></div>
      <div className="bulk-progress-table-foot"><span>第 {page} / {Math.max(1, Math.ceil(items.length / pageSize))} 页 · 共 {items.length} 条</span><div><button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>上一页</button><button disabled={page * pageSize >= items.length} onClick={() => setPage((current) => current + 1)}>下一页</button></div></div>
    </section>
    {selected && <div className="bulk-progress-drawer-backdrop" onClick={() => setSelected(null)}><aside className="bulk-progress-drawer" onClick={(event) => event.stopPropagation()}><header><div><small>资源开通详情</small><h2>{selected.name}</h2></div><button aria-label="关闭" onClick={() => setSelected(null)}><X size={20} /></button></header><div className="bulk-progress-drawer-body"><section><h3><Info size={18} />资源状态</h3><p>类型：{selected.type}</p><p>阶段：{items.find((row) => row.name === selected.name)?.stage}</p><p>国家 / 城市：{countryByCode[selected.countryCode]?.chinese || selected.country} / {cityZh(selected.city)}</p><p>失败原因：{items.find((row) => row.name === selected.name)?.reason || "无"}</p></section><section><h3><Copy size={18} />Zero-Touch Command</h3><code>{scriptFor(selected)}</code><div className="bulk-progress-drawer-actions"><Button icon={Copy} onClick={() => copy(selected)}>复制命令</Button><Button icon={DownloadSimple} onClick={() => download(selected)}>下载脚本</Button></div></section><section><h3><FileText size={18} />开通日志</h3><p>12:31:02 · 资源已加入前端预览队列</p><p>12:31:18 · {items.find((row) => row.name === selected.name)?.stage} · Mock 状态</p></section><Button icon={ArrowsClockwise} onClick={() => retry(selected.name)}>Retry / 重新初始化</Button></div></aside></div>}
  </main>;
}
