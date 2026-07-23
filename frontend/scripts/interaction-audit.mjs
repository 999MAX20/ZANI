import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const apiBaseURL = process.env.E2E_API_BASE_URL || "http://127.0.0.1:8000";
const email = process.env.E2E_OWNER_EMAIL || "business_owner@example.com";
const password = process.env.E2E_PASSWORD || "ZaniTest123!";
const dateStamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..");
const rootDir = path.resolve(frontendDir, "..");
const outDir = path.resolve(rootDir, "output", "playwright", `interaction-audit-${dateStamp}`);
const pythonPath = defaultPythonPath();
const djangoEnv = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || "sqlite:///db.sqlite3",
  ALLOWED_HOSTS: process.env.ALLOWED_HOSTS || "localhost,127.0.0.1",
  SECURE_SSL_REDIRECT: process.env.SECURE_SSL_REDIRECT || "False",
  SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE || "False",
  CSRF_COOKIE_SECURE: process.env.CSRF_COOKIE_SECURE || "False",
  AUTH_LOGIN_RATE: process.env.AUTH_LOGIN_RATE || "1000/min",
  AUTH_REFRESH_RATE: process.env.AUTH_REFRESH_RATE || "1000/min",
};

const routes = [
  {
    name: "dashboard",
    url: "/app/dashboard",
    actions: [
      { name: "open-leads-from-dashboard", kind: "link", href: "/app/leads" },
      { name: "open-tasks-from-dashboard", kind: "link", href: "/app/tasks" },
    ],
  },
  {
    name: "leads",
    url: "/app/leads",
    actions: [
      { name: "open-create-lead", kind: "button", text: /создать заявку|новая заявка/i },
      { name: "open-filters", kind: "button", text: /фильтр/i },
      { name: "open-columns", kind: "button", text: /колонки/i },
      { name: "open-import", kind: "button", text: /импорт/i },
      { name: "open-selected-lead-workspace", kind: "button", text: /^открыть$/i },
    ],
  },
  {
    name: "deals",
    url: "/app/deals",
    actions: [
      { name: "open-create-deal", kind: "button", text: /создать сделку|новая сделка/i },
      { name: "open-filters", kind: "button", text: /фильтр/i },
      { name: "select-kanban-card", kind: "locator", selector: 'main button:has-text("E2E Workspace Deal"), main [role="button"]:has-text("E2E Workspace Deal")' },
      { name: "open-selected-deal-workspace", kind: "button", text: /открыть сделку/i },
      { name: "open-deal-task-surface", kind: "button", text: /создать задачу/i },
    ],
  },
  {
    name: "clients",
    url: "/app/clients",
    actions: [
      { name: "open-create-client", kind: "button", text: /создать клиента|новый клиент/i },
      { name: "open-advanced-filters", kind: "button", text: /расширенные/i },
      { name: "open-columns", kind: "button", text: /столбцы|columns/i },
      { name: "open-client-row-workspace", kind: "locator", selector: 'main button[data-testid="client-row-action-open"]' },
    ],
  },
  {
    name: "tasks",
    url: "/app/tasks",
    actions: [
      { name: "open-create-task", kind: "button", text: /быстрая задача|создать задачу|новая задача/i },
      { name: "open-all-filter", kind: "button", text: /^все$/i },
      { name: "open-overdue-filter", kind: "button", text: /просрочен/i },
      { name: "open-task-row-workspace", kind: "locator", selector: 'main button[data-testid="task-row-action-open"]' },
      { name: "open-selected-task-workspace", kind: "button", text: /детали|details/i },
    ],
  },
  {
    name: "calendar",
    url: "/app/calendar?date=2026-07-21&view=month",
    actions: [
      { name: "open-create-appointment", kind: "button", text: /создать запись|новая запись|запись/i },
      { name: "open-month-day", kind: "locator", selector: 'main button[aria-label*="2026"]' },
      { name: "open-month-inspector-create", kind: "button", text: /новая запись/i, before: { kind: "locator", selector: 'main button[aria-label*="2026"]' } },
      { name: "open-month-inspector-day", kind: "button", text: /открыть день/i, before: { kind: "locator", selector: 'main button[aria-label*="2026"]' } },
    ],
  },
  {
    name: "conversations",
    url: "/app/conversations",
    actions: [
      { name: "select-conversation", kind: "locator", selector: 'main [role="button"]:has-text("E2E Workspace Client"), main button:has-text("E2E Workspace Client")' },
      { name: "open-quick-replies", kind: "button", text: /ответы|быстрые ответы|шаблон/i },
      { name: "open-linked-client", kind: "button", text: /открыть клиента/i },
      { name: "open-linked-lead", kind: "button", text: /открыть заявку/i },
      { name: "open-linked-deal", kind: "button", text: /открыть сделку/i },
      { name: "open-context-task", kind: "button", text: /создать задачу/i },
    ],
  },
  {
    name: "integrations",
    url: "/app/integrations",
    actions: [
      { name: "open-status-filter", kind: "button", text: /все статусы/i },
      { name: "open-provider-setup", kind: "button", text: /подключить|настроить/i },
    ],
  },
  {
    name: "analytics",
    url: "/app/analytics",
    actions: [
      { name: "open-team-csv", kind: "button", text: /csv команды/i },
      { name: "open-smart-report-action", kind: "link", href: "/app/integrations" },
      { name: "open-source-csv", kind: "button", text: /^csv$/i },
    ],
  },
  {
    name: "settings",
    url: "/app/settings",
    actions: [
      { name: "open-team-group", kind: "button", text: /^команда$/i },
      { name: "open-team-section", kind: "locator", selector: 'main a[href="#team-access"]' },
      { name: "open-security-section", kind: "locator", selector: 'main a[href="#security-center"]' },
      { name: "open-advanced-group", kind: "button", text: /^расширенно$/i },
      { name: "open-save-surface", kind: "button", text: /сохранить настройки/i, allowSubmit: false },
    ],
  },
  {
    name: "outreach",
    url: "/app/outreach",
    actions: [
      { name: "open-primary-action", kind: "button", text: /импорт согласий|создать рассылку/i },
    ],
  },
  {
    name: "ai-agents",
    url: "/app/ai-agents",
    actions: [
      { name: "open-primary-action", kind: "button", text: /создать агента|открыть сообщения|сохранить|пауза/i },
    ],
  },
];
function safeFileName(value) {
  return value.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
}

