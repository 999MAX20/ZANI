import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowRight, CalendarClock, CheckCircle2, ClipboardList, MessageCircle, UserRound, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";

import { dealsApi } from "../../../api/deals";
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
import { drawerSurfaceClass, EmptyBlock, SummaryItem } from "./shared";
import type { CrmCardTab, CrmDrawerEntity } from "./types";

export function DealDrawerContent({ data, entity, onTabChange }: { data: CrmCardPayload; entity: CrmDrawerEntity; onTabChange?: (tab: CrmCardTab) => void }) {
  const { t } = useI18n();
  const showNotification = useNotification();
  const queryClient = useQueryClient();
  const deal = data.deal;
  const client = data.client;
  const lead = data.lead;
  const availableActions = new Set(data.available_actions || []);
  const openTasks = data.tasks.filter((task) => !["done", "cancelled"].includes(task.status));
  const latestAppointment = data.appointments[0];
  const latestActivity = data.timeline[0];
  const latestConversation = data.conversations[0];
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState(deal?.lost_reason || "");
  const probability = Math.min(100, Math.max(0, deal?.probability ?? 0));

  useEffect(() => {
    setLostReason(deal?.lost_reason || "");
  }, [deal?.lost_reason]);

  const mutation = useMutation({
    mutationFn: async (action: "won" | "lost" | "reopen") => {
      if (!deal) throw new Error("Deal is required.");
      if (action === "won") return dealsApi.markWon({ id: deal.id });
      if (action === "lost") return dealsApi.markLost({ id: deal.id, lost_reason: lostReason.trim() });
      return dealsApi.reopen({ id: deal.id });
    },
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ["crm-card", entity.type, entity.id] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      setLostOpen(false);
      setLostReason("");
      showNotification({ message: action === "won" ? t("crmCard.won") : action === "lost" ? t("deals.lost") : t("deals.reopen"), tone: "success" });
    },
  });

  if (!deal) return <EmptyBlock title={t("nav.deals")} text={t("crmCard.loadError")} />;
  const clientContact = [client?.phone || deal.client_phone, client?.email || deal.client_email].filter(Boolean).join(" / ") || t("crmCard.noContacts");
  const leadTitle = lead ? t("crmCard.leadNumber", { id: lead.id }) : t("deals.notLinked");

  return (
    <>
      <div className="space-y-4">
        <div className={drawerSurfaceClass}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={deal.status} />
                {deal.stage_name ? <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-zani-muted">{deal.stage_name}</span> : null}
              </div>
              <h3 className="truncate text-xl font-semibold text-zani-ink">{deal.title}</h3>
              <p className="mt-1 text-sm font-semibold text-zani-muted">
                {[client?.full_name || deal.client_name, `${Number(deal.amount || 0).toLocaleString("ru-RU")} ${deal.currency}`].filter(Boolean).join(" В· ")}
              </p>
            </div>
          </div>
          {mutation.error ? <div className="mt-3"><ErrorState message={t("crmCard.saveError")} /></div> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryItem icon={WalletCards} label={t("crmCard.amount")} value={`${Number(deal.amount || 0).toLocaleString("ru-RU")} ${deal.currency}`} />
          <SummaryItem icon={CheckCircle2} label={t("crmCard.probability")} value={`${deal.probability}%`} />
          <SummaryItem icon={CalendarClock} label={t("crmCard.closeDate")} value={deal.expected_close_at ? formatDateTime(deal.expected_close_at) : "-"} />
          <SummaryItem icon={UserRound} label={t("leads.responsible")} value={deal.owner_name || deal.owner_email || t("leads.unassigned")} />
        </div>

        <div className={drawerSurfaceClass}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint">{t("deals.nextAction")}</p>
              <p className="mt-1 text-sm font-semibold text-zani-subtle">{deal.next_task_title || openTasks[0]?.title || t("crmCard.snapshotNoTasks")}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {availableActions.has("won") ? <Button size="sm" isLoading={mutation.isPending} onClick={() => mutation.mutate("won")}>{t("crmCard.won")}</Button> : null}
              {availableActions.has("lost") ? <Button size="sm" variant="secondary" isLoading={mutation.isPending} onClick={() => setLostOpen(true)}>{t("deals.lost")}</Button> : null}
              {availableActions.has("reopen") ? <Button size="sm" variant="secondary" isLoading={mutation.isPending} onClick={() => mutation.mutate("reopen")}>{t("deals.reopen")}</Button> : null}
            </div>
          </div>
          <div className="border-t border-zani-border pt-4">
            <div className="mb-1 flex justify-between text-xs font-bold text-zani-muted">
              <span>{t("crmCard.probability")}</span>
              <span>{probability}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${probability}%` }} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className={drawerSurfaceClass}>
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint"><UserRound size={14} /> {t("nav.clients")}</p>
            <p className="truncate text-sm font-semibold text-zani-ink">{client?.full_name || deal.client_name || t("deals.clientMissing")}</p>
            <p className="mt-1 truncate text-sm font-semibold text-zani-muted">{clientContact}</p>
          </div>
          <div className={drawerSurfaceClass}>
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint"><ClipboardList size={14} /> {t("deals.leadLabel")}</p>
            <p className="truncate text-sm font-semibold text-zani-ink">{leadTitle}</p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold text-zani-muted">{lead?.message || t("crmCard.noLeadMessage")}</p>
          </div>
          <div className={drawerSurfaceClass}>
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint"><CalendarClock size={14} /> {t("nav.appointments")}</p>
            <p className="text-2xl font-semibold text-zani-ink">{data.meta?.related_counts.appointments ?? data.appointments.length}</p>
            <p className="mt-1 text-sm text-zani-muted">{latestAppointment ? formatDateTime(latestAppointment.start_at) : t("appointments.emptyText")}</p>
            {data.appointments.length ? (
              <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => onTabChange?.("appointments")}>
                {t("common.open")} <ArrowRight size={14} />
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className={drawerSurfaceClass}>
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint"><CheckCircle2 size={14} /> {t("nav.tasks")}</p>
            <p className="text-2xl font-semibold text-zani-ink">{openTasks.length}</p>
            <p className="mt-1 text-sm text-zani-muted">{openTasks[0]?.title || t("crmCard.noTasksText")}</p>
            {data.tasks.length ? (
              <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => onTabChange?.("tasks")}>
                {t("common.open")} <ArrowRight size={14} />
              </Button>
            ) : null}
          </div>
          <div className={drawerSurfaceClass}>
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint"><Activity size={14} /> {t("crmCard.snapshotHistory")}</p>
            <p className="line-clamp-2 text-sm font-semibold leading-6 text-zani-text">{latestActivity ? latestActivity.text || latestActivity.event_type : t("crmCard.emptyTimelineText")}</p>
            <p className="mt-1 text-xs font-semibold text-zani-muted">{latestActivity ? formatDateTime(latestActivity.created_at) : ""}</p>
            {data.timeline.length ? (
              <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => onTabChange?.("timeline")}>
                {t("crmCard.timeline")} <ArrowRight size={14} />
              </Button>
            ) : null}
          </div>
          <div className={drawerSurfaceClass}>
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint"><MessageCircle size={14} /> {t("crmCard.snapshotMessages")}</p>
            <p className="line-clamp-2 text-sm font-semibold leading-6 text-zani-text">{latestConversation?.last_message?.text || t("crmCard.noDialogsText")}</p>
            <p className="mt-1 text-xs font-semibold text-zani-muted">{latestConversation ? formatDateTime(latestConversation.last_message_at || latestConversation.updated_at) : ""}</p>
            {data.conversations.length ? (
              <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => onTabChange?.("messages")}>
                {t("crmCard.messages")} <ArrowRight size={14} />
              </Button>
            ) : null}
          </div>
        </div>

        <div className={drawerSurfaceClass}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint">{t("clients.notes")}</p>
          {deal.notes ? <p className="text-sm leading-6 text-zani-text">{deal.notes}</p> : <p className="text-sm leading-6 text-zani-muted">{t("crmCard.noNotesText")}</p>}
          {deal.lost_reason ? <p className="mt-3 rounded-card bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{t("deals.lostReasonPrompt")}: {deal.lost_reason}</p> : null}
        </div>

        <EntityCustomFieldsPanel data={data} entity={entity} />
        <EntityAttachmentsPanel data={data} entity={entity} />
      </div>

      <Modal title={t("deals.markLost")} open={lostOpen} onClose={() => setLostOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!lostReason.trim()) return;
            mutation.mutate("lost");
          }}
        >
          <Textarea label={t("deals.lostReasonPrompt")} value={lostReason} onChange={(event) => setLostReason(event.target.value)} required />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setLostOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" variant="danger" isLoading={mutation.isPending} disabled={!lostReason.trim()}>{t("deals.markLost")}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
