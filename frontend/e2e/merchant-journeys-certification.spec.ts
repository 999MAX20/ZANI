import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const password = process.env.E2E_PASSWORD || "ZaniTest123!";
const apiBaseURL = process.env.E2E_API_BASE_URL || "http://127.0.0.1:8000";
const ownerEmail = process.env.E2E_OWNER_EMAIL || "business_owner@example.com";
const operatorEmail =
  process.env.E2E_OPERATOR_EMAIL || "business_operator@example.com";

type TokenPayload = { access: string };
type ListPayload<T> = T[] | { results: T[] };

function unwrapList<T>(payload: ListPayload<T>) {
  return Array.isArray(payload) ? payload : payload.results || [];
}

function authHeaders(tokens: TokenPayload) {
  return { Authorization: `Bearer ${tokens.access}` };
}

async function login(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('form input[type="email"]').first().fill(ownerEmail);
  await page.locator('form input[type="password"]').first().fill(password);
  const tokenResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/auth/token/"),
  );
  await page.locator('form button[type="submit"]').click();
  const response = await tokenResponse;
  expect(response.ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/app/);
  await expect(page.locator("main").first()).toBeVisible();
  return (await response.json()) as TokenPayload;
}

async function getBusinessId(
  request: APIRequestContext,
  tokens: TokenPayload,
) {
  const response = await request.get(`${apiBaseURL}/api/auth/me/`, {
    headers: authHeaders(tokens),
  });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  const businessId = payload.businesses?.[0]?.id;
  expect(businessId).toBeTruthy();
  return businessId as number;
}

