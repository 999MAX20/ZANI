import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, ClipboardList, UserRound, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";

import { dealsApi } from "../../../api/deals";
import { formatDateTime } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";
import type { CrmCardPayload } from "../../../types";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";
import { ErrorState } from "../../ui/StateViews";
import { StatusBadge } from "../../ui/StatusBadge";
import { Textarea } from "../../ui/Textarea";
import { EntityAttachmentsPanel, EntityCustomFieldsPanel } from "./panels";
import { EmptyBlock, SummaryItem } from "./shared";
import type { CrmDrawerEntity } from "./types";

export function DealDrawerContent({ data, entity }: { data: CrmCardPayload; entity: CrmDrawerEntity }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const deal = data.deal;
  const client = data.client;
  const lead = data.lead;
  const availableActions = new Set(data.available_actions || []);
  const openTasks = data.tasks.filter((task) => !["done", "cancelled"].includes(task.status));
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState(deal?.lost_reason || "");
  const [notice, setNotice] = useState("");
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
      setNotice(action === "won" ? t("crmCard.won") : action === "lost" ? t("deals.lost") : t("deals.reopen"));
    },
  });

  if (!deal) return <EmptyBlock title={t("nav.deals")} text={t("crmCard.loadError")} />;

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-3xl border border-brand-100 bg-white/90 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={deal.status} />
                {deal.stage_name ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">{deal.stage_name}</span> : null}
              </div>
              <h3 className="truncate text-xl font-black text-midnight">{deal.title}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {[client?.full_name || deal.client_name, `${Number(deal.amount || 0).toLocaleString("ru-RU")} ${deal.currency}`].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          {notice ? <div className="mt-3 rounded-2xl border border-green-100 bg-green-50 px-3 py-2 text-sm font-bold text-green-800">{notice}</div> : null}
          {mutation.error ? <div className="mt-3"><ErrorState message={t("crmCard.saveError")} /></div> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryItem icon={WalletCards} label={t("crmCard.amount")} value={`${Number(deal.amount || 0).toLocaleString("ru-RU")} ${deal.currency}`} />
          <SummaryItem icon={CheckCircle2} label={t("crmCard.probability")} value={`${deal.probability}%`} />
          <SummaryItem icon={CalendarClock} label={t("crmCard.closeDate")} value={deal.expected_close_at ? formatDateTime(deal.expected_close_at) : "-"} />
          <SummaryItem icon={UserRound} label={t("leads.responsible")} value={deal.owner_name || deal.owner_email || t("leads.unassigned")} />
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("deals.nextAction")}</p>
              <p className="mt-1 text-sm font-semibold text-slate-600">{deal.next_task_title || openTasks[0]?.title || t("crmCard.snapshotNoTasks")}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {availableActions.has("won") ? <Button size="sm" isLoading={mutation.isPending} onClick={() => mutation.mutate("won")}>{t("crmCard.won")}</Button> : null}
              {availableActions.has("lost") ? <Button size="sm" variant="secondary" isLoading={mutation.isPending} onClick={() => setLostOpen(true)}>{t("deals.lost")}</Button> : null}
              {availableActions.has("reopen") ? <Button size="sm" variant="secondary" isLoading={mutation.isPending} onClick={() => mutation.mutate("reopen")}>{t("deals.reopen")}</Button> : null}
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <div className="mb-1 flex justify-between text-xs font-bold text-slate-500">
              <span>{t("crmCard.probability")}</span>
              <span>{probability}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${probability}%` }} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
            <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400"><ClipboardList size={14} /> {t("nav.leads")}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{lead ? t("crmCard.leadNumber", { id: lead.id }) : "-"}</p>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
            <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400"><CalendarClock size={14} /> {t("nav.appointments")}</p>
            <p className="text-2xl font-black text-midnight">{data.meta?.related_counts.appointments ?? data.appointments.length}</p>
            <p className="mt-1 text-sm text-slate-500">{data.appointments[0] ? formatDateTime(data.appointments[0].start_at) : t("crmCard.noTasksText")}</p>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
            <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400"><CheckCircle2 size={14} /> {t("nav.tasks")}</p>
            <p className="text-2xl font-black text-midnight">{openTasks.length}</p>
            <p className="mt-1 text-sm text-slate-500">{openTasks[0]?.title || t("crmCard.noTasksText")}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("clients.notes")}</p>
          {deal.notes ? <p className="text-sm leading-6 text-slate-700">{deal.notes}</p> : <p className="text-sm leading-6 text-slate-500">{t("crmCard.noNotesText")}</p>}
          {deal.lost_reason ? <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{t("deals.lostReasonPrompt")}: {deal.lost_reason}</p> : null}
        </div>

        <EntityCustomFieldsPanel data={data} entity={entity} />
        <EntityAttachmentsPanel data={data} />
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
