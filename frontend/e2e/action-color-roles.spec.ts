import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("semantic action color matrix", () => {
  test("roles remain distinct, focusable and responsive", async ({ page }) => {
    await page.goto("/e2e/fixtures/action-color-roles.html");

    const matrix = page.getByTestId("action-color-matrix");
    await expect(matrix).toBeVisible();
    await expect(matrix.locator("button")).toHaveCount(10);

    const backgrounds = await Promise.all(
      ["brand", "neutral", "warning", "danger", "ai"].map(async (tone) =>
        page.getByTestId(`tone-${tone}`).evaluate((element) => getComputedStyle(element).backgroundColor),
      ),
    );
    expect(new Set(backgrounds).size).toBe(5);

    const warning = page.getByTestId("tone-warning");
    await expect(warning).toHaveCSS("background-color", "rgb(244, 192, 79)");
    await warning.hover();
    await expect(warning).toHaveCSS("background-color", "rgb(233, 172, 45)");
    await warning.focus();
    await expect(warning).toHaveCSS("box-shadow", /rgba\(164, 71, 13, 0\.42\)/);
    await expect(page.getByTestId("tone-warning-disabled")).toHaveCSS("opacity", "0.6");

    const overflow = await page.locator("body").evaluate((body) => body.scrollWidth - body.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
