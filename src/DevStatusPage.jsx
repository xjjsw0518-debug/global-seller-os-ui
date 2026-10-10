import { useEffect, useState } from "react";
import "./dev-status.css";

const initialStatus = {
  overall_status: "RUNNING",
  current_step: "Step 13 /dev-status 手机实时进度页",
  last_updated: "2026-10-10T09:30:00Z",
  auto_refresh_seconds: 30,
  latest_actions_run: { name: "GSO Gate #22", url: "https://github.com/xjjsw0518-debug/global-seller-os-ui/actions/runs/38041336033", status: "SUCCESS" },
  runner: "ser603198648259",
  completed: [
    "Build Gate", "dependency-cruiser Gate", "Knip Gate", "Playwright Smoke Gate",
    "BackstopJS Visual Gate", "axe-core Accessibility Gate", "Evidence Template Gate",
    "Step 10 Evidence Standard", "Step 11 Failure Handling Standard", "Step 12 Development Entry Standard",
  ].map((name, index) => ({ id: `gate-${index + 1}`, name, status: "PASS", owner: "GSO Automation", evidence: "已合并并有 Actions artifact", next_step: "保持基线" })),
  in_progress: [{ id: "step-13", name: "Step 13 /dev-status 手机实时进度页", status: "RUNNING", owner: "GSO Automation", evidence: "当前 PR / Actions run", next_step: "完成主分支验证" }],
  todo: [{ id: "step-14", name: "Step 14 总交接文件", status: "TODO", owner: "GSO Automation", evidence: "待创建", next_step: "完成 Step 13 后建立" }],
  issues_to_resolve: [{ id: "issue-none", name: "当前无阻塞", status: "CLEAR", owner: "GSO Automation", evidence: "无", next_step: "继续执行" }],
  next_safe_unit: "Step 14 总交接文件",
};

function Item({ item }) {
  return <li className="dev-status-item"><div><strong>{item.id}</strong><span className="dev-status-name">{item.name}</span><span className={`dev-status-pill status-${String(item.status).toLowerCase()}`}>{item.status}</span></div><dl><dt>负责人</dt><dd>{item.owner}</dd><dt>证据</dt><dd>{item.evidence}</dd><dt>下一步</dt><dd>{item.next_step}</dd></dl></li>;
}

function Section({ title, items }) {
  return <section className="dev-status-section"><h2>{title}<span>{items.length}</span></h2><ul>{items.map((item) => <Item key={item.id} item={item} />)}</ul></section>;
}

export default function DevStatusPage() {
  const [data, setData] = useState(initialStatus);
  const [loadError, setLoadError] = useState(false);
  const refresh = async () => {
    try {
      const response = await fetch("/dev-status.json", { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const next = await response.json();
      setData({ ...initialStatus, ...next });
      setLoadError(false);
    } catch { setLoadError(true); }
  };
  useEffect(() => { refresh(); const timer = window.setInterval(refresh, 30000); return () => window.clearInterval(timer); }, []);
  const run = data.latest_actions_run || {};
  return <main className="dev-status-page"><header className="dev-status-header"><p className="dev-status-kicker">GLOBAL SELLER OS · AUTOMATION</p><h1>开发进度</h1><p className="dev-status-subtitle">手机浏览器实时查看 · 自动刷新：30秒</p>{loadError && <p className="dev-status-error" role="alert">状态数据读取失败</p>}<div className="dev-status-summary"><div><span>当前总状态</span><strong>{data.overall_status}</strong></div><div><span>当前 Step</span><strong>{data.current_step}</strong></div><div><span>最新 GitHub Actions Run</span><a href={run.url}>{run.name || "未提供"}</a></div><div><span>Runner</span><strong>{data.runner || "未提供"}</strong></div><div><span>最后更新时间</span><strong>{data.last_updated || "未提供"}</strong></div></div></header><div className="dev-status-grid"><Section title="已完成" items={data.completed || []} /><Section title="进行中" items={data.in_progress || []} /><Section title="待执行" items={data.todo || []} /><Section title="需要解决的问题" items={data.issues_to_resolve || []} /></div><footer className="dev-status-next"><span>NEXT_SAFE_UNIT</span><strong>{data.next_safe_unit || "未提供"}</strong></footer></main>;
}
