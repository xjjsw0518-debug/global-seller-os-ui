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
