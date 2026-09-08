import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const password = process.env.E2E_PASSWORD || "ZaniTest123!";
const ownerEmail =
  process.env.E2E_OWNER_EMAIL || "business_owner@example.com";

const workspaceReadySelectors: Record<string, string> = {
  "/app/dashboard": '[data-testid="dashboard-workspace-ready"]',
  "/app/leads": '[data-testid="leads-workspace-ready"]',
  "/app/clients": '[data-testid="clients-workspace-ready"]',
  "/app/tasks": '[data-testid="tasks-workspace-ready"]',
  "/app/calendar": '[data-testid="calendar-workspace-ready"]',
  "/app/conversations":
    '[data-testid="inbox-priority-actions"], [data-testid="inbox-action-composer"]',
};

async function waitForWorkspaceReady(page: Page, path: string) {
  const readySelector = workspaceReadySelectors[path];
  expect(readySelector, `Missing workspace-ready selector for ${path}`).toBeTruthy();
  await expect(
    page.locator(readySelector).filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(
    page.locator('main [role="status"][aria-busy="true"]'),
  ).toHaveCount(0);
  await expect(page.locator('main [role="alert"]')).toHaveCount(0);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.getByRole("main").first().evaluate(async (main) => {
    const finiteAnimations = main
      .getAnimations()
      .filter(
        (animation) =>
          animation.effect?.getTiming().iterations !== Infinity,
      );
    await Promise.all(
      finiteAnimations.map((animation) =>
        animation.finished.catch(() => undefined),
      ),
    );
  });
  await expect
    .poll(() =>
      page
        .getByRole("main")
        .first()
        .evaluate((main) => Number(getComputedStyle(main).opacity)),
    )
    .toBe(1);
}

async function login(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('form input[type="email"]').first().fill(ownerEmail);
  await page.locator('form input[type="password"]').first().fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/app/);
  await expect(page.getByRole("main").first()).toBeVisible();
  await waitForWorkspaceReady(page, "/app/dashboard");
}

