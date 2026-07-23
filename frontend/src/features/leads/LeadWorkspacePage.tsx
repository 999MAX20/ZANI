import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Phone } from "lucide-react";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { appointmentsApi } from "../../api/appointments";
import { getApiErrorMessage } from "../../api/client";
import { crmCardsApi } from "../../api/crmCards";
import { dealsApi } from "../../api/deals";
import { inboxApi } from "../../api/inbox";
import { leadsApi } from "../../api/leads";
import { tasksApi } from "../../api/tasks";
import {
  CrmActionBar,
  EntityWorkspaceEmptyState,
  EntityWorkspaceErrorState,
  EntityWorkspaceAside,
  EntityWorkspaceAvatar,
  EntityWorkspaceBody,
  EntityWorkspaceHeader,
  EntityWorkspaceLoadingState,
  EntityWorkspaceMain,
  EntityWorkspaceMetrics,
  EntityWorkspaceRoot,
} from "../../components/crm";
import { Button } from "../../components/ui/Button";
import { useI18n } from "../../lib/i18n";
import { useNotification } from "../../components/notifications/NotificationProvider";
import {
  AppointmentsList,
  ConversationsList,
  DealsList,
  TasksList,
  TimelineList,
} from "../clients/components/ClientWorkspaceSections";
import {
  LeadAiPanel,
  LeadContactPanel,
  LeadIntakePanel,
  LeadWorkspaceMetric,
  LeadWorkspaceSection,
  leadAvatarLabel,
  leadWorkspaceIcons,
} from "./components/LeadWorkspaceSections";

const RELATED_PAGE_SIZE = 8;
const supportedLeadActionIds = new Set([
  "take",
  "contacted",
  "create_deal",
  "close",
  "lost",
  "reopen",
]);

