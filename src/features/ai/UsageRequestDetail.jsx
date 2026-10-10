import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";

const number = (value) => {
  if (value == null || value === "") return "未知";
  const parsed = typeof value === "string" ? Number(value.replace(/,/g, "")) : value;
  return Number.isFinite(parsed) ? new Intl.NumberFormat("zh-CN").format(parsed) : "未知";
};
const statusText = (value) => ({ SUCCESS: "成功", FAILED: "失败", ERROR: "失败", TIMEOUT: "超时", RETRIED: "重试中", RETRY_SUCCESS: "重试后成功" }[value] || value || "未知");
const sourceText = (value) => ({ VISUAL_QA_ONLY: "视觉样例", LOCAL_MOCK: "本地样例", INJECTED_READ_DTO: "接口读取", INJECTED_READ_TRANSPORT: "接口读取", NOT_CONNECTED: "尚未连接", UNKNOWN: "未知" }[value] || "待确认");

export function UsageRequestDetail({ record, detailState, onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector("button")?.focus();
    const handleKey = (event) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const targets = Array.from(dialogRef.current?.querySelectorAll('button, summary, a[href], input, select, [tabindex="0"]') || []);
      const first = targets[0], last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", handleKey); previous?.focus?.(); };
  }, []);
  const status = statusText(record.status);
  const failed = ["失败", "超时"].includes(status);
  const amount = record.cost == null ? "未知" : `$${record.cost.toFixed(4)}`;
  const attempts = Array.isArray(record.attempts) ? record.attempts : [];
  const fields = [["请求编号", record.id], ["任务编号", record.task], ["执行器编号", record.worker], ["运行编号", record.runtime]];
  return createPortal(<div className="usage-cost-preview usage-drawer-backdrop usage-process-backdrop" onClick={onClose}>
    <aside ref={dialogRef} className="usage-process-drawer" role="dialog" aria-modal="true" aria-labelledby="usage-detail-title" onClick={(event) => event.stopPropagation()}>
      <header className="usage-process-header"><div><small>用量与成本 · 请求记录</small><h2 id="usage-detail-title">请求详情</h2></div><button type="button" aria-label="关闭详情" onClick={onClose}><X size={22}/></button></header>
      <div className="usage-process-body">
        <div className="usage-process-identity"><h3>{record.model || "未知模型"}</h3><span className={`usage-process-status ${failed ? "is-failed" : status === "成功" || status === "重试后成功" ? "is-success" : ""}`}>{status}</span></div>
        <p className="usage-process-subtitle">{record.provider || "未知服务商"} · {record.time || "未知时间"}<small>时间使用协调世界时</small></p>
        <div className="usage-process-metrics"><div><span>本次费用</span><strong>{amount}</strong></div><div><span>响应耗时</span><strong>{record.latency || "未知"}</strong></div></div>
        <p className="usage-process-read-state" role="status">{detailState.status === "loading" ? "正在读取详情…" : detailState.status === "error" ? "详情读取失败，当前显示已有记录。" : detailState.status === "ready" ? "详情已更新" : ""}</p>
        <section aria-labelledby="usage-process-title"><h3 id="usage-process-title">调用过程</h3><ol className="usage-process-timeline">
          {attempts.length ? attempts.map((attempt, index) => <li key={index} className={/失败|超时/.test(statusText(attempt.status)) ? "is-failed" : ""}><div className="usage-process-step-title"><b>第 {index + 1} 次调用</b><span>{statusText(attempt.status)}</span></div><p>{attempt.provider || record.provider} / {attempt.model || record.model}</p><small>耗时 {attempt.latency || "未知"} · {attempt.tokens == null ? "用量未知" : `${number(attempt.tokens)} 令牌`}{attempt.cost != null && ` · ${attempt.cost}`}</small></li>) : <li><b>暂无调用尝试记录</b><p>当前记录尚未提供调用过程。</p></li>}
          <li><b>用量记录</b><div className="usage-process-token-row"><span>输入令牌 <strong>{number(record.input)}</strong></span><span>输出令牌 <strong>{number(record.output)}</strong></span></div></li>
          <li className={record.cost == null ? "is-pending" : ""}><b>费用记录</b><p>{record.cost == null ? "费用待确认" : `已知费用 ${amount}`} · {sourceText(record.source)}</p></li>
        </ol></section>
        <section className="usage-process-trace" aria-labelledby="usage-trace-title"><h3 id="usage-trace-title">追踪信息</h3><dl>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "未提供"}</dd></div>)}</dl><p>编号用于定位本次请求。</p></section>
      </div>
      <footer><button type="button" onClick={onClose}>关闭详情</button></footer>
    </aside>
  </div>, document.body);
}