async function navigateInsideApp(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
  await expect(page).toHaveURL(
    new RegExp(
      path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    ),
  );
  await expect(page.getByRole("main").first()).toBeVisible();
  await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  await waitForWorkspaceReady(page, path);
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
    "/app/dashboard",
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

test("F-301 sidebar overlays the fixed workspace without compressing page content", async ({
  page,
}, testInfo) => {
  await login(page);
  const main = page.getByRole("main").first();

  if (testInfo.project.name !== "mobile-chromium") {
    const desktopSidebar = page.getByTestId("desktop-sidebar");
    await expect(desktopSidebar).toBeVisible();
    await expect(desktopSidebar.getByText("Zani", { exact: true })).toHaveCount(0);

    const workspaceBefore = await main.boundingBox();
    const sidebarBefore = await desktopSidebar.boundingBox();
    expect(workspaceBefore).toBeTruthy();
    expect(sidebarBefore).toBeTruthy();

    await desktopSidebar.hover();
    await expect
      .poll(async () => (await desktopSidebar.boundingBox())?.width)
      .toBeGreaterThan(sidebarBefore?.width ?? 0);

    const workspaceAfter = await main.boundingBox();
    expect(workspaceAfter?.x).toBeCloseTo(workspaceBefore?.x ?? 0, 0);
    expect(workspaceAfter?.width).toBeCloseTo(workspaceBefore?.width ?? 0, 0);

    await page.mouse.move(500, 100);
  }

  if (testInfo.project.name !== "mobile-chromium") {
    await page.setViewportSize({ width: 900, height: 960 });
  }
  const tabletWorkspaceBefore = await main.boundingBox();
  const menuTrigger = page.getByTestId("bottom-mobile-menu-trigger");
  await expect(menuTrigger).toBeVisible();
  await menuTrigger.click();

  const drawer = page.getByTestId("mobile-navigation-drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("Zani", { exact: true })).toHaveCount(0);

  const tabletWorkspaceAfter = await main.boundingBox();
  expect(tabletWorkspaceAfter?.x).toBeCloseTo(tabletWorkspaceBefore?.x ?? 0, 0);
  expect(tabletWorkspaceAfter?.width).toBeCloseTo(
    tabletWorkspaceBefore?.width ?? 0,
    0,
  );
  await expectNoHorizontalOverflow(page);
});

test("F-301 account navigation lives in the header and notifications remain prominent", async ({
  page,
}, testInfo) => {
  await login(page);

  const accountLink = page.getByTestId("header-account-link");
  await expect(accountLink).toBeVisible();
  await expect(accountLink).toHaveAttribute("href", "/app/account");
  await expect(accountLink).toHaveAccessibleName("Мой аккаунт");
  const accountDetails = page.getByTestId("header-account-details");
  if (testInfo.project.name === "desktop-chromium") {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await expect(accountDetails).toBeVisible();
  } else {
    await expect(accountDetails).toBeHidden();
  }

  const notificationsTrigger = page.getByTestId("header-notifications-trigger");
  await expect(notificationsTrigger).toBeVisible();
  await expect(notificationsTrigger).toHaveAccessibleName("Уведомления");
  const bell = notificationsTrigger.locator("svg");
  await expect(bell).toHaveCount(1);
  const bellBox = await bell.boundingBox();
  expect(bellBox?.width).toBeGreaterThanOrEqual(23);
  expect(bellBox?.height).toBeGreaterThanOrEqual(23);

  if (testInfo.project.name === "mobile-chromium") {
    await page.getByTestId("bottom-mobile-menu-trigger").click();
    const drawer = page.getByTestId("mobile-navigation-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('a[href="/app/account"]')).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
  } else {
    await expect(
      page.getByTestId("desktop-sidebar").locator('a[href="/app/account"]'),
    ).toHaveCount(0);
  }

  await expectNoHorizontalOverflow(page);
  await accountLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app\/account(?:[?#].*)?$/);
});

test("F-301 page header secondary actions remain keyboard reachable", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "The page header filters are intentionally hidden below the tablet breakpoint.",
  );
  await login(page);
  await navigateInsideApp(page, "/app/leads");

  const trigger = page.getByTestId("page-secondary-action-0");
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("lead-saved-filters-panel")).toBeVisible();
  await expectNoSeriousOrCriticalViolations(page, "lead-saved-filters-panel");
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

test("F-301 primary CTA exposes readable peach hover, pressed and loading states", async ({
  page,
}) => {
  await login(page);
  await navigateInsideApp(page, "/app/tasks");

  const trigger = page.getByTestId("page-primary-action").filter({ visible: true }).first();
  await expect(trigger).toBeVisible();
  await expect
    .poll(() =>
      trigger.evaluate((element) => {
        const styles = getComputedStyle(element);
        return `${styles.backgroundColor}|${styles.color}`;
      }),
    )
    .toBe("rgb(245, 179, 122)|rgb(23, 18, 15)");

  await trigger.hover();
  await expect
    .poll(() => trigger.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe("rgb(238, 153, 90)");

  const box = await trigger.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await expect
    .poll(() => trigger.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe("rgb(223, 129, 63)");
  await page.mouse.up();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const title = dialog.getByLabel("Название");
  await title.fill("QA loading state");

  let releaseCreate!: () => void;
  const createHeld = new Promise<void>((resolve) => {
    releaseCreate = resolve;
  });
  await page.route("**/api/tasks/", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await createHeld;
    await route.abort();
  });

  const submit = dialog.locator('button[type="submit"]');
  await submit.click();
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveAttribute("aria-busy", "true");
  await expect(submit).toContainText("Загрузка");
  releaseCreate();
  await expect(submit).not.toHaveAttribute("aria-busy");
  await page.unroute("**/api/tasks/");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("F-301 supported locales keep task actions readable with long input text", async ({
  page,
}) => {
  await login(page);

  for (const [language, quickTaskLabel] of [
    ["ru", "Быстрая задача"],
    ["kk", "Жылдам тапсырма"],
    ["en", "Quick task"],
  ] as const) {
    await page.evaluate((nextLanguage) => {
      localStorage.setItem("ai_smb_language", nextLanguage);
    }, language);
    await page.goto("/app/tasks");
    await expect(page).toHaveURL(/\/app\/tasks/);
    await waitForWorkspaceReady(page, "/app/tasks");

    const trigger = page
      .getByRole("button", { name: quickTaskLabel })
      .filter({ visible: true })
      .first();
    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const title = dialog.locator("input").filter({ visible: true }).first();
    await expect(title).toBeVisible();
    await title.fill("Long customer follow-up title ".repeat(12));
    await expectNoHorizontalOverflow(page);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
});
