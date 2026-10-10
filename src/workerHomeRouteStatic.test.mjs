import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("./App.jsx", import.meta.url), "utf8");

test("overview map returns to the canonical Worker resources global route", () => {
  assert.match(appSource, /const target = new URL\("\/ui-v2\/worker-resources", window\.location\.origin\);\s*if \(visualFixtureMode\) target\.searchParams\.set\("workerVisualFixture", "1"\);\s*window\.history\.pushState\(\{\}, "", `\$\{target\.pathname\}\$\{target\.search\}`\);/);
  assert.doesNotMatch(appSource, /new URL\("\/infrastructure\/workers", window\.location\.origin\)/);
});

test("map and resource table share the selected row detail entry", () => {
  assert.match(appSource, /<ResourceMap[\s\S]*?onOpen=\{openDetail\}[\s\S]*?<ResourceTable[\s\S]*?onDetail=\{openDetail\}/);
  assert.match(appSource, /const openDetail = \(row\) => \{[\s\S]*?setDrawer\(row\);[\s\S]*?searchParams\.set\("resource", row\.name\)/);
});
