import { Check, WarningCircle, X, CircleNotch } from "@phosphor-icons/react";
export { FilterDropdown } from "./FilterDropdown.jsx";

export function StatusPill({ value, tone = "green" }) {
  return <span className={`status-pill ${tone}`}><i />{value}</span>;
}

export function Button({ children, variant = "secondary", icon: Icon, className = "", ...props }) {
  return <button className={`ui-button ${variant} ${className}`} {...props}>{Icon && <Icon size={17} />}{children}</button>;
}

export function IconButton({ children, className = "", ...props }) {
  return <button className={`icon-button ${className}`} {...props}>{children}</button>;
}

export function SectionCard({ children, className = "" }) {
  return <section className={`section-card ${className}`}>{children}</section>;
}

export function ProgressBar({ value = 0 }) {
  return <div className="progress-wrap"><span style={{ width: `${value}%` }} /><b>{value}%</b></div>;
}

export function StateBanner({ kind = "success", title, children, onClose }) {
  const Icon = kind === "success" ? Check : kind === "error" ? WarningCircle : X;
  return <div className={`state-banner ${kind}`}><Icon size={19} /><div><b>{title}</b>{children && <span>{children}</span>}</div>{onClose && <IconButton onClick={onClose}><X size={16} /></IconButton>}</div>;
}

export function LoadingState() {
  return <div className="center-state"><CircleNotch size={28} className="spin" /><b>正在加载资源</b><span>同步 Mock 数据中</span></div>;
}

export function EmptyState() {
  return <div className="center-state"><Check size={28} /><b>暂无匹配资源</b><span>调整筛选条件后重试</span></div>;
}

export function ErrorState({ onRetry }) {
  return <div className="center-state error-state"><WarningCircle size={28} /><b>资源加载失败</b><span>Mock 服务暂时不可用</span><Button variant="secondary" onClick={onRetry}>重试</Button></div>;
}
