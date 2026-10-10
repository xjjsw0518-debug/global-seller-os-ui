export function getRoutingAdviceSelectKeyAction(key, { isOpen, activeIndex, optionCount, selectedIndex }) {
  if (!isOpen) {
    if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") {
      const fallback = key === "ArrowUp" ? optionCount - 1 : 0;
      return { type: "open", activeIndex: selectedIndex >= 0 ? selectedIndex : fallback };
    }
    return { type: "none" };
  }
  if (key === "Escape") return { type: "close" };
  if (key === "Tab") return { type: "close-and-tab" };
  if (key === "Enter" || key === " ") return { type: "select", activeIndex };
  if (key === "ArrowDown") return { type: "move", activeIndex: (activeIndex + 1) % optionCount };
  if (key === "ArrowUp") return { type: "move", activeIndex: (activeIndex - 1 + optionCount) % optionCount };
  if (key === "Home") return { type: "move", activeIndex: 0 };
  if (key === "End") return { type: "move", activeIndex: Math.max(0, optionCount - 1) };
  return { type: "none" };
}
