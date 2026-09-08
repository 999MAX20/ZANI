import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_PASSWORD || "ZaniTest123!";
const ownerEmail = process.env.E2E_OWNER_EMAIL || "business_owner@example.com";

async function login(page: Page) {
  await page.goto("/login");
  await page.locator('form input[type="email"]').fill(ownerEmail);
  await page.locator('form input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/app\//);
}

async function openFirstServiceMenu(page: Page) {
  const row = page.locator('[data-testid="service-row"]:visible').first();
  await expect(row).toBeVisible();
  const trigger = row.getByTestId("row-actions-trigger");
  await trigger.click();
  const menu = page.getByTestId("action-menu");
  await expect(menu).toBeVisible();
  return { row, trigger, menu };
}

test("service row actions support keyboard, lifecycle and recoverable archive", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await login(page);
  await page.goto("/app/business/services");
  await expect(page.getByTestId("services-workspace-ready")).toBeVisible();

  let { trigger, menu } = await openFirstServiceMenu(page);
  await expect(menu.locator('[data-action-key="open"]')).toBeVisible();
  await page.keyboard.press("End");
  await expect(menu.locator('[role="menuitem"]:last-child')).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();

  ({ trigger, menu } = await openFirstServiceMenu(page));
  const activateItem = menu.locator('[data-action-key="activate"]');
  if (await activateItem.count()) {
    await activateItem.click();
    await expect(page.getByTestId("action-menu")).toBeHidden();
    ({ trigger, menu } = await openFirstServiceMenu(page));
  }
  await expect(menu.locator('[data-action-key="deactivate"]')).toBeVisible();
  await menu.locator('[data-action-key="deactivate"]').click();
  const deactivateDialog = page.getByRole("dialog");
  await expect(deactivateDialog).toBeVisible();
  await deactivateDialog.getByRole("button").last().click();

  ({ trigger, menu } = await openFirstServiceMenu(page));
  await expect(menu.locator('[data-action-key="activate"]')).toBeVisible();
  await expect(menu.locator('[data-action-key="archive"]')).toBeVisible();
  const serviceName = (await page.locator('[data-testid="service-row"]:visible').first().getByTestId("service-name").innerText()).trim();
  await menu.locator('[data-action-key="archive"]').click();
  const archiveDialog = page.getByRole("dialog");
  await expect(archiveDialog).toBeVisible();
  await archiveDialog.getByRole("button").last().click();
  await expect(page.locator('[data-testid="service-row"]', { hasText: serviceName })).toHaveCount(0);

  const archivedSelect = page.locator('select').filter({ has: page.locator('option[value="archived"]') });
  await archivedSelect.selectOption("archived");
  const archivedRow = page.locator('[data-testid="service-row"]:visible', { hasText: serviceName });
  await expect(archivedRow).toBeVisible();
  await archivedRow.getByTestId("row-actions-trigger").click();
  menu = page.getByTestId("action-menu");
  await expect(menu.locator('[data-action-key="restore"]')).toBeVisible();
  await expect(menu.locator('[data-action-key="archive"]')).toHaveCount(0);
  await menu.locator('[data-action-key="restore"]').click();
  await expect(archivedRow).toHaveCount(0);

  await archivedSelect.selectOption("");
  const restoredRow = page.locator('[data-testid="service-row"]:visible', { hasText: serviceName });
  await expect(restoredRow).toBeVisible();
  await restoredRow.getByTestId("row-actions-trigger").click();
  await expect(page.getByTestId("action-menu").locator('[data-action-key="activate"]')).toBeVisible();

  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical"),
  ).toEqual([]);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
    .toBeLessThanOrEqual(2);
  await testInfo.attach(`services-lifecycle-${testInfo.project.name}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});
