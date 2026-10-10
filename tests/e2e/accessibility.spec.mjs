import fs from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const reportDirectory = path.join(process.cwd(), "axe-report");
const baselinePath = path.join(process.cwd(), "tests", "e2e", "accessibility-baseline.json");

function fingerprint(ruleId, node) {
  return `${ruleId}::${node.target.join(" >> ")}`;
}

function formatSummary(results, comparison) {
  const lines = [
    "# axe-core accessibility report",
    "",
    `- URL: ${results.url}`,
    `- Tested at: ${results.timestamp}`,
    "- Standard: WCAG 2.0 and 2.1 Level A/AA",
    `- Violations: ${results.violations.length}`,
    `- Violating nodes: ${comparison.observed.length}`,
    `- Baseline matches: ${comparison.baselineMatches.length}`,
    `- New violating nodes: ${comparison.unexpected.length}`,
    `- Resolved baseline entries: ${comparison.resolved.length}`,
    `- Passes: ${results.passes.length}`,
    `- Incomplete checks: ${results.incomplete.length}`,
    "",
  ];

  if (comparison.unexpected.length === 0) {
    lines.push("No accessibility violations outside the checked-in baseline were found.", "");
  } else {
    lines.push("## New violations", "");
    for (const item of comparison.unexpected) {
      lines.push(`- \`${item}\``);
    }
    lines.push("");
  }

  if (results.violations.length === 0) {
    lines.push("No accessibility violations were found in the tested page state.", "");
    return lines.join("\n");
  }

  lines.push("## Violations", "");
  for (const violation of results.violations) {
    lines.push(
      `### ${violation.id} (${violation.impact ?? "unknown"})`,
      "",
      violation.help,
      "",
      `Affected nodes: ${violation.nodes.length}`,
      "",
    );

    for (const node of violation.nodes) {
      lines.push(`- \`${node.target.join(" ")}\``);
    }
    lines.push("");
  }

  return lines.join("\n");
}

test("Global Seller OS smoke route has no basic WCAG A/AA violations", async ({ page }) => {
  const response = await page.goto("/", { waitUntil: "networkidle" });
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator("#root")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const baseline = JSON.parse(await fs.readFile(baselinePath, "utf8"));
  const baselineFingerprints = new Set(baseline.fingerprints);
  const observed = results.violations.flatMap((violation) =>
    violation.nodes.map((node) => fingerprint(violation.id, node)),
  );
  const observedFingerprints = new Set(observed);
  const comparison = {
    observed,
    baselineMatches: observed.filter((item) => baselineFingerprints.has(item)),
    unexpected: observed.filter((item) => !baselineFingerprints.has(item)),
    resolved: baseline.fingerprints.filter((item) => !observedFingerprints.has(item)),
  };

  await fs.mkdir(reportDirectory, { recursive: true });
  await Promise.all([
    fs.writeFile(
      path.join(reportDirectory, "results.json"),
      `${JSON.stringify(results, null, 2)}\n`,
    ),
    fs.writeFile(
      path.join(reportDirectory, "baseline-comparison.json"),
      `${JSON.stringify(comparison, null, 2)}\n`,
    ),
    fs.writeFile(
      path.join(reportDirectory, "summary.md"),
      `${formatSummary(results, comparison)}\n`,
    ),
    page.screenshot({ path: path.join(reportDirectory, "page.png"), fullPage: true }),
  ]);

  expect(
    comparison.unexpected,
    comparison.unexpected.join("\n") || "Expected no WCAG A/AA violations outside the baseline",
  ).toEqual([]);
});
