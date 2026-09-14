import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("../../src/", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

function evaluate(source, bindings = {}) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, ...bindings });
  return exports;
}

const { hasPermission } = evaluate(await read("lib/permissions.ts"));
const sidebarSource = await read("components/layout/Sidebar.tsx");
const syntax = ts.createSourceFile("Sidebar.tsx", sidebarSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set(["desktopSections", "mobileDrawerSections", "isItemActive", "isSidebarItemVisible", "filterSidebarItem"]);
const declarations = syntax.statements.filter((node) =>
  (ts.isVariableStatement(node) && node.declarationList.declarations.some((entry) => names.has(entry.name.getText(syntax)))) ||
  (ts.isFunctionDeclaration(node) && node.name && names.has(node.name.text)),
);
const iconImport = syntax.statements.find((node) =>
  ts.isImportDeclaration(node) && node.moduleSpecifier.text === "lucide-react",
);
const icons = Object.fromEntries(iconImport.importClause.namedBindings.elements.map((item) => [item.name.text, item.name.text]));
const navigation = evaluate(
  declarations.map((node) => node.getText(syntax)).join("\n") +
    "\nexport { desktopSections, mobileDrawerSections, filterSidebarItem, isItemActive };",
  { hasPermission, ...icons },
);

function member({ grants = true, enabled = true } = {}) {
  return {
    role: "manager",
    memberships: [{ business: 1, role: "manager", is_active: true }],
    effective_permissions: { "1": grants ? [{ resource: "ai_assistant", action: "view" }] : [] },
    capabilities: { "1": { modules: { ai: enabled } } },
  };
}

for (const layout of ["desktopSections", "mobileDrawerSections"]) {
  const control = navigation[layout].flatMap((section) => section.items).find((item) => item.label === "nav.control");
  const assistant = control.children.find((item) => item.to === "/app/ai-assistant");

  test(`${layout}: AI assistant appears once next to Analytics with the existing route permission`, () => {
    assert.ok(assistant);
    assert.equal(control.children.filter((item) => item.to === assistant.to).length, 1);
    assert.equal(control.children.indexOf(assistant), control.children.findIndex((item) => item.to === "/app/analytics") + 1);
    assert.equal(assistant.label, "nav.aiAssistant");
    assert.equal(assistant.resource, "ai_assistant");
    assert.equal(assistant.action ?? "view", "view");
  });

  test(`${layout}: a permitted member can reach AI even without analytics permission`, () => {
    const visible = navigation.filterSidebarItem(control, member(), 1);
    assert.ok(visible);
    assert.deepEqual(Array.from(visible.children, (item) => item.to), ["/app/ai-assistant"]);
  });

  test(`${layout}: absent permission, disabled AI and foreign business hide the entry`, () => {
    assert.ok(assistant);
    assert.equal(navigation.filterSidebarItem(assistant, member({ grants: false }), 1), null);
    assert.equal(navigation.filterSidebarItem(assistant, member({ enabled: false }), 1), null);
    assert.equal(navigation.filterSidebarItem(assistant, member(), 2), null);
  });
}

test("AI assistant uses a registered route and remains distinct from AI agents", async () => {
  const router = await read("app/router.tsx");
  assert.match(router, /path: "ai-assistant",\s*resource: "ai_assistant",[\s\S]*?<AIAssistantPage\s*\/>/);
  assert.equal(navigation.isItemActive("/app/ai-assistant", "/app/ai-assistant"), true);
  assert.equal(navigation.isItemActive("/app/ai-agents", "/app/ai-assistant"), false);
});

test("AI navigation label exists in RU, KK and EN", async () => {
  for (const locale of ["ru", "kk", "en"]) {
    assert.match(await read(`lib/i18n/${locale}.ts`), /"nav\.aiAssistant":\s*"[^"\n]+"/);
  }
});
