import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_PASSWORD || "ZaniTest123!";
const apiBaseURL = process.env.E2E_API_BASE_URL || "http://127.0.0.1:8000";

const users = {
  platform: process.env.E2E_PLATFORM_EMAIL || "platform_admin@example.com",
  owner: process.env.E2E_OWNER_EMAIL || "business_owner@example.com",
  manager: process.env.E2E_MANAGER_EMAIL || "business_manager@example.com",
  operator: process.env.E2E_OPERATOR_EMAIL || "business_operator@example.com",
};

type TokenPayload = {
  access: string;
  refresh: string;
};

const tokenCache = new Map<string, TokenPayload>();

test("mobile manager smoke: daily CRM routes are reachable", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Mobile manager smoke runs only in the mobile project.");

  await login(page, users.manager, /\/app/);
  await expect(page).toHaveURL(/\/app/);
  await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);

  const bottomNavRoutes = ["/app/leads", "/app/conversations", "/app/clients"];
  for (const route of bottomNavRoutes) {
    await page.locator(`nav a[href="${route}"]`).last().click();
    await expect(page).toHaveURL(routePattern(route));
    await expectNoHorizontalOverflow(page);
    await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  }

  const drawerRoutes = [
    "/app/tasks",
    "/app/calendar",
    "/app/deals",
    "/app/analytics",
  ];
  for (const route of drawerRoutes) {
    await page.locator("nav button").last().click();
    await page.locator(`a[href="${route}"]`).last().click();
    await expect(page).toHaveURL(routePattern(route));
    await expectNoHorizontalOverflow(page);
    await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  }
});

async function login(page: Page, email: string, target: RegExp) {
  const tokens = await apiLogin(page, email);
  const targetPath = target.source.includes("platform") ? "/platform" : "/app";
  await page.route("**/api/auth/token/refresh/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access: tokens.access }),
    });
  });
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.evaluate(({ access, refresh }) => {
    localStorage.setItem("ai_smb_access_token", access);
    localStorage.setItem("ai_smb_refresh_token", refresh);
  }, tokens);
  await page.goto(targetPath);
  const emailInput = page.locator('form input[type="email"]').first();
  if (await emailInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await emailInput.fill(email);
    await page.locator('form input[type="password"]').first().fill(password);
    await page.locator('form button[type="submit"]').click();
  }
  await expect(page).toHaveURL(target);
  if (!target.source.includes("platform")) {
    await ensureAuthenticatedAppShell(page, email);
    await page.waitForTimeout(3_000);
    await ensureAuthenticatedAppShell(page, email);
  }
}

async function ensureAuthenticatedAppShell(page: Page, email: string) {
  const appNavLink = page.locator('nav a[href="/app/leads"]:visible').first();
  if (await appNavLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
    return;
  }

  const emailInput = page.locator('form input[type="email"]').first();
  if (await emailInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await emailInput.fill(email);
    await page.locator('form input[type="password"]').first().fill(password);
    await page.locator('form button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app/);
  }

  await expect(appNavLink).toBeVisible({ timeout: 15_000 });
}

async function navigateInsideApp(page: Page, path: string) {
  await page.locator(`a[href="${path}"]:visible`).first().click();
  await expect(page).toHaveURL(
    new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
}

function routePattern(route: string) {
  return new RegExp(
    route === "/app" ? "/app/?$" : route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
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

async function expectNoOwnerOnlyTechnicalNoise(page: Page) {
  await expect(page.getByText(/Billing/i)).toHaveCount(0);
  await expect(
    page.getByText(/API and events|webhook|payload|provider|token|secret/i),
  ).toHaveCount(0);
}

async function expectFirstDialogFitsViewport(page: Page) {
  const dialog = page.getByRole("dialog").first();
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(box).toBeTruthy();
  expect(viewport).toBeTruthy();
  if (!box || !viewport) return;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function apiLogin(page: Page, email: string) {
  const cached = tokenCache.get(email);
  if (cached) return cached;

  let response = await page.request.post(`${apiBaseURL}/api/auth/token/`, {
    data: { email, password },
  });
  for (
    let attempt = 0;
    attempt < 3 && response.status() === 429;
    attempt += 1
  ) {
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
  await expect(
    page.getByRole("heading", { name: /РћР±Р·РѕСЂ Zani|Zani overview/ }),
  ).toBeVisible();
  await expect(page.getByText(/Р’СЃРµРіРѕ РјРµСЂС‡Р°РЅС‚РѕРІ|Total merchants/)).toBeVisible();
});

test("business owner can use core merchant CRM pages", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "Desktop navigation smoke is covered separately from mobile bottom navigation.",
  );

  await login(page, users.owner, /\/app/);

  await expect(page).toHaveURL(/\/app/);
  await expect(page.getByText(/Р’С‹СЂСѓС‡РєР°|Revenue/).first()).toBeVisible();

  await navigateInsideApp(page, "/app/leads");
  await expect(page).toHaveURL(/\/app\/leads/);
  await page.getByTestId("lead-row-action-open").first().click();
  await expect(page).toHaveURL(/\/app\/leads\/\d+/);
  await expect(page.locator("main h1").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "contacted" })).toBeVisible();
  await expect(page.getByRole("button", { name: "close" })).toBeVisible();
  await expect(page.getByRole("button", { name: "lost" })).toBeVisible();
  await page.goto("/app/leads");
  await expect(page).toHaveURL(/\/app\/leads/);

  await navigateInsideApp(page, "/app/conversations");
  await expect(page.getByText(/РЎРѕРѕР±С‰РµРЅРёСЏ|Messages/).first()).toBeVisible();

  await navigateInsideApp(page, "/app/settings");
  await expect(
    page.getByRole("heading", { name: /РќР°СЃС‚СЂРѕР№РєРё|Settings/ }),
  ).toBeVisible();
});

test("business owner core routes render without 404", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(120_000);
  test.skip(
    isMobile,
    "Full route audit uses desktop sidebar routes; mobile has a separate reachability smoke.",
  );

  await login(page, users.owner, /\/app/);

  const routes = [
    "/app",
    "/app/leads",
    "/app/deals",
    "/app/clients",
    "/app/tasks",
    "/app/calendar",
    "/app/services",
    "/app/resources",
    "/app/conversations",
    "/app/bots",
    "/app/integrations",
    "/app/pricing",
    "/app/ai-assistant",
    "/app/ai-agents",
    "/app/automations",
    "/app/working-hours",
    "/app/analytics",
    "/app/settings",
    "/app/ai",
  ];

  for (const route of routes) {
    await page.goto(route);
    await expect(page).toHaveURL(routePattern(route));
    await expectNoHorizontalOverflow(page);
    await expect(page.getByText("РЎС‚СЂР°РЅРёС†Р° РЅРµ РЅР°Р№РґРµРЅР°")).toHaveCount(0);
    await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  }
});

