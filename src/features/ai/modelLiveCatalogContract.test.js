import test from "node:test";
import assert from "node:assert/strict";
import { liveVendorModelRows } from "./modelLiveCatalogContract.js";
const vendor={id:"DEEPSEEK",models:[["known","Known","文本","128K",["文本"]]]};
test("explicit matching provider directory includes new model IDs absent from local candidates",()=>{
  const rows=liveVendorModelRows(vendor,[{id:"known",name:"Known"},{id:"new-id",name:"New"}],{modelVendor:"DEEPSEEK"});
  assert.equal(rows.length,2);assert.deepEqual(rows[1],["new-id","New","服务商实时目录","未知",[]]);
});
test("unassigned aggregator directory cannot assign unknown models to an official vendor",()=>{
  assert.equal(liveVendorModelRows(vendor,[{id:"known"},{id:"unknown"}],{}).length,1);
  assert.equal(liveVendorModelRows(vendor,[{id:"known",modelVendor:"OPENAI"}],{modelVendor:"DEEPSEEK"}).length,0);
});
test("custom identity can browse the chosen provider complete directory without claiming official vendor metadata",()=>{
  assert.deepEqual(liveVendorModelRows({id:"CUSTOM",models:[]},[{id:"private-id"}],{id:"provider"}),[["private-id","private-id","服务商实时目录","未知",[]]]);
});
