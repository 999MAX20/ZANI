import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../src/", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("capability-aware permissions hide disabled daily modules before role grants", async () => {
  const permissions = await source("lib/permissions.ts");
  assert.match(permissions, /if \(!isBusinessResourceEnabled\(user, businessId, resource\)\) return false;/);
  assert.match(permissions, /deals:\s*"deals"/);
  assert.match(permissions, /if \(role === "doctor"\) return "doctor";/);
});

test("daily workspaces preserve recoverable and role-valid actions", async () => {
  const [tasks, calendar, conversations] = await Promise.all([
    source("features/tasks/TasksPage.tsx"),
    source("features/calendar/CalendarPage.tsx"),
    source("features/conversations/ConversationsPage.tsx"),
  ]);

  assert.match(tasks, /primaryAction:\s*canCreateTask/);
  assert.match(tasks, /includeTeamData:\s*canViewTeam/);
  assert.match(calendar, /data-testid="calendar-error-state"/);
  assert.match(calendar, /primaryAction:\s*canCreateAppointment/);
  assert.match(conversations, /data-testid="inbox-error-state"/);
  assert.match(conversations, /onRetryLastMessage=/);
});

test("owner AI brief does not substitute unsourced local recommendations", async () => {
  const dashboard = await source("features/dashboard/OwnerDashboard.tsx");
  const briefBuilder = dashboard.slice(
    dashboard.indexOf("function buildBriefItems"),
    dashboard.indexOf("export function OwnerDashboard"),
  );

  assert.doesNotMatch(briefBuilder, /if \(overdueTasks > 0\)/);
  assert.doesNotMatch(briefBuilder, /if \(newLeadsCount > 0\)/);
  assert.match(briefBuilder, /ownerBrief\?\.recommendations/);
  assert.match(briefBuilder, /sourceIds:\s*recommendation\.source_ids/);
});
