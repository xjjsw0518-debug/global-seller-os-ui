import test from "node:test";
import assert from "node:assert/strict";
import { getRoutingAdviceSelectKeyAction } from "./routingAdviceSelectKeyboard.js";

const state = { isOpen: true, activeIndex: 1, optionCount: 4, selectedIndex: 2 };

test("opens at the selected option or the directional edge", () => {
  assert.deepEqual(getRoutingAdviceSelectKeyAction("Enter", { ...state, isOpen: false }), { type: "open", activeIndex: 2 });
  assert.deepEqual(getRoutingAdviceSelectKeyAction("ArrowUp", { ...state, isOpen: false, selectedIndex: -1 }), { type: "open", activeIndex: 3 });
});

test("wraps arrow movement and supports Home and End", () => {
  assert.deepEqual(getRoutingAdviceSelectKeyAction("ArrowDown", { ...state, activeIndex: 3 }), { type: "move", activeIndex: 0 });
  assert.deepEqual(getRoutingAdviceSelectKeyAction("ArrowUp", { ...state, activeIndex: 0 }), { type: "move", activeIndex: 3 });
  assert.deepEqual(getRoutingAdviceSelectKeyAction("Home", state), { type: "move", activeIndex: 0 });
  assert.deepEqual(getRoutingAdviceSelectKeyAction("End", state), { type: "move", activeIndex: 3 });
});

test("Escape closes, Tab closes without trapping navigation, and Enter selects", () => {
  assert.deepEqual(getRoutingAdviceSelectKeyAction("Escape", state), { type: "close" });
  assert.deepEqual(getRoutingAdviceSelectKeyAction("Tab", state), { type: "close-and-tab" });
  assert.deepEqual(getRoutingAdviceSelectKeyAction("Enter", state), { type: "select", activeIndex: 1 });
});

test("unknown keys do not alter the menu state", () => {
  assert.deepEqual(getRoutingAdviceSelectKeyAction("a", state), { type: "none" });
  assert.deepEqual(getRoutingAdviceSelectKeyAction("Escape", { ...state, isOpen: false }), { type: "none" });
});
