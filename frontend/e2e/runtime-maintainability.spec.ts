import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_PASSWORD || "ZaniTest123!";
const ownerEmail =
  process.env.E2E_OWNER_EMAIL || "business_owner@example.com";

type ApiRequestMetric = {
  method: string;
  url: string;
  startedAt: number;
};

const routeRequestBudgets: Record<string, number> = {
  "/app/leads": 10,
  "/app/clients": 4,
  "/app/deals": 4,
  "/app/tasks": 9,
  "/app/calendar": 3,
  "/app/conversations": 5,
};

async function installWorkspaceProfiler(page: Page) {
  await page.addInitScript(() => {
    const runtimeWindow = window as typeof window & {
      __ZANI_WORKSPACE_COMMITS__?: number;
      __ZANI_RUNTIME_PROFILER__?: () => void;
    };
    runtimeWindow.__ZANI_WORKSPACE_COMMITS__ = 0;
    runtimeWindow.__ZANI_RUNTIME_PROFILER__ = () => {
      runtimeWindow.__ZANI_WORKSPACE_COMMITS__ =
        (runtimeWindow.__ZANI_WORKSPACE_COMMITS__ || 0) + 1;
    };
  });
}

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
  await page.waitForTimeout(800);
}

async function resetWorkspaceCommits(page: Page) {
  await page.evaluate(() => {
    const runtimeWindow = window as typeof window & {
      __ZANI_WORKSPACE_COMMITS__?: number;
    };
    runtimeWindow.__ZANI_WORKSPACE_COMMITS__ = 0;
  });
}

async function readWorkspaceCommits(page: Page) {
  return page.evaluate(() => {
    const runtimeWindow = window as typeof window & {
      __ZANI_WORKSPACE_COMMITS__?: number;
    };
    return runtimeWindow.__ZANI_WORKSPACE_COMMITS__ || 0;
  });
}

test("F-302 pilot routes stay within request and waterfall budgets", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const pendingRequests: ApiRequestMetric[] = [];
  page.on("request", (request) => {
    if (
      request.resourceType() !== "fetch" &&
      request.resourceType() !== "xhr"
    ) {
      return;
    }
    const url = new URL(request.url());
    if (
      !url.pathname.startsWith("/api/") ||
      url.pathname === "/api/notifications/summary/" ||
      url.pathname === "/api/inbox/conversations/summary/"
    ) {
      return;
    }
    pendingRequests.push({
      method: request.method(),
      url: `${url.pathname}${url.search}`,
      startedAt: Date.now(),
    });
  });

  await login(page);

  for (const [route, requestBudget] of Object.entries(routeRequestBudgets)) {
    pendingRequests.length = 0;
    await navigateInsideApp(page, route);
    const firstStartedAt = pendingRequests[0]?.startedAt || 0;
    const requests = pendingRequests.map((request) => ({
      ...request,
      startedAt: request.startedAt - firstStartedAt,
    }));
    const signatures = requests.map(
      (request) => `${request.method} ${request.url}`,
    );

    expect(
      new Set(signatures).size,
      `${route} dispatched duplicate API requests: ${JSON.stringify(requests)}`,
    ).toBe(signatures.length);
    expect(
      requests.length,
      `${route} exceeded its measured request budget: ${JSON.stringify(requests)}`,
    ).toBeLessThanOrEqual(requestBudget);
    expect(
      Math.max(0, ...requests.map((request) => request.startedAt)),
      `${route} introduced a deeper request waterfall: ${JSON.stringify(requests)}`,
    ).toBeLessThanOrEqual(1_000);
  }
});

test("F-302 shell interactions do not re-render the active workspace", async ({
  page,
}, testInfo) => {
  await installWorkspaceProfiler(page);
  await login(page);
  await navigateInsideApp(page, "/app/tasks");
  await page.waitForTimeout(1_200);
  await resetWorkspaceCommits(page);

  if (testInfo.project.name === "mobile-chromium") {
    const menuTrigger = page.getByTestId("header-mobile-menu-trigger");
    await menuTrigger.click();
    await expect(page.getByTestId("mobile-navigation-drawer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("mobile-navigation-drawer")).toHaveCount(0);
  } else {
    const desktopSidebar = page.locator("aside").first();
    await desktopSidebar.hover();
    await page.getByRole("main").first().hover({
      position: { x: 500, y: 300 },
    });
  }

  await page.keyboard.press("Control+K");
  const commandInput = page.getByPlaceholder(
    /\u041f\u043e\u0438\u0441\u043a \u0438\u043b\u0438 \u043a\u043e\u043c\u0430\u043d\u0434\u0430|РџРѕРёСЃРє РёР»Рё РєРѕРјР°РЅРґР°|Р СџР С•Р С‘РЎРѓР С” Р С‘Р В»Р С‘ Р С”Р С•Р СР В°Р Р…Р Т‘Р В°|Search or command/,
  );
  await expect(commandInput).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(commandInput).toHaveCount(0);

  await expect
    .poll(() => readWorkspaceCommits(page))
    .toBe(0);
});
