import { expect, test, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";

const password = process.env.E2E_PASSWORD || "ZaniTest123!";
const apiBaseURL = process.env.E2E_API_BASE_URL || "http://127.0.0.1:8000";

const users = {
  platform: process.env.E2E_PLATFORM_EMAIL || "platform_admin@example.com",
  owner: process.env.E2E_OWNER_EMAIL || "business_owner@example.com",
  manager: process.env.E2E_MANAGER_EMAIL || "business_manager@example.com",
  operator: process.env.E2E_OPERATOR_EMAIL || "business_operator@example.com",
  foreignOwner:
    process.env.E2E_FOREIGN_OWNER_EMAIL || "foreign_owner@example.com",
};

type TokenPayload = {
  access: string;
};

const tokenCache = new Map<string, TokenPayload>();

test("mobile manager smoke: daily CRM routes are reachable", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(90_000);
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

  const modules = await businessCapabilityModules(page, users.manager);
  const drawerRoutes = [
    "/app/tasks",
    "/app/calendar",
    ...(modules.deals === false ? [] : ["/app/deals"]),
    "/app/analytics",
  ];
  for (const route of drawerRoutes) {
    await page.getByTestId("bottom-mobile-menu-trigger").click();
    await page.locator(`a[href="${route}"]`).last().click();
    await expect(page).toHaveURL(routePattern(route));
    await expectNoHorizontalOverflow(page);
    await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  }
  if (modules.deals === false) {
    await page.getByTestId("bottom-mobile-menu-trigger").click();
    await expect(page.locator('a[href="/app/deals"]')).toHaveCount(0);
    await page.keyboard.press("Escape");
  }
});

async function login(page: Page, email: string, target: RegExp) {
  await page.context().clearCookies();
  await page.goto("/login");
  const emailInput = page.locator('form input[type="email"]').first();
  await expect(emailInput).toBeVisible();
  await emailInput.fill(email);
  await page.locator('form input[type="password"]').first().fill(password);
  const tokenResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/token/") &&
      response.request().method() === "POST",
  );
  await page.locator('form button[type="submit"]').click();
  expect((await tokenResponse).ok()).toBeTruthy();
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

