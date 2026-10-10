import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
export function UsageBudgetDialog({ amount, editable, onSave, onClose }) {
  const [draft, setDraft] = useState(amount == null ? "" : Number(amount).toFixed(2));
  const [error, setError] = useState("");
  const ref = useRef(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector("input")?.focus();
    const keydown = (event) => {
      if (event.key === "Escape") close.current();
      if (event.key !== "Tab") return;
      const items = Array.from(ref.current.querySelectorAll("button:not(:disabled),input:not(:disabled)"));
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown); previous?.focus?.(); };
  }, []);
  const submit = (event) => {
    event.preventDefault();
    const value = draft.trim(), parsed = Number(value);
    if (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isFinite(parsed) || parsed <= 0) { setError("请输入大于零的预算金额，最多保留两位小数。"); return; }
    try { onSave(parsed); } catch { setError("本地保存失败，请检查浏览器存储设置后重试。"); }
  };
  return createPortal(<div className="usage-budget-overlay" onClick={onClose}><section ref={ref} className="usage-budget-dialog" role="dialog" aria-modal="true" aria-labelledby="usage-budget-title" onClick={(event) => event.stopPropagation()}>
    <header><div><small>用量与成本</small><h2 id="usage-budget-title">设置月度预算</h2></div><button aria-label="关闭预算设置" onClick={onClose}><X size={20}/></button></header>
    <form onSubmit={submit}><p>预算周期：2026年10月 · 美元</p><label htmlFor="usage-budget-amount">月度预算金额</label><div className="usage-budget-input"><span>$</span><input id="usage-budget-amount" type="text" inputMode="decimal" value={draft} onChange={(event) => { setDraft(event.target.value); setError(""); }} aria-invalid={Boolean(error)} aria-describedby="usage-budget-help usage-budget-error" disabled={!editable}/></div>
    <small id="usage-budget-help">{editable ? "仅保存本地视觉样例预算，不写入真实服务。" : "预算写入尚未连接，当前只能查看预算。"}</small><p id="usage-budget-error" role="alert">{error}</p><footer><button type="button" onClick={onClose}>取消</button><button type="submit" disabled={!editable}>保存预算</button></footer></form>
  </section></div>, document.body);
}
