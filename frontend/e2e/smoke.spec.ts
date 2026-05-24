import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, "../..");
const password = process.env.E2E_PASSWORD || "ZaniTest123!";
const apiBaseURL = process.env.E2E_API_BASE_URL || "http://127.0.0.1:8000";

const users = {
  platform: process.env.E2E_PLATFORM_EMAIL || "platform_admin@example.com",
  owner: process.env.E2E_OWNER_EMAIL || "business_owner@example.com",
  operator: process.env.E2E_OPERATOR_EMAIL || "business_operator@example.com",
};

type TokenPayload = {
  access: string;
  refresh: string;
};

const tokenCache = new Map<string, TokenPayload>();

test.beforeAll(() => {
  if (process.env.E2E_SKIP_LOCAL_SETUP === "true") {
    return;
  }

  execFileSync(
    ".venv/bin/python",
    ["manage.py", "migrate"],
    { cwd: rootDir, env: { ...process.env, DATABASE_URL: "sqlite:///db.sqlite3" }, stdio: "inherit" },
  );
  execFileSync(
    ".venv/bin/python",
    ["manage.py", "prepare_e2e_smoke_data"],
    { cwd: rootDir, env: { ...process.env, DATABASE_URL: "sqlite:///db.sqlite3" }, stdio: "inherit" },
  );
});

async function login(page: Page, email: string, target: RegExp) {
  const tokens = await apiLogin(page, email);
  const targetPath = target.source.includes("platform") ? "/platform" : "/dashboard";
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.evaluate(
    ({ access, refresh }) => {
      localStorage.setItem("ai_smb_access_token", access);
      localStorage.setItem("ai_smb_refresh_token", refresh);
    },
    tokens,
  );
  await page.goto(targetPath);
  await expect(page).toHaveURL(target);
}

