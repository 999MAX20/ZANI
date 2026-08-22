import { useQuery } from "@tanstack/react-query";

import { aiApi } from "../../api/ai";
import { analyticsApi } from "../../api/analytics";
import { workQueuesApi } from "../../api/workQueues";
import { ErrorState, PageSkeleton } from "../../components/ui/StateViews";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";
import { hasPermission } from "../../lib/permissions";
import { useAuth } from "../auth/AuthProvider";
import { ManagerDashboard } from "./ManagerDashboard";
import { OwnerDashboard } from "./OwnerDashboard";
import { isTodayDate } from "./dashboardUtils";

function isOwnerDashboardRole(role: string) {
  return ["owner", "admin", "business_owner"].includes(role);
}

export function DashboardPage() {
  const { business, isLoading: businessLoading } = useActiveBusiness();
  const { t } = useI18n();
  const { user } = useAuth();
  const activeMembership = user?.memberships?.find(
    (membership) => Number(membership.business) === Number(business?.id),
  );
  const businessRole = activeMembership?.role || user?.role || "specialist";
  const isOwnerView = isOwnerDashboardRole(businessRole);
  const canViewAiAnalyst = hasPermission(
    user,
    business?.id,
    "ai_analyst",
    "view",
  );
  const canViewAiAssistant = hasPermission(
    user,
    business?.id,
    "ai_assistant",
    "view",
  );
  const dailyAccess = {
    leads: hasPermission(user, business?.id, "leads", "view"),
    clients: hasPermission(user, business?.id, "clients", "view"),
    appointments: hasPermission(user, business?.id, "appointments", "view"),
    tasks: hasPermission(user, business?.id, "tasks", "view"),
    conversations: hasPermission(user, business?.id, "conversations", "view"),
    deals: hasPermission(user, business?.id, "deals", "view"),
    integrations: hasPermission(user, business?.id, "integrations", "view"),
  };
  const { clients, leads, appointments, services, tasks } = useEntityData({
    clients: !isOwnerView && dailyAccess.clients,
    leads: dailyAccess.leads,
    appointments: dailyAccess.appointments,
    services:
      !isOwnerView && (dailyAccess.leads || dailyAccess.appointments),
    tasks: dailyAccess.tasks,
  });
  const metrics = useQuery({
    queryKey: ["owner-dashboard", business?.id],
    queryFn: () => analyticsApi.ownerDashboard(business?.id),
    enabled: Boolean(business && isOwnerView),
  });
  const workQueues = useQuery({
    queryKey: ["work-queues", business?.id],
    queryFn: () => workQueuesApi.get({ business: business!.id, limit: 4 }),
    enabled: Boolean(business),
  });
  const ownerBrief = useQuery({
    queryKey: ["ai-owner-daily-brief", business?.id],
    queryFn: () => aiApi.ownerDailyBrief({ business: business!.id, limit: 8 }),
    enabled: Boolean(business && isOwnerView && canViewAiAnalyst),
  });
  const aiStatus = useQuery({
    queryKey: ["ai-assistant-status", business?.id],
    queryFn: () => aiApi.assistantStatus(business!.id),
    enabled: Boolean(business && isOwnerView && canViewAiAssistant),
  });

  if (businessLoading) return <PageSkeleton />;
  if (!business) return <ErrorState message={t("dashboard.noBusiness")} />;

  const leadList = leads.data || [];
  const appointmentList = appointments.data || [];
  const taskList = tasks.data || [];
  const serviceList = services.data || [];
  const clientList = clients.data || [];
  const dashboard = metrics.data;
  const isCoreDataLoading =
    (!isOwnerView && dailyAccess.clients && clients.isLoading) ||
    (dailyAccess.leads && leads.isLoading) ||
    (dailyAccess.appointments && appointments.isLoading) ||
    (!isOwnerView &&
      (dailyAccess.leads || dailyAccess.appointments) &&
      services.isLoading) ||
    (dailyAccess.tasks && tasks.isLoading);
  const assignedTasks = taskList.filter(
    (task) => task.status !== "done" && task.status !== "cancelled",
  );
  const pendingLeads = leadList.filter((lead) =>
    ["new", "contacted", "in_progress"].includes(lead.status),
  );
  const todayAppointments = appointmentList.filter((appointment) =>
    isTodayDate(appointment.start_at),
  );
  const newLeadsCount = isOwnerView
    ? (dashboard?.new_leads ?? pendingLeads.length)
    : pendingLeads.length;
  const todayAppointmentsCount = isOwnerView
    ? (dashboard?.appointments_today ?? todayAppointments.length)
    : todayAppointments.length;
  const openTasks = isOwnerView
    ? (dashboard?.open_tasks ?? assignedTasks.length)
    : assignedTasks.length;
  const overdueTasks =
    workQueues.data?.summary.overdue_tasks ??
    dashboard?.overdue_tasks ??
    assignedTasks.filter(
      (task) => task.due_at && new Date(task.due_at) < new Date(),
    ).length;
  const revenue = Number(dashboard?.revenue_estimate || 0);
  const revenueHasData = Boolean(dashboard?.sales_events_count || revenue > 0);
  if (isOwnerView) {
    return (
      <OwnerDashboard
        dashboard={dashboard}
        metricsError={metrics.error}
        isCoreDataLoading={isCoreDataLoading}
        revenue={revenue}
        revenueHasData={revenueHasData}
        newLeadsCount={newLeadsCount}
        todayAppointmentsCount={todayAppointmentsCount}
        overdueTasks={overdueTasks}
        workQueues={workQueues.data}
        workQueuesError={workQueues.error}
        isWorkQueuesLoading={workQueues.isLoading}
        retryWorkQueues={() => void workQueues.refetch()}
        ownerBrief={ownerBrief.data}
        ownerBriefError={ownerBrief.error}
        isOwnerBriefLoading={ownerBrief.isLoading}
        canViewAiAnalyst={canViewAiAnalyst}
        canViewAiAssistant={canViewAiAssistant}
        canViewConversations={dailyAccess.conversations}
        canViewDeals={dailyAccess.deals}
        canViewIntegrations={dailyAccess.integrations}
        canViewLeads={dailyAccess.leads}
        canViewAppointments={dailyAccess.appointments}
        canViewTasks={dailyAccess.tasks}
        aiStatus={aiStatus.data}
      />
    );
  }

  return (
    <ManagerDashboard
      leads={leadList}
      appointments={appointmentList}
      tasks={taskList}
      clients={clientList}
      services={serviceList}
      newLeadsCount={newLeadsCount}
      todayAppointmentsCount={todayAppointmentsCount}
      openTasks={openTasks}
      overdueTasks={overdueTasks}
      isCoreDataLoading={isCoreDataLoading}
      workQueues={workQueues.data}
      workQueuesError={workQueues.error}
      isWorkQueuesLoading={workQueues.isLoading}
      retryWorkQueues={() => void workQueues.refetch()}
      role={businessRole}
      access={dailyAccess}
    />
  );
}
