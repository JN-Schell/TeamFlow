import { expect, test } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("ada@northwind.dev");
  await page.locator('input[type="password"]').fill("Password123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
}

test("persists dashboard widget preferences and supports reset", async ({ browser, page }) => {
  await signIn(page);

  const customize = page.getByRole("button", { name: "Customize" });
  await customize.click();
  await page.getByRole("menuitem", { name: "Active sprints" }).click();
  await expect(page.getByRole("heading", { name: "Active sprints" })).toHaveCount(0);

  await page.reload();
  await expect(customize).toBeVisible();
  await expect(page.getByRole("heading", { name: "Active sprints" })).toHaveCount(0);

  const freshContext = await browser.newContext();
  try {
    const freshPage = await freshContext.newPage();
    await signIn(freshPage);
    await expect(freshPage.getByRole("heading", { name: "Active sprints" })).toHaveCount(0);
  } finally {
    await freshContext.close();
  }

  await customize.click();
  await page.getByRole("menuitem", { name: "Reset dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Active sprints" })).toBeVisible();
});