function defaultPythonPath() {
  const relativePath = process.platform === "win32"
    ? [".venv", "Scripts", "python.exe"]
    : [".venv", "bin", "python"];
  const candidate = path.join(rootDir, ...relativePath);
  return fs.existsSync(candidate) ? candidate : "python";
}

function isLocalUrl(value) {
  try {
    const { hostname } = new URL(value);
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

async function isReachable(url) {
  try {
    const response = await fetch(url, { method: "GET" });
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

function startManagedProcess(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd || frontendDir,
    env: options.env || process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const logs = [];
  const append = (chunk) => {
    const text = chunk.toString();
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      logs.push(`[${name}] ${line}`);
      if (logs.length > 80) logs.shift();
    }
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  return { child, name, logs };
}

function runDjangoCommand(args) {
  const result = spawnSync(pythonPath, args, {
    cwd: rootDir,
    env: djangoEnv,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Django command failed: ${pythonPath} ${args.join(" ")}`);
  }
}

function prepareDjango() {
  runDjangoCommand(["manage.py", "migrate"]);
  runDjangoCommand([
    "-c",
    [
      "import os",
      "os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')",
      "import django",
      "django.setup()",
      "from django.core.management import call_command",
      "call_command('prepare_e2e_smoke_data', verbosity=1)",
    ].join(";"),
  ]);
}

function npmCommand(args) {
  if (process.platform !== "win32") return { command: "npm", args };
  return { command: "cmd.exe", args: ["/d", "/s", "/c", ["npm", ...args].join(" ")] };
}

async function waitForUrl(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isReachable(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function ensureLocalServers() {
  const started = [];
  if (!isLocalUrl(baseURL)) {
    await waitForUrl(baseURL, 30_000);
    return started;
  }

  const healthUrl = `${apiBaseURL.replace(/\/$/, "")}/health/`;
  if (!(await isReachable(healthUrl))) {
    prepareDjango();
    started.push(
      startManagedProcess(
        "django",
        pythonPath,
        ["manage.py", "runserver", "127.0.0.1:8000"],
        { cwd: rootDir, env: djangoEnv },
      ),
    );
    await waitForUrl(healthUrl, 240_000).catch((error) => {
      for (const processInfo of started) console.error(processInfo.logs.join("\n"));
      throw error;
    });
  }

  if (!(await isReachable(baseURL))) {
    const viteCommand = npmCommand(["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"]);
    started.push(startManagedProcess("vite", viteCommand.command, viteCommand.args));
    await waitForUrl(baseURL, 240_000).catch((error) => {
      for (const processInfo of started) console.error(processInfo.logs.join("\n"));
      throw error;
    });
  }

  return started;
}

function stopManagedProcesses(processes) {
  for (const { child } of [...processes].reverse()) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      child.kill("SIGTERM");
    }
  }
}

async function apiLogin(page) {
  let response = await page.request.post(`${apiBaseURL}/api/auth/token/`, {
    data: { email, password },
  });
  for (let attempt = 0; attempt < 3 && response.status() === 429; attempt += 1) {
    await page.waitForTimeout(10_000);
    response = await page.request.post(`${apiBaseURL}/api/auth/token/`, {
      data: { email, password },
    });
  }
  if (!response.ok()) {
    throw new Error(`Interaction audit login failed with ${response.status()}: ${await response.text()}`);
  }
  return response.json();
}

async function createAuthenticatedPage(browser, viewport = { width: 1920, height: 1080 }) {
  const context = await browser.newContext({
    baseURL,
    viewport,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const tokens = await apiLogin(page);
  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem("zani_language", "ru");
    localStorage.setItem("ai_smb_access_token", access);
    localStorage.setItem("ai_smb_refresh_token", refresh);
  }, tokens);
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/api/auth/token/refresh/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access: tokens.access }),
      });
      return;
    }
    const headers = { ...route.request().headers() };
    if (!url.includes("/api/auth/token/") && !url.includes("/api/auth/social/")) {
      headers.Authorization = `Bearer ${tokens.access}`;
    }
    await route.continue({ headers });
  });
  return { context, page };
}

function actionLocator(page, action) {
  if (action.kind === "button") return page.getByRole("button", { name: action.text }).first();
  if (action.kind === "link") return page.locator(`main a[href="${action.href}"], nav a[href="${action.href}"]`).first();
  return page.locator(action.selector).first();
}

async function closeTransientUi(page) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(250);
  const closeButtons = [
    page.getByRole("button", { name: /Р·Р°РєСЂС‹С‚СЊ|close|РѕС‚РјРµРЅР°|cancel/i }).first(),
    page.locator('button[aria-label*="Р—Р°РєСЂС‹С‚СЊ"], button[aria-label*="Close"]').first(),
  ];
  for (const button of closeButtons) {
    if (await button.isVisible({ timeout: 250 }).catch(() => false)) {
      await button.click().catch(() => {});
      await page.waitForTimeout(250);
      break;
    }
  }
}

async function collectState(page) {
  return page.evaluate(() => {
    const mainText = document.querySelector("main")?.textContent || "";
    const visibleDialogs = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      }).length;
    const activeOverlays = Array.from(document.querySelectorAll('[data-radix-popper-content-wrapper], [data-headlessui-state], .fixed.inset-0'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 20 && rect.height > 20 && style.visibility !== "hidden" && style.display !== "none";
      }).length;
    return {
      finalUrl: location.pathname + location.search,
      authRedirected: location.pathname === "/login",
      unexpectedError: /Unexpected Application Error|Application Error|РѕС€РёР±РєР° РїСЂРёР»РѕР¶РµРЅРёСЏ/i.test(mainText),
      visibleDialogs,
      activeOverlays,
    };
  });
}

async function runAction(page, routeName, action) {
  if (action.before) {
    const beforeLocator = actionLocator(page, action.before);
    const beforeVisible = await beforeLocator.isVisible({ timeout: 1500 }).catch(() => false);
    if (!beforeVisible) return { action: action.name, status: "missing-prerequisite" };
    await beforeLocator.click({ timeout: 5000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(400);
  }

  const locator = actionLocator(page, action);
  const visible = await locator.isVisible({ timeout: 1500 }).catch(() => false);
  if (!visible) {
    return { action: action.name, status: "missing" };
  }

  const type = await locator.evaluate((element) => element.getAttribute("type") || "").catch(() => "");
  if (type === "submit" && action.allowSubmit === false) {
    return { action: action.name, status: "skipped-submit" };
  }

  const beforeClickState = await collectState(page);
  await locator.click({ timeout: 5000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(500);
  const screenshot = path.join(outDir, `${safeFileName(routeName)}-${safeFileName(action.name)}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  const stateAfterClick = await collectState(page);
  let stateAfterClose = stateAfterClick;
  if (stateAfterClick.finalUrl === beforeClickState.finalUrl) {
    await closeTransientUi(page);
    stateAfterClose = await collectState(page);
  }

  return {
    action: action.name,
    status: "clicked",
    stateAfterClick,
    stateAfterClose,
    screenshot,
  };
}

async function auditRoute(browser, route) {
  const { context, page } = await createAuthenticatedPage(browser);
  const apiIssues = [];
  const apiIssueReads = [];
  const responseHandler = (response) => {
    const responseUrl = response.url();
    if (!responseUrl.includes("/api/") || response.status() < 400) return;
    apiIssueReads.push(
      response.text().then((body) => {
        apiIssues.push({
          status: response.status(),
          url: responseUrl.replace(baseURL, ""),
          body: body.replace(/\s+/g, " ").slice(0, 500),
        });
      }).catch(() => {
        apiIssues.push({ status: response.status(), url: responseUrl.replace(baseURL, ""), body: "" });
      }),
    );
  };

  page.on("response", responseHandler);
  try {
    await page.goto(route.url, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(800);

    const beforeActions = await collectState(page);
    const routeScreenshot = path.join(outDir, `${safeFileName(route.name)}.png`);
    await page.screenshot({ path: routeScreenshot, fullPage: true });
    const actionResults = [];
    for (const action of route.actions) {
      await page.goto(route.url, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(400);
      actionResults.push(await runAction(page, route.name, action));
    }
    await Promise.allSettled(apiIssueReads);
    const record = {
      name: route.name,
      requestedUrl: route.url,
      beforeActions,
      apiIssues,
      actions: actionResults,
      screenshot: routeScreenshot,
    };
    const json = path.join(outDir, `${safeFileName(route.name)}.json`);
    fs.writeFileSync(json, JSON.stringify(record, null, 2), "utf8");
    return { ...record, json };
  } finally {
    page.off("response", responseHandler);
    await context.close();
  }
}

function hasBlockingIssue(record) {
  if (record.beforeActions.authRedirected || record.beforeActions.unexpectedError) return true;
  if (record.apiIssues.some((issue) => issue.status === 401 || issue.status >= 500)) return true;
  return record.actions.some((action) => {
    if (action.status !== "clicked") return false;
    if (action.stateAfterClick.authRedirected || action.stateAfterClick.unexpectedError) return true;
    return action.stateAfterClose.visibleDialogs > 0 && action.stateAfterClose.activeOverlays > 0;
  });
}

async function run() {
  fs.mkdirSync(outDir, { recursive: true });
  const managedProcesses = await ensureLocalServers();
  const browser = await chromium.launch({ headless: true });
  const summary = [];

  try {
    for (const route of routes) {
      const record = await auditRoute(browser, route);
      summary.push({
        name: record.name,
        requestedUrl: record.requestedUrl,
        finalUrl: record.beforeActions.finalUrl,
        authRedirected: record.beforeActions.authRedirected,
        unexpectedError: record.beforeActions.unexpectedError,
        apiIssues: record.apiIssues.length,
        actionsClicked: record.actions.filter((action) => action.status === "clicked").length,
        actionsMissing: record.actions.filter((action) => action.status === "missing").length,
        blocking: hasBlockingIssue(record),
        screenshot: record.screenshot,
        json: record.json,
      });
    }
  } finally {
    await browser.close();
    stopManagedProcesses(managedProcesses);
  }

  const summaryPath = path.join(outDir, "summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  console.log(`Interaction audit written to ${outDir}`);
  console.log(JSON.stringify(summary, null, 2));

  const blockingIssues = summary.filter((item) => item.blocking);
  if (blockingIssues.length) {
    for (const processInfo of managedProcesses) {
      if (processInfo.logs.length) console.error(processInfo.logs.join("\n"));
    }
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
