import { expect, test, type Page, type Request } from "@playwright/test";

const password = process.env.E2E_PASSWORD || "ZaniTest123!";
const ownerEmail =
  process.env.E2E_OWNER_EMAIL || "business_owner@example.com";

type ApiRequestMetric = {
  method: string;
  url: string;
  startedAt: number;
};

type RouteRequestBudget = {
  path: string;
  measurementPath: string;
  minimumRequests: number;
  requestLimit: number;
  readySelector: string;
};

const waterfallBudgetMs = 1_000;
const postReadyObservationMs = 1_250;
const routeRequestBudgets: RouteRequestBudget[] = [
  {
    path: "/app/leads",
    measurementPath: "/app/leads?search=__runtime_budget__",
    minimumRequests: 1,
    requestLimit: 10,
    readySelector: '[data-testid="page-primary-action"]',
  },
  {
    path: "/app/clients",
    measurementPath: "/app/clients?search=__runtime_budget__",
    minimumRequests: 1,
    requestLimit: 4,
    readySelector: '[data-testid="page-primary-action"]',
  },
  {
    path: "/app/deals",
    measurementPath: "/app/deals",
    minimumRequests: 0,
    requestLimit: 4,
    readySelector:
      '[data-testid="page-primary-action"], main [role="alert"]',
  },
  {
    path: "/app/tasks",
    measurementPath: "/app/tasks?search=__runtime_budget__",
    minimumRequests: 1,
    requestLimit: 9,
    readySelector: '[data-testid="page-primary-action"]',
  },
  {
    path: "/app/calendar",
    measurementPath: "/app/calendar?date=2026-07-26&view=day",
    minimumRequests: 1,
    requestLimit: 3,
    readySelector: '[data-testid="page-primary-action"]',
  },
  {
    path: "/app/conversations",
    measurementPath: "/app/conversations?unread=true&sort=unread",
    minimumRequests: 1,
    requestLimit: 5,
    readySelector:
      '[data-testid="inbox-priority-actions"], [data-testid="inbox-action-composer"]',
  },
];

const ignoredShellRequests = new Set([
  "/api/auth/me/",
  "/api/notifications/summary/",
  "/api/inbox/conversations/summary/",
]);

function requestBudgetViolations(
  requests: ApiRequestMetric[],
  requestLimit: number,
) {
  const signatures = requests.map(
    (request) => `${request.method} ${request.url}`,
  );
  return {
    duplicates: signatures.filter(
      (signature, index) => signatures.indexOf(signature) !== index,
    ),
    excess: Math.max(0, requests.length - requestLimit),
    late: requests.filter(
      (request) => request.startedAt > waterfallBudgetMs,
    ),
  };
}

async function measureRouteRequests(
  page: Page,
  budget: RouteRequestBudget,
) {
  const requests: ApiRequestMetric[] = [];
  const navigationStartedAt = Date.now();
  const onRequest = (request: Request) => {
    if (
      request.resourceType() !== "fetch" &&
      request.resourceType() !== "xhr"
    ) {
      return;
    }
    const url = new URL(request.url());
    if (
      !url.pathname.startsWith("/api/") ||
      ignoredShellRequests.has(url.pathname)
    ) {
      return;
    }
    requests.push({
      method: request.method(),
      url: `${url.pathname}${url.search}`,
      startedAt: Date.now() - navigationStartedAt,
    });
  };

  page.on("request", onRequest);
  try {
    await navigateInsideApp(page, budget.measurementPath);
    await waitForRouteReady(page, budget);

    // Observe longer than the allowed waterfall after the real workspace is
    // ready so requests that begin after the former 800 ms snapshot are kept.
    await page.waitForTimeout(postReadyObservationMs);
    return requests;
  } finally {
    page.off("request", onRequest);
  }
}

async function waitForRouteReady(
  page: Page,
  budget: RouteRequestBudget,
) {
  await expect(
    page
      .locator(budget.readySelector)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(
    page.locator('main [role="status"][aria-busy="true"]'),
  ).toHaveCount(0);
}

async function warmRuntimeRoutes(page: Page) {
  // Warm route modules so the request gate measures data waterfalls rather
  // than Vite's development-only transform latency. Each measured navigation
  // still uses a distinct query and must issue its own real API request.
  for (const budget of routeRequestBudgets) {
    await navigateInsideApp(page, budget.path);
    await waitForRouteReady(page, budget);
  }
  await navigateInsideApp(page, "/app");
  await expect(page.locator('main a[href="/app/leads"]').first()).toBeVisible();
  await expect(
    page.locator('main [role="status"][aria-busy="true"]'),
  ).toHaveCount(0);
}

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
  await expect(page.locator('main a[href="/app/leads"]').first()).toBeVisible();
  await expect(
    page.locator('main [role="status"][aria-busy="true"]'),
  ).toHaveCount(0);
  await page.waitForTimeout(postReadyObservationMs);
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
  await login(page);
  await warmRuntimeRoutes(page);

  for (const budget of routeRequestBudgets) {
    const requests = await measureRouteRequests(page, budget);
    const violations = requestBudgetViolations(
      requests,
      budget.requestLimit,
    );
    const maxStartMs = Math.max(
      0,
      ...requests.map((request) => request.startedAt),
    );
    console.info(
      `[F-302] ${budget.path}: ${requests.length}/${budget.requestLimit} requests, latest start ${maxStartMs} ms`,
    );
    expect(
      requests.length,
      `${budget.path} did not exercise its measured API path`,
    ).toBeGreaterThanOrEqual(budget.minimumRequests);
    expect(
      violations.duplicates,
      `${budget.path} dispatched duplicate API requests: ${JSON.stringify(requests)}`,
    ).toEqual([]);
    expect(
      violations.excess,
      `${budget.path} exceeded its measured request budget: ${JSON.stringify(requests)}`,
    ).toBe(0);
    expect(
      violations.late,
      `${budget.path} started API requests after ${waterfallBudgetMs} ms: ${JSON.stringify(requests)}`,
    ).toEqual([]);
  }
});

test("F-302 request analysis rejects starts after the former 800 ms snapshot", () => {
  const lateRequest: ApiRequestMetric = {
    method: "GET",
    url: "/api/tasks/late-dependent/",
    startedAt: 1_050,
  };

  expect(requestBudgetViolations([lateRequest], 1).late).toEqual([
    lateRequest,
  ]);
  expect(postReadyObservationMs).toBeGreaterThan(waterfallBudgetMs);
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