test("manager and operator role UX stays useful and safe", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(90_000);
  test.skip(
    isMobile,
    "Desktop role UX smoke is separate from mobile role navigation.",
  );

  await login(page, users.manager, /\/app/);

  const managerDailyRoutes = [
    "/app",
    "/app/leads",
    "/app/deals",
    "/app/clients",
    "/app/tasks",
    "/app/calendar",
    "/app/conversations",
    "/app/analytics",
  ];

  for (const route of managerDailyRoutes) {
    await page.goto(route);
    await expect(page).toHaveURL(routePattern(route));
    await expectNoHorizontalOverflow(page);
    await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  }

  for (const route of ["/app/settings", "/app/integrations"]) {
    await page.goto(route);
    await expect(page).toHaveURL(routePattern(route));
    await expect(page.getByRole("alert")).toBeVisible();
    await expectNoOwnerOnlyTechnicalNoise(page);
  }

  await login(page, users.operator, /\/app/);

  const operatorDailyRoutes = ["/app", "/app/tasks", "/app/conversations"];
  for (const route of operatorDailyRoutes) {
    await page.goto(route);
    await expect(page).toHaveURL(routePattern(route));
    await expectNoHorizontalOverflow(page);
    await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  }

  await page.goto("/app/settings");
  await expect(page.getByRole("alert")).toBeVisible();
  await expectNoOwnerOnlyTechnicalNoise(page);
});

test("desktop sidebar links render without 404", async ({ page, isMobile }) => {
  test.setTimeout(90_000);
  test.skip(
    isMobile,
    "Desktop sidebar route audit runs in the desktop project.",
  );

  await login(page, users.owner, /\/app/);

  const sidebarRoutes = [
    "/app",
    "/app/leads",
    "/app/deals",
    "/app/clients",
    "/app/conversations",
    "/app/ai-agents",
    "/app/integrations",
    "/app/analytics",
    "/app/settings",
  ];

  for (const route of sidebarRoutes) {
    const sidebarLink = page.locator(`aside a[href="${route}"]`).first();
    await expect(sidebarLink).toBeVisible();
    await sidebarLink.click({ force: true });
    await expect(page).toHaveURL(routePattern(route));
    await expectNoHorizontalOverflow(page);
    await expect(page.getByText("РЎС‚СЂР°РЅРёС†Р° РЅРµ РЅР°Р№РґРµРЅР°")).toHaveCount(0);
    await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  }

  await page.goto("/app/ai-agents/999999/not-a-section");
  await expect(page).toHaveURL(/\/app\/ai-agents\/\d+\/(overview|profile)/);
  await expect(page.getByText("РЎС‚СЂР°РЅРёС†Р° РЅРµ РЅР°Р№РґРµРЅР°")).toHaveCount(0);
  await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("header notifications popover opens and closes safely", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "Mobile header tap targets are covered by the mobile smoke.",
  );

  await login(page, users.owner, /\/app/);

  await page.getByRole("button", { name: /\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f|РЈРІРµРґРѕРјР»РµРЅРёСЏ|Notifications/ }).click();
  await expect(
    page
      .locator("header")
      .getByText(/\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f|РЈРІРµРґРѕРјР»РµРЅРёСЏ|Notifications/)
      .first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page
      .locator("header")
      .getByText(/\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f|РЈРІРµРґРѕРјР»РµРЅРёСЏ|Notifications/)
      .first(),
  ).toBeHidden();
});

