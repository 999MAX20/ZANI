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
const outDir = path.resolve(rootDir, "output", "playwright", `visual-audit-${dateStamp}`);

const routes = [
  ["dashboard", "/app/dashboard"],
  ["leads", "/app/leads"],
  ["deals", "/app/deals"],
  ["clients", "/app/clients"],
  ["tasks", "/app/tasks"],
  ["calendar-day", "/app/calendar?date=2026-07-21&view=day"],
  ["calendar-month", "/app/calendar?date=2026-07-21&view=month"],
  ["conversations", "/app/conversations"],
  ["outreach", "/app/outreach"],
  ["ai-agents", "/app/ai-agents"],
  ["integrations", "/app/integrations"],
  ["analytics", "/app/analytics"],
  ["settings", "/app/settings"],
];

function safeFileName(value) {
  return value.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
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

function startManagedProcess(name, command, args) {
  const child = spawn(command, args, {
    cwd: frontendDir,
    env: process.env,
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
  child.on("exit", (code) => {
    if (code !== null && code !== 0) {
      logs.push(`[${name}] exited with code ${code}`);
    }
  });
  return { child, name, logs };
}

function npmCommand(args) {
  if (process.platform !== "win32") {
    return { command: "npm", args };
  }
  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", ["npm", ...args].join(" ")],
  };
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
    started.push(startManagedProcess("django", "node", ["e2e/django-e2e.mjs", "serve"]));
    await waitForUrl(healthUrl, 240_000).catch((error) => {
      for (const processInfo of started) {
        console.error(processInfo.logs.join("\n"));
      }
      throw error;
    });
  }

  if (!(await isReachable(baseURL))) {
    const viteCommand = npmCommand([
      "run",
      "dev",
      "--",
      "--host",
      "127.0.0.1",
      "--port",
      "5173",
    ]);
    started.push(
      startManagedProcess("vite", viteCommand.command, viteCommand.args),
    );
    await waitForUrl(baseURL, 240_000).catch((error) => {
      for (const processInfo of started) {
        console.error(processInfo.logs.join("\n"));
      }
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
    throw new Error(`Visual audit login failed with ${response.status()}: ${await response.text()}`);
  }
  return response.json();
}

async function createAuthenticatedPage(browser) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1920, height: 1080 },
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

async function gotoAuthenticatedRoute(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1000);
}

async function openCalendarMonthInspector(page) {
  const dayButton = page.locator('main button[aria-label*="2026"]').first();
  if (await dayButton.isVisible({ timeout: 1200 }).catch(() => false)) {
    await dayButton.click();
    await page.waitForTimeout(400);
  }
}

async function collectRouteAudit(page) {
  return page.evaluate(() => {
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth || 0,
    );
    const transparentSurfaceIssues = [];
    const brandButtons = [];

    for (const element of Array.from(document.querySelectorAll("*"))) {
      const className = typeof element.className === "string" ? element.className : "";
      const rect = element.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 16) continue;

      const computed = getComputedStyle(element);
      const backgroundColor = computed.backgroundColor;
      const isSurfaceToken = /(^|\s)(bg-zani-card|bg-surface-card|bg-surface-hover)(\s|$)/.test(className);
      const intentionallyTransparent =
        /(^|\s)bg-transparent(\s|$)/.test(className) ||
        element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA" ||
        element.tagName === "TR";

      if (isSurfaceToken && !intentionallyTransparent && (backgroundColor === "rgba(0, 0, 0, 0)" || backgroundColor === "transparent")) {
        transparentSurfaceIssues.push({
          tag: element.tagName.toLowerCase(),
          className,
          text: (element.textContent || "").trim().slice(0, 140),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }

      const isAction = element.tagName === "BUTTON" || element.tagName === "A";
      const isBrandBackground =
        backgroundColor === "rgb(255, 122, 26)" ||
        backgroundColor === "rgb(240, 100, 0)" ||
        backgroundColor === "rgb(200, 77, 0)";

      if (isAction && isBrandBackground) {
        brandButtons.push({
          tag: element.tagName.toLowerCase(),
          text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100),
          color: computed.color,
          backgroundColor,
        });
      }
    }

    return {
      finalUrl: location.pathname + location.search,
      title: document.title,
      horizontalOverflow: documentWidth - window.innerWidth,
      transparentSurfaceIssues,
      brandButtons,
      authRedirected: location.pathname === "/login",
    };
  });
}

async function auditRoute(browser, name, url) {
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
        apiIssues.push({
          status: response.status(),
          url: responseUrl.replace(baseURL, ""),
          body: "",
        });
      }),
    );
  };

  page.on("response", responseHandler);
  try {
    await gotoAuthenticatedRoute(page, url);

    if (name === "calendar-month") {
      await openCalendarMonthInspector(page);
    }

    const screenshot = path.join(outDir, `${safeFileName(name)}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });

    const routeAudit = await collectRouteAudit(page);
    await Promise.allSettled(apiIssueReads);
    routeAudit.apiIssues = apiIssues;
    const json = path.join(outDir, `${safeFileName(name)}.json`);
    fs.writeFileSync(json, JSON.stringify(routeAudit, null, 2), "utf8");

    return {
      name,
      requestedUrl: url,
      finalUrl: routeAudit.finalUrl,
      authRedirected: routeAudit.authRedirected,
      horizontalOverflow: routeAudit.horizontalOverflow,
      transparentSurfaceIssues: routeAudit.transparentSurfaceIssues.length,
      apiIssues: routeAudit.apiIssues.length,
      authApiIssues: routeAudit.apiIssues.filter((issue) => issue.status === 401).length,
      authMeServerErrors: routeAudit.apiIssues.filter(
        (issue) => issue.status >= 500 && issue.url.includes("/api/auth/me/"),
      ).length,
      brandButtons: routeAudit.brandButtons.length,
      screenshot,
      json,
    };
  } finally {
    page.off("response", responseHandler);
    await context.close();
  }
}

function shouldRetryRouteAudit(record) {
  return record.authRedirected && record.authMeServerErrors > 0;
}

async function run() {
  fs.mkdirSync(outDir, { recursive: true });
  const managedProcesses = await ensureLocalServers();
  const browser = await chromium.launch({ headless: true });
  const summary = [];

  try {
    for (const [name, url] of routes) {
      let record = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        record = await auditRoute(browser, name, url);
        record.attempts = attempt;
        if (!shouldRetryRouteAudit(record)) break;
      }
      summary.push(record);
    }
  } finally {
    await browser.close();
    stopManagedProcesses(managedProcesses);
  }

  const summaryPath = path.join(outDir, "summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  console.log(`Visual audit written to ${outDir}`);
  console.log(JSON.stringify(summary, null, 2));

  const blockingIssues = summary.filter(
    (item) =>
      item.authRedirected ||
      item.authApiIssues > 0 ||
      item.horizontalOverflow > 2 ||
      item.transparentSurfaceIssues > 0,
  );
  if (blockingIssues.length) {
    for (const processInfo of managedProcesses) {
      if (processInfo.logs.length) {
        console.error(processInfo.logs.join("\n"));
      }
    }
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
