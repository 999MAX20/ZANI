import { UserRound } from "lucide-react";

import { formatDateTime } from "../../../lib/format";
import type { CrmCardPayload } from "../../../types";
import { useI18n } from "../../../lib/i18n";
import type { CrmDrawerEntity } from "./types";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export const drawerSurfaceClass = "rounded-card border border-slate-200 bg-white p-4 shadow-card";
export const drawerSoftSurfaceClass = "rounded-card border border-slate-200 bg-slate-50 p-4";
export const drawerPrimarySurfaceClass = "rounded-card border border-brand-100 bg-brand-50 p-4";
export const drawerEmptySurfaceClass = "rounded-card border border-dashed border-slate-200 bg-white p-6 text-center";

export function getDrawerTitle(data: CrmCardPayload | undefined, t: Translate, entity?: CrmDrawerEntity | null) {
  if (!data) return t("crmCard.title");
  if (entity?.type === "client") return data.client?.full_name || t("crmCard.title");
  if (data.deal) return data.deal.title;
  if (data.appointment) return t("crmCard.appointmentNumber", { id: data.appointment.id });
  if (data.lead) return t("crmCard.leadNumber", { id: data.lead.id });
  return data.client?.full_name || t("crmCard.title");
}

export function getDrawerSubtitle(data: CrmCardPayload | undefined, t: (key: string) => string) {
  const client = data?.client;
  if (!client) return t("crmCard.subtitle");
  return [client.phone, client.email, client.source].filter(Boolean).join(" · ") || t("crmCard.noContacts");
}

export function getChannelLabel(channel: string, t: (key: string) => string) {
  const labels: Record<string, string> = {
    website: "channel.website",
    telegram: "channel.telegram",
    whatsapp: "channel.whatsapp",
    instagram: "channel.instagram",
    manual: "channel.manual",
  };
  return labels[channel] ? t(labels[channel]) : channel;
}

export function SummaryItem({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: React.ReactNode }) {
  return (
    <div className={drawerSurfaceClass}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-brand-600">
        <Icon size={19} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <div className="mt-1 text-sm font-bold text-midnight">{value || "-"}</div>
    </div>
  );
}

export function EmptyBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className={drawerEmptySurfaceClass}>
      <p className="font-bold text-midnight">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
    </div>
  );
}

export function EntityDecisionSnapshot({ data }: { data: CrmCardPayload }) {
  const { t } = useI18n();
  const openTasks = data.tasks.filter((task) => !["done", "cancelled"].includes(task.status));
  const latestEvent = data.timeline[0];
  const latestConversation = data.conversations[0];

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className={drawerPrimarySurfaceClass}>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-700">{t("crmCard.snapshotNext")}</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
          {openTasks[0]?.title || t("crmCard.snapshotNoTasks")}
        </p>
      </div>
      <div className={drawerSurfaceClass}>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("crmCard.snapshotHistory")}</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
          {latestEvent ? `${latestEvent.text || latestEvent.event_type} · ${formatDateTime(latestEvent.created_at)}` : t("crmCard.emptyTimelineText")}
        </p>
      </div>
      <div className={drawerSurfaceClass}>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("crmCard.snapshotMessages")}</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
          {latestConversation?.last_message?.text || t("crmCard.noDialogsText")}
        </p>
      </div>
    </div>
  );
}