test("global search and command palette open safely", async ({ page, isMobile }) => {
  test.skip(
    isMobile,
    "Desktop shell search and command palette are covered in the desktop project.",
  );

  await login(page, users.owner, /\/app/);

  await page.goto("/app");
  await expect(page.locator("header")).toBeVisible();
  await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  const headerSearch = page.locator("header input:visible").first();
  await expect(headerSearch).toBeVisible();
  await headerSearch.click();
  await expect(page.getByRole("button", { name: /\u042d\u0442\u0430 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430|Р­С‚Р° СЃС‚СЂР°РЅРёС†Р°|Р В­РЎвЂљР В° РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ Р В°|This page/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /\u0412\u0441\u044f CRM|Р’СЃСЏ CRM|Р вЂ™РЎРѓРЎРЏ CRM|All CRM/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /\u042d\u0442\u0430 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430|Р­С‚Р° СЃС‚СЂР°РЅРёС†Р°|Р В­РЎвЂљР В° РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ Р В°|This page/ })).toHaveCount(0);

  await page.keyboard.press("Control+K");
  await expect(page.getByPlaceholder(/\u041f\u043e\u0438\u0441\u043a \u0438\u043b\u0438 \u043a\u043e\u043c\u0430\u043d\u0434\u0430|РџРѕРёСЃРє РёР»Рё РєРѕРјР°РЅРґР°|Р СџР С•Р С‘РЎРѓР С” Р С‘Р В»Р С‘ Р С”Р С•Р СР В°Р Р…Р Т‘Р В°|Search or command/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByPlaceholder(/\u041f\u043e\u0438\u0441\u043a \u0438\u043b\u0438 \u043a\u043e\u043c\u0430\u043d\u0434\u0430|РџРѕРёСЃРє РёР»Рё РєРѕРјР°РЅРґР°|Р СџР С•Р С‘РЎРѓР С” Р С‘Р В»Р С‘ Р С”Р С•Р СР В°Р Р…Р Т‘Р В°|Search or command/)).toHaveCount(0);
});

test("core merchant business flow works through API", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "API business-flow smoke only needs one browser project.",
  );

  const tokens = await apiLogin(page, users.owner);
  const headers = authHeaders(tokens);
  const unique = Date.now();

  const meResponse = await page.request.get(`${apiBaseURL}/api/auth/me/`, {
    headers,
  });
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

  const serviceResponse = await page.request.post(
    `${apiBaseURL}/api/services/`,
    {
      headers,
      data: {
        business: businessId,
        name: `E2E Service ${unique}`,
        description: "Created by Playwright smoke.",
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
        name: `E2E Specialist ${unique}`,
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
        service: service.id,
        resource: resource.id,
        start_at: slots[0].start_at,
        end_at: slots[0].end_at,
        status: "created",
        source: "manual",
        notes: "Playwright appointment smoke.",
      },
    },
  );
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

  const dealResponse = await page.request.post(
    `${apiBaseURL}/api/leads/${lead.id}/create-deal/`,
    {
      headers,
      data: { title: `E2E Deal ${unique}`, amount: "2500.00" },
    },
  );
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

test("business owner can create an appointment from calendar UI", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "Calendar booking UI smoke runs in desktop; mobile route reachability is covered separately.",
  );

  const tokens = await apiLogin(page, users.owner);
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
      full_name: `Calendar Client ${unique}`,
      phone: `+7702${String(unique).slice(-7)}`,
      email: `calendar-${unique}@example.com`,
      source: "manual",
    },
  });
  expect(clientResponse.ok()).toBeTruthy();
  const client = await clientResponse.json();

  const serviceResponse = await page.request.post(
    `${apiBaseURL}/api/services/`,
    {
      headers,
      data: {
        business: businessId,
        name: `Calendar Haircut ${unique}`,
        description: "Calendar UI smoke service.",
        duration_minutes: 30,
        price_from: "5000.00",
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
        name: `Calendar Master ${unique}`,
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
      data: {
        business: businessId,
        preset: "daily_9_20",
        resource: resource.id,
      },
    },
  );
  expect(presetResponse.ok()).toBeTruthy();

  const slotDate = addDays(new Date().toISOString().slice(0, 10), 1);
  const slotsResponse = await page.request.get(
    `${apiBaseURL}/api/appointments/available-slots/?business_id=${businessId}&service_id=${service.id}&resource_id=${resource.id}&date=${slotDate}`,
    { headers },
  );
  expect(slotsResponse.ok()).toBeTruthy();
  const slots: Array<{ start_at: string; end_at: string }> =
    await slotsResponse.json();
  expect(slots.length).toBeGreaterThan(0);

  await login(page, users.owner, /\/app/);
  await page.goto("/app/calendar");
  await expect(page).toHaveURL(/\/app\/calendar/);
  await expect(
    page
      .getByRole("button", { name: /РќРѕРІР°СЏ Р·Р°РїРёСЃСЊ|New booking|Р–Р°ТЈР° Р¶Р°Р·Р±Р°/ })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Р”РµРЅСЊ|Day|РљТЇРЅ/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /РќРµРґРµР»СЏ|Week|РђРїС‚Р°/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /РњРµСЃСЏС†|Month|РђР№/ }),
  ).toBeVisible();
  await expect(page).toHaveURL(
    /\/app\/calendar\?date=\d{4}-\d{2}-\d{2}&view=day/,
  );

  await page.getByRole("button", { name: /РќРµРґРµР»СЏ|Week|РђРїС‚Р°/ }).click();
  await expect(page).toHaveURL(/view=week/);
  await expect(
    page.getByRole("button", { name: /РќРµРґРµР»СЏ|Week|РђРїС‚Р°/ }),
  ).toHaveClass(/text-brand-700/);

  await page.getByRole("button", { name: /РњРµСЃСЏС†|Month|РђР№/ }).click();
  await expect(page).toHaveURL(/view=month/);
  await expect(
    page.getByRole("button", { name: /РњРµСЃСЏС†|Month|РђР№/ }),
  ).toHaveClass(/text-brand-700/);

  await page.getByRole("button", { name: /Р”РµРЅСЊ|Day|РљТЇРЅ/ }).click();
  await expect(page).toHaveURL(/view=day/);
  await expect(page.getByRole("button", { name: /Р”РµРЅСЊ|Day|РљТЇРЅ/ })).toHaveClass(
    /text-brand-700/,
  );

  await page
    .getByRole("button", { name: /РќРѕРІР°СЏ Р·Р°РїРёСЃСЊ|New booking|Р–Р°ТЈР° Р¶Р°Р·Р±Р°/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: /РќРѕРІР°СЏ Р·Р°РїРёСЃСЊ|New booking|Р–Р°ТЈР° Р¶Р°Р·Р±Р°/ }),
  ).toBeVisible();

  await page.locator('select[name="client"]').selectOption(String(client.id));
  await page.locator('select[name="service"]').selectOption(String(service.id));
  await page
    .locator('select[name="resource"]')
    .selectOption(String(resource.id));
  await page.locator('input[name="date"]').fill(slotDate);
  await expect
    .poll(async () => page.locator('select[name="slot"] option').count())
    .toBeGreaterThan(1);
  await page.locator('select[name="slot"]').selectOption(slots[0].start_at);
  await page
    .getByRole("button", { name: "РЎРѕР·РґР°С‚СЊ Р·Р°РїРёСЃСЊ", exact: true })
    .click();

  await expect(
    page.getByText("Р—Р°РїРёСЃСЊ СЃРѕР·РґР°РЅР° Рё РїРѕСЏРІРёР»Р°СЃСЊ РІ РєР°Р»РµРЅРґР°СЂРµ."),
  ).toBeVisible();
  await expect(
    page
      .locator("aside")
      .getByText(new RegExp(`Calendar Client ${unique}`))
      .first(),
  ).toBeVisible();

  await page
    .getByRole("button", { name: /РќРѕРІР°СЏ Р·Р°РїРёСЃСЊ|New booking|Р–Р°ТЈР° Р¶Р°Р·Р±Р°/ })
    .first()
    .click({ force: true });
  await expect(
    page.getByRole("heading", { name: /РќРѕРІР°СЏ Р·Р°РїРёСЃСЊ|New booking|Р–Р°ТЈР° Р¶Р°Р·Р±Р°/ }),
  ).toBeVisible();
  await page.locator('select[name="client"]').selectOption(String(client.id));
  await page.locator('select[name="service"]').selectOption(String(service.id));
  await page
    .locator('select[name="resource"]')
    .selectOption(String(resource.id));
  await page.locator('input[name="date"]').fill(slotDate);
  await expect
    .poll(async () => {
      const values = await page
        .locator('select[name="slot"] option')
        .evaluateAll((options) =>
          options.map((option) => (option as HTMLOptionElement).value),
        );
      return values.includes(slots[0].start_at);
    })
    .toBe(false);
});

