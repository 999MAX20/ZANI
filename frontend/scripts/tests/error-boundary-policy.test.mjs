import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(frontendDir, relativePath), "utf8");
}

const appBoundary = read("src/components/ui/AppErrorBoundary.tsx");
const routeBoundary = read("src/components/ui/RouteErrorBoundary.tsx");
const fallbackSurfaces = read("src/components/ui/FallbackSurfaces.tsx");

test("application crash boundary captures the original error without storing or rendering its message", () => {
  assert.match(appBoundary, /captureFrontendError\(error,/);
  assert.match(appBoundary, /onErrorCaptured\?\.\(error, errorInfo\)/);
  assert.match(appBoundary, /PageFallbackLayout/);
  assert.doesNotMatch(appBoundary, /error\.message|state\.message|statusText/);
  assert.doesNotMatch(appBoundary, /message:\s*error|\{error\}/);
});

test("route boundary normalizes every error and never uses route status text or runtime messages", () => {
  assert.match(routeBoundary, /normalizeAppError\(error\)/);
  assert.match(routeBoundary, /captureFrontendError\(error, \{ boundary: "route" \}\)/);
  assert.match(routeBoundary, /PageFallback/);
  assert.doesNotMatch(routeBoundary, /error\.message|statusText|getApiErrorMessage/);
  assert.match(routeBoundary, /retryPolicy: "never_blindly"/);
});

test("both crash paths reuse the shared page fallback layout", () => {
  assert.match(fallbackSurfaces, /export function PageFallbackLayout/);
  assert.match(fallbackSurfaces, /role="alert"/);
  assert.match(appBoundary, /testId="app-error-boundary"/);
  assert.match(routeBoundary, /title=\{t\("routeError\.title"\)\}/);
});
