import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const OWNER_EMAIL = "ada@northwind.dev";

async function signIn(page: Page, email = OWNER_EMAIL) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill("Password123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
}

async function expectAccessible(page: Page, name: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const violations = results.violations
    .filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      targets: violation.nodes.flatMap((node) => node.target),
    }));
  expect(violations, `${name} has critical/serious axe violations`).toEqual([]);
}

async function openAtlasProject(page: Page) {
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: /Atlas API Platform/ }).first().click();
  await expect(page.getByRole("heading", { name: "Atlas API Platform" })).toBeVisible();
}

test("login has no critical or serious WCAG violations", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expectAccessible(page, "login");
});

test("core workspace pages have no critical or serious WCAG violations", async ({ page }) => {
  await signIn(page);

  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Ada/ })).toBeVisible();
  await expectAccessible(page, "dashboard");

  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await expectAccessible(page, "projects");

  await openAtlasProject(page);
  await expectAccessible(page, "project board");

  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
  await expectAccessible(page, "calendar");

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expectAccessible(page, "settings");
});

test("task drawer has no critical or serious WCAG violations and closes with Escape", async ({ page }) => {
  await signIn(page);
  await openAtlasProject(page);

  await page.getByRole("button", { name: /ATLAS-\d+/ }).first().click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("tablist")).toBeVisible();
  await expectAccessible(page, "task drawer");

  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
});

test("supports keyboard-only task creation, board movement, and drawer focus restoration", async ({ page }) => {
  const title = `Keyboard task ${Date.now()}`;

  await signIn(page);
  await openAtlasProject(page);

  const newTask = page.getByRole("button", { name: "New task" });
  await newTask.focus();
  await page.keyboard.press("Enter");

  const modal = page.getByRole("dialog", { name: "Create task" });
  await expect(modal).toBeVisible();
  const titleInput = modal.getByLabel("Title");
  await expect(titleInput).toBeFocused();

  await modal.getByRole("button", { name: "Close dialog" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(modal.getByRole("button", { name: "Create task" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(newTask).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(modal).toBeVisible();
  await expect(titleInput).toBeFocused();
  await page.keyboard.type(title);
  await page.keyboard.press("Enter");

  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);

  const card = page.getByRole("button", { name: new RegExp(title) });
  await expect(card).toBeVisible();
  await card.focus();
  await expect(card).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card).toBeFocused();

  await expect(card.locator('xpath=ancestor::*[@data-column-name][1]')).toHaveAttribute("data-column-name", "Backlog");
  const backlogCards = page.locator('[data-column-name="Backlog"]').getByRole("button", { name: /^ATLAS-\d+/ });
  const cardIndex = async () =>
    backlogCards.evaluateAll(
      (cards, taskTitle) => cards.findIndex((candidate) => candidate.textContent?.includes(taskTitle)),
      title,
    );
  const initialIndex = await cardIndex();

  const cardShell = card.locator("xpath=..");
  const moveHandle = cardShell.getByRole("button", { name: /Move ATLAS-/ });
  await moveHandle.focus();
  await page.keyboard.press("ArrowUp");
  await expect.poll(cardIndex).toBeLessThan(initialIndex);
  await page.keyboard.press("ArrowDown");
  await expect.poll(cardIndex).toBe(initialIndex);
});

test("announces form errors and respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");

  const signInButton = page.getByRole("button", { name: "Sign in", exact: true });
  const transitionDuration = await signInButton.evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Number.parseFloat(transitionDuration)).toBeLessThanOrEqual(0.01);

  await page.locator('input[type="email"]').fill(OWNER_EMAIL);
  await page.locator('input[type="password"]').fill("wrong-password");
  await signInButton.click();
  await expect(page.getByRole("alert")).toContainText("Invalid email or password");
});

test("supports keyboard navigation for tabs and menus", async ({ page }) => {
  await signIn(page);
  await openAtlasProject(page);

  const boardTab = page.getByRole("tab", { name: "Board" });
  await boardTab.focus();
  await page.keyboard.press("ArrowRight");
  const backlogTab = page.getByRole("tab", { name: /Backlog/ });
  await expect(backlogTab).toHaveAttribute("aria-selected", "true");
  await expect(backlogTab).toBeFocused();

  const accountMenu = page.getByRole("button", { name: "Account menu" });
  await accountMenu.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Account settings" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(accountMenu).toBeFocused();
});