test("calendar deep link selects appointment and lifecycle action works", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "Calendar deep-link workflow runs in desktop; mobile reachability is covered separately.",
  );

  const tokens = await apiLogin(page, users.owner);
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
      full_name: `Deep Link Client ${unique}`,
      phone: `+7703${String(unique).slice(-7)}`,
      source: "manual",
    },
  });
  expect(clientResponse.ok()).toBeTruthy();
  const client = await clientResponse.json();

  const serviceResponse = await page.request.post(
    `${apiBaseURL}/api/services/`,
    {
      headers,
      data: {
        business: businessId,
        name: `Deep Link Service ${unique}`,
        duration_minutes: 30,
        price_from: "6000.00",
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
        name: `Deep Link Master ${unique}`,
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
      data: {
        business: businessId,
        preset: "daily_9_20",
        resource: resource.id,
      },
    },
  );
  expect(presetResponse.ok()).toBeTruthy();

  const slotDate = addDays(new Date().toISOString().slice(0, 10), 2);
  const slotsResponse = await page.request.get(
    `${apiBaseURL}/api/appointments/available-slots/?business_id=${businessId}&service_id=${service.id}&resource_id=${resource.id}&date=${slotDate}`,
    { headers },
  );
  expect(slotsResponse.ok()).toBeTruthy();
  const slots: Array<{ start_at: string; end_at: string }> =
    await slotsResponse.json();
  expect(slots.length).toBeGreaterThan(0);

  const appointmentResponse = await page.request.post(
    `${apiBaseURL}/api/appointments/`,
    {
      headers,
      data: {
        business: businessId,
        client: client.id,
        service: service.id,
        resource: resource.id,
        start_at: slots[0].start_at,
        end_at: slots[0].end_at,
        source: "manual",
        notes: "Calendar deep-link smoke.",
      },
    },
  );
  expect(appointmentResponse.ok()).toBeTruthy();
  const appointment = await appointmentResponse.json();

  await login(page, users.owner, /\/app/);
  await page.goto(`/app/calendar?appointment=${appointment.id}`);
  await expect(
    page.locator("aside").getByText(`Deep Link Client ${unique}`).first(),
  ).toBeVisible();

  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("aside button")).find(
      (item) => /РџРѕРґС‚РІРµСЂРґРёС‚СЊ|Confirm|Р Р°СЃС‚Р°Сѓ/.test(item.textContent || ""),
    ) as HTMLButtonElement | undefined;
    button?.click();
  });
  await expect
    .poll(async () => {
      const response = await page.request.get(
        `${apiBaseURL}/api/appointments/${appointment.id}/`,
        { headers },
      );
      expect(response.ok()).toBeTruthy();
      const updated = await response.json();
      return updated.status;
    })
    .toBe("confirmed");
});

