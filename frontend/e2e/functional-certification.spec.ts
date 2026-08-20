import {
  expect,
  test,
  type Locator,
  type Page,
  type Request,
} from "@playwright/test";

const password = process.env.E2E_PASSWORD || "ZaniTest123!";
const ownerEmail = process.env.E2E_OWNER_EMAIL || "business_owner@example.com";

async function login(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('form input[type="email"]').first().fill(ownerEmail);
  await page.locator('form input[type="password"]').first().fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/app/);
  await expect(page.locator("main").first()).toBeVisible();
}

async function typeOneCharacterAtATime(input: Locator, value: string) {
  await input.fill("");
  await input.focus();
  let expectedValue = "";
  for (const character of value) {
    expectedValue += character;
    await input.press(character);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue(expectedValue);
  }
}

test.describe("FC-002 shared search and filter contracts", () => {
  test("core CRM searches keep focus, debounce requests and transmit the complete query", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Dense CRM filter bars use separate mobile surface contracts.");
    test.setTimeout(180_000);
    await login(page);

    const cases = [
      {
        route: "/app/leads",
        ready: "leads-workspace-ready",
        input: "leads-search-input",
        endpoint: /\/api\/leads\/(?:\?.*)?$/,
      },
      {
        route: "/app/deals",
        ready: "deals-workspace-ready",
        input: "deals-search-input",
        endpoint: /\/api\/deals\/(?:\?.*)?$/,
      },
      {
        route: "/app/tasks",
        ready: "tasks-workspace-ready",
        input: "tasks-search-input",
        endpoint: /\/api\/tasks\/(?:\?.*)?$/,
      },
    ];

    for (const contract of cases) {
      await page.goto(contract.route);
      await expect(page.getByTestId(contract.ready)).toBeVisible();

      const requests: string[] = [];
      const onRequest = (request: Request) => {
        if (contract.endpoint.test(request.url())) requests.push(request.url());
      };
      page.on("request", onRequest);

      const input = page.getByTestId(contract.input);
      await expect(input).toBeVisible();
      const documentSentinel = await page.evaluate(() => {
        const sentinel = crypto.randomUUID();
        Object.assign(window, { __zaniCertificationSentinel: sentinel });
        return sentinel;
      });
      await typeOneCharacterAtATime(input, "alpha");
      await page.waitForTimeout(700);

      await expect(input).toBeFocused();
      await expect(input).toHaveValue("alpha");
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as Window & { __zaniCertificationSentinel?: string })
                .__zaniCertificationSentinel,
          ),
        )
        .toBe(documentSentinel);
      expect(requests.length).toBeGreaterThan(0);
      expect(requests.length).toBeLessThanOrEqual(2);
      expect(requests.at(-1)).toContain("search=alpha");

      page.off("request", onRequest);
    }
  });

  test("lead search composes with a status filter without resetting either control", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop filter composition is certified here; mobile is covered by responsive audits.");
    test.setTimeout(90_000);
    await login(page);
    await page.goto("/app/leads");
    await expect(page.getByTestId("leads-workspace-ready")).toBeVisible();

    const status = page.getByTestId("leads-status-filter");
    const search = page.getByTestId("leads-search-input");
    await status.selectOption("new");
    await typeOneCharacterAtATime(search, "alpha");
    await page.waitForTimeout(700);

    await expect(status).toHaveValue("new");
    await expect(search).toHaveValue("alpha");
    await expect(search).toBeFocused();
  });

  test("global search remains mounted across operational routes", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Mobile uses the command palette rather than the desktop header input.");
    test.setTimeout(180_000);
    await login(page);

    for (const route of [
      "/app/clients",
      "/app/conversations",
      "/app/outreach",
      "/app/pricing",
    ]) {
      await page.goto(route);
      await expect(page.locator("main").first()).toBeVisible();
      const input = page.locator("header input:visible").first();
      await expect(input).toBeVisible();
      await typeOneCharacterAtATime(input, "alpha");
      await page.waitForTimeout(350);
      await expect(input).toHaveValue("alpha");
      await expect(input).toBeFocused();
      await page.keyboard.press("Escape");
    }
  });
});

test.describe("FC-003 session contracts", () => {
  test("merchant login survives reload and logout revokes the browser session", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await login(page);
    await page.reload();
    await expect(page).toHaveURL(/\/app/);
    await expect(page.locator("main").first()).toBeVisible();

    await page.goto("/app/account");
    const logoutResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/auth/logout/"),
    );
    await page.getByTestId("merchant-logout").click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await logoutResponse).status()).toBe(200);

    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('form input[type="email"]').first()).toBeVisible();
  });
});
