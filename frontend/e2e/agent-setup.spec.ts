import { expect, test } from "@playwright/test";

test("saved agent setup, draft preview, recovery and readiness", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/login");
  await page.locator('form input[type="email"]').fill(process.env.E2E_OWNER_EMAIL || "business_owner@example.com");
  await page.locator('form input[type="password"]').fill(process.env.E2E_PASSWORD || "ZaniTest123!");
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/app/);
  await page.goto("/app/ai-agents");
  await expect(page.getByTestId("ai-agents-workspace-ready")).toBeVisible();
  // The isolated seed contains a draft with no profile; finish that draft first.
  const initialSave = page.getByRole("button", { name: "Сохранить изменения", exact: true });
  if (await initialSave.isEnabled()) {
    await initialSave.click();
    await expect(initialSave).toBeDisabled();
  }
  await page.getByRole("button", { name: "Создать агента", exact: true }).first().click();
  const modal = page.getByRole("dialog");
  await modal.getByRole("textbox").fill(`Setup ${testInfo.project.name}`);
  await modal.getByRole("button", { name: "Создать агента", exact: true }).click();
  await expect(modal).not.toBeVisible();
  const editor = page.getByTestId("ai-agent-editor");
  await expect(editor.getByLabel("Язык", { exact: true })).toBeVisible();
  await editor.getByLabel("Язык", { exact: true }).click();
  await page.getByRole("option", { name: "Қазақша", exact: true }).click();
  await editor.getByLabel("Тон", { exact: true }).click();
  await page.getByRole("option", { name: "Формальный", exact: true }).click();
  await expect(editor.locator('input[type="range"]')).toHaveCount(0);
  await editor.getByRole("button", { name: /Дополнительные настройки/ }).click();
  await editor.locator('input[type="range"]').fill("0.2");
  await editor.getByRole("tab", { name: "Действия", exact: true }).click();
  await editor.getByLabel("Что делать после диалога", { exact: true }).click();
  await page.getByRole("option", { name: "Только оценить обращение", exact: true }).click();
  await editor.getByRole("switch", { name: "Автоматически отправлять ответ", exact: true }).click();
  await editor.getByRole("tab", { name: /Тест/ }).click();
  await expect(editor.getByText("Сохраните настройки перед проверкой")).toBeVisible();
  await expect(editor.getByRole("button", { name: "Проверить ответ" })).toBeDisabled();
  const saved = page.waitForResponse((response) => /\/api\/bots\/\d+\/$/.test(new URL(response.url()).pathname) && response.request().method() === "PATCH");
  await editor.getByRole("button", { name: "Сохранить изменения" }).click();
  const payload = await (await saved).json();
  expect(payload.settings_json.temperature).toBe(0.2);
  expect(payload.default_language).toBe("kk");
  expect(payload.settings_json.auto_crm_pipeline.auto_send_reply).toBe(true);
  await expect(editor.getByText("Сохраните настройки перед проверкой")).toHaveCount(0);
  await expect(editor.getByRole("switch")).toBeDisabled(); // no channel
  await editor.getByRole("button", { name: "Цена", exact: true }).click();
  await editor.getByRole("button", { name: "Проверить ответ" }).click();
  await expect(editor.getByText("Тестовый режим: показан демонстрационный результат.", { exact: true })).toBeVisible();
  await page.screenshot({ path: `../output/agent-setup-20260924/${testInfo.project.name}-preview.png`, fullPage: true });
  // A real backend response above; inject one transport failure to check retry UX.
  await page.route(/\/api\/bots\/\d+\/preview\/$/, (route) => route.fulfill({ status: 503, json: { code: "provider_unavailable", detail: "Temporarily unavailable" } }));
  await editor.getByLabel("Сообщение от тестового клиента").fill("Повторный тест");
  await editor.getByRole("button", { name: "Проверить ответ" }).click();
  await expect(editor.getByLabel("Сообщение от тестового клиента")).toHaveValue("Повторный тест");
  await expect(editor.getByRole("button", { name: "Проверить ответ" })).toBeEnabled();
  await page.unroute(/\/api\/bots\/\d+\/preview\/$/);
  await editor.getByRole("button", { name: "Новый тест" }).click();
  await expect(editor.getByRole("log")).toBeEmpty();
  await page.reload();
  await expect(editor.getByRole("button", { name: "Проверить ответ" })).toBeVisible();
  await editor.getByRole("tab", { name: "Профиль", exact: true }).click();
  await expect(editor.getByLabel("Язык", { exact: true })).toContainText("Қазақша");
  await expect(editor.getByLabel("Тон", { exact: true })).toContainText("Формальный");
  await page.screenshot({ path: `../output/agent-setup-20260924/${testInfo.project.name}-profile.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
