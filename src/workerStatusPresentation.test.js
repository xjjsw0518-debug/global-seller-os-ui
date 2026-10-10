import test from "node:test";
import assert from "node:assert/strict";
import { workerStatusPresentation } from "./workerStatusPresentation.js";

test("runtime API status values map only to explicit Worker UI labels", () => {
  assert.deepEqual(workerStatusPresentation("RUNNING", "runtime"), { label: "运行中", tone: "green", known: true });
  assert.deepEqual(workerStatusPresentation("READY", "runtime"), { label: "已就绪", tone: "cyan", known: true });
  assert.deepEqual(workerStatusPresentation("OFFLINE", "runtime"), { label: "离线", tone: "muted", known: true });
  assert.deepEqual(workerStatusPresentation("FAILED", "runtime"), { label: "异常", tone: "danger", known: true });
  assert.deepEqual(workerStatusPresentation("PLANNED", "runtime"), { label: "未知状态：PLANNED", tone: "muted", known: false });
});