test("business owner can reschedule appointment from calendar UI", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "Calendar reschedule workflow runs in desktop; mobile reachability is covered separately.",
  );

  const tokens = await apiLogin(page, users.owner);
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
      full_name: `Reschedule Client ${unique}`,
      phone: `+7704${String(unique).slice(-7)}`,
      source: "manual",
    },
  });
  expect(clientResponse.ok()).toBeTruthy();
  const client = await clientResponse.json();

  const serviceResponse = await page.request.post(
    `${apiBaseURL}/api/services/`,
    {
      headers,
      data: {
        business: businessId,
        name: `Reschedule Service ${unique}`,
        duration_minutes: 30,
        price_from: "7000.00",
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
        name: `Reschedule Master ${unique}`,
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
      data: {
        business: businessId,
        preset: "daily_9_20",
        resource: resource.id,
      },
    },
  );
  expect(presetResponse.ok()).toBeTruthy();

  const oldDate = addDays(new Date().toISOString().slice(0, 10), 3);
  const newDate = addDays(new Date().toISOString().slice(0, 10), 4);
  const oldSlotsResponse = await page.request.get(
    `${apiBaseURL}/api/appointments/available-slots/?business_id=${businessId}&service_id=${service.id}&resource_id=${resource.id}&date=${oldDate}`,
    { headers },
  );
  expect(oldSlotsResponse.ok()).toBeTruthy();
  const oldSlots: Array<{ start_at: string; end_at: string }> =
    await oldSlotsResponse.json();
  expect(oldSlots.length).toBeGreaterThan(0);

  const newSlotsResponse = await page.request.get(
    `${apiBaseURL}/api/appointments/available-slots/?business_id=${businessId}&service_id=${service.id}&resource_id=${resource.id}&date=${newDate}`,
    { headers },
  );
  expect(newSlotsResponse.ok()).toBeTruthy();
  const newSlots: Array<{ start_at: string; end_at: string }> =
    await newSlotsResponse.json();
  expect(newSlots.length).toBeGreaterThan(0);

  const appointmentResponse = await page.request.post(
    `${apiBaseURL}/api/appointments/`,
    {
      headers,
      data: {
        business: businessId,
        client: client.id,
        service: service.id,
        resource: resource.id,
        start_at: oldSlots[0].start_at,
        end_at: oldSlots[0].end_at,
        source: "manual",
        notes: "Calendar reschedule smoke.",
      },
    },
  );
  expect(appointmentResponse.ok()).toBeTruthy();
  const appointment = await appointmentResponse.json();

  await login(page, users.owner, /\/app/);
  await page.goto(`/app/calendar?appointment=${appointment.id}`);
  await expect(
    page.locator("aside").getByText(`Reschedule Client ${unique}`).first(),
  ).toBeVisible();

  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("aside button")).find(
      (item) => /РџРµСЂРµРЅРµСЃС‚Рё|Reschedule|РђСѓС‹СЃС‚С‹СЂСѓ/.test(item.textContent || ""),
    ) as HTMLButtonElement | undefined;
    button?.click();
  });
  await expect(
    page.getByRole("heading", {
      name: /РџРµСЂРµРЅРµСЃС‚Рё Р·Р°РїРёСЃСЊ|Reschedule appointment|Р–Р°Р·Р±Р°РЅС‹ Р°СѓС‹СЃС‚С‹СЂСѓ/,
    }),
  ).toBeVisible();
  await page.locator('input[type="date"]').last().fill(newDate);
  const timeSelect = page.locator("label").filter({
    hasText: /Р’СЂРµРјСЏ|Time|РЈР°Т›С‹С‚/,
  });
  await expect
    .poll(async () => {
      const values = await timeSelect.locator("select option").evaluateAll(
        (items) =>
          items
            .map((item) => (item as HTMLOptionElement).value)
            .filter(Boolean),
      );
      return values.length;
    })
    .toBeGreaterThan(0);
  const slotOptions = await timeSelect.locator("select option").evaluateAll(
    (items) =>
      items
        .map((item) => ({
          label: item.textContent?.trim() || "",
          value: (item as HTMLOptionElement).value,
        }))
        .filter((item) => item.value),
  );
  const selectedSlot =
    slotOptions.find((item) => item.value === newSlots[0].start_at) ||
    slotOptions[0];
  expect(selectedSlot).toBeTruthy();
  await timeSelect.getByRole("button").click();
  await page.getByRole("button", { name: selectedSlot.label }).last().click();
  await page
    .getByRole("button", { name: /РџРµСЂРµРЅРµСЃС‚Рё|Reschedule|РђСѓС‹СЃС‚С‹СЂСѓ/ })
    .last()
    .click();

  await expect
    .poll(async () => {
      const response = await page.request.get(
        `${apiBaseURL}/api/appointments/${appointment.id}/`,
        { headers },
      );
      expect(response.ok()).toBeTruthy();
      const updated = await response.json();
      return updated.start_at;
    })
    .toBe(selectedSlot.value);

  const freedOldSlotsResponse = await page.request.get(
    `${apiBaseURL}/api/appointments/available-slots/?business_id=${businessId}&service_id=${service.id}&resource_id=${resource.id}&date=${oldDate}`,
    { headers },
  );
  expect(freedOldSlotsResponse.ok()).toBeTruthy();
  const freedOldSlots: Array<{ start_at: string; end_at: string }> =
    await freedOldSlotsResponse.json();
  expect(
    freedOldSlots.some((slot) => slot.start_at === oldSlots[0].start_at),
  ).toBeTruthy();
});

