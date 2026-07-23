import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_PASSWORD || "ZaniTest123!";
const apiBaseURL = process.env.E2E_API_BASE_URL || "http://127.0.0.1:8000";
const ownerEmail = process.env.E2E_OWNER_EMAIL || "business_owner@example.com";

type TokenPayload = {
  access: string;
  refresh: string;
};

type OwnerDashboardMetricsPayload = {
  new_leads?: number;
  total_leads?: number;
  open_tasks?: number;
};

async function apiLogin(page: Page) {
  let response = await page.request.post(`${apiBaseURL}/api/auth/token/`, {
    data: { email: ownerEmail, password },
  });
  for (
    let attempt = 0;
    attempt < 3 && response.status() === 429;
    attempt += 1
  ) {
    await page.waitForTimeout(10_000);
    response = await page.request.post(`${apiBaseURL}/api/auth/token/`, {
      data: { email: ownerEmail, password },
    });
  }
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as TokenPayload;
}

function authHeaders(tokens: TokenPayload) {
  return { Authorization: `Bearer ${tokens.access}` };
}

function nextBusinessWeekdayDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function authenticate(page: Page, tokens: TokenPayload) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/api/auth/token/refresh/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access: tokens.access }),
      });
      return;
    }
    const headers = { ...route.request().headers() };
    if (
      !url.includes("/api/auth/token/") &&
      !url.includes("/api/auth/social/")
    ) {
      headers.Authorization = `Bearer ${tokens.access}`;
    }
    await route.continue({ headers });
  });
  await page.goto("/login");
  if (
    await page
      .waitForURL(/\/app/, { timeout: 1_000 })
      .then(() => true)
      .catch(() => false)
  ) {
    return;
  }
  const emailInput = page.getByRole("textbox", { name: "Email" }).first();
  await expect(emailInput).toBeVisible();
  await emailInput.fill(ownerEmail);
  await page.locator('form input[type="password"]').first().fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/app/);
}

async function navigateInsideApp(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState(null, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth || 0,
    );
    return documentWidth - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(2);
}

async function waitForOwnerDashboardMetrics(page: Page) {
  const response = await page.waitForResponse(
    (item) =>
      item.url().includes("/api/analytics/owner-dashboard/") &&
      item.status() === 200,
  );
  return (await response.json()) as OwnerDashboardMetricsPayload;
}

async function waitForAnalyticsReportSummary(page: Page) {
  return page.waitForResponse(
    (item) =>
      item.url().includes("/api/analytics/reports/summary/") &&
      item.status() === 200,
  );
}

