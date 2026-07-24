import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_PASSWORD || "ZaniTest123!";

const users = {
  owner: process.env.E2E_OWNER_EMAIL || "business_owner@example.com",
  manager: process.env.E2E_MANAGER_EMAIL || "business_manager@example.com",
  operator: process.env.E2E_OPERATOR_EMAIL || "business_operator@example.com",
  doctor: process.env.E2E_DOCTOR_EMAIL || "business_doctor@example.com",
};

async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('form input[type="email"]').first().fill(email);
  await page.locator('form input[type="password"]').first().fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/app/);
  await expect(page.locator("main")).toBeVisible();
}

async function expectHealthyWorkspace(page: Page) {
  await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  const overflow = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

async function navigateClient(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
  await expect(page).toHaveURL(new RegExp(path === "/app" ? "/app/?$" : path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

test("F-201 desktop roles receive legitimate daily routes and controls", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop role contract is verified in the desktop project.");
  test.setTimeout(120_000);

  await login(page, users.owner);
  await expect(page.locator('main a[href="/app/tasks"]').first()).toBeVisible();
  await expect(page.locator('main a[href="/app/calendar"]').first()).toBeVisible();
  await expectHealthyWorkspace(page);

  await login(page, users.manager);
  await expect(page.getByTestId("role-daily-actions")).toBeVisible();
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/tasks"]')).toBeVisible();
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/calendar"]')).toBeVisible();
  await expectHealthyWorkspace(page);

  await login(page, users.operator);
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/tasks"]')).toBeVisible();
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/conversations"]')).toBeVisible();
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/deals"]')).toHaveCount(0);
  await expectHealthyWorkspace(page);

  await login(page, users.doctor);
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/tasks"]')).toBeVisible();
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/calendar"]')).toBeVisible();
  await expect(page.locator('nav a[href="/app/deals"]')).toHaveCount(0);
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/conversations"]')).toHaveCount(0);

  await navigateClient(page, "/app/tasks");
  await expect(page.getByRole("button", { name: /Quick task|Быстрая задача|Жылдам тапсырма/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /My tasks|Мои|Менің/i }).first()).toBeVisible();

  await navigateClient(page, "/app/calendar");
  await expect(page.getByRole("button", { name: /New booking|Новая запись|Жаңа жазба/i })).toHaveCount(0);
  await expect(page.locator('a[href="/app/working-hours"]')).toHaveCount(0);
  await expectHealthyWorkspace(page);

  await navigateClient(page, "/app/deals");
  await expect(page.getByRole("alert")).toBeVisible();
});

test("F-201 mobile owner, manager, operator and doctor daily routes stay usable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile role matrix runs only in the mobile project.");
  test.setTimeout(150_000);

  const routeMatrix = [
    { email: users.owner, routes: ["/app", "/app/tasks", "/app/conversations", "/app/calendar"] },
    { email: users.manager, routes: ["/app", "/app/tasks", "/app/conversations", "/app/calendar"] },
    { email: users.operator, routes: ["/app", "/app/tasks", "/app/conversations"] },
    { email: users.doctor, routes: ["/app", "/app/tasks", "/app/calendar"] },
  ];

  for (const entry of routeMatrix) {
    await login(page, entry.email);
    for (const route of entry.routes) {
      await navigateClient(page, route);
      await expect(page).toHaveURL(new RegExp(route === "/app" ? "/app/?$" : route));
      await expectHealthyWorkspace(page);
    }
  }
});

test("F-201 recoverable queue, calendar and provider failure states expose next actions", async ({ page, isMobile }) => {
  test.skip(isMobile, "Failure-state interception is covered once in desktop Chromium.");
  test.setTimeout(120_000);

  const workQueuesUrl = /\/api\/work-queues\/(?:\?.*)?$/;
  await page.route(workQueuesUrl, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "service_unavailable", detail: "temporary" }),
    });
  });
  await login(page, users.owner);
  await expect(page.getByTestId("dashboard-priority-error")).toBeVisible();
  await expect(page.getByTestId("dashboard-priority-error").getByRole("button")).toBeVisible();
  await page.unroute(workQueuesUrl);

  const appointmentsUrl = /\/api\/appointments\/(?:\?.*)?$/;
  await page.route(appointmentsUrl, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ code: "service_unavailable", detail: "temporary" }),
      });
      return;
    }
    await route.continue();
  });
  await navigateClient(page, "/app/calendar");
  await expect(page.getByTestId("calendar-error-state")).toBeVisible();
  await expect(page.getByTestId("calendar-error-state").getByRole("button")).toBeVisible();
  await page.unroute(appointmentsUrl);

  await page.route(
    /\/api\/inbox\/conversations\/summary\/(?:\?.*)?$/,
    async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      const channels = Array.isArray(payload.channels) ? payload.channels : [];
      payload.channels = channels.length
        ? channels.map((channel: Record<string, unknown>, index: number) =>
            index === 0
              ? { ...channel, total: 1, is_connected: false }
              : channel,
          )
        : [
            {
              key: "telegram",
              label: "Telegram",
              status: "available",
              pilot_note: "",
              total: 1,
              unread: 1,
              handoff_required: 0,
              is_connected: false,
            },
          ];
      payload.next_actions = [
        {
          label: "Open unread queue",
          href: "/app/conversations?unread=true&sort=unread",
          priority: "high",
        },
      ];
      await route.fulfill({ response, json: payload });
    },
  );
  await page.route(
    /\/api\/inbox\/conversations\/(?:\?.*)?$/,
    async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      if (payload.results?.[0]?.last_message) {
        payload.results[0].last_message.status = "failed";
      }
      await route.fulfill({ response, json: payload });
    },
  );
  await page.route(
    /\/api\/inbox\/conversations\/\d+\/retry-message\/$/,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          conversation: 1,
          direction: "outbound",
          sender_type: "manager",
          text: "retry",
          payload_json: {},
          status: "queued",
          created_at: new Date().toISOString(),
        }),
      });
    },
  );

  // Re-authenticate so the shell-level inbox summary is fetched through the
  // provider-unavailable fixture rather than reused from the first dashboard.
  await login(page, users.owner);
  await navigateClient(page, "/app/conversations");
  await expect(page.getByTestId("inbox-priority-actions")).toBeVisible();
  await expect(
    page
      .getByTestId("inbox-priority-actions")
      .locator('a[href*="unread=true"]')
      .first(),
  ).toBeVisible();
  await expect(page.getByTestId("inbox-provider-unavailable")).toBeVisible();
  const retry = page.getByTestId("conversation-retry-failed").first();
  await expect(retry).toBeVisible();
  await retry.click();
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
