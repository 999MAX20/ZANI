const apiUrl = process.env.ZANI_MOBILE_API_URL || process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";
const email = process.env.ZANI_MOBILE_EMAIL;
const password = process.env.ZANI_MOBILE_PASSWORD;
const business = process.env.ZANI_MOBILE_BUSINESS ? Number(process.env.ZANI_MOBILE_BUSINESS) : undefined;

if (!email || !password) {
  console.error("Set ZANI_MOBILE_EMAIL and ZANI_MOBILE_PASSWORD.");
  process.exit(1);
}

const requestId = () => `mobile-smoke-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": requestId(),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${text}`);
  }
  return payload;
}

const login = await request("/api/mobile/v1/auth/login/", {
  method: "POST",
  body: {
    email,
    password,
    business,
    device_id: `smoke-${Date.now()}`,
    platform: "ios",
    app_version: "1.0.0",
    build_number: "smoke",
    os_version: "smoke",
    device_model: "smoke",
  },
});

const auth = { Authorization: `Bearer ${login.access}` };
const businessId = login.business.id;
const endpoints = [
  "/api/mobile/v1/bootstrap/",
  `/api/mobile/v1/home/?business=${businessId}&limit=3`,
  `/api/mobile/v1/today/?business=${businessId}&limit=3`,
  `/api/mobile/v1/actions/?business=${businessId}&limit=3`,
  `/api/mobile/v1/inbox/?business=${businessId}&limit=3`,
  `/api/mobile/v1/leads/?business=${businessId}&limit=3`,
  `/api/mobile/v1/clients/?business=${businessId}&limit=3`,
  `/api/mobile/v1/tasks/?business=${businessId}&limit=3`,
  `/api/mobile/v1/appointments/?business=${businessId}&limit=3`,
  `/api/mobile/v1/notifications/?business=${businessId}&limit=3`,
  `/api/mobile/v1/notification-preferences/?business=${businessId}`,
  `/api/mobile/v1/devices/?business=${businessId}`,
  `/api/mobile/v1/operations/summary/?business=${businessId}`,
];

for (const endpoint of endpoints) {
  const payload = await request(endpoint, { headers: auth });
  console.log(`OK ${endpoint} ${JSON.stringify(Object.keys(payload)).slice(0, 160)}`);
}

await request("/api/mobile/v1/auth/logout/", {
  method: "POST",
  headers: auth,
  body: { refresh: login.refresh },
});

console.log("Mobile API smoke OK.");
