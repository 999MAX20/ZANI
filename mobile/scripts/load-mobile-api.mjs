const apiUrl = process.env.ZANI_MOBILE_API_URL || process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";
const email = process.env.ZANI_MOBILE_EMAIL;
const password = process.env.ZANI_MOBILE_PASSWORD;
const business = process.env.ZANI_MOBILE_BUSINESS ? Number(process.env.ZANI_MOBILE_BUSINESS) : undefined;
const concurrency = Number(process.env.ZANI_MOBILE_LOAD_CONCURRENCY || 4);
const iterations = Number(process.env.ZANI_MOBILE_LOAD_ITERATIONS || 20);
const p95BudgetMs = Number(process.env.ZANI_MOBILE_LOAD_P95_BUDGET_MS || 800);

if (!email || !password) {
  console.error("Set ZANI_MOBILE_EMAIL and ZANI_MOBILE_PASSWORD.");
  process.exit(1);
}

if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 25) {
  console.error("ZANI_MOBILE_LOAD_CONCURRENCY must be an integer from 1 to 25.");
  process.exit(1);
}

if (!Number.isInteger(iterations) || iterations < 1 || iterations > 500) {
  console.error("ZANI_MOBILE_LOAD_ITERATIONS must be an integer from 1 to 500.");
  process.exit(1);
}

const requestId = () => `mobile-load-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

async function request(path, options = {}) {
  const startedAt = performance.now();
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": requestId(),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const durationMs = performance.now() - startedAt;
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${text}`);
  }
  return { payload, durationMs, status: response.status };
}

function percentile(values, pct) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

async function runPool(tasks) {
  let nextIndex = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (nextIndex < tasks.length) {
      const task = tasks[nextIndex];
      nextIndex += 1;
      await task();
    }
  });
  await Promise.all(workers);
}

const login = await request("/api/mobile/v1/auth/login/", {
  method: "POST",
  body: {
    email,
    password,
    business,
    device_id: `load-${Date.now()}`,
    platform: "ios",
    app_version: "1.0.0",
    build_number: "load",
    os_version: "load",
    device_model: "load",
  },
});

const auth = { Authorization: `Bearer ${login.payload.access}` };
const businessId = login.payload.business.id;
const endpoints = [
  "/api/mobile/v1/bootstrap/",
  `/api/mobile/v1/home/?business=${businessId}&limit=5`,
  `/api/mobile/v1/today/?business=${businessId}&limit=5`,
  `/api/mobile/v1/actions/?business=${businessId}&limit=5`,
  `/api/mobile/v1/inbox/?business=${businessId}&limit=5`,
  `/api/mobile/v1/leads/?business=${businessId}&limit=5`,
  `/api/mobile/v1/clients/?business=${businessId}&limit=5`,
  `/api/mobile/v1/tasks/?business=${businessId}&limit=5`,
  `/api/mobile/v1/appointments/?business=${businessId}&limit=5`,
  `/api/mobile/v1/notifications/?business=${businessId}&limit=5`,
  `/api/mobile/v1/operations/summary/?business=${businessId}`,
];

const results = new Map(endpoints.map((endpoint) => [endpoint, []]));
const errors = [];
const tasks = [];

for (let iteration = 0; iteration < iterations; iteration += 1) {
  for (const endpoint of endpoints) {
    tasks.push(async () => {
      try {
        const response = await request(endpoint, { headers: auth });
        results.get(endpoint).push(response.durationMs);
      } catch (error) {
        errors.push({ endpoint, message: error.message });
      }
    });
  }
}

await runPool(tasks);

await request("/api/mobile/v1/auth/logout/", {
  method: "POST",
  headers: auth,
  body: { refresh: login.payload.refresh },
});

let failed = errors.length > 0;

console.log(`Mobile API load smoke: ${iterations} iterations x ${endpoints.length} endpoints, concurrency ${concurrency}.`);
for (const endpoint of endpoints) {
  const durations = results.get(endpoint);
  const p50 = percentile(durations, 50);
  const p95 = percentile(durations, 95);
  const max = durations.length ? Math.max(...durations) : 0;
  const overBudget = p95 > p95BudgetMs;
  failed = failed || overBudget;
  console.log(
    `${overBudget ? "OVER" : "OK  "} ${endpoint} count=${durations.length} p50=${p50.toFixed(0)}ms p95=${p95.toFixed(0)}ms max=${max.toFixed(0)}ms`,
  );
}

if (errors.length) {
  console.error("Errors:");
  for (const error of errors.slice(0, 20)) {
    console.error(`- ${error.endpoint}: ${error.message}`);
  }
}

if (failed) {
  console.error(`Mobile API load smoke failed. p95 budget is ${p95BudgetMs}ms.`);
  process.exit(1);
}

console.log("Mobile API load smoke OK.");
