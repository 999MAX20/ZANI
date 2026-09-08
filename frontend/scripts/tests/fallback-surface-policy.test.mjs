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
const statusNotice = read("src/components/ui/StatusNotice.tsx");
const notificationProvider = read("src/components/notifications/NotificationProvider.tsx");
const stateViews = read("src/components/ui/StateViews.tsx");
const importPanel = read("src/features/integrations/components/ImportPanel.tsx");

test("shared fallback family consumes AppError and exports every required surface", () => {
  assert.match(fallbackSurfaces, /export function InlineFallback/);
  assert.match(fallbackSurfaces, /export function PageFallback/);
  assert.match(fallbackSurfaces, /export function PermissionFallback/);
  assert.match(connectivityBanner, /export function ConnectivityBanner/);
  assert.match(fieldErrorSummary, /export function FieldErrorSummary/);
  assert.match(recoveryDetails, /export function RecoveryDetails/);
  assert.match(statusNotice, /export function StatusNotice/);
  assert.match(notificationProvider, /export function ActionFeedbackToast/);
  assert.match(stateViews, /export \{ InlineFallback, PageFallback, PermissionFallback \}/);

  for (const source of [fallbackSurfaces, connectivityBanner, fieldErrorSummary, recoveryDetails, statusNotice]) {
    assert.match(source, /AppError/);
  }
});

test("fallbacks, connectivity, field summaries and toasts share one status notice primitive", () => {
  for (const source of [fallbackSurfaces, connectivityBanner, fieldErrorSummary, notificationProvider, stateViews]) {
    assert.match(source, /StatusNotice/);
  }
  assert.match(statusNotice, /statusNoticeTones/);
  assert.match(statusNotice, /success/);
  assert.match(statusNotice, /info/);
  assert.match(statusNotice, /warning/);
  assert.match(statusNotice, /danger/);
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
  assert.match(fieldErrorSummary, /technicalMessagePattern/);
  assert.match(fieldErrorSummary, /fallback\.fields\.invalidValue/);
  assert.doesNotMatch(importPanel, />\s*\{item\.(?:field|message)\}\s*</);
  assert.match(importPanel, /integrations\.import\.(?:rowNeedsReview|columnsNeedReview)/);
});

test("known merchant surfaces do not render raw error-bearing fields or native alerts", () => {
  const sourceRoot = path.join(frontendDir, "src");
  const stack = [sourceRoot];
  const sources = [];

  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else if (/\.(?:ts|tsx)$/.test(entry.name)) sources.push({ target, source: fs.readFileSync(target, "utf8") });
    }
  }

  for (const { target, source } of sources) {
    assert.doesNotMatch(source, /window\.(?:alert|confirm)\s*\(/, target);
    assert.doesNotMatch(
      source,
      />\s*\{\s*(?:(?:[A-Za-z_$][\w$]*(?:\?\.)?\.(?:last_error|error_code|skipped_reason|statusText))|(?:(?:error|err)(?:\?\.)?\.message))\s*\}\s*</,
      target,
    );
  }
  assert.doesNotMatch(read("src/features/auth/LoginPage.tsx"), /serenity-login__error/);
  assert.doesNotMatch(read("src/features/auth/ForgotPasswordPage.tsx"), /bg-red-|border-red-|text-red-/);
  assert.doesNotMatch(read("src/features/auth/ResetPasswordPage.tsx"), /bg-red-|border-red-|text-red-/);

  const integrationSetupRoot = path.join(sourceRoot, "features", "integrations", "components", "setup");
  const integrationSetupSources = walkSources(integrationSetupRoot);
  for (const { target, source } of integrationSetupSources) {
    assert.doesNotMatch(source, /setNotice\([^;\n]*:\s*data\.reason\b/, target);
  }
});

function walkSources(root) {
  const stack = [root];
  const sources = [];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else if (/\.(?:ts|tsx)$/.test(entry.name)) sources.push({ target, source: fs.readFileSync(target, "utf8") });
    }
  }
  return sources;
}