async function navigateInsideApp(page: Page, path: string) {
  await page.locator(`a[href="${path}"]`).first().click({ force: true });
  await expect(page).toHaveURL(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

async function apiLogin(page: Page, email: string) {
  const cached = tokenCache.get(email);
  if (cached) return cached;

  let response = await page.request.post(`${apiBaseURL}/api/auth/token/`, {
    data: { email, password },
  });
  for (let attempt = 0; attempt < 3 && response.status() === 429; attempt += 1) {
    await page.waitForTimeout(10_000);
    response = await page.request.post(`${apiBaseURL}/api/auth/token/`, {
      data: { email, password },
    });
  }
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as TokenPayload;
  expect(payload.access).toBeTruthy();
  expect(payload.refresh).toBeTruthy();
  tokenCache.set(email, payload);
  return payload;
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

test("platform admin lands in platform workspace", async ({ page }) => {
  await login(page, users.platform, /\/platform/);

  await expect(page).toHaveURL(/\/platform/);
  await expect(page.getByText("Zani overview")).toBeVisible();
  await expect(page.getByText("Total merchants")).toBeVisible();
});

test("business owner can use core merchant CRM pages", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop navigation smoke is covered separately from mobile bottom navigation.");

  await login(page, users.owner, /\/dashboard/);

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: /Рабочий стол бизнеса|Business dashboard|Бизнес басқару панелі/ })).toBeVisible();

  await navigateInsideApp(page, "/dashboard/leads");
  await expect(page.getByRole("heading", { name: "Sales pipeline" })).toBeVisible();
  await page.getByRole("button", { name: /Открыть|Open/ }).first().click();
  await expect(page.getByRole("button", { name: "История" })).toBeVisible();
  await page.getByRole("button", { name: "Заметки" }).click();
  await page.getByPlaceholder("Например: клиент просит перезвонить вечером").fill("E2E CRM Light comment");
  await page.getByRole("button", { name: "Добавить комментарий" }).click();
  await expect(page.getByRole("paragraph").filter({ hasText: "E2E CRM Light comment" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Задачи" }).click();
  await page.getByPlaceholder("Например: перезвонить сегодня").fill("E2E CRM Light follow-up");
  await page.getByRole("button", { name: "Создать задачу" }).click();
  await expect(page.getByText("E2E CRM Light follow-up").first()).toBeVisible();
  await page.getByRole("button", { name: "Закрыть карточку" }).click();

  await navigateInsideApp(page, "/dashboard/conversations");
  await expect(page.getByRole("heading", { name: "Conversations" })).toBeVisible();

  await navigateInsideApp(page, "/dashboard/settings");
  await expect(page.getByRole("heading", { name: /Настройки|Settings/ })).toBeVisible();
});

test("business owner core routes render without 404", async ({ page, isMobile }) => {
  test.skip(isMobile, "Full route audit uses desktop sidebar routes; mobile has a separate reachability smoke.");

  await login(page, users.owner, /\/dashboard/);

  const routes = [
    "/dashboard",
    "/dashboard/leads",
    "/dashboard/deals",
    "/dashboard/clients",
    "/dashboard/tasks",
    "/dashboard/calendar",
    "/dashboard/appointments",
    "/dashboard/services",
    "/dashboard/resources",
    "/dashboard/conversations",
    "/dashboard/bots",
    "/dashboard/integrations",
    "/dashboard/analytics",
    "/dashboard/settings",
    "/dashboard/ai",
  ];

  for (const route of routes) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\&").replace(/\\&/g, "\\$&")));
    await expect(page.getByText("Страница не найдена")).toHaveCount(0);
    await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  }
});

test("header notifications popover opens and closes safely", async ({ page, isMobile }) => {
  test.skip(isMobile, "Mobile header tap targets are covered by the mobile smoke.");

  await login(page, users.owner, /\/dashboard/);

  await page.getByRole("button", { name: /Уведомления|Notifications/ }).click();
  await expect(page.locator("header").getByText(/Уведомления|Notifications/).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("header").getByText(/Уведомления|Notifications/).first()).toBeHidden();
});

test("core merchant business flow works through API", async ({ page, isMobile }) => {
  test.skip(isMobile, "API business-flow smoke only needs one browser project.");

  const tokens = await apiLogin(page, users.owner);
  const headers = authHeaders(tokens);
  const unique = Date.now();

  const meResponse = await page.request.get(`${apiBaseURL}/api/auth/me/`, { headers });
  expect(meResponse.ok()).toBeTruthy();
  const me = await meResponse.json();
  const business = me.businesses?.[0];
  expect(business?.id).toBeTruthy();
  const businessId = business.id;

  const clientResponse = await page.request.post(`${apiBaseURL}/api/clients/`, {
    headers,
    data: {
      business: businessId,
      full_name: `E2E Client ${unique}`,
      phone: `+7701${String(unique).slice(-7)}`,
      email: `e2e-${unique}@example.com`,
      source: "manual",
    },
  });
  expect(clientResponse.ok()).toBeTruthy();
  const client = await clientResponse.json();

  const serviceResponse = await page.request.post(`${apiBaseURL}/api/services/`, {
    headers,
    data: {
      business: businessId,
      name: `E2E Service ${unique}`,
      description: "Created by Playwright smoke.",
      duration_minutes: 30,
      price_from: "1000.00",
      is_active: true,
    },
  });
  expect(serviceResponse.ok()).toBeTruthy();
  const service = await serviceResponse.json();

  const resourceResponse = await page.request.post(`${apiBaseURL}/api/resources/`, {
    headers,
    data: {
      business: businessId,
      name: `E2E Specialist ${unique}`,
      resource_type: "staff",
      is_active: true,
    },
  });
  expect(resourceResponse.ok()).toBeTruthy();
  const resource = await resourceResponse.json();

  const presetResponse = await page.request.post(`${apiBaseURL}/api/working-hours/apply-preset/`, {
    headers,
    data: { business: businessId, preset: "weekdays_9_18" },
  });
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

  const appointmentResponse = await page.request.post(`${apiBaseURL}/api/appointments/`, {
    headers,
    data: {
      business: businessId,
      client: client.id,
      service: service.id,
      resource: resource.id,
      start_at: slots[0].start_at,
      end_at: slots[0].end_at,
      status: "created",
      source: "manual",
      notes: "Playwright appointment smoke.",
    },
  });
  expect(appointmentResponse.ok()).toBeTruthy();
  const appointment = await appointmentResponse.json();
  expect(appointment.client).toBe(client.id);

  const leadResponse = await page.request.post(`${apiBaseURL}/api/leads/`, {
    headers,
    data: {
      business: businessId,
      client: client.id,
      service: service.id,
      source: "manual",
      message: "Playwright lead smoke.",
      status: "new",
    },
  });
  expect(leadResponse.ok()).toBeTruthy();
  const lead = await leadResponse.json();

  const dealResponse = await page.request.post(`${apiBaseURL}/api/leads/${lead.id}/create-deal/`, {
    headers,
    data: { title: `E2E Deal ${unique}`, amount: "2500.00" },
  });
  expect(dealResponse.ok()).toBeTruthy();
  const deal = await dealResponse.json();
  expect(deal.lead).toBe(lead.id);

  const taskResponse = await page.request.post(`${apiBaseURL}/api/tasks/`, {
    headers,
    data: {
      business: businessId,
      title: `E2E Follow-up ${unique}`,
      client: client.id,
      lead: lead.id,
      deal: deal.id,
      appointment: appointment.id,
      priority: "normal",
      status: "open",
    },
  });
  expect(taskResponse.ok()).toBeTruthy();
  const task = await taskResponse.json();
  expect(task.deal).toBe(deal.id);
});

test("business owner can create an appointment from calendar UI", async ({ page, isMobile }) => {
  test.skip(isMobile, "Calendar booking UI smoke runs in desktop; mobile route reachability is covered separately.");

  const tokens = await apiLogin(page, users.owner);
  const headers = authHeaders(tokens);
  const unique = Date.now();

  const meResponse = await page.request.get(`${apiBaseURL}/api/auth/me/`, { headers });
  expect(meResponse.ok()).toBeTruthy();
  const me = await meResponse.json();
  const businessId = me.businesses?.[0]?.id;
  expect(businessId).toBeTruthy();

  const clientResponse = await page.request.post(`${apiBaseURL}/api/clients/`, {
    headers,
    data: {
      business: businessId,
      full_name: `Calendar Client ${unique}`,
      phone: `+7702${String(unique).slice(-7)}`,
      email: `calendar-${unique}@example.com`,
      source: "manual",
    },
  });
  expect(clientResponse.ok()).toBeTruthy();
  const client = await clientResponse.json();

  const serviceResponse = await page.request.post(`${apiBaseURL}/api/services/`, {
    headers,
    data: {
      business: businessId,
      name: `Calendar Haircut ${unique}`,
      description: "Calendar UI smoke service.",
      duration_minutes: 30,
      price_from: "5000.00",
      is_active: true,
    },
  });
  expect(serviceResponse.ok()).toBeTruthy();
  const service = await serviceResponse.json();

  const resourceResponse = await page.request.post(`${apiBaseURL}/api/resources/`, {
    headers,
    data: {
      business: businessId,
      name: `Calendar Master ${unique}`,
      resource_type: "staff",
      is_active: true,
    },
  });
  expect(resourceResponse.ok()).toBeTruthy();
  const resource = await resourceResponse.json();

  const presetResponse = await page.request.post(`${apiBaseURL}/api/working-hours/apply-preset/`, {
    headers,
    data: { business: businessId, preset: "daily_9_20", resource: resource.id },
  });
  expect(presetResponse.ok()).toBeTruthy();

  const slotDate = addDays(new Date().toISOString().slice(0, 10), 1);
  const slotsResponse = await page.request.get(
    `${apiBaseURL}/api/appointments/available-slots/?business_id=${businessId}&service_id=${service.id}&resource_id=${resource.id}&date=${slotDate}`,
    { headers },
  );
  expect(slotsResponse.ok()).toBeTruthy();
  const slots: Array<{ start_at: string; end_at: string }> = await slotsResponse.json();
  expect(slots.length).toBeGreaterThan(0);

  await login(page, users.owner, /\/dashboard/);
  await page.goto("/dashboard/calendar");
  await expect(page.getByRole("heading", { name: /Календарь бизнеса|Business calendar|Бизнес күнтізбесі/ })).toBeVisible();

  await page.getByRole("button", { name: /Свободное окно|Available slot/ }).first().click();
  await expect(page.getByRole("heading", { name: /Новая запись|New booking|Жаңа жазба/ })).toBeVisible();
  await page.getByRole("button", { name: /Закрыть|Close/ }).click();

  await page.getByRole("button", { name: /Новая запись/ }).click();
  await expect(page.getByRole("heading", { name: /Новая запись|New booking|Жаңа жазба/ })).toBeVisible();

  await page.getByLabel("Клиент").selectOption(String(client.id));
  await page.getByLabel("Услуга").selectOption(String(service.id));
  await page.getByLabel("Мастер / ресурс").selectOption(String(resource.id));
  await page.getByLabel("Дата").fill(slotDate);
  await expect.poll(async () => page.getByLabel("Свободный слот").locator("option").count()).toBeGreaterThan(1);
  await page.getByLabel("Свободный слот").selectOption(slots[0].start_at);
  await page.getByRole("button", { name: "Создать запись" }).click();

  await expect(page.getByText("Запись создана и появилась в календаре.")).toBeVisible();
  await expect(page.getByText(`Calendar Client ${unique}`)).toBeVisible();
});

test("operator cannot read another tenant through direct object URLs", async ({ page, isMobile }) => {
  test.skip(isMobile, "Tenant API smoke only needs one browser project.");

  const ownerTokens = await apiLogin(page, users.owner);
  const platformTokens = await apiLogin(page, users.platform);
  const operatorTokens = await apiLogin(page, users.operator);

  const activationResponse = await page.request.post(`${apiBaseURL}/api/platform/activate-landing/`, {
    headers: authHeaders(platformTokens),
    data: {
      landing_id: `e2e-foreign-${Date.now()}`,
      owner_email: `foreign-owner-${Date.now()}@example.com`,
      owner_password: password,
      owner_full_name: "Foreign Owner",
      business_name: "Foreign Tenant",
      business_type: "medical",
      city: "Almaty",
    },
  });
  expect(activationResponse.ok()).toBeTruthy();

  const foreignOwnerEmail = (await activationResponse.json()).owner?.email;
  expect(foreignOwnerEmail).toBeTruthy();
  const foreignTokens = await apiLogin(page, foreignOwnerEmail);
  const foreignMeResponse = await page.request.get(`${apiBaseURL}/api/auth/me/`, { headers: authHeaders(foreignTokens) });
  const foreignBusiness = (await foreignMeResponse.json()).businesses?.[0];
  expect(foreignBusiness?.id).toBeTruthy();

  const foreignClientResponse = await page.request.post(`${apiBaseURL}/api/clients/`, {
    headers: authHeaders(foreignTokens),
    data: {
      business: foreignBusiness.id,
      full_name: "Foreign Tenant Client",
      phone: "+77019999999",
      source: "manual",
    },
  });
  expect(foreignClientResponse.ok()).toBeTruthy();
  const foreignClient = await foreignClientResponse.json();

  const operatorForeignClientResponse = await page.request.get(`${apiBaseURL}/api/clients/${foreignClient.id}/`, {
    headers: authHeaders(operatorTokens),
  });
  expect([403, 404]).toContain(operatorForeignClientResponse.status());

  const ownerForeignClientResponse = await page.request.get(`${apiBaseURL}/api/clients/${foreignClient.id}/`, {
    headers: authHeaders(ownerTokens),
  });
  expect([403, 404]).toContain(ownerForeignClientResponse.status());
});

test("public routes render without login", async ({ page }) => {
  const routes = ["/", "/pricing", "/bots", "/crm", "/contacts"];

  for (const route of routes) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`${route === "/" ? "/$" : route}`));
    await expect(page.getByText("Страница не найдена")).toHaveCount(0);
    await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  }
});

