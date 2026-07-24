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
  const [tasks, calendar, appointmentAccess, conversations, conversationList] = await Promise.all([
    source("features/tasks/TasksPage.tsx"),
    source("features/calendar/CalendarPage.tsx"),
    source("features/calendar/appointmentAccess.ts"),
    source("features/conversations/ConversationsPage.tsx"),
    source("features/conversations/components/ConversationListPane.tsx"),
  ]);

  assert.match(tasks, /primaryAction:\s*canCreateTask/);
  assert.match(tasks, /includeTeamData:\s*canViewTeam/);
  assert.match(calendar, /data-testid="calendar-error-state"/);
  assert.match(calendar, /primaryAction:\s*canCreateAppointment/);
  assert.match(calendar, /canAccessAppointmentAction/);
  assert.match(appointmentAccess, /resource\?\.linked_user/);
  assert.match(appointmentAccess, /scope !== "own"/);
  assert.match(conversations, /data-testid="inbox-error-state"/);
  assert.match(conversations, /businessConnectorsApi\.list/);
  assert.match(conversations, /connector\.capability === "communications"/);
  assert.doesNotMatch(conversations, /!channel\.is_connected && channel\.total > 0/);
  assert.match(conversations, /conversationUpdateScope === "own"/);
  assert.match(conversations, /!isIntegrationsAction\(action\.href\)/);
  assert.match(conversations, /onRetryLastMessage=/);
  assert.match(conversationList, /canRetryLastMessage\(conversation\)/);
});

test("owner dashboard fetches and renders capability-scoped daily modules", async () => {
  const [page, dashboard] = await Promise.all([
    source("features/dashboard/DashboardPage.tsx"),
    source("features/dashboard/OwnerDashboard.tsx"),
  ]);

  assert.match(page, /clients:\s*dailyAccess\.clients/);
  assert.match(page, /leads:\s*dailyAccess\.leads/);
  assert.match(page, /appointments:\s*dailyAccess\.appointments/);
  assert.match(page, /tasks:\s*dailyAccess\.tasks/);
  assert.match(page, /canViewLeads=\{dailyAccess\.leads\}/);
  assert.match(page, /canViewAppointments=\{dailyAccess\.appointments\}/);
  assert.match(page, /canViewTasks=\{dailyAccess\.tasks\}/);
  assert.match(dashboard, /\{canViewLeads \? \(/);
  assert.match(dashboard, /\{canViewAppointments \? \(/);
  assert.match(dashboard, /\{canViewTasks \? \(/);
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
