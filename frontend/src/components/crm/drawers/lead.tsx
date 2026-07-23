import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, ClipboardList, MessageCircle, Phone, Tags, UserRound, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";

import { leadsApi } from "../../../api/leads";
import { formatDateTime } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";
import type { CrmCardPayload } from "../../../types";
import { useNotification } from "../../notifications/NotificationProvider";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";
import { ErrorState } from "../../ui/StateViews";
import { StatusBadge } from "../../ui/StatusBadge";
import { Textarea } from "../../ui/Textarea";
import { EntityAttachmentsPanel, EntityCustomFieldsPanel } from "./panels";
import { drawerSurfaceClass, EmptyBlock, getChannelLabel, SummaryItem } from "./shared";
import type { CrmDrawerEntity } from "./types";

export function LeadDrawerContent({ data, entity }: { data: CrmCardPayload; entity: CrmDrawerEntity }) {
  const { t } = useI18n();
  const showNotification = useNotification();
  const queryClient = useQueryClient();
  const lead = data.lead;
  const client = data.client;
  const serviceName = lead?.service_name || "";
  const cleanPhone = client?.phone?.replace(/\D/g, "");
  const openTasks = data.tasks.filter((task) => !["done", "cancelled"].includes(task.status));
  const latestConversation = data.conversations[0];
  const availableActions = new Set(data.available_actions || []);
  const [lostActionOpen, setLostActionOpen] = useState(false);
  const [lostReason, setLostReason] = useState(lead?.lost_reason || "");
  const leadScore = lead?.ai_score ?? 0;
  const lossRisk = lead?.loss_risk ?? 0;

  useEffect(() => {
    setLostReason(lead?.lost_reason || "");
  }, [lead?.lost_reason]);

  const lifecycleMutation = useMutation({
    mutationFn: async (action: "take" | "contacted" | "deal" | "closed" | "reopen" | "lost") => {
      if (!lead) throw new Error("Lead is required.");
      if (action === "take") return leadsApi.takeInWork({ id: lead.id });
      if (action === "contacted") return leadsApi.markContacted({ id: lead.id });
      if (action === "deal") return leadsApi.createDeal({ id: lead.id });
      if (action === "closed") return leadsApi.markClosed({ id: lead.id });
      if (action === "reopen") return leadsApi.reopen({ id: lead.id });
      if (action === "lost") return leadsApi.markLost({ id: lead.id, lost_reason: lostReason.trim() });
      return lead;
    },
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ["crm-card", entity.type, entity.id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      setLostActionOpen(false);
      setLostReason("");
      const labels: Record<string, string> = {
        take: t("leads.noticeTaken"),
        contacted: t("leads.noticeContacted"),
        deal: t("leads.noticeDealCreated"),
        closed: t("leads.noticeClosed"),
        lost: t("leads.noticeLost"),
        reopen: t("leads.noticeReopened"),
      };
      showNotification({ message: labels[action] || t("leads.actionDone"), tone: "success" });
    },
  });

  if (!lead) return <EmptyBlock title={t("crmCard.leadNumber", { id: entity.id })} text={t("crmCard.loadError")} />;

  return (
    <>
      <div className="space-y-4">
        <div className={drawerSurfaceClass}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={lead.status} />
                <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-zani-muted">{getChannelLabel(lead.source, t)}</span>
                {serviceName ? <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{serviceName}</span> : null}
              </div>
              <h3 className="truncate text-xl font-semibold text-zani-ink">{client?.full_name || lead.client_name || t("crmCard.leadNumber", { id: lead.id })}</h3>
              <p className="mt-1 text-sm font-semibold text-zani-muted">
                {[client?.phone || lead.client_phone, client?.email || lead.client_email].filter(Boolean).join(" В· ") || t("crmCard.noContacts")}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="secondary" disabled={!client?.phone} onClick={() => client?.phone && (window.location.href = `tel:${client.phone}`)}>
                <Phone size={16} /> {t("crmCard.call")}
              </Button>
              <Button variant="secondary" disabled={!cleanPhone} onClick={() => cleanPhone && window.open(`https://wa.me/${cleanPhone}`, "_blank", "noopener,noreferrer")}>
                <MessageCircle size={16} /> WhatsApp
              </Button>
            </div>
          </div>
          {lifecycleMutation.error ? <div className="mt-3"><ErrorState message={t("crmCard.saveError")} /></div> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryItem icon={UserRound} label={t("common.client")} value={client?.full_name || lead.client_name || "-"} />
          <SummaryItem icon={Tags} label={t("leads.source")} value={getChannelLabel(lead.source, t)} />
          <SummaryItem icon={ClipboardList} label={t("common.service")} value={serviceName || "-"} />
          <SummaryItem icon={CheckCircle2} label={t("leads.responsible")} value={lead.responsible_name || lead.responsible_email || t("leads.unassigned")} />
        </div>

        <div className={drawerSurfaceClass}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint">{t("leads.takeAction")}</p>
              <p className="mt-1 text-sm font-semibold text-zani-subtle">{lead.recommended_action || openTasks[0]?.title || t("crmCard.snapshotNoTasks")}</p>
            </div>
            {data.deals.length ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => window.location.assign(`/app/deals/${data.deals[0].id}`)}>
                {data.deals[0].title}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-zani-border pt-4">
            {availableActions.has("take") ? (
              <Button type="button" variant="secondary" size="sm" isLoading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate("take")}>
                {t("leads.takeWork")}
              </Button>
            ) : null}
            {availableActions.has("contacted") ? (
              <Button type="button" variant="secondary" size="sm" isLoading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate("contacted")}>
                {t("leads.contacted")}
              </Button>
            ) : null}
            {availableActions.has("create_deal") ? (
              <Button type="button" size="sm" isLoading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate("deal")}>
                {t("leads.deal")}
              </Button>
            ) : null}
            {availableActions.has("close") ? (
              <Button type="button" variant="secondary" size="sm" isLoading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate("closed")}>
                {t("leads.close")}
              </Button>
            ) : null}
            {availableActions.has("lost") ? (
              <Button type="button" variant="secondary" size="sm" isLoading={lifecycleMutation.isPending} onClick={() => setLostActionOpen(true)}>
                {t("leads.lost")}
              </Button>
            ) : null}
            {availableActions.has("reopen") ? (
              <Button type="button" variant="secondary" size="sm" isLoading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate("reopen")}>
                {t("leads.reopen")}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className={drawerSurfaceClass}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint">{t("leads.priority")}</p>
            <div className="mt-3 space-y-2">
              <div>
                <div className="mb-1 flex justify-between text-xs font-bold text-zani-muted">
                  <span>{t("leads.priorityLead", { lead: leadScore })}</span>
                  <span>{leadScore}/100</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, Math.max(0, leadScore))}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs font-bold text-zani-muted">
                  <span>{t("leads.priorityCallFast")}</span>
                  <span>{lossRisk}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                  <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.min(100, Math.max(0, lossRisk))}%` }} />
                </div>
              </div>
            </div>
          </div>
          <div className={drawerSurfaceClass}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint">{t("crmCard.snapshotMessages")}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-zani-text">{latestConversation?.last_message?.text || t("crmCard.noDialogsText")}</p>
          </div>
        </div>

        <div className={drawerSurfaceClass}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint">{t("crmCard.messageNote")}</p>
          <p className="text-sm leading-6 text-zani-text">{lead.message || t("crmCard.noLeadMessage")}</p>
          {lead.lost_reason ? <p className="mt-3 rounded-card bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{t("leads.lostReason")}: {lead.lost_reason}</p> : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className={drawerSurfaceClass}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint">{t("nav.tasks")}</p>
            <p className="text-2xl font-semibold text-zani-ink">{openTasks.length}</p>
            <p className="mt-1 text-sm text-zani-muted">{openTasks[0]?.title || t("crmCard.noTasksText")}</p>
          </div>
          <div className={drawerSurfaceClass}>
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint"><WalletCards size={14} /> {t("nav.deals")}</p>
            <p className="text-2xl font-semibold text-zani-ink">{data.meta?.related_counts.deals ?? data.deals.length}</p>
            <p className="mt-1 text-sm text-zani-muted">{data.deals[0]?.title || t("crmCard.snapshotNoTasks")}</p>
          </div>
          <div className={drawerSurfaceClass}>
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint"><CalendarClock size={14} /> {t("nav.appointments")}</p>
            <p className="text-2xl font-semibold text-zani-ink">{data.meta?.related_counts.appointments ?? data.appointments.length}</p>
            <p className="mt-1 text-sm text-zani-muted">{data.appointments[0] ? formatDateTime(data.appointments[0].start_at) : t("crmCard.noTasksText")}</p>
          </div>
        </div>

        <EntityCustomFieldsPanel data={data} entity={entity} />
        <EntityAttachmentsPanel data={data} entity={entity} />
      </div>

      <Modal title={t("leads.closeAsLost")} open={lostActionOpen} onClose={() => setLostActionOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!lostReason.trim()) return;
            lifecycleMutation.mutate("lost");
          }}
        >
          <Textarea label={t("leads.lostReasonRequired")} value={lostReason} onChange={(event) => setLostReason(event.target.value)} required />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setLostActionOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="danger" isLoading={lifecycleMutation.isPending} disabled={!lostReason.trim()}>
              {t("leads.closeAsLost")}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