test("client, lead, deal, appointment, conversation and task workspaces render executable action bars", async ({
  page,
}) => {
  test.setTimeout(90_000);

  const tokens = await apiLogin(page);
  const headers = authHeaders(tokens);
  const unique = Date.now();

  const meResponse = await page.request.get(`${apiBaseURL}/api/auth/me/`, {
    headers,
  });
  expect(meResponse.ok()).toBeTruthy();
  const me = await meResponse.json();
  const businessId = me.businesses?.[0]?.id;
  expect(businessId).toBeTruthy();

  const clientResponse = await page.request.post(`${apiBaseURL}/api/clients/`, {
    headers,
    data: {
      business: businessId,
      full_name: `E2E Workspace Client ${unique}`,
      phone: `+7701${String(unique).slice(-7)}`,
      email: `workspace-${unique}@example.com`,
      source: "manual",
    },
  });
  expect(clientResponse.ok()).toBeTruthy();
  const client = await clientResponse.json();

  const leadResponse = await page.request.post(`${apiBaseURL}/api/leads/`, {
    headers,
    data: {
      business: businessId,
      client: client.id,
      source: "manual",
      message: `E2E workspace lead ${unique}`,
      status: "new",
    },
  });
  expect(leadResponse.ok()).toBeTruthy();
  const lead = await leadResponse.json();

  const dealResponse = await page.request.post(
    `${apiBaseURL}/api/leads/${lead.id}/create-deal/`,
    {
      headers,
      data: { title: `E2E Workspace Deal ${unique}`, amount: "2500.00" },
    },
  );
  expect(dealResponse.ok()).toBeTruthy();
  const deal = await dealResponse.json();

  const serviceResponse = await page.request.post(
    `${apiBaseURL}/api/services/`,
    {
      headers,
      data: {
        business: businessId,
        name: `E2E Workspace Service ${unique}`,
        description: "Created by Playwright entity workspace.",
        duration_minutes: 30,
        price_from: "1000.00",
        is_active: true,
      },
    },
  );
  expect(serviceResponse.ok()).toBeTruthy();
  const service = await serviceResponse.json();

  const resourceResponse = await page.request.post(
    `${apiBaseURL}/api/resources/`,
    {
      headers,
      data: {
        business: businessId,
        name: `E2E Workspace Specialist ${unique}`,
        resource_type: "staff",
        is_active: true,
      },
    },
  );
  expect(resourceResponse.ok()).toBeTruthy();
  const resource = await resourceResponse.json();

  const presetResponse = await page.request.post(
    `${apiBaseURL}/api/working-hours/apply-preset/`,
    {
      headers,
      data: { business: businessId, preset: "weekdays_9_18" },
    },
  );
  expect(presetResponse.ok()).toBeTruthy();

  const firstSlotDate = nextBusinessWeekdayDate();
  let slots: Array<{ start_at: string; end_at: string }> = [];
  for (let dayOffset = 0; dayOffset < 10; dayOffset += 1) {
    const slotDate = addDays(firstSlotDate, dayOffset);
    const slotsResponse = await page.request.get(
      `${apiBaseURL}/api/appointments/available-slots/?business_id=${businessId}&service_id=${service.id}&resource_id=${resource.id}&date=${slotDate}`,
      { headers },
    );
    expect(slotsResponse.ok()).toBeTruthy();
    slots = await slotsResponse.json();
    if (slots.length > 0) break;
  }
  expect(slots.length).toBeGreaterThan(0);

  const appointmentResponse = await page.request.post(
    `${apiBaseURL}/api/appointments/`,
    {
      headers,
      data: {
        business: businessId,
        client: client.id,
        lead: lead.id,
        service: service.id,
        resource: resource.id,
        start_at: slots[0].start_at,
        end_at: slots[0].end_at,
        source: "manual",
        notes: "Playwright appointment workspace.",
      },
    },
  );
  expect(appointmentResponse.ok()).toBeTruthy();
  const appointment = await appointmentResponse.json();

  const botsResponse = await page.request.get(
    `${apiBaseURL}/api/bots/?business=${businessId}`,
    { headers },
  );
  expect(botsResponse.ok()).toBeTruthy();
  const botsPayload = await botsResponse.json();
  const existingBots = Array.isArray(botsPayload)
    ? botsPayload
    : botsPayload.results || [];
  let bot = existingBots[0];
  if (!bot) {
    const botResponse = await page.request.post(`${apiBaseURL}/api/bots/`, {
      headers,
      data: {
        business: businessId,
        name: `E2E Workspace Bot ${unique}`,
        status: "active",
        default_language: "ru",
      },
    });
    expect(botResponse.ok()).toBeTruthy();
    bot = await botResponse.json();
  }

  const conversationResponse = await page.request.post(
    `${apiBaseURL}/api/bot-conversations/`,
    {
      headers,
      data: {
        business: businessId,
        bot: bot.id,
        channel: "website",
        external_user_id: `workspace-visitor-${unique}`,
        client: client.id,
        lead: lead.id,
        deal: deal.id,
        priority: "high",
        bot_enabled: true,
        handoff_required: true,
        handoff_reason: "E2E workspace handoff",
      },
    },
  );
  expect(conversationResponse.ok()).toBeTruthy();
  const conversation = await conversationResponse.json();

  const messageResponse = await page.request.post(
    `${apiBaseURL}/api/bot-messages/`,
    {
      headers,
      data: {
        conversation: conversation.id,
        direction: "inbound",
        sender_type: "client",
        text: `E2E workspace conversation message ${unique}`,
        payload_json: { source: "entity_workspace_e2e" },
        status: "received",
      },
    },
  );
  expect(messageResponse.ok()).toBeTruthy();

  const taskResponse = await page.request.post(`${apiBaseURL}/api/tasks/`, {
    headers,
    data: {
      business: businessId,
      title: `E2E Workspace Task ${unique}`,
      client: client.id,
      lead: lead.id,
      deal: deal.id,
      appointment: appointment.id,
      conversation: conversation.id,
      priority: "normal",
    },
  });
  expect(taskResponse.ok()).toBeTruthy();
  const task = await taskResponse.json();

  await authenticate(page, tokens);

  await navigateInsideApp(page, `/app/clients/${client.id}`);
  await expect(page).toHaveURL(new RegExp(`/app/clients/${client.id}`));
  await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await expect(
    page.getByText(`E2E Workspace Client ${unique}`).first(),
  ).toBeVisible();
  await expect(
    page.locator('[data-crm-action-id="create_task"]'),
  ).toBeVisible();

  await navigateInsideApp(page, `/app/leads/${lead.id}`);
  await expect(page).toHaveURL(new RegExp(`/app/leads/${lead.id}`));
  await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await expect(
    page.getByText(`E2E workspace lead ${unique}`).first(),
  ).toBeVisible();
  await expect(page.locator('[data-crm-action-id="lost"]')).toBeVisible();

  await navigateInsideApp(page, `/app/deals/${deal.id}`);
  await expect(page).toHaveURL(new RegExp(`/app/deals/${deal.id}`));
  await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await expect(
    page.getByText(`E2E Workspace Deal ${unique}`).first(),
  ).toBeVisible();
  await expect(page.locator('[data-crm-action-id="won"]')).toBeVisible();
  await expect(page.locator('[data-crm-action-id="lost"]')).toBeVisible();

  await navigateInsideApp(page, `/app/calendar/${appointment.id}`);
  await expect(page).toHaveURL(new RegExp(`/app/calendar/${appointment.id}`));
  await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await expect(
    page.getByText(`E2E Workspace Service ${unique}`).first(),
  ).toBeVisible();
  await expect(
    page.locator('[data-appointment-action-id="confirmed"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-appointment-action-id="cancelled"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-appointment-action-id="reschedule"]'),
  ).toBeVisible();

  await navigateInsideApp(page, `/app/conversations/${conversation.id}`);
  await expect(page).toHaveURL(
    new RegExp(`/app/conversations/${conversation.id}`),
  );
  await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await expect(
    page
      .locator(".whitespace-pre-wrap")
      .filter({ hasText: `E2E workspace conversation message ${unique}` }),
  ).toBeVisible();
  await expect(
    page.locator('[data-conversation-action-id="assign"]'),
  ).toBeVisible();

  await navigateInsideApp(page, `/app/tasks/${task.id}`);
  await expect(page).toHaveURL(new RegExp(`/app/tasks/${task.id}`));
  await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await expect(
    page.getByText(`E2E Workspace Task ${unique}`).first(),
  ).toBeVisible();
  await expect(page.locator('[data-task-action-id="complete"]')).toBeVisible();
  await expect(page.locator('[data-task-action-id="cancel"]')).toBeVisible();

  const dashboardMetricsPromise = waitForOwnerDashboardMetrics(page);
  await page.goto("/app");
  const dashboardMetrics = await dashboardMetricsPromise;
  await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expect(dashboardMetrics.total_leads ?? 0).toBeGreaterThan(0);
  expect(dashboardMetrics.new_leads ?? 0).toBeGreaterThan(0);
  expect(dashboardMetrics.open_tasks ?? 0).toBeGreaterThan(0);

  const analyticsReportPromise = waitForAnalyticsReportSummary(page);
  await navigateInsideApp(page, "/app/analytics");
  await analyticsReportPromise;
  await expect(page).toHaveURL(/\/app\/analytics/);
  await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await navigateInsideApp(page, `/app/clients?client=${client.id}`);
  await expect(page).toHaveURL(new RegExp(`/app/clients/${client.id}`));
  await expectNoHorizontalOverflow(page);

  await navigateInsideApp(page, `/app/leads?lead=${lead.id}`);
  await expect(page).toHaveURL(new RegExp(`/app/leads/${lead.id}`));
  await expectNoHorizontalOverflow(page);

  await navigateInsideApp(page, `/app/deals?deal=${deal.id}`);
  await expect(page).toHaveURL(new RegExp(`/app/deals/${deal.id}`));
  await expectNoHorizontalOverflow(page);

  await navigateInsideApp(page, `/app/tasks?task=${task.id}`);
  await expect(page).toHaveURL(new RegExp(`/app/tasks/${task.id}`));
  await expectNoHorizontalOverflow(page);

  await navigateInsideApp(
    page,
    `/app/conversations?conversation=${conversation.id}`,
  );
  await expect(page).toHaveURL(
    new RegExp(`/app/conversations/${conversation.id}`),
  );
  await expectNoHorizontalOverflow(page);
});