test("business owner can configure working hours week", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "Working-hours setup smoke runs in desktop; mobile route reachability is covered separately.",
  );

  const tokens = await apiLogin(page, users.owner);
  const headers = authHeaders(tokens);
  const unique = Date.now();

  const meResponse = await page.request.get(`${apiBaseURL}/api/auth/me/`, {
    headers,
  });
  expect(meResponse.ok()).toBeTruthy();
  const me = await meResponse.json();
  const businessId = me.businesses?.[0]?.id;
  expect(businessId).toBeTruthy();

  const resourceResponse = await page.request.post(
    `${apiBaseURL}/api/resources/`,
    {
      headers,
      data: {
        business: businessId,
        name: `Hours Master ${unique}`,
        resource_type: "staff",
        is_active: true,
      },
    },
  );
  expect(resourceResponse.ok()).toBeTruthy();
  const resource = await resourceResponse.json();

  await login(page, users.owner, /\/app/);
  await page.goto("/app/working-hours");
  await expect(
    page.getByRole("heading", {
      name: /Р“СЂР°С„РёРє СЂР°Р±РѕС‚С‹|Working hours|Р–Т±РјС‹СЃ РєРµСЃС‚РµСЃС–/,
    }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: /РќР°СЃС‚СЂРѕРёС‚СЊ РЅРµРґРµР»СЋ|Set up week|РђРїС‚Р°РЅС‹ Р±Р°РїС‚Р°Сѓ/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", {
      name: /РќРµРґРµР»СЊРЅС‹Р№ РіСЂР°С„РёРє|Weekly schedule|РђРїС‚Р°Р»С‹Т› РєРµСЃС‚Рµ/,
    }),
  ).toBeVisible();

  await page.locator("select").last().selectOption(String(resource.id));
  await page
    .getByRole("button", { name: /РЎР°Р»РѕРЅ 09:00-20:00|Salon 09:00-20:00/ })
    .click();
  await page
    .getByRole("button", {
      name: /РЎРѕС…СЂР°РЅРёС‚СЊ РЅРµРґРµР»СЊРЅС‹Р№ РіСЂР°С„РёРє|Save weekly schedule|РђРїС‚Р°Р»С‹Т› РєРµСЃС‚РµРЅС– СЃР°Т›С‚Р°Сѓ/,
    })
    .click();
  await expect(
    page.getByText(
      /РќРµРґРµР»СЊРЅС‹Р№ РіСЂР°С„РёРє СЃРѕС…СЂР°РЅС‘РЅ|Weekly schedule saved|РђРїС‚Р°Р»С‹Т› РєРµСЃС‚Рµ СЃР°Т›С‚Р°Р»РґС‹/,
    ),
  ).toBeVisible();

  await expect
    .poll(async () => {
      const response = await page.request.get(
        `${apiBaseURL}/api/working-hours/`,
        { headers },
      );
      expect(response.ok()).toBeTruthy();
      const payload = await response.json();
      const rows = Array.isArray(payload) ? payload : payload.results || [];
      return rows.filter(
        (row: {
          resource: number;
          is_day_off: boolean;
          start_time: string;
          end_time: string;
        }) =>
          row.resource === resource.id &&
          !row.is_day_off &&
          row.start_time.startsWith("09:00") &&
          row.end_time.startsWith("20:00"),
      ).length;
    })
    .toBe(7);
});

