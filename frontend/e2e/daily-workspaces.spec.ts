import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_PASSWORD || "ZaniTest123!";

const users = {
  owner: process.env.E2E_OWNER_EMAIL || "business_owner@example.com",
  administrator:
    process.env.E2E_ADMIN_EMAIL || "business_administrator@example.com",
  manager: process.env.E2E_MANAGER_EMAIL || "business_manager@example.com",
  operator: process.env.E2E_OPERATOR_EMAIL || "business_operator@example.com",
  specialist: process.env.E2E_SPECIALIST_EMAIL || "business_specialist@example.com",
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

async function clickRetryControlIfPresent(page: Page, testId: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const control = page.getByTestId(testId);
    await expect(control).toBeVisible();
    await expect(control).toBeEnabled();
    await expect(control).toHaveAttribute("type", "button");
    try {
      await control.click({ timeout: 5_000 });
      return;
    } catch (error) {
      lastError = error;
      if (!(await control.isVisible().catch(() => false))) {
        throw new Error(`Retry control ${testId} disappeared after a failed real click.`, { cause: error });
      }
      await page.waitForTimeout(250);
    }
  }
  throw lastError;
}

async function openCommandPalette(page: Page) {
  await page.keyboard.press("Control+K");
  await expect(page.getByTestId("command-open-leads")).toBeVisible();
}

async function apiList<T>(
  page: Page,
  path: string,
  authorization: string,
): Promise<T[]> {
  const response = await page.request.get(path, {
    headers: { Authorization: authorization },
  });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return Array.isArray(payload) ? payload : payload.results || [];
}

test("F-201 desktop roles receive legitimate daily routes and controls", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop role contract is verified in the desktop project.");
  test.setTimeout(120_000);

  await login(page, users.owner);
  await expect(page.locator('main a[href="/app/tasks"]').first()).toBeVisible();
  await expect(page.locator('main a[href="/app/calendar"]').first()).toBeVisible();
  await expect(page.locator('nav a[href="/app/settings"]')).toBeVisible();
  await expect(page.locator('nav a[href="/app/deals"]')).toBeVisible();
  await expectHealthyWorkspace(page);

  await login(page, users.administrator);
  await expect(page.locator('main a[href="/app/tasks"]').first()).toBeVisible();
  await expect(page.locator('main a[href="/app/calendar"]').first()).toBeVisible();
  await expect(page.locator('nav a[href="/app/settings"]')).toBeVisible();
  await expect(page.locator('nav a[href="/app/deals"]')).toBeVisible();
  await expectHealthyWorkspace(page);

  await login(page, users.manager);
  await expect(page.getByTestId("role-daily-actions")).toBeVisible();
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/tasks"]')).toBeVisible();
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/calendar"]')).toBeVisible();
  await expect(page.locator('nav a[href="/app/settings"]')).toHaveCount(0);
  await expect(page.locator('nav a[href="/app/deals"]')).toBeVisible();
  await navigateClient(page, "/app/settings");
  await expect(page.getByTestId("forbidden-state")).toBeVisible();
  await expectHealthyWorkspace(page);

  await login(page, users.operator);
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/tasks"]')).toBeVisible();
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/conversations"]')).toBeVisible();
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/deals"]')).toHaveCount(0);
  await expectHealthyWorkspace(page);

  await login(page, users.specialist);
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/tasks"]')).toBeVisible();
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/calendar"]')).toBeVisible();
  await expect(page.locator('nav a[href="/app/deals"]')).toHaveCount(0);
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/conversations"]')).toHaveCount(0);

  await navigateClient(page, "/app/tasks");
  await expect(page.getByRole("button", { name: /Quick task|Быстрая задача|Жылдам тапсырма/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /My tasks|Мои|Менің/i }).first()).toBeVisible();

  await navigateClient(page, "/app/calendar");
  await expect(page.getByRole("button", { name: /New booking|Новая запись|Жаңа жазба/i })).toHaveCount(0);
  await expect(page.locator('nav a[href="/app/business"]')).toHaveCount(0);
  await expectHealthyWorkspace(page);

  await navigateClient(page, "/app/deals");
  await expect(page.getByTestId("forbidden-state")).toBeVisible();
});

