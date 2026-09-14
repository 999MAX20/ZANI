import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const stories = [
  "zani-buttons--states", "zani-buttons--long-localized-label",
  "zani-fields--default", "zani-fields--validation",
  "zani-navigation--keyboard-tabs", "zani-navigation--dialog", "zani-navigation--open-dialog",
  "zani-servicetable--populated", "zani-servicetable--empty", "zani-servicetable--loading",
  "zani-servicemodal--editable", "zani-servicemodal--archived", "zani-servicemodal--save-error", "zani-servicemodal--saving",
  "zani-crmdrawer--empty-related", "zani-crmdrawer--loading",
];

test("the fresh Storybook index matches the tested catalogue", async ({ request }) => {
  const response = await request.get("/index.json");
  expect(response.ok()).toBe(true);
  const index = await response.json();
  const ids = Object.values(index.entries as Record<string, { type: string; id: string }>).filter((entry) => entry.type === "story").map((entry) => entry.id);
  expect(ids.sort()).toEqual([...stories].sort());
});

async function openStory(page: Page, id: string, locale: string) {
  await page.goto(`/iframe.html?id=${id}&viewMode=story&globals=locale:${locale}`);
  await expect(page.locator(`[data-catalog-ready="${locale}"]`)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}

test.beforeEach(async ({ page, baseURL }) => {
  // Real CRM APIs, telemetry, CDNs and external data are not test prerequisites.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== baseURL || url.pathname.startsWith("/api/")) {
      await route.abort();
      throw new Error(`Catalogue attempted forbidden network request: ${url.origin}${url.pathname}`);
    }
    await route.continue();
  });
});

for (const locale of ["ru", "kk", "en"]) {
  test(`${locale}: service table filtering, pagination, action menu and row keyboard`, async ({ page }) => {
    await openStory(page, "zani-servicetable--populated", locale);
    const pagination = page.getByTestId("crm-pagination");
    await pagination.getByRole("button").nth(1).click();
    await expect(pagination.locator('[aria-current="page"]')).toHaveText("2/2");
    await page.getByRole("textbox").fill("Synthetic 01");
    await expect(pagination.locator('[aria-current="page"]')).toHaveText("1/1");
    const row = page.getByTestId("catalog-service-1").filter({ visible: true });
    const trigger = row.getByTestId("row-actions-trigger");
    await trigger.press("Enter");
    await expect(page.getByRole("menuitem")).toHaveCount(3);
    await page.keyboard.press("ArrowDown");
    await expect(page.locator('[data-action-key="deactivate"]')).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await row.focus();
    await row.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(row).toBeFocused();
  });

  test(`${locale}: service modal validates, resets and recovers from an error`, async ({ page }) => {
    await openStory(page, "zani-servicemodal--save-error", locale);
    const dialog = page.getByRole("dialog");
    const name = dialog.getByRole("textbox").first();
    const initial = await name.inputValue();
    const save = dialog.locator('button[type="submit"]');
    await expect(save).toBeDisabled();
    await name.fill("x");
    await save.click();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(dialog).toBeVisible();
    await name.fill("Synthetic edited");
    // Footer secondary action resets unsaved changes; it does not close.
    await dialog.locator('button[type="submit"]').locator("..").getByRole("button").first().click();
    await expect(name).toHaveValue(initial);
    await expect(save).toBeDisabled();
    await name.fill("Synthetic saved");
    await save.click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("catalog-saved-name")).toHaveText("Synthetic saved");
  });

  test(`${locale}: archived modal and saving state cannot submit`, async ({ page }) => {
    await openStory(page, "zani-servicemodal--archived", locale);
    for (const input of await page.getByRole("dialog").getByRole("textbox").all()) await expect(input).toBeDisabled();
    await expect(page.getByRole("dialog").locator('button[type="submit"]')).toHaveCount(0);
    await openStory(page, "zani-servicemodal--saving", locale);
    const save = page.getByRole("dialog").locator('button[type="submit"]');
    await expect(save).toBeDisabled();
    await expect(save).toHaveAttribute("aria-busy", "true");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test(`${locale}: CRM drawer tabs, keyboard trap and exact focus return`, async ({ page }) => {
    await openStory(page, "zani-crmdrawer--empty-related", locale);
    await page.keyboard.press("Escape");
    const trigger = page.getByTestId("catalog-drawer-trigger");
    await trigger.focus();
    await trigger.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button").first()).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button").last()).toBeFocused();
    await dialog.getByTestId("crm-entity-tab-notes").press("Enter");
    await expect(page.getByTestId("catalog-drawer-content")).not.toBeEmpty();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  for (const story of stories) {
    test(`${locale}: ${story} accessibility and layout`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await openStory(page, story, locale);
      expect(errors).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(result.violations).toEqual([]);
      // Review artifacts, not auto-approved golden screenshots.
      const screenshot = testInfo.outputPath(`${story}-${locale}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      await testInfo.attach(`${story}-${locale}`, { path: screenshot, contentType: "image/png" });
    });
  }

  test(`${locale}: buttons keyboard, hover, pressed, disabled and loading`, async ({ page }, testInfo) => {
    await openStory(page, "zani-buttons--states", locale);
    const buttons = page.getByTestId("variant-primary").getByRole("button");
    await expect(buttons.nth(1)).toBeDisabled();
    await expect(buttons.nth(2)).toBeDisabled();
    await expect(buttons.nth(2)).toHaveAttribute("aria-busy", "true");
    await page.keyboard.press("Tab");
    await expect(buttons.first()).toBeFocused();
    expect(await buttons.first().evaluate((button) => getComputedStyle(button).boxShadow)).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("click-count")).toHaveText("1");
    await buttons.first().hover();
    await testInfo.attach("hover", { body: await buttons.first().screenshot(), contentType: "image/png" });
    await page.mouse.down();
    await testInfo.attach("pressed", { body: await buttons.first().screenshot(), contentType: "image/png" });
    await page.mouse.up();
    await expect(page.getByTestId("click-count")).toHaveText("2");
  });

  test(`${locale}: fields preserve typing and support keyboard selection`, async ({ page }) => {
    await openStory(page, "zani-fields--default", locale);
    const input = page.getByRole("textbox").first();
    await input.pressSequentially("Alpha beta");
    await expect(input).toHaveValue("Alpha beta");
    await expect(input).toBeFocused();
    const select = page.getByRole("combobox");
    await select.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(select).toBeFocused();
    await page.getByRole("switch").press("Space");
    await expect(page.getByTestId("field-state")).toHaveText("Alpha beta|long|true");
  });

  test(`${locale}: tabs and dialog return focus`, async ({ page }) => {
    await openStory(page, "zani-navigation--keyboard-tabs", locale);
    const tabs = page.getByRole("tab");
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(tabs.first()).toBeFocused();

    await openStory(page, "zani-navigation--dialog", locale);
    const trigger = page.locator('[data-focus-return-id="catalog-dialog"]');
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button").first()).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button").last()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}
