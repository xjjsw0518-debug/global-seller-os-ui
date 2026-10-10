import "./aiVisualFixtureProvider.css";
import { disableAiVisualFixtureMode, getAiVisualFixtureData, isAiVisualFixtureMode } from "./aiVisualFixtureRuntime.js";

export { disableAiVisualFixtureMode, getAiVisualFixtureData, isAiVisualFixtureMode } from "./aiVisualFixtureRuntime.js";

export function AiVisualFixtureNotice({ compact = false } = {}) {
  if (!isAiVisualFixtureMode()) return null;
  return <aside className={`ai-visual-fixture-notice${compact ? " is-compact" : ""}`} role="status" aria-label="本地视觉预览模式">
    <span>本地视觉预览 · 合成数据仅用于展示，不代表真实 API / DB 状态</span>
    <button type="button" onClick={disableAiVisualFixtureMode}>关闭视觉预览</button>
  </aside>;
}
