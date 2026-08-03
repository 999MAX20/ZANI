import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_PASSWORD || "ZaniTest123!";
const ownerEmail =
  process.env.E2E_OWNER_EMAIL || "business_owner@example.com";

async function login(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('form input[type="email"]').first().fill(ownerEmail);
  await page.locator('form input[type="password"]').first().fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/app/);
}

test("deal kanban exposes one dense localized canonical pipeline", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await login(page);
  await page.goto("/app/deals");
  await expect(page.getByTestId("deals-workspace-ready")).toBeVisible();

  const board = page.getByTestId("deals-kanban-board");
  await expect(board).toBeVisible();
  const stages = board.locator('[data-testid^="deals-kanban-stage-"]');
  await expect(stages).toHaveCount(6);
  await expect(stages.locator(":scope > header h3")).toHaveText([
    "Новая сделка",
    "Квалификация",
    "Предложение",
    "Согласование",
    "Успешно",
    "Потеряно",
  ]);

  const boardMetrics = await board.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(boardMetrics.scrollWidth).toBeLessThanOrEqual(
    boardMetrics.clientWidth + 2,
  );

  const cards = stages.first().locator("article");
  await expect(cards).toHaveCount(6);
  const cardHeights = await cards.evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().height),
  );
  expect(Math.max(...cardHeights)).toBeLessThanOrEqual(112);
  await expect(cards.last()).toBeInViewport();
});

test("narrow deal kanban keeps deliberate horizontal navigation", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "tablet-chromium");
  await login(page);
  await page.goto("/app/deals");
  await expect(page.getByTestId("deals-workspace-ready")).toBeVisible();

  const board = page.getByTestId("deals-kanban-board");
  const before = await board.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    scrollLeft: element.scrollLeft,
  }));
  expect(before.scrollWidth).toBeGreaterThan(before.clientWidth);

  const after = await board.evaluate((element) => {
    element.scrollTo({ left: element.scrollWidth, behavior: "instant" });
    return element.scrollLeft;
  });
  expect(after).toBeGreaterThan(before.scrollLeft);
  await expect(
    board.locator('[data-testid^="deals-kanban-stage-"]').last(),
  ).toBeInViewport();
});
