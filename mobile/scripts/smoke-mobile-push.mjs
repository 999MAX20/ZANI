const apiUrl = process.env.ZANI_MOBILE_API_URL || process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";
const email = process.env.ZANI_MOBILE_EMAIL;
const password = process.env.ZANI_MOBILE_PASSWORD;
const pushToken = process.env.ZANI_EXPO_PUSH_TOKEN;
const business = process.env.ZANI_MOBILE_BUSINESS ? Number(process.env.ZANI_MOBILE_BUSINESS) : undefined;

if (!email || !password || !pushToken) {
  console.error("Set ZANI_MOBILE_EMAIL, ZANI_MOBILE_PASSWORD and ZANI_EXPO_PUSH_TOKEN from a physical device.");
  process.exit(1);
}

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": `mobile-push-smoke-${Date.now().toString(36)}`,
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

const deviceId = `push-smoke-${Date.now()}`;

const login = await request("/api/mobile/v1/auth/login/", {
  method: "POST",
  body: {
    email,
    password,
    business,
    device_id: deviceId,
    platform: "ios",
    app_version: "1.0.0",
    build_number: "push-smoke",
    os_version: "physical",
    device_model: "physical",
  },
});

const auth = { Authorization: `Bearer ${login.access}` };
const registered = await request("/api/mobile/v1/push-tokens/register/", {
  method: "POST",
  headers: auth,
  body: {
    business: login.business.id,
    device_id: deviceId,
    provider: "expo",
    push_token: pushToken,
  },
});

console.log(`Registered push token id=${registered.id}, provider=${registered.provider}, active=${registered.is_active}.`);
console.log("Send a real notification from backend/admin flow, then revoke this device and confirm delivery stops.");
