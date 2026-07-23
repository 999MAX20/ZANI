import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, ClipboardList, Mail, MessageCircle, Phone, Tags, UserRound, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";

import { dealsApi } from "../../../api/deals";
import { leadsApi } from "../../../api/leads";
import { formatDateTime } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";
import type { Appointment, CrmCardPayload, Deal, Id, Lead } from "../../../types";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Modal } from "../../ui/Modal";
import { ErrorState } from "../../ui/StateViews";
import { StatusBadge } from "../../ui/StatusBadge";
import { Textarea } from "../../ui/Textarea";
import { EntityAttachmentsPanel, EntityCustomFieldsPanel } from "./panels";
import { drawerPrimarySurfaceClass, drawerSoftSurfaceClass, drawerSurfaceClass, EntityDecisionSnapshot, SummaryItem } from "./shared";
import type { CrmDrawerEntity } from "./types";

function EntityQuickActions({ data }: { data: CrmCardPayload }) {
  const { t } = useI18n();
  const phone = data.client?.phone;
  const cleanPhone = phone?.replace(/\D/g, "");

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" disabled={!phone} onClick={() => phone && (window.location.href = `tel:${phone}`)}>
        <Phone size={17} /> {t("crmCard.call")}
      </Button>
      <Button
        variant="secondary"
        disabled={!cleanPhone}
        onClick={() => cleanPhone && window.open(`https://wa.me/${cleanPhone}`, "_blank", "noopener,noreferrer")}
      >
        <MessageCircle size={17} /> WhatsApp
      </Button>
      <Button variant="ghost" disabled={!data.client?.email} onClick={() => data.client?.email && (window.location.href = `mailto:${data.client.email}`)}>
        <Mail size={17} /> Email
      </Button>
    </div>
  );
}

function ClientCardContent({ data, entity }: { data: CrmCardPayload; entity: CrmDrawerEntity }) {
  const { t } = useI18n();
  const client = data.client;

  return (
    <div className="space-y-5">
      <EntityQuickActions data={data} />
      <EntityDecisionSnapshot data={data} />
      {data.tags.length ? (
        <div className="flex flex-wrap gap-2">
          {data.tags.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{ backgroundColor: `${item.tag_color || "#2563eb"}18`, color: item.tag_color || "#2563eb" }}
            >
              <Tags size={13} /> {item.tag_name}
            </span>
          ))}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryItem icon={UserRound} label={t("common.client")} value={client?.full_name} />
        <SummaryItem icon={ClipboardList} label={t("nav.leads")} value={data.leads.length} />
        <SummaryItem icon={WalletCards} label={t("nav.deals")} value={data.deals.length} />
        <SummaryItem icon={CalendarClock} label={t("nav.appointments")} value={data.appointments.length} />
      </div>
      {client?.notes ? <div className={`${drawerSoftSurfaceClass} text-sm leading-6 text-zani-subtle`}>{client.notes}</div> : null}
      <EntityAttachmentsPanel data={data} entity={entity} />
    </div>
  );
}

function LeadCardContent({ lead }: { lead: Lead | null }) {
  const { t } = useI18n();
  if (!lead) return null;

  return (
    <div className={drawerSurfaceClass}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-zani-ink">{t("crmCard.leadNumber", { id: lead.id })}</h3>
        <StatusBadge status={lead.status} />
      </div>
      <p className="text-sm leading-6 text-zani-subtle">{lead.message || t("crmCard.noLeadMessage")}</p>
      <p className="mt-3 text-xs font-semibold text-zani-faint">{lead.source} В· {formatDateTime(lead.created_at)}</p>
    </div>
  );
}

function DealCardContent({ deal }: { deal: Deal | null }) {
  const { t } = useI18n();
  if (!deal) return null;

  return (
    <div className={drawerSurfaceClass}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-zani-ink">{deal.title}</h3>
        <StatusBadge status={deal.status} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryItem icon={WalletCards} label={t("crmCard.amount")} value={`${Number(deal.amount || 0).toLocaleString("ru-RU")} ${deal.currency}`} />
        <SummaryItem icon={CheckCircle2} label={t("crmCard.probability")} value={`${deal.probability}%`} />
        <SummaryItem icon={CalendarClock} label={t("crmCard.closeDate")} value={formatDateTime(deal.expected_close_at)} />
      </div>
      {deal.notes ? <p className="mt-4 text-sm leading-6 text-zani-subtle">{deal.notes}</p> : null}
    </div>
  );
}

function AppointmentCardContent({ appointment }: { appointment: Appointment | null }) {
  const { t } = useI18n();
  if (!appointment) return null;

  return (
    <div className={drawerPrimarySurfaceClass}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-zani-ink">{t("crmCard.appointmentNumber", { id: appointment.id })}</h3>
        <StatusBadge status={appointment.status} />
      </div>
      <p className="text-sm font-semibold text-zani-text">{formatDateTime(appointment.start_at)} - {formatDateTime(appointment.end_at)}</p>
      {appointment.notes ? <p className="mt-3 text-sm leading-6 text-zani-subtle">{appointment.notes}</p> : null}
    </div>
  );
}