async function navigateInAppHistory(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
  await expect(page).toHaveURL(
    new RegExp(path.split("?")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
}

function routePattern(route: string) {
  return new RegExp(
    route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
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
  tokenCache.set(email, payload);
  return payload;
}

function authHeaders(tokens: TokenPayload) {
  return { Authorization: `Bearer ${tokens.access}` };
}

function decodeBase32(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = value
    .replace(/=+$/u, "")
    .toUpperCase()
    .split("")
    .map((character) => alphabet.indexOf(character).toString(2).padStart(5, "0"))
    .join("");
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function currentTotp(secret: string) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", decodeBase32(secret))
    .update(counterBuffer)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    (((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)) >>>
    0;
  return String(binary % 1_000_000).padStart(6, "0");
}

async function createPlatformStepUp(page: Page, tokens: TokenPayload) {
  const enrollmentStart = await page.request.post(
    `${apiBaseURL}/api/auth/mfa/enrollment/start/`,
    { headers: authHeaders(tokens), data: {} },
  );
  expect(enrollmentStart.ok()).toBeTruthy();
  const enrollment = (await enrollmentStart.json()) as {
    challenge_token: string;
    manual_key: string;
  };
  const enrollmentConfirm = await page.request.post(
    `${apiBaseURL}/api/auth/mfa/enrollment/confirm/`,
    {
      data: {
        challenge_token: enrollment.challenge_token,
        code: currentTotp(enrollment.manual_key),
      },
    },
  );
  expect(enrollmentConfirm.ok()).toBeTruthy();
  const confirmed = (await enrollmentConfirm.json()) as TokenPayload & {
    recovery_codes: string[];
  };
  expect(confirmed.recovery_codes.length).toBeGreaterThanOrEqual(2);

  const stepUpResponse = await page.request.post(
    `${apiBaseURL}/api/auth/mfa/step-up/`,
    {
      headers: authHeaders(confirmed),
      data: { code: confirmed.recovery_codes[0] },
    },
  );
  expect(stepUpResponse.ok()).toBeTruthy();
  const stepUp = (await stepUpResponse.json()) as { step_up_token: string };

  return {
    headers: {
      ...authHeaders(confirmed),
      "X-Zani-MFA-Step-Up": stepUp.step_up_token,
    },
    cleanup: async () => {
      const response = await page.request.post(
        `${apiBaseURL}/api/auth/mfa/disable/`,
        {
          headers: authHeaders(confirmed),
          data: {
            password,
            code: confirmed.recovery_codes[1],
            reason: "Restore deterministic E2E platform fixture",
          },
        },
      );
      expect(response.ok()).toBeTruthy();
    },
  };
}

async function businessCapabilityModules(page: Page, email: string) {
  const tokens = await apiLogin(page, email);
  const response = await page.request.get(`${apiBaseURL}/api/auth/me/`, {
    headers: authHeaders(tokens),
  });
  expect(response.ok()).toBeTruthy();
  const currentUser = await response.json();
  const businessId = currentUser.businesses?.[0]?.id;
  expect(businessId).toBeTruthy();
  return (currentUser.capabilities?.[String(businessId)]?.modules || {}) as Record<
    string,
    boolean
  >;
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
  await expect(page.getByTestId("platform-overview-ready")).toBeVisible();
});

test("merchant root redirects to the canonical dashboard route", async ({
  page,
}) => {
  await login(page, users.owner, /\/app\/dashboard/);

  await page.goto("/app");
  await expect(page).toHaveURL(/\/app\/dashboard\/?$/);
  await expect(page.getByTestId("dashboard-workspace-ready")).toBeVisible();
  await expect(
    page.locator('aside a[href="/app/dashboard"]').first(),
  ).toBeVisible();
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

  await expect(page).toHaveURL(/\/app\/dashboard/);
  await expect(page.getByTestId("dashboard-workspace-ready")).toBeVisible();

  await navigateInsideApp(page, "/app/leads");
  await expect(page).toHaveURL(/\/app\/leads/);
  await page.getByTestId("lead-row-open").first().click();
  const leadDrawer = page.getByTestId("crm-entity-drawer");
  await expect(leadDrawer).toBeVisible();
  await expect(leadDrawer.getByTestId("crm-entity-drawer-content")).toBeVisible();
  await expect(leadDrawer.locator('[data-crm-action-id="contacted"]')).toBeVisible();
  await expect(leadDrawer.locator('[data-crm-action-id="close"]')).toBeVisible();
  await expect(leadDrawer.locator('[data-crm-action-id="lost"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(leadDrawer).toHaveCount(0);

  await navigateInsideApp(page, "/app/conversations");
  await expect(page.getByTestId("inbox-workspace-ready")).toBeVisible();

  await navigateInsideApp(page, "/app/settings");
  await expect(page.getByTestId("settings-workspace-ready")).toBeVisible();
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
    "/app/dashboard",
    "/app/leads",
    "/app/deals",
    "/app/clients",
    "/app/tasks",
    "/app/calendar",
    "/app/business/services",
    "/app/business/resources",
    "/app/conversations",
    "/app/bots",
    "/app/integrations",
    "/app/pricing",
    "/app/ai-assistant",
    "/app/ai-agents",
    "/app/automations",
    "/app/business/working-hours",
    "/app/analytics",
    "/app/settings",
    "/app/ai",
  ];

  for (const route of routes) {
    // Keep the authenticated SPA session alive while auditing every route.
    // A hard reload for each route creates overlapping one-time refresh-token
    // rotations and can log the browser out even though the route is healthy.
    await navigateInAppHistory(page, route);
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
    "/app/dashboard",
    "/app/leads",
    "/app/deals",
    "/app/clients",
    "/app/tasks",
    "/app/calendar",
    "/app/conversations",
    "/app/analytics",
  ];

  for (const route of managerDailyRoutes) {
    await navigateInAppHistory(page, route);
    await expect(page).toHaveURL(routePattern(route));
    await expectNoHorizontalOverflow(page);
    await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  }

  for (const route of ["/app/settings", "/app/integrations"]) {
    await navigateInAppHistory(page, route);
    await expect(page).toHaveURL(routePattern(route));
    await expect(page.getByTestId("forbidden-state")).toBeVisible();
    await expectNoOwnerOnlyTechnicalNoise(page);
  }

  await login(page, users.operator, /\/app/);

  const operatorDailyRoutes = [
    "/app/dashboard",
    "/app/tasks",
    "/app/conversations",
  ];
  for (const route of operatorDailyRoutes) {
    await navigateInAppHistory(page, route);
    await expect(page).toHaveURL(routePattern(route));
    await expectNoHorizontalOverflow(page);
    await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  }

  await navigateInAppHistory(page, "/app/settings");
  await expect(page.getByTestId("forbidden-state")).toBeVisible();
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
    "/app/dashboard",
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

  await page.goto("/app/dashboard");
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
        name: `Calendar Specialist ${unique}`,
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
  await expect(page.locator('[data-testid="page-primary-action"]:visible').first()).toBeVisible();
  await expect(page.getByTestId("calendar-view-day")).toBeVisible();
  await expect(page.getByTestId("calendar-view-week")).toBeVisible();
  await expect(page.getByTestId("calendar-view-month")).toBeVisible();
  await expect(page).toHaveURL(
    /\/app\/calendar\?date=\d{4}-\d{2}-\d{2}&view=day/,
  );

  await page.getByTestId("calendar-view-week").click();
  await expect(page).toHaveURL(/view=week/);
  await expect(
    page.getByTestId("calendar-view-week"),
  ).toHaveClass(/text-brand-700/);

  await page.getByTestId("calendar-view-month").click();
  await expect(page).toHaveURL(/view=month/);
  await expect(
    page.getByTestId("calendar-view-month"),
  ).toHaveClass(/text-brand-700/);

  await page.getByTestId("calendar-view-day").click();
  await expect(page).toHaveURL(/view=day/);
  await expect(page.getByTestId("calendar-view-day")).toHaveClass(
    /text-brand-700/,
  );

  await page.locator('[data-testid="page-primary-action"]:visible').first().click();
  await expect(page.getByTestId("appointment-form")).toBeVisible();

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
  await page.getByTestId("appointment-submit").click();

  await expect(page.getByTestId("action-feedback").first()).toBeVisible();
  await expect(
    page
      .locator("aside")
      .getByText(new RegExp(`Calendar Client ${unique}`))
      .first(),
  ).toBeVisible();

  await page.locator('[data-testid="page-primary-action"]:visible').first().click();
  await expect(page.getByTestId("appointment-form")).toBeVisible();
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
        name: `Deep Link Specialist ${unique}`,
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
  await navigateInsideApp(page, "/app/calendar");
  await navigateInAppHistory(
    page,
    `/app/calendar?appointment=${appointment.id}`,
  );
  await expect(
    page.locator("aside").getByText(`Deep Link Client ${unique}`).first(),
  ).toBeVisible();

  const confirmAction = page.getByTestId(
    "calendar-appointment-status-confirmed",
  );
  await expect(confirmAction).toBeVisible();
  await confirmAction.click();
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
  test.setTimeout(60_000);
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
        name: `Reschedule Specialist ${unique}`,
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
  await navigateInsideApp(page, "/app/calendar");
  await navigateInAppHistory(
    page,
    `/app/calendar?appointment=${appointment.id}`,
  );
  await expect(
    page.locator("aside").getByText(`Reschedule Client ${unique}`).first(),
  ).toBeVisible();

  const rescheduleOpener = page.getByTestId("calendar-reschedule-action");
  await expect(rescheduleOpener).toHaveAttribute(
    "data-focus-return-id",
    `calendar-reschedule-${appointment.id}`,
  );
  const originalRescheduleOpener = await rescheduleOpener.elementHandle();
  expect(originalRescheduleOpener).not.toBeNull();
  await rescheduleOpener.click();
  const rescheduleDialog = page.getByRole("dialog");
  await expect(rescheduleDialog).toBeVisible();
  await rescheduleDialog.getByTestId("appointment-reschedule-date").fill(newDate);
  await expect(rescheduleDialog.locator("select")).toHaveCount(2);
  const timeSelect = rescheduleDialog.getByTestId("appointment-reschedule-slot");
  await expect
    .poll(async () => {
       const values = await timeSelect.locator("option").evaluateAll(
        (items) =>
          items
            .map((item) => (item as HTMLOptionElement).value)
            .filter(Boolean),
      );
      return values.length;
    })
    .toBeGreaterThan(0);
  const slotOptions = await timeSelect.locator("option").evaluateAll(
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
  await timeSelect.selectOption(selectedSlot.value);

  let rescheduleAttempts = 0;
  await page.route(
    `**/api/appointments/${appointment.id}/reschedule/`,
    async (route) => {
      rescheduleAttempts += 1;
      if (rescheduleAttempts === 1) {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ detail: "raw-calendar-forbidden-stack" }),
        });
        return;
      }
      if (rescheduleAttempts === 2) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ detail: "raw-calendar-temporary-stack" }),
        });
        return;
      }
      await route.continue();
    },
  );

  await rescheduleDialog.getByTestId("appointment-reschedule-submit").click();

  let recoveryAlert = page.getByTestId("action-feedback").first();
  await expect(recoveryAlert).toBeVisible();
  await expect(recoveryAlert.getByTestId("action-feedback-action")).toHaveCount(0);
  await expect(rescheduleDialog.locator('input[type="date"]')).toHaveValue(newDate);
  await expect(rescheduleDialog).not.toContainText(
    "raw-calendar-forbidden-stack",
  );
  await expect(recoveryAlert).not.toContainText(
    "raw-calendar-forbidden-stack",
  );
  await recoveryAlert.locator('button[aria-label]').click();
  await expect(recoveryAlert).toHaveCount(0);

  await rescheduleDialog.getByTestId("appointment-reschedule-submit").click();
  recoveryAlert = page.getByTestId("action-feedback").first();
  await expect(recoveryAlert).toBeVisible();
  await expect(rescheduleDialog.locator('input[type="date"]')).toHaveValue(newDate);
  await expect(rescheduleDialog).not.toContainText(
    "raw-calendar-temporary-stack",
  );
  await expect(recoveryAlert).not.toContainText(
    "raw-calendar-temporary-stack",
  );
  await expect(recoveryAlert.getByTestId("action-feedback-action")).toHaveCount(0);
  await recoveryAlert.locator('button[aria-label]').click();
  await expect(recoveryAlert).toHaveCount(0);
  await rescheduleDialog.getByTestId("appointment-reschedule-submit").click();

  expect(rescheduleAttempts).toBe(3);
  await expect(rescheduleDialog).toHaveCount(0);
  await expect
    .poll(() =>
      originalRescheduleOpener!.evaluate((element) => element.isConnected),
    )
    .toBeFalsy();
  await expect(rescheduleOpener).toBeFocused();
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
  await page.setViewportSize({ width: 1600, height: 1000 });

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
        name: `Hours Specialist ${unique}`,
        resource_type: "staff",
        is_active: true,
      },
    },
  );
  expect(resourceResponse.ok()).toBeTruthy();
  const resource = await resourceResponse.json();

  await login(page, users.owner, /\/app/);
  await page.goto(`/app/business/working-hours?view=resources&resource=${resource.id}`);
  await expect(page.getByTestId("working-hours-workspace-ready")).toBeVisible();
  await expect(page.getByTestId("working-hours-edit-modal")).toBeVisible();
  await expect(page.getByTestId("weekly-working-hours-form")).toBeVisible();

  await page.getByTestId("working-hours-preset-daily").click();
  const saveResponse = page.waitForResponse(
    (response) => response.url().includes("/api/working-hours/bulk-upsert-week/") && response.request().method() === "POST",
  );
  await page.getByTestId("working-hours-save-week").click();
  expect((await saveResponse).ok()).toBeTruthy();
  await expect(page.getByTestId("working-hours-save-week")).not.toHaveAttribute("aria-busy", "true");
  await expect(page.getByTestId("working-hours-save-week")).toBeDisabled();
  await expect(page.getByTestId("weekly-working-hours-form")).toBeVisible();

  await expect
    .poll(async () => {
      const response = await page.request.get(
        `${apiBaseURL}/api/working-hours/?resource=${resource.id}&page_size=20`,
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

  const inspector = page.getByTestId("working-hours-edit-modal");
  await inspector.getByRole("button", { name: /Close|Закрыть|Жабу/i }).click();
  await expect(page).not.toHaveURL(/resource=/);
  const resourceRow = page.locator(`[data-focus-return-id="working-hours-resource-${resource.id}"]:visible`).first();
  await expect(resourceRow).toBeFocused();
  await resourceRow.press("Enter");
  await expect(inspector).toBeVisible();
  await expect(inspector.locator(":focus")).toHaveCount(1);

  const timeInputs = inspector.locator('input[type="time"]');
  await timeInputs.nth(0).fill("20:00");
  await timeInputs.nth(1).fill("09:00");
  await inspector.getByTestId("working-hours-save-week").click();
  await expect(inspector.getByText(/end time must be later|время окончания должно быть позже|аяқталу уақыты.*кейін/i)).toBeVisible();
  await inspector.getByRole("button", { name: /^Cancel$|^Отмена$|^Бас тарту$/i }).click();
  await expect(inspector.getByTestId("working-hours-save-week")).toBeDisabled();

  await inspector.getByTestId("working-hours-preset-weekdays").click();
  await inspector.getByRole("button", { name: /Close|Закрыть|Жабу/i }).click();
  const discardDialog = page.getByRole("dialog", {
    name: /Discard unsaved schedule changes|Отменить несохранённые изменения графика|Сақталмаған кесте өзгерістерінен бас тарту/i,
  });
  await expect(discardDialog).toBeVisible();
  await discardDialog.getByRole("button", { name: /Discard changes|Отменить изменения|Өзгерістерден бас тарту/i }).click();
  await expect(page).not.toHaveURL(/resource=/);
  await expect(resourceRow).toBeFocused();
});

test("working-hours editor keeps all seven days reachable on mobile", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Mobile working-hours coverage runs only in the mobile project.");

  await login(page, users.owner, /\/app/);
  await page.goto("/app/business/working-hours?target=business");
  await expect(page.getByTestId("working-hours-workspace-ready")).toBeVisible();
  await expect(page.getByTestId("working-hours-edit-modal")).toBeVisible();
  await expect(page.getByTestId("weekly-working-hours-form").locator('input[type="checkbox"]')).toHaveCount(7);
  await expectNoHorizontalOverflow(page);
});

