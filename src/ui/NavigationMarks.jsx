import React from "react";

// Preview-only Global Seller OS identity: one visual language for the shell,
// without relying on third-party product marks for our own navigation.
export function BrandMark() {
  return <svg className="brand-mark" viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <defs><linearGradient id="seller-brand-gradient" x1="3" y1="3" x2="32" y2="32" gradientUnits="userSpaceOnUse"><stop stopColor="#45E8FA"/><stop offset="1" stopColor="#087CFF"/></linearGradient></defs>
    <path d="M18 3.5 30.8 10.8v14.4L18 32.5 5.2 25.2V10.8L18 3.5Z" fill="#082960" stroke="url(#seller-brand-gradient)" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M5.8 11.2 18 18l12.2-6.8M18 18v13.7" stroke="url(#seller-brand-gradient)" strokeWidth="1.9" strokeLinejoin="round"/>
    <path d="m12 7 12 6.8M11.5 15.1 18 18l6.5-2.9" stroke="#7AEEFF" strokeWidth="1.25" strokeLinecap="round" opacity=".9"/>
    <circle cx="30.8" cy="10.8" r="2.1" fill="#48E5FA"/>
  </svg>;
}

const art = {
  "首页": <><path d="m4.3 11 7.7-6.3 7.7 6.3v8H4.3v-8Z"/><path d="M9.5 19v-6.2h5V19"/><path d="M3 11.8 12 4l9 7.8"/></>,
  "产品中心": <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="M4.3 7.6 12 12l7.7-4.4M12 12v8.7"/></>,
  "任务中心": <><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2M8.4 11l1.4 1.4 2.4-2.7M8.5 16h7"/></>,
  "客户线索": <><circle cx="9" cy="8" r="2.5"/><circle cx="17.3" cy="9" r="2"/><path d="M3.5 19c.2-3.2 2.3-5 5.5-5s5.3 1.8 5.5 5M14.6 14.3c3.3-.3 5.6 1.5 5.9 4.7"/></>,
  "合同管理中心": <><path d="M6 3.5h8l4 4V20H6V3.5Z"/><path d="M14 3.5v4h4M9 11h6M9 14h5"/><path d="m12.5 18.2 5.5-5.5 1.7 1.7-5.5 5.5-2.4.7.7-2.4Z"/></>,
  "客服中心": <><path d="M4.6 13v-2a7.4 7.4 0 0 1 14.8 0v2M5.4 13h1.3v5H5.4A2.4 2.4 0 0 1 3 15.6v-.2A2.4 2.4 0 0 1 5.4 13ZM18.6 13h-1.3v5h1.3a2.4 2.4 0 0 0 2.4-2.4v-.2a2.4 2.4 0 0 0-2.4-2.4Z"/><path d="M17.2 19c-1.1 1.5-2.9 2.2-5.2 2.2h-1.5"/></>,
  "AI智能模型中心": <><circle cx="12" cy="12" r="3"/><circle cx="5" cy="5" r="1.6"/><circle cx="19" cy="5" r="1.6"/><circle cx="5" cy="19" r="1.6"/><circle cx="19" cy="19" r="1.6"/><path d="M7 7 9.9 9.9M17 7l-2.9 2.9M7 17l2.9-2.9M17 17l-2.9-2.9"/></>,
  "Worker资源中心": <><path d="m12 2.8 8 4.4-8 4.4-8-4.4 8-4.4ZM4 12l8 4.5 8-4.5M4 16.5l8 4.5 8-4.5"/><path d="m4 7.2 8 4.4 8-4.4"/></>,
  "数据分析": <><path d="M4 19.5h16M6 16v-4M11 16V9M16 16v-6"/><path d="m4.5 9 5-4 4 3 6-4"/><circle cx="19.5" cy="4" r="1"/></>,
  "系统设置": <><circle cx="12" cy="12" r="3.1"/><path d="m10 3.4.5 1.7a7 7 0 0 1 3 0l.5-1.7 2.6 1.1-.8 1.6a7 7 0 0 1 2.1 2.1l1.6-.8 1.1 2.6-1.7.5a7 7 0 0 1 0 3l1.7.5-1.1 2.6-1.6-.8a7 7 0 0 1-2.1 2.1l.8 1.6-2.6 1.1-.5-1.7a7 7 0 0 1-3 0l-.5 1.7-2.6-1.1.8-1.6a7 7 0 0 1-2.1-2.1l-1.6.8-1.1-2.6 1.7-.5a7 7 0 0 1 0-3l-1.7-.5 1.1-2.6 1.6.8a7 7 0 0 1 2.1-2.1l-.8-1.6L10 3.4Z"/></>,
};

export function NavigationMark({ name }) {
  return <svg className="nav-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{art[name] || art["产品中心"]}</svg>;
}
