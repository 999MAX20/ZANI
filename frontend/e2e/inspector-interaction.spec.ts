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

test("business editors open as focus-trapped modals and return focus", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop business modal contract runs once.");
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1742, height: 900 });
  await login(page);

  await page.goto("/app/business/services");
  await expect(page.getByTestId("services-workspace-ready")).toBeVisible();

  const serviceRow = page.locator('[data-testid="service-row"]:visible').first();
  await serviceRow.focus();
  await serviceRow.press("Space");
  const serviceModal = page.getByTestId("service-edit-modal");
  await expect(serviceModal).toBeVisible();
  await expect(serviceModal.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(serviceModal).toBeHidden();
  await expect(serviceRow).toBeFocused();

  await serviceRow.press("Enter");
  await expect(serviceModal).toBeVisible();

  const serviceName = serviceModal.locator("input").first();
  const originalName = await serviceName.inputValue();
  await serviceName.fill(`${originalName} keyboard draft`);
  await page.keyboard.press("Escape");

  const discardDialog = page.getByRole("dialog").last();
  await expect(discardDialog).toBeVisible();
  await discardDialog.getByRole("button", { name: /Cancel|Отмена|Бас тарту/i }).click();
  await expect(serviceModal).toBeVisible();
  await expect(serviceName).toHaveValue(`${originalName} keyboard draft`);

  await page.keyboard.press("Escape");
  await expect(discardDialog).toBeVisible();
  await discardDialog.getByRole("button", { name: /Discard changes|Отменить изменения|Өзгерістерден бас тарту/i }).click();
  await expect(serviceModal).toBeHidden();
  await expect(serviceRow).toBeFocused();

  await page.goto("/app/business/resources");
  await expect(page.getByTestId("resources-workspace-ready")).toBeVisible();

  const resourceRow = page.locator('[data-testid="resource-row"]:visible').first();
  await resourceRow.focus();
  await resourceRow.press("Enter");
  const resourceModal = page.getByTestId("resource-edit-modal");
  await expect(resourceModal).toBeVisible();
  await expect(resourceModal.locator(":focus")).toHaveCount(1);
});

test("business modal is contained and restores focus on tablet and mobile", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop-chromium", "Responsive modal sizing is covered by tablet and mobile projects.");
  test.setTimeout(60_000);
  await login(page);
  await page.goto("/app/business/services");
  await expect(page.getByTestId("services-workspace-ready")).toBeVisible();

  const serviceRow = page.locator('[data-testid="service-row"]:visible').first();
  await serviceRow.focus();
  await serviceRow.press("Enter");

  const modal = page.getByTestId("service-edit-modal");
  await expect(modal).toBeVisible();
  const modalBox = await modal.boundingBox();
  expect(modalBox).not.toBeNull();
  expect(modalBox!.width).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  await expect(modal.locator(":focus")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect(serviceRow).toBeFocused();
});

test("lead list exposes a native keyboard opening control", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop lead table owns this control.");
  test.setTimeout(60_000);
  await login(page);
  await page.goto("/app/leads");
  await expect(page.getByTestId("leads-workspace-ready")).toBeVisible();

  const openLead = page.getByTestId("lead-row-keyboard-open").first();
  await openLead.focus();
  await openLead.press("Enter");

  const drawer = page.getByTestId("crm-entity-drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(openLead).toBeFocused();
});
