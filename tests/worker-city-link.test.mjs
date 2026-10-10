import test from 'node:test';
import assert from 'node:assert/strict';
import { filterWorkerRowsByGeography, isStableWorkerResource, projectWorkerResourceLocation } from '../src/workerCityLink.js';

const idA = '9c8c2f8a-cc6a-4f1b-901d-8c81bc44ed21';
const idB = '9c8c2f8a-cc6a-4f1b-901d-8c81bc44ed22';
const row = (entityId, city, latitude = -6.2, longitude = 106.8) => ({ entityType: 'VPS_RESOURCE', entityId, countryCode: 'ID', city, latitude, longitude });
const rows = [row(idA, 'Jakarta'), row(idB, 'Jakarta'), row(null, 'Jakarta'), row('9c8c2f8a-cc6a-4f1b-901d-8c81bc44ed25', 'Surabaya')];

test('city scope matches country and normalized city, keeping duplicate names distinct by UUID', () => {
  const jakarta = filterWorkerRowsByGeography(rows, { view: 'city', countryCode: 'id', cityName: ' Jakarta ' });
  assert.equal(jakarta.length, 3);
  assert.deepEqual(jakarta.slice(0, 2).map((item) => item.entityId), [idA, idB]);
  assert.equal(filterWorkerRowsByGeography(rows, { view: 'country', countryCode: 'ID' }).length, 4);
  assert.equal(filterWorkerRowsByGeography(rows, { view: 'global' }).length, 4);
});

test('map placement requires canonical stable identity and exact valid resource coordinates', () => {
  assert.equal(isStableWorkerResource(rows[0]), true);
  assert.equal(isStableWorkerResource(rows[2]), false);
  assert.deepEqual(projectWorkerResourceLocation(rows[0], [-6.2, 106.8]), { x: 50, y: 50 });
  assert.deepEqual(projectWorkerResourceLocation({ ...rows[0], latitude: null }, [-6.2, 106.8]), { x: null, y: null });
  assert.deepEqual(projectWorkerResourceLocation(rows[2], [-6.2, 106.8]), { x: null, y: null });
  assert.deepEqual(projectWorkerResourceLocation(rows[0], null), { x: null, y: null });
});
