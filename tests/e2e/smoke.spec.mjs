import { expect, test } from "@playwright/test";

test("Global Seller OS loads without a blank screen", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const response = await page.goto("/", { waitUntil: "domcontentloaded" });

  expect(response?.ok()).toBeTruthy();
  await expect(page.locator("#root")).toBeVisible();
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.getByText("Global Seller OS", { exact: true }).first()).toBeVisible();
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page).toHaveTitle(/\S+/);
  expect(pageErrors).toEqual([]);
});

test("development status page loads and exposes live progress sections", async ({ page }) => {
  const response = await page.goto("/dev-status", { waitUntil: "networkidle" });
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole("heading", { name: "开发进度" })).toBeVisible();
  await expect(page.getByText("自动刷新：30秒")).toBeVisible();
  await expect(page.getByRole("heading", { name: "已完成" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "进行中" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "待执行" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "需要解决的问题" })).toBeVisible();
  await expect(page.getByText("NEXT_SAFE_UNIT", { exact: true })).toBeVisible();
});
