import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buttonVariantForActionTone,
  resolveCrmActionTone,
} from "../../src/components/ui/actionTone.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(frontendDir, relativePath), "utf8");
}

function walkSources(root) {
  const stack = [root];
  const sources = [];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else if (/\.tsx$/.test(entry.name)) sources.push({ target, source: fs.readFileSync(target, "utf8") });
    }
  }
  return sources;
}

test("shared action tones map to one button variant contract", () => {
  assert.deepEqual(
    ["brand", "neutral", "warning", "danger", "ai"].map(buttonVariantForActionTone),
    ["primary", "secondary", "warning", "danger", "ai"],
  );
  assert.equal(resolveCrmActionTone({ id: "lost" }), "warning");
  assert.equal(resolveCrmActionTone({ id: "cancel" }), "warning");
  assert.equal(resolveCrmActionTone({ id: "no_show" }), "warning");
  assert.equal(resolveCrmActionTone({ id: "merge" }), "danger");
  assert.equal(resolveCrmActionTone({ id: "add_note" }), "neutral");
  assert.equal(resolveCrmActionTone({ id: "unknown", destructive: true }), "danger");
});

test("button, menu and confirmation primitives expose warning with complete interaction tokens", () => {
  const button = read("src/components/ui/Button.tsx");
  const menu = read("src/components/ui/ActionMenu.tsx");
  const confirm = read("src/components/actions/ActionConfirmProvider.tsx");
  const styles = read("src/styles.css");

  assert.match(button, /\| "warning" \|/);
  assert.match(button, /--zani-warning-bold-hover/);
  assert.match(button, /--zani-warning-bold-pressed/);
  assert.match(button, /--zani-danger-hover/);
  assert.match(button, /--zani-danger-pressed/);
  assert.match(menu, /warning: "text-zani-warning/);
  assert.match(confirm, /tone\?: ActionTone/);
  assert.doesNotMatch(confirm, /variant\?: "danger"/);

  for (const token of [
    "--zani-warning-bold",
    "--zani-warning-bold-hover",
    "--zani-warning-bold-pressed",
    "--zani-danger-hover",
    "--zani-danger-pressed",
  ]) {
    assert.match(styles, new RegExp(`${token}:`));
  }
});

test("reason-required CRM actions are not treated as destructive", () => {
  const crmActionBar = read("src/components/crm/CrmActionBar.tsx");
  assert.match(crmActionBar, /resolveCrmActionTone\(action\)/);
  assert.doesNotMatch(crmActionBar, /const destructive[\s\S]{0,120}confirmation === "reason"/);
  assert.doesNotMatch(crmActionBar, /variant=\{[^\n]*confirmation === "reason"/);
});

test("AI tone is reserved for model-driven actions", () => {
  const ordinaryActionFiles = [
    "src/features/auth/ForgotPasswordPage.tsx",
    "src/features/auth/InviteAcceptPage.tsx",
    "src/features/auth/ResetPasswordPage.tsx",
    "src/features/conversations/components/ConversationComposer.tsx",
    "src/features/assistant/components/AIAgentModals.tsx",
    "src/features/bots/BotsPage.tsx",
    "src/features/pilot/NotFoundPage.tsx",
  ];
  for (const relativePath of ordinaryActionFiles) {
    assert.doesNotMatch(read(relativePath), /variant="ai"/, relativePath);
  }

  assert.match(read("src/features/assistant/AIAssistantPage.tsx"), /variant="ai"/);
  assert.match(read("src/features/bots/BotDetailPage.tsx"), /variant="ai"/);
});

test("literal danger buttons are limited to irreversible or emergency actions", () => {
  const allowedDangerIntent = /delete|merge|revoke|cancelSubscription|stopAgent/i;
  for (const { target, source } of walkSources(path.join(frontendDir, "src"))) {
    for (const match of source.matchAll(/<Button\b[\s\S]*?<\/Button>/g)) {
      if (!/variant="danger"/.test(match[0])) continue;
      assert.match(match[0], allowedDangerIntent, target);
      assert.doesNotMatch(match[0], /archive|discard|deactiv|noShow|markLost|tasks\.cancel/i, target);
    }
  }
});

test("representative reversible caution actions use warning", () => {
  const expectations = [
    ["src/features/services/ServicesPage.tsx", /tone: "warning"/],
    ["src/features/resources/ResourcesPage.tsx", /tone: "warning"/],
    ["src/features/tasks/TaskWorkspacePage.tsx", /variant="warning"/],
    ["src/features/calendar/AppointmentWorkspacePage.tsx", /\? "warning"/],
    ["src/features/conversations/components/ConversationThreadPane.tsx", /selected\.bot_enabled \? "warning"/],
    ["src/features/integrations/components/ConnectorCard.tsx", /variant="warning"[\s\S]{0,200}disconnect/],
    ["src/features/settings/sections/BillingSection.tsx", /variant="warning"[\s\S]{0,300}pause/],
  ];
  for (const [relativePath, pattern] of expectations) {
    assert.match(read(relativePath), pattern, relativePath);
  }
  assert.match(read("src/features/services/components/ServiceActionsMenu.tsx"), /services\.actionArchive/);
  assert.doesNotMatch(read("src/features/services/components/ServiceActionsMenu.tsx"), /services\.actionDelete/);
});
