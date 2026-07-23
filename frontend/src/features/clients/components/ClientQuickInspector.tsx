import {
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  MessageCircle,
  Phone,
  SquareArrowOutUpRight,
  Tag,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "../../../components/ui/Button";
import { formatDateTime } from "../../../lib/format";
import type { ClientTableRow, Translate } from "../types";
import { sourceLabel } from "../utils";
import {
  ClientAvatar,
  ClientStatusBadge,
  SourceIcon,
  TagPill,
} from "./ClientPrimitives";

export function ClientQuickInspector({
  row,
  t,
  onOpen,
  onCall,
  onWhatsApp,
}: {
  row: ClientTableRow | null;
  t: Translate;
  onOpen: (clientId: number) => void;
  onCall: (phone: string) => void;
  onWhatsApp: (phone: string) => void;
}) {
  if (!row) {
    return (
      <div className="grid min-h-[260px] place-items-center p-4 text-center">
        <div>
          <p className="text-sm font-bold text-zani-text">
            {t("clients.listHintTitle")}
          </p>
          <p className="mt-1 text-sm font-semibold text-zani-muted">
            {t("clients.listHintText")}
          </p>
        </div>
      </div>
    );
  }

  const phone = row.client.phone || "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-zani-border p-4">
        <div className="flex min-w-0 items-start gap-3">
          <ClientAvatar name={row.client.full_name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zani-muted">
                  {t("clients.client")}
                </p>
                <h2 className="mt-1 truncate text-base font-bold text-zani-text">
                  {row.client.full_name}
                </h2>
              </div>
              <ClientStatusBadge status={row.status} t={t} />
            </div>
            <p className="mt-2 truncate text-sm font-semibold text-zani-muted">
              {phone || row.client.email || t("clients.noContacts")}
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <section className="rounded-card border border-zani-border bg-surface-muted p-3">
          <p className="text-xs font-semibold text-zani-muted">
            {t("clients.nextStep")}
          </p>
          <p className="mt-1 text-sm font-bold leading-5 text-zani-text">
            {row.nextStep.title}
          </p>
          <p className="mt-1 text-xs font-semibold text-zani-muted">
            {row.nextStep.date
              ? formatDateTime(row.nextStep.date)
              : t("common.today")}
          </p>
        </section>

        <div className="grid gap-2">
          <MetaRow
            icon={
              <SourceIcon
                source={row.client.source}
                className="shrink-0 text-zani-muted"
              />
            }
            label={t("clients.source")}
            value={sourceLabel(row.client.source, t)}
          />
          <MetaRow
            icon={<UserRound size={16} className="shrink-0 text-zani-muted" />}
            label={t("clients.manager")}
            value={row.manager || t("clients.unassigned")}
          />
          <MetaRow
            icon={<Phone size={16} className="shrink-0 text-zani-muted" />}
            label={t("clients.lastContact")}
            value={
              row.lastContactAt
                ? formatDateTime(row.lastContactAt)
                : t("clients.noContact")
            }
          />
        </div>

        {row.tags.length ? (
          <section className="rounded-card border border-zani-border bg-surface-card p-3">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-zani-muted">
              <Tag size={14} />
              {t("clients.tags")}
            </p>
            <div className="flex flex-wrap gap-2">
              {row.tags.map((tag) => (
                <TagPill key={tag.id}>{tag.tag_name}</TagPill>
              ))}
            </div>
          </section>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          <RelatedStat
            icon={BriefcaseBusiness}
            value={row.deals.length}
            label={t("clients.statusDeals")}
          />
          <RelatedStat
            icon={CalendarDays}
            value={row.appointments.length}
            label={t("clients.statusBookings")}
          />
          <RelatedStat
            icon={ClipboardList}
            value={row.tasks.length}
            label={t("nav.tasks")}
          />
        </div>
      </div>

      <div className="grid gap-2 border-t border-zani-border p-4">
        <Button type="button" onClick={() => onOpen(row.client.id)}>
          <SquareArrowOutUpRight size={16} />
          {t("clients.details")}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!phone}
            onClick={() => onCall(phone)}
          >
            <Phone size={16} />
            {t("clients.call")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!phone}
            onClick={() => onWhatsApp(phone)}
          >
            <MessageCircle size={16} />
            {t("clients.openWhatsapp")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-control border border-zani-border bg-surface-card px-3 py-2">
      {icon}
      <div className="min-w-0">
        <p className="text-xs font-semibold text-zani-muted">{label}</p>
        <p className="truncate text-sm font-bold text-zani-text">{value}</p>
      </div>
    </div>
  );
}

function RelatedStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Phone;
  value: number;
  label: string;
}) {
  return (
    <div className="min-w-0 rounded-control bg-surface-muted p-2">
      <Icon size={15} className="text-zani-muted" />
      <p className="mt-2 text-base font-bold text-zani-text">{value}</p>
      <p className="truncate text-[11px] font-semibold text-zani-muted">
        {label}
      </p>
    </div>
  );
}
