import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  BUILTIN_PROVIDERS,
  PROVIDER_CREDENTIAL_ALIASES,
  RESOURCE_IMPORT_EXAMPLE_ROWS,
  RESOURCE_IMPORT_HEADERS,
  safeProviderUrl,
  validateAndSanitizeResourceImportRecord,
  validateResourceImportHeaders,
  validateResourceAddress,
} from "./workerBulkImportContract.js";

const validRecord = (overrides = {}) => ({
  vps_key: "TEST-IMPORT-1",
  display_name: "Test resource",
  resource_type: "VPS",
  resource_address: "vps.example.com:49268",
  country_code: "ID",
  country_name: "Indonesia",
  city: "Jakarta",
  environment: "TEST",
  purpose: "SYSTEM_MOCK",
  runtime_type: "BROWSER_RPA",
  provider_name: "AWS",
  ...overrides,
});

test("accepts IPv4, IPv4:port, domain, domain:port, and IPv6 forms without rewriting", () => {
  for (const address of ["103.10.10.11", "103.10.10.11:3389", "vps.example.com", "vps.example.com:49268", "2001:db8::1", "2001:db8::1:443", "[2001:db8::1]:443"]) {
    const result = validateResourceAddress(address);
    assert.equal(result.valid, true, address);
    assert.equal(result.displayValue, address);
  }
  assert.equal(validateResourceAddress("vps.example.com").port, null);
  assert.equal(validateResourceAddress("103.10.10.11").port, null);
});

test("rejects malformed hosts, ambiguous IPv6 ports, whitespace, and invalid ports", () => {
  for (const address of ["256.10.10.11", "vps..example.com", "-vps.example.com", "vps.example.com:0", "vps.example.com:65536", "vps.example.com:abc", "vps.example.com:", "2001:db8::1:zz", "  vps.example.com", "https://vps.example.com", "vps.example.com/path"]) {
    assert.equal(validateResourceAddress(address).valid, false, address);
  }
});

test("keeps the exact address form in its safe preview row", () => {
  for (const address of ["103.10.10.11", "103.10.10.11:3389", "vps.example.com", "vps.example.com:49268"]) {
    const row = validateAndSanitizeResourceImportRecord(validRecord({ resource_address: address }), 2);
    assert.deepEqual(row.__errors, []);
    assert.equal(row.resource_address, address);
  }
});

test("marks Mobile RPA as visible-but-deferred without reporting a functional pass", () => {
  const row = validateAndSanitizeResourceImportRecord(validRecord({ resource_type: "MOBILE_RPA", resource_address: "" }), 2);
  assert.equal(row.__deferred, true);
  assert.equal(row.__resourceType, "MOBILE_RPA");
});

test("resolves built-in provider links only to configured HTTPS official sites", () => {
  assert.ok(BUILTIN_PROVIDERS.length >= 7);
  assert.equal(safeProviderUrl("AWS", "https://untrusted.example/"), "https://aws.amazon.com/");
  assert.equal(safeProviderUrl("Custom Cloud", "javascript:alert(1)"), "");
  assert.equal(safeProviderUrl("Custom Cloud", "https://custom.example/"), "https://custom.example/");
});

test("credential inputs are masked out of the preview row and never retained as ordinary data", () => {
  const plaintext = randomBytes(24).toString("hex");
  const row = validateAndSanitizeResourceImportRecord(validRecord({
    provider_website_username: "test-user",
    provider_website_credential: plaintext,
  }), 2);
  assert.equal(row.__credentialProvided, true);
  assert.match(row.__credentialIndicator, /已填写/);
  assert.equal(row.provider_website_credential, "");
  assert.equal(row.provider_website_password, "");
  assert.equal(JSON.stringify(row).includes(plaintext), false);
  assert.deepEqual(PROVIDER_CREDENTIAL_ALIASES, ["provider_website_credential", "provider_website_password"]);
});

test("rejects ambiguous credential aliases and custom providers missing safe identity", () => {
  const firstSecret = randomBytes(24).toString("hex");
  const secondSecret = randomBytes(24).toString("hex");
  const row = validateAndSanitizeResourceImportRecord(validRecord({
    provider_name: "自定义示例云",
    provider_website_username: "test-user",
    provider_website_credential: firstSecret,
    provider_website_password: secondSecret,
  }), 2);
  assert.ok(row.__errors.includes("请只填写一个服务商凭据列"));
  assert.ok(row.__errors.includes("自定义服务商必须提供 provider_logo_url"));
  assert.ok(row.__errors.includes("自定义服务商必须提供有效的 HTTPS provider_website_url"));
  assert.equal(JSON.stringify(row).includes(firstSecret), false);
  assert.equal(JSON.stringify(row).includes(secondSecret), false);
});

test("includes all four address examples and provider account fields in the canonical template schema", () => {
  for (const value of ["103.10.10.11", "103.10.10.11:3389", "vps.example.com", "vps.example.com:49268"]) {
    assert.ok(RESOURCE_IMPORT_EXAMPLE_ROWS.some((row) => row.resource_address === value));
  }
  for (const key of ["resource_address", "provider_name", "provider_logo_url", "provider_website_url", "provider_website_username", "provider_website_credential"]) {
    assert.ok(RESOURCE_IMPORT_HEADERS.includes(key));
  }
});

test("accepts only the exact canonical template order or the documented credential alias", () => {
  assert.equal(validateResourceImportHeaders(RESOURCE_IMPORT_HEADERS).valid, true);
  const passwordAlias = RESOURCE_IMPORT_HEADERS.map((key) => key === "provider_website_credential" ? "provider_website_password" : key);
  assert.equal(validateResourceImportHeaders(passwordAlias).valid, true);
  const reordered = [...RESOURCE_IMPORT_HEADERS].reverse();
  assert.equal(validateResourceImportHeaders(reordered).valid, false);
  assert.equal(validateResourceImportHeaders([...RESOURCE_IMPORT_HEADERS, "rdp_password"]).valid, false);
});