test("operator cannot read another tenant through direct object URLs", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Tenant API smoke only needs one browser project.");

  const ownerTokens = await apiLogin(page, users.owner);
  const platformTokens = await apiLogin(page, users.platform);
  const operatorTokens = await apiLogin(page, users.operator);

  const activationResponse = await page.request.post(
    `${apiBaseURL}/api/platform/activate-landing/`,
    {
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
    },
  );
  expect(activationResponse.ok()).toBeTruthy();

  const foreignOwnerEmail = (await activationResponse.json()).owner?.email;
  expect(foreignOwnerEmail).toBeTruthy();
  const foreignTokens = await apiLogin(page, foreignOwnerEmail);
  const foreignMeResponse = await page.request.get(
    `${apiBaseURL}/api/auth/me/`,
    { headers: authHeaders(foreignTokens) },
  );
  const foreignBusiness = (await foreignMeResponse.json()).businesses?.[0];
  expect(foreignBusiness?.id).toBeTruthy();

  const foreignClientResponse = await page.request.post(
    `${apiBaseURL}/api/clients/`,
    {
      headers: authHeaders(foreignTokens),
      data: {
        business: foreignBusiness.id,
        full_name: "Foreign Tenant Client",
        phone: "+77019999999",
        source: "manual",
      },
    },
  );
  expect(foreignClientResponse.ok()).toBeTruthy();
  const foreignClient = await foreignClientResponse.json();

  const operatorForeignClientResponse = await page.request.get(
    `${apiBaseURL}/api/clients/${foreignClient.id}/`,
    {
      headers: authHeaders(operatorTokens),
    },
  );
  expect([403, 404]).toContain(operatorForeignClientResponse.status());

  const ownerForeignClientResponse = await page.request.get(
    `${apiBaseURL}/api/clients/${foreignClient.id}/`,
    {
      headers: authHeaders(ownerTokens),
    },
  );
  expect([403, 404]).toContain(ownerForeignClientResponse.status());
});

test("public routes render without login", async ({ page }) => {
  const routes = ["/", "/pricing", "/bots", "/crm", "/contacts"];

  for (const route of routes) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`${route === "/" ? "/$" : route}`));
    await expect(page.getByText("РЎС‚СЂР°РЅРёС†Р° РЅРµ РЅР°Р№РґРµРЅР°")).toHaveCount(0);
    await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  }
});

test("platform routes render without merchant sidebar", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Platform route audit runs in desktop project.");

  await login(page, users.platform, /\/platform/);

  const routes = ["/platform", "/platform/merchants", "/platform/settings"];
  for (const route of routes) {
    await page.goto(route);
    await expect(page).toHaveURL(
      new RegExp(route === "/platform" ? "/platform/?$" : route),
    );
    await expect(page.getByText("РЎС‚СЂР°РЅРёС†Р° РЅРµ РЅР°Р№РґРµРЅР°")).toHaveCount(0);
    await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
    await expect(page.getByText(users.platform).first()).toBeVisible();
  }

  await page.goto("/platform/merchants");
  const firstMerchant = page.locator('a[href^="/platform/merchants/"]').first();
  if (await firstMerchant.count()) {
    await firstMerchant.click();
    await expect(page).toHaveURL(/\/platform\/merchants\/\d+/);
    await expect(page.getByText("Platform support")).toBeVisible();
  }
});

