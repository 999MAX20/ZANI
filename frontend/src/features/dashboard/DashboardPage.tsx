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
  const { clients, leads, appointments, services, tasks } = useEntityData({
    clients: true,
    leads: true,
    appointments: true,
    services: true,
    tasks: true,
  });
  const { t } = useI18n();
  const { user } = useAuth();
  const activeMembership = user?.memberships?.find((membership) => Number(membership.business) === Number(business?.id));
  const businessRole = activeMembership?.role || user?.role || "staff";
  const isOwnerView = isOwnerDashboardRole(businessRole);
  const canViewAiAnalyst = hasPermission(user, business?.id, "ai_analyst", "view");
  const canViewAiAssistant = hasPermission(user, business?.id, "ai_assistant", "view");
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
  const isCoreDataLoading = clients.isLoading || leads.isLoading || appointments.isLoading || services.isLoading || tasks.isLoading;
  const assignedTasks = taskList.filter((task) => task.status !== "done" && task.status !== "cancelled");
  const pendingLeads = leadList.filter((lead) => ["new", "contacted", "in_progress"].includes(lead.status));
  const todayAppointments = appointmentList.filter((appointment) => isTodayDate(appointment.start_at));
  const closedLeadCount = leadList.filter((lead) => lead.status === "appointment_created" || lead.status === "closed").length;
  const newLeadsCount = isOwnerView ? dashboard?.new_leads ?? pendingLeads.length : pendingLeads.length;
  const todayAppointmentsCount = isOwnerView ? dashboard?.appointments_today ?? todayAppointments.length : todayAppointments.length;
  const conversion = isOwnerView ? dashboard?.conversion_lead_to_appointment ?? (leadList.length ? Math.round((closedLeadCount / leadList.length) * 100) : 0) : 0;
  const openTasks = isOwnerView ? dashboard?.open_tasks ?? assignedTasks.length : assignedTasks.length;
  const overdueTasks = workQueues.data?.summary.overdue_tasks ?? dashboard?.overdue_tasks ?? assignedTasks.filter((task) => task.due_at && new Date(task.due_at) < new Date()).length;
  const revenue = Number(dashboard?.revenue_estimate || 0);
  const revenueHasData = Boolean(dashboard?.sales_events_count || revenue > 0);
  const setupItems = [
    Boolean(business.landing_id || business.landing_domain || business.landing_preview_url),
    serviceList.length > 0,
    clientList.length > 0,
    leadList.length > 0,
    appointmentList.length > 0,
    taskList.length > 0,
  ];
  const setupScore = Math.round((setupItems.filter(Boolean).length / setupItems.length) * 100);

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
        conversion={conversion}
        openTasks={openTasks}
        overdueTasks={overdueTasks}
        setupScore={setupScore}
        leads={leadList}
        clients={clientList}
        appointments={appointmentList}
        services={serviceList}
        tasks={taskList}
        workQueues={workQueues.data}
        ownerBrief={ownerBrief.data}
        ownerBriefError={ownerBrief.error}
        isOwnerBriefLoading={ownerBrief.isLoading}
        canViewAiAnalyst={canViewAiAnalyst}
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
    />
  );
}
