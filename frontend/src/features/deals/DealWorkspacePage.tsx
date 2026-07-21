import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Phone } from "lucide-react";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getApiErrorMessage } from "../../api/client";
import { crmCardsApi } from "../../api/crmCards";
import { inboxApi } from "../../api/inbox";
import { tasksApi } from "../../api/tasks";
import {
  CrmWorkspacePage,
  EntityWorkspaceAside,
  EntityWorkspaceAvatar,
  EntityWorkspaceBody,
  EntityWorkspaceHeader,
  EntityWorkspaceMain,
  EntityWorkspaceMetrics,
  EntityWorkspaceRoot,
} from "../../components/crm";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useI18n } from "../../lib/i18n";
import { ActionPanel, AppointmentsList, ConversationsList, TasksList, TimelineList } from "../clients/components/ClientWorkspaceSections";
import {
  DealClientPanel,
  DealLinkedLeadPanel,
  DealOverviewPanel,
  DealWorkspaceMetric,
  DealWorkspaceSection,
  dealWorkspaceIcons,
} from "./components/DealWorkspaceSections";
import { initials, money, stageProbability } from "./utils/dealHelpers";

const RELATED_PAGE_SIZE = 8;

function asNumericId(value: string | undefined): number | null {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function DealWorkspacePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const dealId = asNumericId(routeId);

  const cardQuery = useQuery({
    queryKey: ["crm-card", "deal", dealId],
    queryFn: () => crmCardsApi.get({ type: "deal", id: dealId as number }),
    enabled: Boolean(dealId),
  });
  const tasksQuery = useQuery({
    queryKey: ["tasks", "deal-workspace", dealId],
    queryFn: () => tasksApi.listPage({ deal_ids: String(dealId), page_size: RELATED_PAGE_SIZE, status: "active" }),
    enabled: Boolean(dealId),
  });
  const conversationsQuery = useQuery({
    queryKey: ["inbox-conversations", "deal-workspace", dealId],
    queryFn: () => inboxApi.listConversations({ deal_ids: String(dealId) }),
    enabled: Boolean(dealId),
  });

  const pageError = cardQuery.error || tasksQuery.error || conversationsQuery.error;
  const isLoading = cardQuery.isLoading || tasksQuery.isLoading || conversationsQuery.isLoading;
  const card = cardQuery.data;
  const deal = card?.deal;
  const client = card?.client || null;
  const lead = card?.lead || null;
  const related = useMemo(
    () => ({
      appointments: card?.appointments || [],
      conversations: conversationsQuery.data?.results || card?.conversations || [],
      tasks: tasksQuery.data?.results || card?.tasks || [],
    }),
    [card, conversationsQuery.data, tasksQuery.data],
  );

  if (!dealId) return <ErrorState message={t("deals.notFoundTitle")} />;
  if (isLoading) return <CrmWorkspacePage><LoadingState /></CrmWorkspacePage>;
  if (pageError) return <CrmWorkspacePage><ErrorState message={getApiErrorMessage(pageError)} /></CrmWorkspacePage>;
  if (!deal) {
    return (
      <CrmWorkspacePage>
        <EmptyState title={t("deals.notFoundTitle")} description={t("deals.notFoundText")} />
      </CrmWorkspacePage>
    );
  }

  const title = deal.title || `${t("deals.deal")} #${deal.id}`;
  const subtitle = [client?.full_name || deal.client_name, deal.stage_name, deal.owner_name || t("deals.unassigned")].filter(Boolean).join(" / ");
  const counts = card?.meta?.related_counts;
  const phoneDigits = (client?.phone || deal.client_phone || "").replace(/\D/g, "");
  const probability = stageProbability(deal);

  return (
    <EntityWorkspaceRoot>
      <EntityWorkspaceHeader
        backLabel={t("common.back")}
        onBack={() => navigate("/app/deals")}
        avatar={<EntityWorkspaceAvatar>{initials(title)}</EntityWorkspaceAvatar>}
        title={title}
        subtitle={subtitle || `#${deal.id}`}
        status={deal.status}
        actions={
          <>
              {client ? (
                <Button type="button" variant="secondary" onClick={() => navigate(`/app/clients/${client.id}`)}>
                  {t("leads.openClient")}
                </Button>
              ) : null}
              {lead ? (
                <Button type="button" variant="secondary" onClick={() => navigate(`/app/leads/${lead.id}`)}>
                  {t("crmCard.leadNumber", { id: lead.id })}
                </Button>
              ) : null}
              <Button type="button" variant="secondary" disabled={!phoneDigits} onClick={() => phoneDigits && window.open(`https://wa.me/${phoneDigits}`, "_blank", "noopener,noreferrer")}>
                <MessageCircle size={16} />
                {t("clients.openWhatsapp")}
              </Button>
              <Button type="button" disabled={!phoneDigits} onClick={() => phoneDigits && window.open(`tel:${phoneDigits}`, "_self")}>
                <Phone size={16} />
                {t("clients.call")}
              </Button>
          </>
        }
      />

        <EntityWorkspaceMetrics>
          <DealWorkspaceMetric label={t("deals.amount")} value={money(deal.amount, deal.currency)} />
          <DealWorkspaceMetric label={t("deals.probability")} value={`${probability}%`} />
          <DealWorkspaceMetric label={t("nav.tasks")} value={counts?.tasks ?? related.tasks.length} />
          <DealWorkspaceMetric label={t("crmCard.messages")} value={counts?.conversations ?? related.conversations.length} />
          <DealWorkspaceMetric label={t("nav.calendar")} value={counts?.appointments ?? related.appointments.length} />
        </EntityWorkspaceMetrics>

        <EntityWorkspaceBody>
          <EntityWorkspaceAside>
            <DealWorkspaceSection title={t("deals.client")} icon={dealWorkspaceIcons.client}>
              <DealClientPanel deal={deal} client={client} />
            </DealWorkspaceSection>
            <DealWorkspaceSection title={t("deals.deal")} icon={dealWorkspaceIcons.deal}>
              <DealOverviewPanel deal={deal} />
            </DealWorkspaceSection>
            <DealWorkspaceSection title={lead || deal.lead ? t("crmCard.leadNumber", { id: lead?.id || deal.lead || "" }) : t("nav.leads")} icon={dealWorkspaceIcons.lead}>
              <DealLinkedLeadPanel lead={lead} />
            </DealWorkspaceSection>
            <DealWorkspaceSection title={t("clients.quickActions")} icon={dealWorkspaceIcons.actions}>
              <ActionPanel actions={card?.available_action_details || []} />
            </DealWorkspaceSection>
          </EntityWorkspaceAside>

          <EntityWorkspaceMain>
            <DealWorkspaceSection title={t("nav.tasks")} icon={dealWorkspaceIcons.tasks}>
              <TasksList tasks={related.tasks} />
            </DealWorkspaceSection>
            <DealWorkspaceSection title={t("nav.calendar")} icon={dealWorkspaceIcons.appointments}>
              <AppointmentsList appointments={related.appointments} />
            </DealWorkspaceSection>
            <DealWorkspaceSection title={t("crmCard.messages")} icon={dealWorkspaceIcons.conversations} className="lg:col-span-2">
              <ConversationsList conversations={related.conversations} />
            </DealWorkspaceSection>
            <DealWorkspaceSection title={t("crmCard.timeline")} icon={dealWorkspaceIcons.timeline} className="lg:col-span-2">
              <TimelineList cardTimeline={card?.timeline || []} />
            </DealWorkspaceSection>
          </EntityWorkspaceMain>
        </EntityWorkspaceBody>
    </EntityWorkspaceRoot>
  );
}
