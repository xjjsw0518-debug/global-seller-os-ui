import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { cityZh } from "./mock/localization.js";

const source = await readFile(new URL("./workerVisualFixtureProvider.jsx", import.meta.url), "utf8");
const fixtureStart = source.indexOf("const HOME_STATUSES =");
const fixtureEnd = source.indexOf("\nfunction documentationAddress", fixtureStart);
assert.notEqual(fixtureStart, -1, "fixture builder exists");
assert.notEqual(fixtureEnd, -1, "fixture scope function end exists");
const fixtureSource = source.slice(fixtureStart, fixtureEnd).replace("export function getWorkerHomeFixtureScope", "function getWorkerHomeFixtureScope");
const fixtureFactory = new Function(`${fixtureSource}; return { workerHomeFixture, getWorkerHomeFixtureScope };`);
const { workerHomeFixture, getWorkerHomeFixtureScope: getScope } = fixtureFactory();

const fixture = {
  rows: [
    { id: "id-jkt-1", countryCode: "id", city: "Jakarta", fixtureStatus: "运行中", type: "VPS RPA", final: "已就绪", remote: "RDP" },
    { id: "id-jkt-2", countryCode: "id", city: "Jakarta", fixtureStatus: "离线", type: "手机RPA", final: "离线", remote: "未启用" },
    { id: "id-sub-1", countryCode: "id", city: "Surabaya", fixtureStatus: "空闲", type: "VPS RPA", final: "运行中", remote: "RDP" },
    { id: "us-la-1", countryCode: "us", city: "Los Angeles", fixtureStatus: "异常", type: "手机RPA", final: "异常", remote: "未启用" },
  ],
  countries: [
    { code: "id", name: "印度尼西亚", cities: [{ name: "Jakarta", count: 2 }, { name: "Surabaya", count: 1 }] },
    { code: "us", name: "美国", cities: [{ name: "Los Angeles", count: 1 }] },
  ],
  cities: [
    { countryCode: "id", countryName: "印度尼西亚", name: "Jakarta", count: 2 },
    { countryCode: "id", countryName: "印度尼西亚", name: "Surabaya", count: 1 },
    { countryCode: "us", countryName: "美国", name: "Los Angeles", count: 1 },
  ],
};

test("global, country, and city scopes keep map aggregates aligned with their resource rows", () => {
  for (const [view, code, city, expected] of [
    ["global", "id", "Jakarta", ["Jakarta:2", "Surabaya:1", "Los Angeles:1"]],
    ["country", "id", "Jakarta", ["Jakarta:2", "Surabaya:1"]],
    ["city", "id", "Jakarta", ["Jakarta:2"]],
  ]) {
    const scope = getScope(fixture, view, code, city);
    assert.equal(scope.cities.reduce((sum, item) => sum + item.count, 0), scope.rows.length);
    assert.deepEqual(scope.cities.map((item) => `${item.name}:${item.count}`), expected);
    assert.equal(scope.kpis.find((item) => item.label === "资源总数").value, scope.rows.length);
    assert.equal(new Set(scope.rows.map((row) => row.id)).size, scope.rows.length);
  }
});

test("city with no rows does not fall back to stale fixture totals", () => {
  const scope = getScope(fixture, "city", "id", "Not a city");
  assert.equal(scope.rows.length, 0);
  assert.deepEqual(scope.cities, []);
  assert.equal(scope.kpis.find((item) => item.label === "资源总数").value, 0);
});

test("full visual fixture resource, geography, map, provider, and state totals reconcile", () => {
  const rows = workerHomeFixture.rows;
  assert.equal(rows.length, 482);
  assert.equal(new Set(rows.map((row) => row.entityId)).size, rows.length);
  assert.equal(new Set(rows.map((row) => row.name)).size, rows.length);
  assert.equal(workerHomeFixture.countries.reduce((sum, country) => sum + country.total, 0), rows.length);
  assert.equal(workerHomeFixture.cities.reduce((sum, city) => sum + city.count, 0), rows.length);
  assert.equal(workerHomeFixture.mapNodes.reduce((sum, node) => sum + node.count, 0), rows.length);
  assert.equal(workerHomeFixture.providers.reduce((sum, provider) => sum + provider.count, 0), rows.length);
  for (const country of workerHomeFixture.countries) {
    const countryRows = rows.filter((row) => row.countryCode === country.code);
    const node = workerHomeFixture.mapNodes.find((item) => item.countryCode === country.code);
    assert.equal(countryRows.length, country.total, `${country.code} country total`);
    assert.equal(country.cities.reduce((sum, city) => sum + city.count, 0), countryRows.length, `${country.code} city total`);
    assert.equal(node.count, countryRows.length, `${country.code} map total`);
    for (const city of country.cities) {
      assert.equal(countryRows.filter((row) => row.city === city.name).length, city.count, `${country.code}/${city.name} city count`);
    }
    for (const [status, count] of Object.entries(country.statusCounts)) {
      assert.equal(countryRows.filter((row) => row.fixtureStatus === status).length, count, `${country.code}/${status} state count`);
    }
  }
  for (const [status, count] of Object.entries(workerHomeFixture.statusCounts)) {
    assert.equal(rows.filter((row) => row.fixtureStatus === status).length, count, `${status} global state count`);
  }
  assert.equal(workerHomeFixture.kpis.find((item) => item.label === "资源总数").value, rows.length);
});

test("every Worker home fixture city has a Chinese display label in the shared localization map", () => {
  const missing = [...new Set(workerHomeFixture.cities.map((city) => city.name))].filter((name) => cityZh(name) === name);
  assert.deepEqual(missing, []);
  assert.equal(cityZh("Rome"), "罗马");
  assert.equal(cityZh("Milan"), "米兰");
  assert.equal(cityZh("Naples"), "那不勒斯");
});
