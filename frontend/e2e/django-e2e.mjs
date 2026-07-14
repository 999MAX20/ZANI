import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(e2eDir, "../..");

const pythonPath = process.env.E2E_PYTHON || defaultPythonPath();
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

function defaultPythonPath() {
  const relativePath =
    process.platform === "win32"
      ? [".venv", "Scripts", "python.exe"]
      : [".venv", "bin", "python"];
  const candidate = path.join(rootDir, ...relativePath);
  return fs.existsSync(candidate) ? candidate : "python";
}

function runManage(args) {
  const result = spawnSync(pythonPath, ["manage.py", ...args], {
    cwd: rootDir,
    env: djangoEnv,
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function prepare() {
  runManage(["migrate"]);
  runManage(["prepare_e2e_smoke_data"]);
}

const mode = process.argv[2] || "prepare";

if (mode === "prepare") {
  prepare();
} else if (mode === "serve") {
  prepare();
  runManage(["runserver", "127.0.0.1:8000"]);
} else {
  console.error(`Unknown django-e2e mode: ${mode}`);
  process.exit(2);
}
