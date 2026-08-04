import { Buffer } from "node:buffer";

import { expect, test, type Locator, type Page } from "@playwright/test";

const password = process.env.E2E_PASSWORD || "ZaniTest123!";
const ownerEmail =
  process.env.E2E_OWNER_EMAIL || "business_owner@example.com";

const readySelectors: Record<string, string> = {
  "/app": '[data-testid="dashboard-workspace-ready"]',
  "/app/leads": '[data-testid="leads-workspace-ready"]',
  "/app/clients": '[data-testid="clients-workspace-ready"]',
  "/app/deals": '[data-testid="deals-workspace-ready"]',
};

async function waitForReady(page: Page, path: string) {
  await expect(page.locator(readySelectors[path]).first()).toBeVisible();
  await expect(page.locator('main [role="alert"]')).toHaveCount(0);
}

async function login(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('form input[type="email"]').first().fill(ownerEmail);
  await page.locator('form input[type="password"]').first().fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/app/);
  await waitForReady(page, "/app");
}

async function navigateInsideApp(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
  await expect(page).toHaveURL(new RegExp(`${path}/?$`));
  await waitForReady(page, path);
}

async function expectOverlayPreservesWorkspace(
  page: Page,
  path: string,
  opener: Locator,
) {
  await opener.click();
  await expect(page.getByTestId("crm-entity-drawer")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${path}/?$`));
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("crm-entity-drawer")).toHaveCount(0);
  await expect(page.locator(readySelectors[path])).toBeVisible();
}

test("desktop CRM lists keep full-width context and open entity overlays", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await login(page);

  await navigateInsideApp(page, "/app/leads");
  const leadsWorkspace = await page
    .locator(readySelectors["/app/leads"])
    .boundingBox();
  expect(leadsWorkspace?.width || 0).toBeGreaterThan(1630);
  const leadAction = page.getByTestId("lead-row-action-more").first();
  await expect(leadAction).toBeVisible();
  await expect(page.getByTestId("lead-row-action-open")).toHaveCount(0);
  await expectOverlayPreservesWorkspace(
    page,
    "/app/leads",
    leadAction.locator("xpath=../.."),
  );

  await navigateInsideApp(page, "/app/clients");
  const clientAction = page.getByTestId("client-row-action-open").first();
  await expect(clientAction).toBeVisible();
  await expectOverlayPreservesWorkspace(
    page,
    "/app/clients",
    clientAction.locator("xpath=ancestor::tr"),
  );

  await navigateInsideApp(page, "/app/deals");
  const dealAction = page.getByTestId("deal-card-action-open").first();
  await expect(dealAction).toBeVisible();
  await expectOverlayPreservesWorkspace(
    page,
    "/app/deals",
    dealAction.locator("xpath=ancestor::article"),
  );
});

test("canceling the attachment picker preserves CRM drawer context", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await login(page);

  for (const path of ["/app/leads", "/app/clients", "/app/deals"] as const) {
    await navigateInsideApp(page, path);
    const opener =
      path === "/app/leads"
        ? page
            .getByTestId("lead-row-action-more")
            .first()
            .locator("xpath=../..")
        : path === "/app/clients"
          ? page
              .getByTestId("client-row-action-open")
              .first()
              .locator("xpath=ancestor::tr")
          : page
              .getByTestId("deal-card-action-open")
              .first()
              .locator("xpath=ancestor::article");

    await opener.click();
    const drawer = page.getByTestId("crm-entity-drawer");
    await expect(drawer).toBeVisible();
    await drawer.getByTestId("crm-entity-tab-files").click();

    const tabs = drawer.getByTestId("crm-entity-tabs");
    const content = drawer.getByTestId("crm-entity-drawer-content");
    const pickerTrigger = drawer.getByTestId(
      "crm-attachment-picker-trigger",
    );
    const pickerInput = drawer.getByTestId("crm-attachment-input");
    await expect(tabs).toBeVisible();
    await expect(content).toBeVisible();
    await expect(pickerTrigger).toBeVisible();

    await drawer.evaluate((element) => {
      element.scrollTop = 500;
    });
    await pickerInput.dispatchEvent("cancel");

    await expect.poll(() => drawer.evaluate((element) => element.scrollTop)).toBe(0);
    await expect(tabs).toBeVisible();
    await expect(content).toBeVisible();
    await expect(pickerTrigger).toBeVisible();
    await expect(pickerTrigger).toBeFocused();

    const fixtureName = `attachment-${path.split("/").at(-1)}.txt`;
    await pickerInput.setInputFiles({
      name: fixtureName,
      mimeType: "text/plain",
      buffer: Buffer.from("drawer attachment fixture"),
    });
    await expect(content.getByText(fixtureName)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
  }
});

test("mobile CRM actions open the same entity overlay without page overflow", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");
  await login(page);

  for (const [path, actionTestId] of [
    ["/app/clients", "client-card-action-open"],
    ["/app/deals", "deal-card-action-open"],
  ] as const) {
    await navigateInsideApp(page, path);
    const action = page.getByTestId(actionTestId).first();
    await expect(action).toBeVisible();
    await action.click();
    await expect(page.getByTestId("crm-entity-drawer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("crm-entity-drawer")).toHaveCount(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
