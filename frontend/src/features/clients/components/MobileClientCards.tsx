import { Phone } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { formatDateTime } from "../../../lib/format";
import type { ClientTableRow, Translate } from "../types";
import { sourceLabel } from "../utils";
import { ClientAvatar, ClientStatusBadge } from "./ClientPrimitives";

export function MobileClientCards({
  rows,
  selectedClientId,
  onSelectClient,
  onOpenClient,
  t,
}: {
  rows: ClientTableRow[];
  selectedClientId: number | null;
  onSelectClient: (id: number) => void;
  onOpenClient: (id: number) => void;
  t: Translate;
}) {
  return (
    <div className="space-y-3 p-3 md:hidden">
      {rows.map((row) => (
        <article
          key={row.client.id}
          aria-selected={selectedClientId === row.client.id}
          className="rounded-card border border-zani-border bg-surface-card p-4 shadow-card"
        >
          <button
            type="button"
            onClick={() => onSelectClient(row.client.id)}
            className="flex w-full items-start justify-between gap-3 text-left"
          >
            <div className="flex min-w-0 items-center gap-3">
              <ClientAvatar name={row.client.full_name} />
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-zani-text">
                  {row.client.full_name}
                </h3>
                <p className="mt-1 truncate text-xs font-medium text-zani-muted">
                  {row.client.phone ||
                    row.client.email ||
                    t("clients.noContacts")}
                </p>
              </div>
            </div>
            <ClientStatusBadge status={row.status} t={t} />
          </button>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zani-muted">{t("clients.source")}</dt>
              <dd className="font-semibold text-zani-text">
                {sourceLabel(row.client.source, t)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zani-muted">{t("clients.lastContact")}</dt>
              <dd className="text-right font-semibold text-zani-text">
                {row.lastContactAt
                  ? formatDateTime(row.lastContactAt)
                  : t("clients.noContact")}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zani-muted">{t("clients.nextStep")}</dt>
              <dd className="text-right font-semibold text-zani-text">
                {row.nextStep.title}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              className="min-h-11 flex-1"
              disabled={!row.client.phone}
              onClick={() =>
                row.client.phone &&
                window.open(`tel:${row.client.phone}`, "_self")
              }
            >
              <Phone size={16} /> {t("clients.call")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 flex-1"
              onClick={() => onOpenClient(row.client.id)}
            >
              {t("clients.details")}
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