test.describe("FC-006 pilot merchant journeys", () => {
  test("FC-J06 import validation, duplicates and visible records persist through the Leads UI", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const tokens = await login(page);
    const businessId = await getBusinessId(page.request, tokens);
    const headers = authHeaders(tokens);
    const unique = Date.now();
    const marker = `FC-J06-${unique}`;
    const phone = `+7706${String(unique).slice(-7)}`;

    const clientResponse = await page.request.post(
      `${apiBaseURL}/api/clients/`,
      {
        headers,
        data: {
          business: businessId,
          full_name: `Certification client ${unique}`,
          phone,
          email: `fc-j06-${unique}@example.com`,
          source: "manual",
        },
      },
    );
    expect(clientResponse.ok()).toBeTruthy();

    await page.goto("/app/leads");
    await expect(page.getByTestId("leads-workspace-ready")).toBeVisible();
    await page.getByTestId("leads-import").click();
    await expect(page.getByTestId("leads-import-modal")).toBeVisible();

    const csv = [
      "full_name,phone,email,service_name,source,message,status",
      `Certification client ${unique},${phone},fc-j06-${unique}@example.com,,landing,${marker},new`,
    ].join("\n");
    await page.getByTestId("import-file").setInputFiles({
      name: `fc-j06-${unique}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    });

    const previewResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith("/api/import-jobs/"),
    );
    await page.getByTestId("import-preview").click();
    const preview = await previewResponse;
    expect(preview.status()).toBe(201);
    const previewPayload = await preview.json();
    expect(previewPayload.status).toBe("previewed");
    expect(previewPayload.errors_json?.rows || []).toEqual([]);
    expect(previewPayload.duplicates_json?.rows?.length).toBeGreaterThan(0);
    await expect(page.getByTestId("import-duplicates")).toBeVisible();

    const confirmResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/api\/import-jobs\/\d+\/confirm\/$/.test(response.url()),
    );
    await page.getByTestId("import-confirm").click();
    const confirmed = await confirmResponse;
    expect(confirmed.ok()).toBeTruthy();
    const confirmedPayload = await confirmed.json();
    expect(confirmedPayload.status).toBe("imported");
    expect(confirmedPayload.imported_count).toBe(1);

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("leads-import-modal")).toHaveCount(0);
    await page.getByTestId("leads-search-input").fill(marker);
    await expect(
      page
        .locator(
          '[data-testid="lead-row-keyboard-open"]:visible, [data-testid="lead-mobile-row-open"]:visible',
        )
        .filter({ hasText: `Certification client ${unique}` }),
    ).toBeVisible();

    const leadsResponse = await page.request.get(
      `${apiBaseURL}/api/leads/?search=${encodeURIComponent(marker)}`,
      { headers },
    );
    expect(leadsResponse.ok()).toBeTruthy();
    const leads = unwrapList(await leadsResponse.json());
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      business: businessId,
      message: marker,
      source: "landing",
    });
  });

  test("FC-J07 owner role change is applied by the Team UI and restored", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const tokens = await login(page);
    const businessId = await getBusinessId(page.request, tokens);
    const headers = authHeaders(tokens);
    const membersResponse = await page.request.get(
      `${apiBaseURL}/api/team/members/?business=${businessId}`,
      { headers },
    );
    expect(membersResponse.ok()).toBeTruthy();
    const members = unwrapList<{
      id: number;
      role: string;
      business_role: number | null;
      user: { email: string };
    }>(await membersResponse.json());
    const operator = members.find(
      (member) => member.user.email === operatorEmail,
    );
    expect(operator).toBeTruthy();
    if (!operator) return;

    const originalRole = operator.role;
    const originalBusinessRole = operator.business_role;
    let needsRestore = false;
    try {
      await page.goto("/app/settings#team-access");
      await expect(page.getByTestId("team-member-select")).toBeAttached();
      await page.getByTestId("team-member-select").selectOption(String(operator.id));
      await expect(page.getByTestId("team-role-select")).toHaveValue(originalRole);

      const updateResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          response.url().endsWith(`/api/team/members/${operator.id}/`),
      );
      await page.getByTestId("team-role-select").selectOption("manager");
      const updated = await updateResponse;
      expect(updated.ok()).toBeTruthy();
      expect((await updated.json()).role).toBe("manager");
      needsRestore = true;

      const persistedResponse = await page.request.get(
        `${apiBaseURL}/api/team/members/?business=${businessId}`,
        { headers },
      );
      const persistedMembers = unwrapList<{ id: number; role: string }>(
        await persistedResponse.json(),
      );
      expect(
        persistedMembers.find((member) => member.id === operator.id)?.role,
      ).toBe("manager");

      const restoreResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          response.url().endsWith(`/api/team/members/${operator.id}/`),
      );
      await page.getByTestId("team-role-select").selectOption(originalRole);
      expect((await restoreResponse).ok()).toBeTruthy();
      needsRestore = false;
    } finally {
      if (needsRestore) {
        const restore = await page.request.patch(
          `${apiBaseURL}/api/team/members/${operator.id}/`,
          {
            headers,
            data: {
              role: originalRole,
              business_role: originalBusinessRole,
            },
          },
        );
        expect(restore.ok()).toBeTruthy();
      }
    }
  });

  test("FC-J10 grounded AI suggestion requires approval and persists task plus audit", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const tokens = await login(page);
    const businessId = await getBusinessId(page.request, tokens);
    const headers = authHeaders(tokens);

    await page.goto("/app/ai-assistant");
    await expect(page.getByTestId("ai-action-workflow")).toBeVisible();
    const sourceSelect = page.getByTestId("ai-action-source");
    const conversationId = await sourceSelect
      .locator("option")
      .nth(1)
      .getAttribute("value");
    expect(conversationId).toBeTruthy();
    if (!conversationId) return;
    await sourceSelect.selectOption(conversationId);
    await page
      .getByTestId("ai-action-prompt")
      .fill("Create a grounded follow-up task for this conversation");

    const suggestResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith("/api/ai/tools/suggest/"),
    );
    await page.getByTestId("ai-action-suggest").click();
    const suggested = await suggestResponse;
    expect(suggested.status()).toBe(201);
    const suggestedPayload = await suggested.json();
    const taskAction = suggestedPayload.suggested_actions.find(
      (action: { tool_name: string }) => action.tool_name === "create_task",
    );
    expect(taskAction).toBeTruthy();
    expect(String(taskAction.conversation)).toBe(conversationId);
    await expect(page.getByTestId("ai-action-source-chip").first()).toHaveText(
      `CONVERSATION-${conversationId}`,
    );

    await page.getByTestId(`ai-action-run-${taskAction.id}`).click();
    const approvalDialog = page.getByRole("dialog");
    await expect(approvalDialog).toBeVisible();
    await approvalDialog.locator("textarea").fill("Owner confirmed this action");
    const executeResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith(`/api/ai/tools/${taskAction.id}/execute/`),
    );
    await approvalDialog.getByRole("button").last().click();
    const executed = await executeResponse;
    expect(executed.ok()).toBeTruthy();
    const executedPayload = await executed.json();
    expect(executedPayload.status).toBe("executed");
    const taskId = executedPayload.output_json?.task_id;
    expect(taskId).toBeTruthy();
    await expect(page.getByText(new RegExp(`ID: ${taskId}`))).toBeVisible();

    const taskResponse = await page.request.get(
      `${apiBaseURL}/api/tasks/${taskId}/`,
      { headers },
    );
    expect(taskResponse.ok()).toBeTruthy();
    expect(await taskResponse.json()).toMatchObject({
      business: businessId,
      conversation: Number(conversationId),
    });

    const auditResponse = await page.request.get(
      `${apiBaseURL}/api/security/audit/?business=${businessId}&entity_type=AIToolCallLog`,
      { headers },
    );
    expect(auditResponse.ok()).toBeTruthy();
    const auditLogs = unwrapList<{
      entity_id: string;
      metadata: Record<string, unknown>;
    }>(await auditResponse.json());
    expect(
      auditLogs.some(
        (entry) =>
          entry.entity_id === String(taskAction.id) &&
          entry.metadata?.status === "executed" &&
          entry.metadata?.approval_id,
      ),
    ).toBeTruthy();
  });
});
