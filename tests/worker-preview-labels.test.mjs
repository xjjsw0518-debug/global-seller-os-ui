import assert from "node:assert/strict";
import test from "node:test";
import { packageProfiles, globalResources, resources, globalMapNodes, countryPreviews } from "../src/mock/workerResources.js";
import { cityZh } from "../src/mock/localization.js";

test("every selectable RPA plan has a distinct nonempty package list", () => {
  assert.equal(Object.keys(packageProfiles).length, 10);
  for (const [plan, packages] of Object.entries(packageProfiles)) {
    assert.ok(packages.length > 0, `${plan} has no packages`);
    assert.equal(new Set(packages).size, packages.length, `${plan} repeats a package`);
    assert.ok(packages.includes("Worker Package"), `${plan} omits Worker Package`);
  }
  assert.ok(packageProfiles["自定义方案"].includes("自定义 RPA Adapter"));
  assert.ok(packageProfiles["Mobile RPA"].includes("Remote Device Gateway"));
  assert.ok(!packageProfiles["Mobile RPA"].some((name) => /usb|scrcpy|adb|rdp/i.test(name)));
});

test("all mock resource cities have Chinese display names", () => {
  for (const row of [...globalResources, ...resources]) {
    assert.match(cityZh(row.city), /[\u3400-\u9fff]/u, row.city);
  }
  assert.equal(cityZh("Los Angeles"), "洛杉矶");
  assert.equal(cityZh("Jakarta"), "雅加达");
});

test("every global status point belongs to an explicit nearby country anchor", () => {
  assert.ok(globalMapNodes.length > 20);
  for (const node of globalMapNodes) {
    const country = countryPreviews[node.countryCode];
    assert.ok(country, `unknown country ${node.countryCode}`);
    assert.ok(Math.abs(node.x - country.anchor[0]) <= 6, `${node.countryCode} x is scattered`);
    assert.ok(Math.abs(node.y - country.anchor[1]) <= 4, `${node.countryCode} y is scattered`);
    assert.ok(node.x > 0 && node.x < 100 && node.y > 0 && node.y < 100);
  }
});
