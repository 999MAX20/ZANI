import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

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
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The shared overlay keyboard contract needs one desktop browser run.",
  );
  await login(page);
  await navigateInsideApp(page, "/app/tasks");

  const trigger = page.locator('[data-testid="page-primary-action"]:visible');
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect
    .poll(() =>
      dialog.evaluate((element) => element.contains(document.activeElement)),
    )
    .toBe(true);

  await dialog.evaluate((element) => {
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
  await expect
    .poll(() =>
      dialog.evaluate((element) => element.contains(document.activeElement)),
    )
    .toBe(true);

  await expectNoSeriousOrCriticalViolations(page, "task-create-dialog");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
