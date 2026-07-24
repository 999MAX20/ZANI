import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const password = process.env.E2E_PASSWORD || "ZaniTest123!";
const ownerEmail =
  process.env.E2E_OWNER_EMAIL || "business_owner@example.com";

async function login(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('form input[type="email"]').first().fill(ownerEmail);
  await page.locator('form input[type="password"]').first().fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/app/);
  await expect(page.getByRole("main").first()).toBeVisible();
}

async function navigateInsideApp(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
  await expect(page).toHaveURL(
    new RegExp(
      path === "/app"
        ? "/app/?$"
        : path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    ),
  );
  await expect(page.getByRole("main").first()).toBeVisible();
  await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  await page.waitForTimeout(350);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ) - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

async function expectNoSeriousOrCriticalViolations(page: Page, context: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blockers = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  expect(
    blockers,
    `${context}\n${blockers
      .map(
        (violation) =>
          `${violation.id}: ${violation.help} (${violation.nodes.length})`,
      )
      .join("\n")}`,
  ).toEqual([]);
}

async function expectFocusInside(container: Locator) {
  await expect
    .poll(() =>
      container.evaluate((element) => element.contains(document.activeElement)),
    )
    .toBe(true);
}

async function expectForwardTabWrap(
  page: Page,
  container: Locator,
) {
  await container.evaluate((element) => {
    const focusable = Array.from(
      element.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ),
    ).filter(
      (candidate) =>
        candidate.getAttribute("aria-hidden") !== "true" &&
        candidate.getClientRects().length > 0,
    );
    focusable.at(-1)?.focus();
  });
  await page.keyboard.press("Tab");
  await expectFocusInside(container);
}

test("F-301 pilot workspaces remain responsive and have no serious or critical axe findings", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await login(page);

  for (const route of [
    "/app",
    "/app/leads",
    "/app/tasks",
    "/app/calendar",
    "/app/conversations",
  ]) {
    await navigateInsideApp(page, route);
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousOrCriticalViolations(page, route);
  }

  await testInfo.attach(`f301-${testInfo.project.name}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});

test("F-301 task dialog contains keyboard focus and returns it to its trigger", async ({
  page,
}) => {
  await login(page);
  await navigateInsideApp(page, "/app/tasks");

  const trigger = page.locator('[data-testid="page-primary-action"]:visible');
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expectFocusInside(dialog);

  const select = dialog.getByRole("combobox").first();
  await expect(select).toBeVisible();
  await select.focus();
  await page.keyboard.press("ArrowDown");
  await expect(select).toHaveAttribute("aria-expanded", "true");
  const firstActiveOption = await select.getAttribute("aria-activedescendant");
  expect(firstActiveOption).toBeTruthy();
  await page.keyboard.press("ArrowDown");
  await expect
    .poll(() => select.getAttribute("aria-activedescendant"))
    .not.toBe(firstActiveOption);
  await page.keyboard.press("Enter");
  await expect(select).toHaveAttribute("aria-expanded", "false");
  await expect(select).toBeFocused();

  await expectForwardTabWrap(page, dialog);

  await expectNoSeriousOrCriticalViolations(page, "task-create-dialog");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("F-301 mobile menu is a modal drawer and restores the exact visible trigger", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "This contract targets the mobile-only navigation triggers.",
  );
  await login(page);

  for (const triggerId of [
    "header-mobile-menu-trigger",
    "bottom-mobile-menu-trigger",
  ]) {
    const trigger = page.getByTestId(triggerId);
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await page.keyboard.press("Enter");

    const drawer = page.getByTestId("mobile-navigation-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute("role", "dialog");
    await expect(drawer).toHaveAttribute("aria-modal", "true");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expectFocusInside(drawer);
    await expectForwardTabWrap(page, drawer);
    await expectNoSeriousOrCriticalViolations(
      page,
      `mobile-navigation-${triggerId}`,
    );

    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
  }
});

test("F-301 header filters are exposed through the shared modal drawer contract", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "The page header filters are intentionally hidden below the tablet breakpoint.",
  );
  await login(page);
  await navigateInsideApp(page, "/app/tasks");

  const trigger = page.getByTestId("header-filter-trigger");
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await page.keyboard.press("Enter");

  const drawer = page.getByTestId("header-filter-drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveAttribute("role", "dialog");
  await expect(drawer).toHaveAttribute("aria-modal", "true");
  await expect(drawer).toHaveAttribute("aria-labelledby", /.+/);
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expectFocusInside(drawer);
  await expectForwardTabWrap(page, drawer);
  await expectNoSeriousOrCriticalViolations(page, "header-filter-drawer");

  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
});

test("F-301 conditionally unmounted CRM drawer restores focus to its opener", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "One desktop run proves the conditional-unmount focus restoration path.",
  );
  await login(page);
  await navigateInsideApp(page, "/app/clients");

  const trigger = page.getByTestId("client-row-action-open").first();
  await expect(trigger).toBeVisible();
  await trigger.focus();
  const clientId = Number(await trigger.getAttribute("data-client-id"));
  expect(clientId).toBeGreaterThan(0);
  await page.evaluate((id) => {
    window.history.pushState(
      {},
      "",
      `/app/clients?client=${id}&tab=tasks`,
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, clientId);

  const drawer = page.getByTestId("crm-entity-drawer");
  await expect(drawer).toBeVisible();
  await expectFocusInside(drawer);
  await expectForwardTabWrap(page, drawer);
  await expectNoSeriousOrCriticalViolations(page, "lead-crm-entity-drawer");

  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
