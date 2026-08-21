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

const fallbackSurfaces = read("src/components/ui/FallbackSurfaces.tsx");
const connectivityBanner = read("src/components/ui/ConnectivityBanner.tsx");
const fieldErrorSummary = read("src/components/ui/FieldErrorSummary.tsx");
const recoveryDetails = read("src/components/ui/RecoveryDetails.tsx");
const notificationProvider = read("src/components/notifications/NotificationProvider.tsx");
const stateViews = read("src/components/ui/StateViews.tsx");

test("shared fallback family consumes AppError and exports every required surface", () => {
  assert.match(fallbackSurfaces, /export function InlineFallback/);
  assert.match(fallbackSurfaces, /export function PageFallback/);
  assert.match(fallbackSurfaces, /export function PermissionFallback/);
  assert.match(connectivityBanner, /export function ConnectivityBanner/);
  assert.match(fieldErrorSummary, /export function FieldErrorSummary/);
  assert.match(recoveryDetails, /export function RecoveryDetails/);
  assert.match(notificationProvider, /export function ActionFeedbackToast/);
  assert.match(stateViews, /export \{ InlineFallback, PageFallback, PermissionFallback \}/);

  for (const source of [fallbackSurfaces, connectivityBanner, fieldErrorSummary, recoveryDetails]) {
    assert.match(source, /AppError/);
  }
});

test("fallback surfaces use normalized keys and never render raw error objects", () => {
  const sources = [fallbackSurfaces, connectivityBanner, fieldErrorSummary, recoveryDetails, notificationProvider];
  for (const source of sources) {
    assert.doesNotMatch(source, /error\.message(?!Key)|error\.detail|statusText|JSON\.stringify\(error/);
  }
  assert.match(fallbackSurfaces, /t\(error\.messageKey\)/);
  assert.match(connectivityBanner, /t\(error\.messageKey\)/);
  assert.match(notificationProvider, /t\(item\.appError\.messageKey\)/);
});

test("recovery actions remain policy-gated and support details expose only requestId", () => {
  assert.match(fallbackSurfaces, /canOfferActionRecovery\(error, Boolean\(onRetry\)\)/);
  assert.match(connectivityBanner, /canOfferActionRecovery\(error, Boolean\(onRetry\)\)/);
  assert.match(recoveryDetails, /if \(!error\.requestId\) return null/);
  assert.doesNotMatch(recoveryDetails, /fieldErrors|retryAfterSeconds|status/);
});

test("field error summary avoids exposing technical field names without approved labels", () => {
  assert.match(fieldErrorSummary, /fieldLabels\?\: Record<string, string>/);
  assert.match(fieldErrorSummary, /label \? `\$\{label\}: ` : ""/);
  assert.doesNotMatch(fieldErrorSummary, />\{field\}</);
});