test("F-401 command palette follows role permissions and disabled modules", async ({ page, isMobile }) => {
  test.skip(isMobile, "Command palette role and capability contract is certified in the desktop project.");
  test.setTimeout(120_000);

  await login(page, users.owner);
  await openCommandPalette(page);
  await expect(page.getByTestId("command-create-lead")).toBeVisible();
  await expect(page.getByTestId("command-open-clients")).toBeVisible();
  await expect(page.getByTestId("command-open-messages")).toBeVisible();
  await expect(page.getByTestId("command-open-settings")).toBeVisible();
  await expect(page.getByTestId("command-open-ai-agents")).toBeVisible();
  await expect(page.getByTestId("command-open-deals")).toBeVisible();
  await page.keyboard.press("Escape");

  await login(page, users.administrator);
  await openCommandPalette(page);
  await expect(page.getByTestId("command-create-lead")).toBeVisible();
  await expect(page.getByTestId("command-open-clients")).toBeVisible();
  await expect(page.getByTestId("command-open-messages")).toBeVisible();
  await expect(page.getByTestId("command-open-settings")).toBeVisible();
  await expect(page.getByTestId("command-open-ai-agents")).toBeVisible();
  await expect(page.getByTestId("command-open-deals")).toBeVisible();
  await page.keyboard.press("Escape");

  await login(page, users.manager);
  await openCommandPalette(page);
  await expect(page.getByTestId("command-create-lead")).toBeVisible();
  await expect(page.getByTestId("command-open-clients")).toBeVisible();
  await expect(page.getByTestId("command-open-messages")).toBeVisible();
  await expect(page.getByTestId("command-open-settings")).toHaveCount(0);
  await expect(page.getByTestId("command-open-ai-agents")).toHaveCount(0);
  await expect(page.getByTestId("command-open-deals")).toBeVisible();
  await page.keyboard.press("Escape");

  await login(page, users.operator);
  await openCommandPalette(page);
  await expect(page.getByTestId("command-create-lead")).toBeVisible();
  await expect(page.getByTestId("command-open-clients")).toBeVisible();
  await expect(page.getByTestId("command-open-messages")).toBeVisible();
  await expect(page.getByTestId("command-open-settings")).toHaveCount(0);
  await expect(page.getByTestId("command-open-ai-agents")).toHaveCount(0);
  await expect(page.getByTestId("command-open-deals")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await login(page, users.specialist);
  await openCommandPalette(page);
  await expect(page.getByTestId("command-create-lead")).toHaveCount(0);
  await expect(page.getByTestId("command-open-clients")).toBeVisible();
  await expect(page.getByTestId("command-open-messages")).toHaveCount(0);
  await expect(page.getByTestId("command-open-settings")).toHaveCount(0);
  await expect(page.getByTestId("command-open-ai-agents")).toHaveCount(0);
  await expect(page.getByTestId("command-open-deals")).toHaveCount(0);
});

test("F-201 mobile owner, manager, operator and specialist daily routes stay usable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile role matrix runs only in the mobile project.");
  test.setTimeout(180_000);
  let authorization = "";
  page.on("request", (request) => {
    const nextAuthorization = request.headers().authorization;
    if (nextAuthorization) authorization = nextAuthorization;
  });

  await login(page, users.owner);
  await expect(page.locator('main a[href="/app/tasks"]').first()).toBeVisible();
  await expect(page.locator('main a[href="/app/calendar"]').first()).toBeVisible();
  await navigateClient(page, "/app/tasks");
  await expect(page.locator('[data-testid="page-primary-action"]:visible')).toBeVisible();
  await navigateClient(page, "/app/conversations");
  await expect(page.locator('[data-conversation-action-id="assign"]').first()).toBeVisible();
  await navigateClient(page, "/app/calendar");
  await expect(page.locator('[data-testid="page-primary-action"]:visible')).toBeVisible();
  await expectHealthyWorkspace(page);

  await login(page, users.administrator);
  await expect(page.locator('main a[href="/app/tasks"]').first()).toBeVisible();
  await expect(page.locator('main a[href="/app/calendar"]').first()).toBeVisible();
  await navigateClient(page, "/app/settings");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expectHealthyWorkspace(page);

  await login(page, users.manager);
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/tasks"]')).toBeVisible();
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/calendar"]')).toBeVisible();
  await navigateClient(page, "/app/tasks");
  await expect(page.locator('[data-testid="page-primary-action"]:visible')).toBeVisible();
  await navigateClient(page, "/app/conversations");
  await expect(page.locator('[data-conversation-action-id="assign"]').first()).toBeVisible();
  await navigateClient(page, "/app/calendar");
  await expect(page.locator('[data-testid="page-primary-action"]:visible')).toBeVisible();
  await expectHealthyWorkspace(page);

  await login(page, users.operator);
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/tasks"]')).toBeVisible();
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/conversations"]')).toBeVisible();
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/deals"]')).toHaveCount(0);
  await navigateClient(page, "/app/tasks");
  await expect(page.getByTestId("page-primary-action")).toHaveCount(0);
  await expect(page.locator('[data-task-filter="my"]').first()).toBeVisible();
  await navigateClient(page, "/app/conversations");
  await expect(page.locator('[data-conversation-action-id="assign"]').first()).toBeVisible();
  await expectHealthyWorkspace(page);

  await login(page, users.specialist);
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/tasks"]')).toBeVisible();
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/calendar"]')).toBeVisible();
  await expect(page.getByTestId("role-daily-actions").locator('a[href^="/app/conversations"]')).toHaveCount(0);
  await navigateClient(page, "/app/tasks");
  await expect(page.getByTestId("page-primary-action")).toHaveCount(0);
  await expect(page.locator('[data-task-filter="my"]').first()).toBeVisible();
  await navigateClient(page, "/app/calendar");
  await expect(page.getByTestId("page-primary-action")).toHaveCount(0);

  const resources = await apiList<{ id: number; linked_user_email?: string | null }>(
    page,
    "/api/resources/",
    authorization,
  );
  const appointments = await apiList<{ id: number; resource: number | null }>(
    page,
    "/api/appointments/",
    authorization,
  );
  // A user may legitimately belong to more than one business. The unscoped
  // endpoint therefore returns the specialist's resources from every
  // accessible tenant, while still excluding other specialists' schedules.
  const ownResources = resources.filter((resource) => resource.linked_user_email === users.specialist);
  const ownResourceIds = new Set(ownResources.map((resource) => resource.id));
  const ownAppointment = appointments.find((appointment) =>
    appointment.resource !== null && ownResourceIds.has(appointment.resource),
  );
  expect(ownAppointment).toBeTruthy();
  expect(resources.every((resource) => !resource.linked_user_email || resource.linked_user_email === users.specialist)).toBeTruthy();
  expect(appointments.every((appointment) => appointment.resource !== null && ownResourceIds.has(appointment.resource))).toBeTruthy();

  await navigateClient(page, `/app/calendar/${ownAppointment!.id}`);
  await expect(page.locator('[data-appointment-action-id="reschedule"]')).toBeVisible();
  await expectHealthyWorkspace(page);
});