function asNumericId(value: string | undefined): number | null {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function LeadWorkspacePage() {
  const { t } = useI18n();
  const showNotification = useNotification();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const leadId = asNumericId(routeId);

  const cardQuery = useQuery({
    queryKey: ["crm-card", "lead", leadId],
    queryFn: () => crmCardsApi.get({ type: "lead", id: leadId as number }),
    enabled: Boolean(leadId),
  });
  const dealsQuery = useQuery({
    queryKey: ["deals", "lead-workspace", leadId],
    queryFn: () =>
      dealsApi.listPaginated({
        lead_ids: String(leadId),
        page_size: RELATED_PAGE_SIZE,
      }),
    enabled: Boolean(leadId),
  });
  const appointmentsQuery = useQuery({
    queryKey: ["appointments", "lead-workspace", leadId],
    queryFn: () =>
      appointmentsApi.list({
        lead_ids: String(leadId),
        page_size: RELATED_PAGE_SIZE,
      }),
    enabled: Boolean(leadId),
  });
  const tasksQuery = useQuery({
    queryKey: ["tasks", "lead-workspace", leadId],
    queryFn: () =>
      tasksApi.listPage({
        lead_ids: String(leadId),
        page_size: RELATED_PAGE_SIZE,
        status: "active",
      }),
    enabled: Boolean(leadId),
  });
  const conversationsQuery = useQuery({
    queryKey: ["inbox-conversations", "lead-workspace", leadId],
    queryFn: () => inboxApi.listConversations({ lead_ids: String(leadId) }),
    enabled: Boolean(leadId),
  });
  const lifecycleMutation = useMutation<
    unknown,
    Error,
    { actionId: string; reason?: string }
  >({
    mutationFn: ({
      actionId,
      reason,
    }: {
      actionId: string;
      reason?: string;
    }) => {
      if (!leadId) throw new Error(t("leads.emptyTitle"));
      if (actionId === "take") return leadsApi.takeInWork({ id: leadId });
      if (actionId === "contacted")
        return leadsApi.markContacted({ id: leadId });
      if (actionId === "create_deal")
        return leadsApi.createDeal({ id: leadId });
      if (actionId === "close") return leadsApi.markClosed({ id: leadId });
      if (actionId === "lost")
        return leadsApi.markLost({ id: leadId, lost_reason: reason || "" });
      if (actionId === "reopen") return leadsApi.reopen({ id: leadId });
      throw new Error(actionId);
    },
    onSuccess: async () => {
      showNotification({ message: t("leads.actionDone"), tone: "success" });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["crm-card", "lead", leadId],
        }),
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["deals"] }),
        queryClient.invalidateQueries({ queryKey: ["activity-events"] }),
      ]);
    },
  });

  const pageError =
    cardQuery.error ||
    dealsQuery.error ||
    appointmentsQuery.error ||
    tasksQuery.error ||
    conversationsQuery.error;
  const isLoading =
    cardQuery.isLoading ||
    dealsQuery.isLoading ||
    appointmentsQuery.isLoading ||
    tasksQuery.isLoading ||
    conversationsQuery.isLoading;
  const card = cardQuery.data;
  const lead = card?.lead;
  const client = card?.client || null;
  const related = useMemo(
    () => ({
      appointments: appointmentsQuery.data || card?.appointments || [],
      conversations:
        conversationsQuery.data?.results || card?.conversations || [],
      deals: dealsQuery.data?.results || card?.deals || [],
      tasks: tasksQuery.data?.results || card?.tasks || [],
    }),
    [
      appointmentsQuery.data,
      card,
      conversationsQuery.data,
      dealsQuery.data,
      tasksQuery.data,
    ],
  );

  if (!leadId)
    return <EntityWorkspaceErrorState message={t("leads.emptyTitle")} />;
  if (isLoading) return <EntityWorkspaceLoadingState />;
  if (pageError)
    return (
      <EntityWorkspaceErrorState message={getApiErrorMessage(pageError)} />
    );
  if (!lead) {
    return (
      <EntityWorkspaceEmptyState
        title={t("leads.emptyTitle")}
        description={t("leads.emptyText")}
      />
    );
  }

  const title =
    client?.full_name ||
    lead.client_name ||
    t("leads.leadFallback", { id: lead.id });
  const subtitle = [
    lead.service_name,
    lead.client_phone || client?.phone,
    lead.responsible_name || t("leads.unassigned"),
  ]
    .filter(Boolean)
    .join(" / ");
  const counts = card?.meta?.related_counts;
  const phoneDigits = (client?.phone || lead.client_phone || "").replace(
    /\D/g,
    "",
  );
  const executableActions = (card?.available_action_details || []).filter(
    (action) => supportedLeadActionIds.has(action.id),
  );

  return (
    <EntityWorkspaceRoot>
      <EntityWorkspaceHeader
        backLabel={t("common.back")}
        onBack={() => navigate("/app/leads")}
        avatar={
          <EntityWorkspaceAvatar>
            {leadAvatarLabel(lead, client, title)}
          </EntityWorkspaceAvatar>
        }
        title={title}
        subtitle={subtitle || t("crmCard.leadNumber", { id: lead.id })}
        status={lead.status}
        actions={
          <>
            {client ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(`/app/clients/${client.id}`)}
              >
                {t("leads.openClient")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/app/leads")}
            >
              {t("nav.leads")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!phoneDigits}
              onClick={() =>
                phoneDigits &&
                window.open(
                  `https://wa.me/${phoneDigits}`,
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              <MessageCircle size={16} />
              {t("clients.openWhatsapp")}
            </Button>
            <Button
              type="button"
              disabled={!phoneDigits}
              onClick={() =>
                phoneDigits && window.open(`tel:${phoneDigits}`, "_self")
              }
            >
              <Phone size={16} />
              {t("leads.call")}
            </Button>
          </>
        }
      />

      <EntityWorkspaceMetrics>
        <LeadWorkspaceMetric
          label={t("nav.deals")}
          value={counts?.deals ?? related.deals.length}
        />
        <LeadWorkspaceMetric
          label={t("nav.calendar")}
          value={counts?.appointments ?? related.appointments.length}
        />
        <LeadWorkspaceMetric
          label={t("nav.tasks")}
          value={counts?.tasks ?? related.tasks.length}
        />
        <LeadWorkspaceMetric
          label={t("crmCard.messages")}
          value={counts?.conversations ?? related.conversations.length}
        />
        <LeadWorkspaceMetric
          label={t("leads.aiScoreShort")}
          value={lead.ai_score ?? "-"}
        />
      </EntityWorkspaceMetrics>

      <EntityWorkspaceBody>
        <EntityWorkspaceAside>
          <LeadWorkspaceSection
            title={t("leads.client")}
            icon={leadWorkspaceIcons.contact}
          >
            <LeadContactPanel lead={lead} client={client} />
          </LeadWorkspaceSection>
          <LeadWorkspaceSection
            title={t("leads.control")}
            icon={leadWorkspaceIcons.intake}
          >
            <LeadIntakePanel lead={lead} />
          </LeadWorkspaceSection>
          <LeadWorkspaceSection
            title={t("leads.intelligence")}
            icon={leadWorkspaceIcons.ai}
          >
            <LeadAiPanel lead={lead} />
          </LeadWorkspaceSection>
          <LeadWorkspaceSection
            title={t("leads.quickActions")}
            icon={leadWorkspaceIcons.actions}
          >
            <CrmActionBar
              actions={executableActions}
              isPending={lifecycleMutation.isPending}
              onExecute={(action, reason) =>
                lifecycleMutation.mutate({ actionId: action.id, reason })
              }
            />
          </LeadWorkspaceSection>
        </EntityWorkspaceAside>

        <EntityWorkspaceMain>
          <LeadWorkspaceSection
            title={t("nav.deals")}
            icon={leadWorkspaceIcons.deals}
          >
            <DealsList deals={related.deals} />
          </LeadWorkspaceSection>
          <LeadWorkspaceSection
            title={t("nav.tasks")}
            icon={leadWorkspaceIcons.tasks}
          >
            <TasksList tasks={related.tasks} />
          </LeadWorkspaceSection>
          <LeadWorkspaceSection
            title={t("nav.calendar")}
            icon={leadWorkspaceIcons.appointments}
          >
            <AppointmentsList appointments={related.appointments} />
          </LeadWorkspaceSection>
          <LeadWorkspaceSection
            title={t("crmCard.messages")}
            icon={leadWorkspaceIcons.conversations}
          >
            <ConversationsList conversations={related.conversations} />
          </LeadWorkspaceSection>
          <LeadWorkspaceSection
            title={t("crmCard.timeline")}
            icon={leadWorkspaceIcons.timeline}
            className="lg:col-span-2"
          >
            <TimelineList cardTimeline={card?.timeline || []} />
          </LeadWorkspaceSection>
        </EntityWorkspaceMain>
      </EntityWorkspaceBody>
    </EntityWorkspaceRoot>
  );
}
