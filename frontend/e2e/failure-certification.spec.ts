import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  createFb010Matrix,
  fb010MerchantRoles,
  fb010ViewportProjects,
} from "./certification/failure-certification-registry.mjs";

const password = process.env.E2E_PASSWORD || "ZaniTest123!";
const users = {
  owner: process.env.E2E_OWNER_EMAIL || "business_owner@example.com",
  administrator: process.env.E2E_ADMIN_EMAIL || "business_administrator@example.com",
  manager: process.env.E2E_MANAGER_EMAIL || "business_manager@example.com",
  operator: process.env.E2E_OPERATOR_EMAIL || "business_operator@example.com",
  specialist: process.env.E2E_SPECIALIST_EMAIL || "business_specialist@example.com",
};
const rawTechnicalMarker = "SQLSTATE 42P01 token=fb010-never-render provider_secret=never-render";

async function browserLogin(page: Page, email: string) {
  if (page.url().startsWith("http")) {
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  }
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('form input[type="email"]').fill(email);
  await page.locator('form input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/app/);
  await expect(page.locator("main")).toBeVisible();
}

test.describe("FB-010 cross-role failure certification", () => {
  test("all applicable journey, role and failure cells preserve safe recovery on desktop and mobile", async ({
    page,
  }, testInfo) => {
    test.skip(
      !fb010ViewportProjects.includes(testInfo.project.name),
      "FB-010 requires the desktop and mobile projects; tablet remains in FC-007.",
    );
    test.setTimeout(420_000);

    await page.addInitScript(() => {
      localStorage.setItem("ai_smb_language", "ru");
    });
    await page.goto(`/e2e/fixtures/failure-certification.html?viewport=${testInfo.project.name}`);

    const expectedCells = createFb010Matrix().filter((cell) => cell.viewport === testInfo.project.name);
    await expect(page.getByTestId("fb010-cell-count")).toHaveText(`${expectedCells.length} browser cells`);
    await expect(page.locator("body")).not.toContainText(rawTechnicalMarker);
    await expect(page.locator("body")).not.toContainText(/Traceback|ChunkLoadError|provider_secret|SQLSTATE/i);

    const structuralEvidence = await page.locator("[data-fb010-case]").evaluateAll((elements) =>
      elements.map((element) => {
        const input = element.querySelector("input");
        const button = element.querySelector("button");
        const state = element.getAttribute("data-fb010-state");
        let recoverySelector = '[data-testid="fb010-recovery-control"]';
        if (["rate_limit", "temporary", "provider"].includes(state || "")) {
          recoverySelector = '[data-testid="inline-fallback"] button';
        } else if (state === "offline") {
          recoverySelector = '[data-testid="connectivity-banner"] button';
        } else if (state === "unexpected") {
          recoverySelector = '[data-testid="page-fallback"] button';
        }
        if (state !== "validation") {
          const recovery = element.querySelector(recoverySelector);
          if (recovery instanceof HTMLButtonElement) recovery.click();
        }
        return {
          id: element.getAttribute("data-fb010-case"),
          state,
          surface: element.getAttribute("data-fb010-surface"),
          hasInput: input instanceof HTMLInputElement && input.value.startsWith("draft:"),
          hasRecovery: button instanceof HTMLButtonElement && !button.disabled,
          overflow: element.scrollWidth - element.clientWidth,
          text: element.textContent || "",
        };
      }),
    );

    expect(structuralEvidence).toHaveLength(expectedCells.length);
    expect(new Set(structuralEvidence.map((entry) => entry.id)).size).toBe(expectedCells.length);
    for (const entry of structuralEvidence) {
      expect(entry.id).toBeTruthy();
      expect(entry.surface).toBeTruthy();
      expect(entry.hasInput).toBeTruthy();
      expect(entry.hasRecovery).toBeTruthy();
      expect(entry.overflow).toBeLessThanOrEqual(2);
      expect(entry.text.trim()).not.toBe("");
      expect(entry.text).not.toMatch(/Traceback|ChunkLoadError|provider_secret|SQLSTATE/i);
    }

    const validationCells = expectedCells.filter((cell) => cell.state === "validation");
    for (const cell of validationCells) {
      const card = page.locator(`[data-fb010-case="${cell.id}"]`);
      const context = card.locator("input");
      await card.getByTestId("field-error-summary").getByRole("button").evaluate(
        (button: HTMLButtonElement) => button.click(),
      );
      await expect(context).toBeFocused();
    }

    await expect.poll(async () => page
      .locator('[data-testid="fb010-recovery-status"]')
      .evaluateAll((elements) => elements.filter((element) => element.textContent === "recovered").length))
      .toBe(expectedCells.length);

    const postRecoveryEvidence = await page.locator("[data-fb010-case]").evaluateAll((elements) =>
      elements.map((element) => ({
        id: element.getAttribute("data-fb010-case"),
        context: (element.querySelector("input") as HTMLInputElement | null)?.value,
        recoveryStatus: element.querySelector('[data-testid="fb010-recovery-status"]')?.textContent,
      })),
    );
    const expectedById = new Map(expectedCells.map((cell) => [cell.id, cell]));
    for (const entry of postRecoveryEvidence) {
      const cell = expectedById.get(entry.id || "");
      expect(cell).toBeTruthy();
      expect(entry.context).toBe(`draft:${cell!.journey}:${cell!.role}`);
      expect(entry.recoveryStatus).toBe("recovered");
    }

    const pageOverflow = await page.evaluate(
      () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
    );
    expect(pageOverflow).toBeLessThanOrEqual(2);

    const accessibility = await new AxeBuilder({ page })
      .include('[data-fb010-axe-sample="true"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blockingViolations = accessibility.violations.filter((violation) =>
      violation.impact === "serious" || violation.impact === "critical",
    );
    expect(blockingViolations).toEqual([]);
  });

  test("session expiry redirects every merchant role safely and restores the intended route", async ({
    page,
  }, testInfo) => {
    test.skip(
      !fb010ViewportProjects.includes(testInfo.project.name),
      "FB-010 requires the desktop and mobile projects; tablet remains in FC-007.",
    );
    test.setTimeout(420_000);

    for (const role of fb010MerchantRoles) {
      const email = users[role as keyof typeof users];
      await browserLogin(page, email);

      const intendedRoute = `/app/tasks?fb010-role=${role}`;
      const rawSessionDetail = `raw-session-${role}-stack`;
      let protectedRequestForced = false;
      await page.route(/\/api\/tasks\/(?:\?.*)?$/, async (route) => {
        if (route.request().method() === "GET" && !protectedRequestForced) {
          protectedRequestForced = true;
          await route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ code: "token_not_valid", detail: rawSessionDetail }),
          });
          return;
        }
        await route.continue();
      });
      await page.route("**/api/auth/token/refresh/", async (route) => {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ code: "token_not_valid", detail: rawSessionDetail }),
        });
      });

      await page.goto(intendedRoute);
      await expect(page).toHaveURL(/\/login/);
      const notice = page.getByTestId("session-expired-notice");
      await expect(notice).toBeVisible();
      await expect(notice).not.toContainText(rawSessionDetail);
      await expect.poll(() => page.evaluate(
        () => window.sessionStorage.getItem("zani:session-expired-return-to"),
      )).toBe(intendedRoute);
      await page.unroute(/\/api\/tasks\/(?:\?.*)?$/);
      await page.unroute("**/api/auth/token/refresh/");

      await page.locator('form input[type="email"]').fill(email);
      await page.locator('form input[type="password"]').fill(password);
      await page.locator('form button[type="submit"]').click();
      await expect(page).toHaveURL(/\/app\/tasks/);
      await expect.poll(() => page.evaluate(() => ({
        pathname: window.location.pathname,
        role: new URLSearchParams(window.location.search).get("fb010-role"),
      }))).toEqual({ pathname: "/app/tasks", role });
      await expect(page.locator("body")).not.toContainText(rawSessionDetail);
    }
  });
});