test("F-201 recoverable queue, calendar and provider failure states expose next actions", async ({ page, isMobile }) => {
  test.setTimeout(180_000);

  if (!isMobile) {
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
  }

  await page.route(
    /\/api\/inbox\/conversations\/summary\/(?:\?.*)?$/,
    async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      payload.next_actions = [
        {
          label: "Open unread queue",
          href: "/app/conversations?unread=true&sort=unread",
          priority: "high",
        },
        {
          label: "Repair provider",
          href: "/app/integrations?status=failed",
          priority: "high",
        },
      ];
      await route.fulfill({ response, json: payload });
    },
  );
  let connectorStatusRequests = 0;
  await page.route(
    /\/api\/business-connectors\/(?:\?.*)?$/,
    async (route) => {
      connectorStatusRequests += 1;
      const retryWasClicked = await page
        .evaluate(
          () =>
            Boolean(
              (window as typeof window & {
                __ZANI_TEST_CONNECTOR_RETRY_CLICKED__?: boolean;
              }).__ZANI_TEST_CONNECTOR_RETRY_CLICKED__,
            ),
        )
        .catch(() => false);
      if (!retryWasClicked) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            code: "service_unavailable",
            detail: "connector status temporary unavailable",
          }),
        });
        return;
      }
      const response = await route.fetch();
      const payload = await response.json();
      const failedConnector = {
        id: 990001,
        business: 1,
        business_name: "Zani E2E Demo",
        provider: "telegram",
        capability: "communications",
        name: "Telegram E2E failure",
        status: "failed",
        auth_type: "token",
        config_json: {},
        scopes_json: [],
        last_sync_at: null,
        next_sync_at: null,
        last_error: "Temporary provider failure",
        connected_at: null,
        created_by: null,
        created_by_email: null,
        credentials_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (Array.isArray(payload)) {
        await route.fulfill({ response, json: [...payload, failedConnector] });
        return;
      }
      await route.fulfill({
        response,
        json: {
          ...payload,
          count: Number(payload.count || 0) + 1,
          results: [...(payload.results || []), failedConnector],
        },
      });
    },
  );
  let forcedAssignee: number | undefined;
  await page.route(
    /\/api\/inbox\/conversations\/(?:\?.*)?$/,
    async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      if (payload.results?.[0]?.last_message) {
        payload.results[0].last_message.status = "failed";
        if (forcedAssignee !== undefined) {
          payload.results[0].assigned_to = forcedAssignee;
        }
      }
      await route.fulfill({ response, json: payload });
    },
  );
  const rawMessageDeliveryError = "raw-provider-delivery-error";
  await page.route(
    /\/api\/inbox\/conversations\/\d+\/messages\/(?:\?.*)?$/,
    async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      const failedMessage = {
        id: 990002,
        conversation: Number(
          route.request().url().match(/conversations\/(\d+)/)?.[1] || 1,
        ),
        direction: "outbound",
        sender_type: "manager",
        text: "E2E failed outbound message",
        payload_json: {},
        error_text: rawMessageDeliveryError,
        status: "failed",
        created_at: new Date().toISOString(),
        attachments: [],
      };
      const botMessage = {
        ...failedMessage,
        id: 990003,
        sender_type: "bot",
        text: "E2E bot outbound message",
        error_text: "",
        status: "sent",
      };
      await route.fulfill({
        response,
        json: {
          ...payload,
          count: Number(payload.count || 0) + 2,
          results: [...(payload.results || []), failedMessage, botMessage],
        },
      });
    },
  );

  // Re-authenticate so the shell-level inbox summary is fetched through the
  // provider-unavailable fixture rather than reused from the first dashboard.
  await login(page, users.owner);
  await navigateClient(page, "/app/conversations");
  if (isMobile) {
    const closeMobileThread = page
      .locator("main main > div:first-child button")
      .first();
    await expect(closeMobileThread).toBeVisible();
    await closeMobileThread.click();
  }
  await expect(page.getByTestId("inbox-priority-actions")).toBeVisible();
  await expect(
    page
      .getByTestId("inbox-priority-actions")
      .locator('a[href*="unread=true"]')
      .first(),
  ).toBeVisible();
  await expect(page.getByTestId("inbox-provider-status-unavailable")).toBeVisible();
  await expect(page.getByTestId("inbox-provider-status-retry")).toBeEnabled();
  await expect(page.getByTestId("inbox-provider-status-retry")).toHaveAttribute("type", "button");
  await expect(page.getByTestId("conversation-retry-failed")).toHaveCount(0);
  if (!isMobile) {
    const failedMessage = page
      .getByTestId("conversation-message")
      .filter({ hasText: "E2E failed outbound message" });
    await expect(failedMessage).toBeVisible();
    await expect(failedMessage).toHaveAttribute("data-message-status", "failed");
    await expect(failedMessage.getByTestId("conversation-message-bubble")).toHaveClass(/bg-zani-card/);
    await expect(failedMessage.getByTestId("conversation-message-bubble")).toHaveClass(/text-zani-text/);
    await expect(failedMessage).not.toContainText(rawMessageDeliveryError);
    await expect(failedMessage.getByRole("button")).toHaveCount(0);
    const botMessage = page
      .getByTestId("conversation-message")
      .filter({ hasText: "E2E bot outbound message" });
    await expect(botMessage).toBeVisible();
    await expect(botMessage).toHaveAttribute("data-message-sender", "bot");
    await expect(botMessage.getByTestId("conversation-message-bubble")).toHaveClass(/bg-zani-card/);
    await expect(botMessage.getByTestId("conversation-message-bubble")).toHaveClass(/text-zani-text/);
    await expect(botMessage.getByRole("button")).toHaveCount(0);
  }

  const connectorRetry = page.getByTestId("inbox-provider-status-retry");
  await connectorRetry.evaluate((control) => {
    (window as typeof window & {
      __ZANI_TEST_CONNECTOR_RETRY_CLICKED__?: boolean;
    }).__ZANI_TEST_CONNECTOR_RETRY_CLICKED__ = false;
    control.addEventListener(
      "click",
      () => {
        (window as typeof window & {
          __ZANI_TEST_CONNECTOR_RETRY_CLICKED__?: boolean;
        }).__ZANI_TEST_CONNECTOR_RETRY_CLICKED__ = true;
      },
      { capture: true, once: true },
    );
  });
  const connectorStatusRequestsBeforeRetry = connectorStatusRequests;
  await clickRetryControlIfPresent(page, "inbox-provider-status-retry");
  await expect.poll(() => connectorStatusRequests).toBeGreaterThan(connectorStatusRequestsBeforeRetry);
  await expect(page.getByTestId("inbox-provider-status-unavailable")).toHaveCount(0);
  await expect(page.getByTestId("inbox-provider-unavailable")).toBeVisible();

  forcedAssignee = 999999;
  await login(page, users.operator);
  await navigateClient(page, "/app/conversations");
  await expect(page.getByTestId("conversation-retry-failed")).toHaveCount(0);
  await expect(
    page.getByTestId("inbox-priority-actions").locator('a[href^="/app/integrations"]'),
  ).toHaveCount(0);
  await expect(page.getByTestId("inbox-provider-unavailable")).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