test("operator cannot read another tenant through direct object URLs", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Tenant API smoke only needs one browser project.");

  const ownerTokens = await apiLogin(page, users.owner);
  const operatorTokens = await apiLogin(page, users.operator);
  const foreignTokens = await apiLogin(page, users.foreignOwner);
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

test("public entry and legacy routes resolve without a router error", async ({ page }) => {
  const routes = [
    { path: "/", expected: /\/$/ },
    { path: "/pricing", expected: /\/login/ },
    { path: "/bots", expected: /\/login/ },
    { path: "/crm", expected: /\/login/ },
    { path: "/contacts", expected: /\/login/ },
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await expect(page).toHaveURL(route.expected);
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
  const privilegedSession = await createPlatformStepUp(page, tokenPayload);
  const unique = Date.now();
  const activatedOwnerEmail = `e2e_activation_owner_${unique}@example.com`;

  try {
    const activationResponse = await page.request.post(
      `${apiBaseURL}/api/platform/activate-landing/`,
      {
        headers: privilegedSession.headers,
        data: {
          landing_id: `e2e-first-run-landing-${unique}`,
          owner_email: activatedOwnerEmail,
          owner_password: password,
          owner_full_name: "E2E Activation Owner",
          business_name: `E2E Activated Clinic ${unique}`,
          business_type: "medical",
          landing_domain: `e2e-${unique}.zani.test`,
          landing_preview_url: "https://example.com/e2e-landing",
          city: "Almaty",
        },
      },
    );
    expect(activationResponse.ok()).toBeTruthy();

    await login(page, activatedOwnerEmail, /\/app/);

    await expect(page.getByTestId("dashboard-workspace-ready")).toBeVisible();
    await navigateInAppHistory(page, "/app/account");
    await expect(page.getByText(activatedOwnerEmail).first()).toBeVisible();
  } finally {
    await privilegedSession.cleanup();
  }
});

test("merchant users cannot open platform workspace", async ({ page }) => {
  await login(page, users.owner, /\/app/);
  await page.goto("/platform");

  await expect(page).toHaveURL(/\/app\/dashboard/);
});

test("operator sees restricted sections as forbidden", async ({ page }) => {
  await login(page, users.operator, /\/app/);
  await page.goto("/app/settings");

  const forbiddenState = page.getByTestId("forbidden-state");
  await expect(forbiddenState).toBeVisible();
  await expect(forbiddenState.getByText(/\u0440\u043e\u043b\u044c|\u0440\u043e\u043b\u0438|\u0434\u043e\u0441\u0442\u0443\u043f|СЂРѕР»СЊ|СЂРѕР»Рё|РґРѕСЃС‚СѓРї|access/i).first()).toBeVisible();
  await expect(page.getByText(/Billing|Р‘РёР»Р»РёРЅРі|Р‘РёР»Р»РёРЅРі/i)).toHaveCount(0);
  await expect(
    page.getByText(/API and events|API Рё СЃРѕР±С‹С‚РёСЏ|API Р¶У™РЅРµ РѕТ›РёТ“Р°Р»Р°СЂ/i),
  ).toHaveCount(0);
  await expect(page.getByText(/webhook|payload|provider/i)).toHaveCount(0);
});

test("owner summary omits duplicate appointment rows and manager queue deduplicates them", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const duplicateKeyWarnings: string[] = [];
  let duplicatedAppointmentId: number | undefined;

  page.on("console", (message) => {
    if (
      message.type() === "error"
      && /same key|unique "key" prop/i.test(message.text())
    ) {
      duplicateKeyWarnings.push(message.text());
    }
  });

  await page.route(/\/api\/work-queues\/(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    const confirmations = payload.queues?.appointment_confirmations || [];
    const upcoming = payload.queues?.upcoming_appointments || [];
    const appointment = confirmations[0] || upcoming[0];
    expect(appointment).toBeTruthy();
    duplicatedAppointmentId = Number(appointment.id);
    await route.fulfill({
      response,
      json: {
        ...payload,
        queues: {
          ...payload.queues,
          appointment_confirmations: [appointment, ...confirmations],
          upcoming_appointments: [appointment, ...upcoming],
        },
      },
    });
  });

  duplicatedAppointmentId = undefined;
  await login(page, users.owner, /\/app/);
  await expect.poll(() => duplicatedAppointmentId).toBeGreaterThan(0);
  await expect(page.getByTestId("dashboard-workspace-ready")).toBeVisible();
  await expect(page.getByTestId("dashboard-appointment-row")).toHaveCount(0);

  duplicatedAppointmentId = undefined;
  await login(page, users.manager, /\/app/);
  await expect.poll(() => duplicatedAppointmentId).toBeGreaterThan(0);
  await expect(
    page.locator(
      `[data-testid="dashboard-appointment-row"][data-appointment-id="${duplicatedAppointmentId}"]`,
    ),
  ).toHaveCount(1);

  expect(duplicateKeyWarnings).toEqual([]);
});

test("mobile navigation away wins over AI-agent route canonicalization", async ({
  page,
  isMobile,
}) => {
  test.skip(
    !isMobile,
    "Mobile navigation race regression runs only in the mobile project.",
  );

  await login(page, users.owner, /\/app/);
  await page.getByTestId("bottom-mobile-menu-trigger").click();
  const drawer = page.getByTestId("mobile-navigation-drawer");
  await expect(drawer).toBeVisible();
  await drawer.locator('a[href="/app/ai-agents"]').click();
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(
    /\/app\/ai-agents\/\d+\/(?:overview|profile)(?:[?#].*)?$/,
  );

  await page.getByTestId("bottom-mobile-menu-trigger").click();
  await expect(drawer).toBeVisible();
  await drawer.locator('a[href="/app/integrations"]').click();

  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(/\/app\/integrations(?:[?#].*)?$/);
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/app\/integrations(?:[?#].*)?$/);
});

test("mobile owner smoke: dashboard, bottom nav and more drawer are reachable", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(90_000);
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

  const modules = await businessCapabilityModules(page, users.owner);
  const drawerRoutes = [
    ...(modules.deals === false ? [] : ["/app/deals"]),
    "/app/tasks",
    "/app/calendar",
    "/app/ai-agents",
    "/app/integrations",
    "/app/analytics",
    "/app/settings",
  ];

  for (const route of drawerRoutes) {
    await page.getByTestId("bottom-mobile-menu-trigger").click();
    const drawer = page.getByTestId("mobile-navigation-drawer");
    await expect(drawer).toBeVisible();
    const drawerLink = drawer.locator(`a[href="${route}"]`);
    await expect(drawerLink).toBeVisible();
    await drawerLink.click();
    await expect(drawer).toHaveCount(0);
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
  if (modules.deals === false) {
    await page.getByTestId("bottom-mobile-menu-trigger").click();
    const drawer = page.getByTestId("mobile-navigation-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('a[href="/app/deals"]')).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
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