function EntityInlineEditPanel({ data, entity }: { data: CrmCardPayload; entity: CrmDrawerEntity }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const lead = data.lead;
  const deal = data.deal;
  const [leadMessage, setLeadMessage] = useState(lead?.message || "");
  const [dealNotes, setDealNotes] = useState(deal?.notes || "");
  const [lostAction, setLostAction] = useState<{ type: "lead" | "deal"; id: Id } | null>(null);
  const [lostReason, setLostReason] = useState("");

  useEffect(() => {
    setLeadMessage(lead?.message || "");
    setDealNotes(deal?.notes || "");
  }, [deal, lead]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (entity.type === "lead" && lead) {
        return leadsApi.update({ id: lead.id, payload: { message: leadMessage } });
      }
      if (entity.type === "deal" && deal) {
        return dealsApi.update({ id: deal.id, payload: { notes: dealNotes } });
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-card", entity.type, entity.id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
  const lifecycleMutation = useMutation({
    mutationFn: async ({ type, action, lost_reason }: { type: "lead" | "deal"; action: string; lost_reason?: string }) => {
      if (type === "lead" && lead) {
        if (action === "take") return leadsApi.takeInWork({ id: lead.id });
        if (action === "contacted") return leadsApi.markContacted({ id: lead.id });
        if (action === "closed") return leadsApi.markClosed({ id: lead.id });
        if (action === "reopen") return leadsApi.reopen({ id: lead.id });
        if (action === "lost" && lost_reason) return leadsApi.markLost({ id: lead.id, lost_reason });
      }
      if (type === "deal" && deal) {
        if (action === "won") return dealsApi.markWon({ id: deal.id });
        if (action === "reopen") return dealsApi.reopen({ id: deal.id });
        if (action === "lost" && lost_reason) return dealsApi.markLost({ id: deal.id, lost_reason });
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-card", entity.type, entity.id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setLostAction(null);
      setLostReason("");
    },
  });

  if (entity.type === "client") return null;
  if (entity.type === "lead" && !lead) return null;
  if (entity.type === "deal" && !deal) return null;

  return (
    <>
      <div className={drawerSurfaceClass}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-semibold text-zani-ink">{t("crmCard.quickEdit")}</h3>
            <p className="mt-1 text-sm leading-6 text-zani-muted">{t("crmCard.quickEditText")}</p>
          </div>
          <Button type="button" variant="secondary" isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
            {t("clients.save")}
          </Button>
        </div>
        {mutation.error || lifecycleMutation.error ? <div className="mb-3"><ErrorState message={t("crmCard.saveError")} /></div> : null}
        {entity.type === "lead" ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              {lead?.status !== "in_progress" ? <Button type="button" variant="secondary" className="h-9 rounded-full px-3 text-xs" isLoading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate({ type: "lead", action: "take" })}>{t("leads.takeInWork")}</Button> : null}
              {lead?.status !== "contacted" ? <Button type="button" variant="secondary" className="h-9 rounded-full px-3 text-xs" isLoading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate({ type: "lead", action: "contacted" })}>{t("leads.contacted")}</Button> : null}
              {lead?.status !== "closed" ? <Button type="button" variant="secondary" className="h-9 rounded-full px-3 text-xs" isLoading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate({ type: "lead", action: "closed" })}>{t("leads.close")}</Button> : null}
              {lead?.status !== "lost" ? <Button type="button" variant="secondary" className="h-9 rounded-full px-3 text-xs" isLoading={lifecycleMutation.isPending} onClick={() => { setLostAction({ type: "lead", id: lead!.id }); setLostReason(lead?.lost_reason || ""); }}>{t("leads.lost")}</Button> : null}
              {lead?.status === "closed" || lead?.status === "lost" ? <Button type="button" variant="secondary" className="h-9 rounded-full px-3 text-xs" isLoading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate({ type: "lead", action: "reopen" })}>{t("leads.reopen")}</Button> : null}
            </div>
            <Input label={t("crmCard.messageNote")} value={leadMessage} onChange={(event) => setLeadMessage(event.target.value)} />
          </div>
        ) : null}
        {entity.type === "deal" ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              {deal?.status !== "won" ? <Button type="button" variant="secondary" className="h-9 rounded-full px-3 text-xs" isLoading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate({ type: "deal", action: "won" })}>{t("crmCard.won")}</Button> : null}
              {deal?.status !== "lost" ? <Button type="button" variant="secondary" className="h-9 rounded-full px-3 text-xs" isLoading={lifecycleMutation.isPending} onClick={() => { setLostAction({ type: "deal", id: deal!.id }); setLostReason(deal?.lost_reason || ""); }}>{t("leads.lost")}</Button> : null}
              {deal?.status !== "open" ? <Button type="button" variant="secondary" className="h-9 rounded-full px-3 text-xs" isLoading={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate({ type: "deal", action: "reopen" })}>{t("deals.reopen")}</Button> : null}
            </div>
            <Input label={t("clients.notes")} value={dealNotes} onChange={(event) => setDealNotes(event.target.value)} />
          </div>
        ) : null}
      </div>
      <Modal title={lostAction?.type === "deal" ? t("deals.markLost") : t("leads.closeAsLost")} open={Boolean(lostAction)} onClose={() => { setLostAction(null); setLostReason(""); }}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!lostAction || !lostReason.trim()) return;
            lifecycleMutation.mutate({ type: lostAction.type, action: "lost", lost_reason: lostReason.trim() });
          }}
        >
          <Textarea label={t("leads.lostReasonRequired")} value={lostReason} onChange={(event) => setLostReason(event.target.value)} required />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setLostAction(null); setLostReason(""); }}>
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

export function GenericDrawerContent({ data, entity }: { data: CrmCardPayload; entity: CrmDrawerEntity }) {
  return (
    <div className="space-y-4">
      <ClientCardContent data={data} entity={entity} />
      <EntityInlineEditPanel data={data} entity={entity} />
      <EntityCustomFieldsPanel data={data} entity={entity} />
      <LeadCardContent lead={data.lead} />
      <DealCardContent deal={data.deal} />
      <AppointmentCardContent appointment={data.appointment} />
    </div>
  );
}
