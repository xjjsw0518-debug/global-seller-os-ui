import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { providerLogoAssets, providerLogoCatalog, resolveProviderLogoName } from "./modelLogoContract.js";

test("provider selection and Base URL edits clear stale individual connection checks", async () => {
  const source = await readFile(new URL("./AddModelPage.jsx", import.meta.url), "utf8");
  const providerHandler = source.match(/<AccessProviderPicker[^\n]+onChange=\{\(value\)=>\{([^\n]+?)\}\}\/>/);
  const baseUrlHandler = source.match(/aria-label="Base URL"[^\n]+onChange=\{\(event\)=>\{([^\n]+?)\}\}/);
  for (const handler of [providerHandler, baseUrlHandler]) {
    assert.ok(handler, "source handler is present");
    assert.match(handler[1], /setConnectionHealth\("UNTESTED"\)/);
    assert.match(handler[1], /setConnectionChecks\(\[\]\)/);
    assert.match(handler[1], /setTestResult\(null\)/);
  }
});

test("model vendor catalog uses canonical display names and the shared logo resolver", () => {
  assert.equal(resolveProviderLogoName("OPENAI"), "OpenAI");
  assert.equal(resolveProviderLogoName("DEEPSEEK"), "DeepSeek");
  assert.equal(resolveProviderLogoName("DOUBAO"), "Doubao");
  assert.equal(resolveProviderLogoName("CUSTOM", "CUSTOM Provider (SYNTHETIC)"), "CUSTOM");
  assert.ok(providerLogoAssets.OpenAI);
  assert.ok(providerLogoAssets.DeepSeek);
  assert.equal(providerLogoCatalog.Other.kind, "generic-provider-fallback");
});

test("locked vendor cards and More drawer preserve committed selection and live discovery", async () => {
  const source = await readFile(new URL("./AddModelPage.jsx", import.meta.url), "utf8");
  for (const [pattern,message] of [
    [/const visibleVendors = MODEL_VENDOR_CATALOG\.filter\(\(vendor\) => VENDOR_TILES\.includes\(vendor\.id\)\)/,"Main vendor tiles stay bounded"],
    [/aria-pressed=\{form\.modelVendor===vendor\.id\}/,"Pressed state follows committed vendor"],
    [/setVendorId\(vendor\.id\)/,"Main selection updates vendor state"],
    [/showMoreVendors && <section className="add-page-card model-more-panel"/,"More drawer opens only on demand"],
    [/const confirmMoreSelection = \(\) =>/,"Drawer has explicit commit"],
    [/const cancelMoreVendors = \(\) => setShowMoreVendors\(false\)/,"Cancel closes drawer without committing"],
    [/onClick=\{cancelMoreVendors\}/,"Cancel is wired"],
    [/onClick=\{confirmMoreSelection\}/,"Confirm is wired"],
    [/const moreSelectedModel = availableMoreModels\.find/,"Drawer includes server discovered models"],
    [/hasAuthoritativeModelCatalog \? matchedLiveVendorModels/,"Authoritative discovery replaces local candidates"],
    [/setCategoryFilter\("全部"\);setCapabilityFilter\("全部"\);setModalityFilter\("全部"\);setContextFilter\("全部"\)/,"Changing vendor clears old filters"],
    [/model-custom-access-pane/,"Custom identity has its own drawer pane"],
  ]) assert.ok(pattern.test(source),message);
});


test("obsolete connection failures cannot overwrite edited connection state", async () => {
  const source = await readFile(new URL("./AddModelPage.jsx", import.meta.url), "utf8");
  const handler = source.slice(source.indexOf("const runConnectionHealthCheck ="), source.indexOf("const persistConfiguration ="));
  const failure = handler.slice(handler.lastIndexOf("} catch (error) {"));
  assert.match(failure, /if \(testedFingerprint !== connectionFingerprint.current\) return;/);
  assert.ok(failure.indexOf("testedFingerprint !== connectionFingerprint.current") < failure.indexOf("setConnectionHealth"));
  assert.match(failure, /finally \{ setBusy\(""\); \}/);
});