test("platform routes render without merchant sidebar", async ({ page, isMobile }) => {
  test.skip(isMobile, "Platform route audit runs in desktop project.");

  await login(page, users.platform, /\/platform/);

  const routes = ["/platform", "/platform/merchants", "/platform/settings"];
  for (const route of routes) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(route === "/platform" ? "/platform/?$" : route));
    await expect(page.getByText("Страница не найдена")).toHaveCount(0);
    await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
    await expect(page.getByText("Platform Admin", { exact: true }).first()).toBeVisible();
  }

  await page.goto("/platform/merchants");
  const firstMerchant = page.locator('a[href^="/platform/merchants/"]').first();
  if (await firstMerchant.count()) {
    await firstMerchant.click();
    await expect(page).toHaveURL(/\/platform\/merchants\/\d+/);
    await expect(page.getByText("Platform support")).toBeVisible();
  }
});

test("activated landing owner sees first-run dashboard", async ({ page, isMobile }) => {
  test.setTimeout(75_000);
  test.skip(isMobile, "First-run empty state is covered in desktop; mobile layout is covered by the mobile smoke.");

  const tokenPayload = await apiLogin(page, users.platform);

  const activationResponse = await page.request.post(`${apiBaseURL}/api/platform/activate-landing/`, {
    headers: authHeaders(tokenPayload),
    data: {
      landing_id: "e2e-first-run-landing",
      owner_email: "e2e_activation_owner@example.com",
      owner_password: password,
      owner_full_name: "E2E Activation Owner",
      business_name: "E2E Activated Clinic",
      business_type: "medical",
      landing_domain: "e2e-landing.zani.test",
      landing_preview_url: "https://example.com/e2e-landing",
      city: "Almaty",
    },
  });
  expect(activationResponse.ok()).toBeTruthy();

  await login(page, "e2e_activation_owner@example.com", /\/dashboard/);

  await expect(page.getByText("Ваш лендинг активирован")).toBeVisible();
  await expect(page.getByText("У вас открыт подарочный месяц расширенного доступа. Доплачивать сейчас не нужно")).toBeVisible();
  await expect(page.getByText(/ZANI видит ваш бизнес на \d+%/)).toBeVisible();
  await expect(page.getByText("WhatsApp", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("1C export", { exact: true }).first()).toBeVisible();
});

test("merchant users cannot open platform workspace", async ({ page }) => {
  await login(page, users.owner, /\/dashboard/);
  await page.goto("/platform");

  await expect(page).toHaveURL(/\/dashboard/);
});

test("operator sees restricted sections as forbidden", async ({ page }) => {
  await login(page, users.operator, /\/dashboard/);
  await page.goto("/dashboard/settings");

  await expect(page.getByText("Раздел скрыт настройками доступа")).toBeVisible();
  await expect(page.getByText(/роль|access/i)).toBeVisible();
});

test("mobile owner smoke: dashboard and calendar are reachable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile viewport smoke runs only in the mobile project.");

  await login(page, users.owner, /\/dashboard/);
  await expect(page.getByRole("heading", { name: /Рабочий стол бизнеса|Business dashboard|Бизнес басқару панелі/ })).toBeVisible();

  await page.getByRole("button", { name: /Развернуть меню|Expand menu/ }).click();
  const closeSidebarButton = page.getByRole("button", { name: /Свернуть меню|Collapse menu/ }).last();
  await expect(closeSidebarButton).toBeVisible();
  await closeSidebarButton.click();

  await page.getByRole("button", { name: /Ещё|More/ }).click();
  await page.locator('a[href="/dashboard/calendar"]').first().click();
  await expect(page).toHaveURL(/\/dashboard\/calendar/);
  await expect(page.getByRole("heading", { name: /Календарь бизнеса|Business calendar|Бизнес күнтізбесі/ })).toBeVisible();
});
