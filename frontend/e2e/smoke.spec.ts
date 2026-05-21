import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, "../..");
const password = process.env.E2E_PASSWORD || "ZaniTest123!";

const users = {
  platform: process.env.E2E_PLATFORM_EMAIL || "platform_admin@example.com",
  owner: process.env.E2E_OWNER_EMAIL || "business_owner@example.com",
  operator: process.env.E2E_OPERATOR_EMAIL || "business_operator@example.com",
};

test.beforeAll(() => {
  if (process.env.E2E_SKIP_LOCAL_SETUP === "true") {
    return;
  }

  execFileSync(
    ".venv/bin/python",
    ["manage.py", "migrate"],
    { cwd: rootDir, env: { ...process.env, DATABASE_URL: "sqlite:///db.sqlite3" }, stdio: "inherit" },
  );
  execFileSync(
    ".venv/bin/python",
    ["manage.py", "prepare_e2e_smoke_data"],
    { cwd: rootDir, env: { ...process.env, DATABASE_URL: "sqlite:///db.sqlite3" }, stdio: "inherit" },
  );
});

async function login(page: Page, email: string, target: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Пароль|Password/).fill(password);
  await Promise.all([
    page.waitForURL(target),
    page.getByRole("button", { name: /Войти|Enter cockpit/ }).click(),
  ]);
}

test("platform admin lands in platform workspace", async ({ page }) => {
  await login(page, users.platform, /\/platform/);

  await expect(page).toHaveURL(/\/platform/);
  await expect(page.getByText("Zani overview")).toBeVisible();
  await expect(page.getByText("Total merchants")).toBeVisible();
});

test("business owner can use core merchant CRM pages", async ({ page }) => {
  await login(page, users.owner, /\/dashboard/);

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Business cockpit")).toBeVisible();

  await page.goto("/dashboard/leads");
  await expect(page.getByRole("heading", { name: "Sales pipeline" })).toBeVisible();

  await page.goto("/dashboard/conversations");
  await expect(page.getByRole("heading", { name: "Conversations" })).toBeVisible();

  await page.goto("/dashboard/settings");
  await expect(page.getByRole("heading", { name: /Настройки|Settings/ })).toBeVisible();
});

test("merchant users cannot open platform workspace", async ({ page }) => {
  await login(page, users.owner, /\/dashboard/);
  await page.goto("/platform");

  await expect(page).toHaveURL(/\/dashboard/);
});

test("operator sees restricted sections as forbidden", async ({ page }) => {
  await login(page, users.operator, /\/dashboard/);
  await page.goto("/dashboard/settings");

  await expect(page.getByText("Раздел скрыт настройками доступа")).toBeVisible();
  await expect(page.getByText(/роль|access/i)).toBeVisible();
});

test("mobile owner smoke: dashboard and calendar are reachable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile viewport smoke runs only in the mobile project.");

  await login(page, users.owner, /\/dashboard/);
  await expect(page.getByText("Business cockpit")).toBeVisible();

  await page.getByRole("link", { name: /Календарь|Calendar/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/calendar/);
  await expect(page.getByRole("heading", { name: "Smart calendar" })).toBeVisible();
});