test("activated landing owner sees first-run dashboard", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(75_000);
  test.skip(
    isMobile,
    "First-run empty state is covered in desktop; mobile layout is covered by the mobile smoke.",
  );

  const tokenPayload = await apiLogin(page, users.platform);

  const activationResponse = await page.request.post(
    `${apiBaseURL}/api/platform/activate-landing/`,
    {
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
    },
  );
  expect(activationResponse.ok()).toBeTruthy();

  await login(page, "e2e_activation_owner@example.com", /\/app/);

  await expect(
    page.getByRole("heading", {
      name: /Р“Р»Р°РІРЅР°СЏ|Business dashboard|Dashboard|Р‘Р°СЃС‚С‹/,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("e2e_activation_owner@example.com").first(),
  ).toBeVisible();
  await expect(page.getByText(/AI-СЃРІРѕРґРєР° РґРЅСЏ|AI summary/)).toBeVisible();
  await expect(
    page.getByText("WhatsApp", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText(/1C|РЎРєР»Р°Рґ|Warehouse/).first()).toBeVisible();
});

test("merchant users cannot open platform workspace", async ({ page }) => {
  await login(page, users.owner, /\/app/);
  await page.goto("/platform");

  await expect(page).toHaveURL(/\/app/);
});

test("operator sees restricted sections as forbidden", async ({ page }) => {
  await login(page, users.operator, /\/app/);
  await page.goto("/app/settings");

  const forbiddenAlert = page.getByRole("alert");
  await expect(forbiddenAlert).toBeVisible();
  await expect(forbiddenAlert.getByText(/\u0440\u043e\u043b\u044c|\u0440\u043e\u043b\u0438|\u0434\u043e\u0441\u0442\u0443\u043f|СЂРѕР»СЊ|СЂРѕР»Рё|РґРѕСЃС‚СѓРї|access/i).first()).toBeVisible();
  await expect(page.getByText(/Billing|Р‘РёР»Р»РёРЅРі|Р‘РёР»Р»РёРЅРі/i)).toHaveCount(0);
  await expect(
    page.getByText(/API and events|API Рё СЃРѕР±С‹С‚РёСЏ|API Р¶У™РЅРµ РѕТ›РёТ“Р°Р»Р°СЂ/i),
  ).toHaveCount(0);
  await expect(page.getByText(/webhook|payload|provider/i)).toHaveCount(0);
});

test("mobile owner smoke: dashboard, bottom nav and more drawer are reachable", async ({
  page,
  isMobile,
}) => {
  test.skip(
    !isMobile,
    "Mobile viewport smoke runs only in the mobile project.",
  );

  await login(page, users.owner, /\/app/);
  await expect(page).toHaveURL(/\/app/);
  await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.locator('nav a[href="/app/leads"]').last().click();
  await expect(page).toHaveURL(/\/app\/leads/);
  await expectNoHorizontalOverflow(page);
  await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);

  await page.locator('nav a[href="/app/conversations"]').last().click();
  await expect(page).toHaveURL(/\/app\/conversations/);
  await expectNoHorizontalOverflow(page);
  await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);

  await page.locator('nav a[href="/app/clients"]').last().click();
  await expect(page).toHaveURL(/\/app\/clients/);
  await expectNoHorizontalOverflow(page);
  await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);

  const drawerRoutes = [
    "/app/deals",
    "/app/tasks",
    "/app/calendar",
    "/app/ai-agents",
    "/app/integrations",
    "/app/analytics",
    "/app/settings",
  ];

  for (const route of drawerRoutes) {
    await page.locator("nav button").last().click();
    await page.locator(`a[href="${route}"]`).last().click();
    await expect(page).toHaveURL(routePattern(route));
    await expectNoHorizontalOverflow(page);
    await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
    if (route === "/app/calendar") {
      await expect(
        page.getByText(/AGENDA \u0414\u041d\u042f|Day agenda|\u041a\u04af\u043d agenda/i).first(),
      ).toBeVisible();
      const newBookingButton = page
        .getByRole("button", { name: /\u041d\u043e\u0432\u0430\u044f \u0437\u0430\u043f\u0438\u0441\u044c|New booking|\u0416\u0430\u04a3\u0430 \u0436\u0430\u0437\u0431\u0430/ })
        .first();
      await expect(newBookingButton).toBeVisible();
      await newBookingButton.click();
      await expectFirstDialogFitsViewport(page);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  }

  await expect(
    page.getByRole("heading", { name: /\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438|Settings|\u0411\u0430\u043f\u0442\u0430\u0443\u043b\u0430\u0440/ }),
  ).toBeVisible();
});

test("tablet CRM workbench routes keep usable proportions", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(90_000);
  test.skip(
    isMobile,
    "Tablet viewport smoke runs in desktop project with an explicit viewport.",
  );

  await page.setViewportSize({ width: 900, height: 960 });
  await login(page, users.owner, /\/app/);
  const ownerTokens = await apiLogin(page, users.owner);

  const tabletRoutes = [
    "/app/leads",
    "/app/clients",
    "/app/deals",
    "/app/tasks",
    "/app/calendar",
    "/app/conversations",
  ];

  for (const route of tabletRoutes) {
    await page.goto(route);
    await expect(page).toHaveURL(routePattern(route));
    await expect(page.getByRole("main").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  }

  const leadsResponse = await page.request.get(
    `${apiBaseURL}/api/leads/?page=1&page_size=1`,
    { headers: authHeaders(ownerTokens) },
  );
  expect(leadsResponse.ok()).toBeTruthy();
  const leadsPayload = await leadsResponse.json();
  const firstLead = Array.isArray(leadsPayload)
    ? leadsPayload[0]
    : leadsPayload.results?.[0];
  expect(firstLead?.id).toBeTruthy();

  await page.goto(`/app/leads/${firstLead.id}`);
  await expect(page).toHaveURL(/\/app\/leads\/\d+/);
  await expect(page.locator("main h1").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
});
