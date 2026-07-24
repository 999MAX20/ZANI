import { expect, test, type Locator, type Page } from "@playwright/test";

const password = process.env.E2E_PASSWORD || "ZaniTest123!";
const apiBaseURL =
  process.env.E2E_API_BASE_URL || "http://127.0.0.1:8000";
const ownerEmail =
  process.env.E2E_OWNER_EMAIL || "business_owner@example.com";

type TokenPayload = {
  access: string;
  refresh: string;
};

async function apiLogin(page: Page) {
  const response = await page.request.post(`${apiBaseURL}/api/auth/token/`, {
    data: { email: ownerEmail, password },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as TokenPayload;
}

async function browserLogin(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('form input[type="email"]').fill(ownerEmail);
  await page.locator('form input[type="password"]').fill(password);
  const tokenResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/token/") &&
      response.request().method() === "POST",
  );
  await page.locator('form button[type="submit"]').click();
  expect((await tokenResponse).ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/app/);
  await expect(page.locator('nav a[href="/app/leads"]:visible').first()).toBeVisible();
}

async function navigateInApp(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
  await expect(page).toHaveURL(
    new RegExp(path.split("?")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
}

async function expectFeedback(
  page: Page,
  {
    rawDetail,
    recovery,
  }: {
    rawDetail: string;
    recovery: boolean;
  },
) {
  const feedback = page.getByTestId("action-feedback").last();
  await expect(feedback).toBeVisible();
  await expect(feedback).not.toContainText(rawDetail);
  await expect(feedback.getByTestId("action-feedback-action")).toHaveCount(
    recovery ? 1 : 0,
  );
  return feedback;
}

async function dismissFeedback(feedback: Locator) {
  await feedback.locator('button[aria-label]').click();
  await expect(feedback).toHaveCount(0);
}

test("F-101 representative actions keep safe feedback, recovery and success", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "The bounded F-101 action matrix runs on desktop.");
  test.setTimeout(120_000);

  const tokens = await apiLogin(page);
  const headers = { Authorization: `Bearer ${tokens.access}` };
  const meResponse = await page.request.get(`${apiBaseURL}/api/auth/me/`, {
    headers,
  });
  expect(meResponse.ok()).toBeTruthy();
  const me = await meResponse.json();
  const businessId = me.businesses?.[0]?.id;
  expect(businessId).toBeTruthy();

  const unique = Date.now();
  const clientResponse = await page.request.post(`${apiBaseURL}/api/clients/`, {
    headers,
    data: {
      business: businessId,
      full_name: `F101 Client ${unique}`,
      phone: `+7702${String(unique).slice(-7)}`,
      email: `f101-${unique}@example.com`,
      source: "manual",
    },
  });
  expect(clientResponse.ok()).toBeTruthy();
  const client = await clientResponse.json();

  const taskResponse = await page.request.post(`${apiBaseURL}/api/tasks/`, {
    headers,
    data: {
      business: businessId,
      title: `F101 Task ${unique}`,
      client: client.id,
      priority: "normal",
    },
  });
  expect(taskResponse.ok()).toBeTruthy();
  const task = await taskResponse.json();

  const conversationsResponse = await page.request.get(
    `${apiBaseURL}/api/inbox/conversations/?page_size=50`,
    { headers },
  );
  expect(conversationsResponse.ok()).toBeTruthy();
  const conversationsPayload = await conversationsResponse.json();
  const conversations = Array.isArray(conversationsPayload)
    ? conversationsPayload
    : conversationsPayload.results || [];
  const conversation =
    conversations.find((item: { status?: string }) => item.status !== "closed") ||
    conversations[0];
  expect(conversation?.id).toBeTruthy();

  await browserLogin(page);

  await navigateInApp(page, "/app/leads?create=1");
  const leadForm = page.getByTestId("lead-action-form");
  await expect(leadForm).toBeVisible();
  const leadFailures = [
    { status: 400, detail: "raw-lead-validation-stack" },
    { status: 422, detail: "raw-lead-unprocessable-stack" },
    { status: 418, detail: "raw-lead-unmapped-stack" },
  ];
  let leadAttempt = 0;
  await page.route("**/api/leads/", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const failure = leadFailures[leadAttempt];
    leadAttempt += 1;
    await route.fulfill({
      status: failure.status,
      contentType: "application/json",
      body: JSON.stringify({ detail: failure.detail }),
    });
  });
  for (const failure of leadFailures) {
    await leadForm.getByTestId("lead-action-submit").click();
    const feedback = await expectFeedback(page, {
      rawDetail: failure.detail,
      recovery: false,
    });
    await expect(leadForm).toBeVisible();
    await dismissFeedback(feedback);
  }
  await page.unroute("**/api/leads/");
  await leadForm.getByTestId("lead-action-submit").click();
  await expect(leadForm).toHaveCount(0);
  await dismissFeedback(
    await expectFeedback(page, { rawDetail: "raw-lead", recovery: false }),
  );

  await navigateInApp(page, `/app/clients/${client.id}`);
  const clientEditOpener = page.getByTestId("client-edit-action");
  await expect(clientEditOpener).toBeVisible();
  await clientEditOpener.click();
  const clientForm = page.getByTestId("client-action-form");
  await expect(clientForm).toBeVisible();
  const rawClientDetail = "raw-client-forbidden-stack";
  await page.route(`**/api/clients/${client.id}/`, async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ detail: rawClientDetail }),
    });
  });
  await clientForm.getByTestId("client-action-submit").click();
  await dismissFeedback(
    await expectFeedback(page, {
      rawDetail: rawClientDetail,
      recovery: false,
    }),
  );
  await expect(clientForm).toBeVisible();
  await page.unroute(`**/api/clients/${client.id}/`);
  await clientForm.getByTestId("client-action-submit").click();
  await expect(clientForm).toHaveCount(0);
  await expect(clientEditOpener).toBeFocused();
  await dismissFeedback(
    await expectFeedback(page, { rawDetail: "raw-client", recovery: false }),
  );

  const pipelineId = 990000 + (unique % 1000);
  const stageId = pipelineId + 1;
  await page.route("**/api/pipelines/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: pipelineId,
          business: businessId,
          name: `F101 Pipeline ${unique}`,
          slug: `f101-pipeline-${unique}`,
          entity_type: "deal",
          is_default: true,
          stages: [],
        },
      ]),
    });
  });
  await page.route("**/api/pipeline-stages/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: stageId,
          business: businessId,
          pipeline: pipelineId,
          name: `F101 Stage ${unique}`,
          order: 0,
          color: "#2563eb",
          probability: 10,
          is_won: false,
          is_lost: false,
        },
      ]),
    });
  });
  await navigateInApp(page, "/app/deals");
  await page.getByTestId("page-primary-action").click();
  const dealForm = page.getByTestId("deal-action-form");
  await expect(dealForm).toBeVisible();
  await dealForm.locator("input").first().fill(`F101 Deal ${unique}`);
  const clientSelect = dealForm.locator("select").first();
  const firstClientValue = await clientSelect
    .locator("option")
    .evaluateAll((options) =>
      options
        .map((option) => (option as HTMLOptionElement).value)
        .find(Boolean),
    );
  expect(firstClientValue).toBeTruthy();
  await clientSelect.selectOption(String(firstClientValue));
  const rawDealDetail = "raw-deal-conflict-stack";
  let dealAttempt = 0;
  await page.route("**/api/deals/", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    dealAttempt += 1;
    if (dealAttempt === 1) {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ detail: rawDealDetail }),
      });
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: 995000,
        business: businessId,
        client: Number(firstClientValue),
        pipeline: pipelineId,
        stage: stageId,
        title: `F101 Deal ${unique}`,
        amount: "0.00",
        currency: "KZT",
        source: "manual",
        status: "open",
      }),
    });
  });
  await dealForm.getByTestId("deal-action-submit").click();
  await dismissFeedback(
    await expectFeedback(page, {
      rawDetail: rawDealDetail,
      recovery: false,
    }),
  );
  await expect(dealForm).toBeVisible();
  await dealForm.getByTestId("deal-action-submit").click();
  await expect(dealForm).toHaveCount(0);
  expect(dealAttempt).toBe(2);
  await dismissFeedback(
    await expectFeedback(page, { rawDetail: "raw-deal", recovery: false }),
  );

  await navigateInApp(
    page,
    `/app/tasks?search=${encodeURIComponent(task.title)}`,
  );
  const dueTodayAction = page.getByTestId("task-due-today-action");
  await expect(dueTodayAction).toBeVisible();
  const rawTaskDetail = "raw-task-temporary-stack";
  await page.route(`**/api/tasks/${task.id}/due-today/`, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: rawTaskDetail }),
    });
  });
  await dueTodayAction.click();
  const taskFeedback = await expectFeedback(page, {
    rawDetail: rawTaskDetail,
    recovery: true,
  });
  await taskFeedback.getByTestId("action-feedback-action").click();
  await expect(taskFeedback).toHaveCount(0);
  await page.unroute(`**/api/tasks/${task.id}/due-today/`);
  await dueTodayAction.click();
  await dismissFeedback(
    await expectFeedback(page, { rawDetail: "raw-task", recovery: false }),
  );

  await navigateInApp(page, `/app/conversations/${conversation.id}`);
  const composer = page.getByTestId("inbox-action-composer");
  const sendAction = page.getByTestId("inbox-action-send");
  await expect(composer).toBeVisible();
  const rawInboxDetail = "raw-inbox-temporary-stack";
  let sendAttempt = 0;
  await page.route(
    `**/api/inbox/conversations/${conversation.id}/messages/`,
    async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      sendAttempt += 1;
      if (sendAttempt === 2) {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: 900000 + sendAttempt,
            conversation: conversation.id,
            text: `F101 retained draft ${unique}`,
            sender_type: "manager",
            status: "sent",
            attachments: [],
          }),
        });
        return;
      }
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: rawInboxDetail }),
      });
    },
  );
  await composer.fill(`F101 retained draft ${unique}`);
  await sendAction.click();
  const inboxFailure = await expectFeedback(page, {
    rawDetail: rawInboxDetail,
    recovery: false,
  });
  await expect(composer).toHaveValue(`F101 retained draft ${unique}`);
  await expect(composer).toBeFocused();
  await dismissFeedback(inboxFailure);

  await sendAction.click();
  await expect(composer).toHaveValue("");
  await dismissFeedback(
    await expectFeedback(page, { rawDetail: "raw-inbox", recovery: false }),
  );

  await composer.fill(`F101 later failure ${unique}`);
  await sendAction.click();
  await dismissFeedback(
    await expectFeedback(page, {
      rawDetail: rawInboxDetail,
      recovery: false,
    }),
  );
  await expect(composer).toHaveValue(`F101 later failure ${unique}`);
  expect(sendAttempt).toBe(3);
});
