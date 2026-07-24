import {
  MessageCircle,
  Phone,
  SquareArrowOutUpRight,
  UserX,
} from "lucide-react";
import { memo } from "react";

import { cn } from "../../../lib/cn";
import { formatDate, formatDateTime } from "../../../lib/format";
import type { ClientTableRow, Translate } from "../types";
import { initials, sourceLabel } from "../utils";
import {
  ClientAvatar,
  ClientStatusBadge,
  SourceIcon,
} from "./ClientPrimitives";

export const ClientRow = memo(function ClientRow({
  row,
  selected,
  checked,
  visibleColumns,
  onSelect,
  onOpen,
  onToggleCheck,
  t,
}: {
  row: ClientTableRow;
  selected: boolean;
  checked: boolean;
  visibleColumns: Set<"source" | "manager">;
  onSelect: () => void;
  onOpen: () => void;
  onToggleCheck: () => void;
  t: Translate;
}) {
  const phoneDigits = row.client.phone?.replace(/\D/g, "") || "";
  const hasTelegram = Boolean(
    row.client.telegram_id || row.client.source === "telegram",
  );

  function handleKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect();
  }

  function openExternalContact(
    event: React.MouseEvent<HTMLButtonElement>,
    href: string,
  ) {
    event.stopPropagation();
    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <tr
      role="row"
      aria-selected={selected}
      tabIndex={0}
      className={cn(
        "group cursor-pointer border-b border-zani-border bg-surface-card transition-colors hover:bg-surface-warm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-inset",
        selected &&
          "bg-brand-50/80 shadow-[inset_5px_0_0_var(--zani-brand)] hover:bg-brand-50/80",
      )}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <td role="gridcell" className="w-10 px-3 py-2 align-middle">
        <input
          type="checkbox"
          checked={checked}
          readOnly
          aria-label={t("clients.selectClient", { name: row.client.full_name })}
          className="h-4 w-4 rounded border-zani-border text-brand-600 focus:ring-brand-500"
          onClick={(event) => {
            event.stopPropagation();
            onToggleCheck();
          }}
        />
      </td>
      <td role="gridcell" className="overflow-hidden px-2 py-2">
        <div className="flex items-center gap-3">
          <ClientAvatar name={row.client.full_name} />
          <div className="min-w-0">
            <p
              className={cn(
                "truncate text-sm font-semibold text-zani-text",
                selected && "text-brand-700",
              )}
            >
              {row.client.full_name}
            </p>
            <p className="mt-0.5 truncate text-xs font-medium text-zani-muted">
              {row.client.phone || row.client.email || t("clients.noContacts")}
            </p>
          </div>
        </div>
      </td>
      {visibleColumns.has("source") ? (
        <td role="gridcell" className="overflow-hidden px-2 py-2">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-zani-muted">
            <SourceIcon source={row.client.source} />
            <span className="truncate">
              {sourceLabel(row.client.source, t)}
            </span>
          </div>
        </td>
      ) : null}
      <td role="gridcell" className="overflow-hidden px-2 py-2">
        <ClientStatusBadge status={row.status} t={t} />
      </td>
      {visibleColumns.has("manager") ? (
        <td role="gridcell" className="overflow-hidden px-2 py-2">
          {!row.managerUserId ? (
            <div className="flex min-w-0 items-center gap-2 text-zani-muted">
              <UserX size={16} className="shrink-0" />
              <span className="truncate text-sm font-medium">
                {t("clients.unassigned")}
              </span>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-muted text-[10px] font-bold text-zani-muted">
                {initials(row.manager)}
              </div>
              <span className="truncate text-sm font-medium text-zani-muted">
                {row.manager}
              </span>
            </div>
          )}
        </td>
      ) : null}
      <td role="gridcell" className="overflow-hidden px-2 py-2">
        <p className="truncate text-sm font-medium text-zani-text">
          {row.lastContactAt
            ? formatDateTime(row.lastContactAt)
            : t("clients.noContact")}
        </p>
      </td>
      <td role="gridcell" className="overflow-hidden px-2 py-2">
        <p className="truncate text-sm font-medium text-zani-text">
          {row.nextStep.title}
        </p>
        <p className="mt-0.5 text-xs font-medium text-zani-muted">
          {row.nextStep.date
            ? formatDate(row.nextStep.date)
            : t("common.today")}
        </p>
      </td>
      <td role="gridcell" className="w-[92px] px-2 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          {phoneDigits ? (
            <>
              <button
                type="button"
                className="inline-grid h-8 w-8 place-items-center rounded-lg text-zani-muted transition hover:bg-[var(--zani-success-soft)] hover:text-zani-success"
                onClick={(event) =>
                  openExternalContact(event, `tel:${phoneDigits}`)
                }
                aria-label={t("clients.call")}
              >
                <Phone size={16} />
              </button>
              <button
                type="button"
                className="inline-grid h-8 w-8 place-items-center rounded-lg text-zani-muted transition hover:bg-[var(--zani-success-soft)] hover:text-zani-success"
                onClick={(event) =>
                  openExternalContact(event, `https://wa.me/${phoneDigits}`)
                }
                aria-label={t("clients.openWhatsapp")}
              >
                <MessageCircle size={16} />
              </button>
            </>
          ) : hasTelegram ? (
            <button
              type="button"
              className="inline-grid h-8 w-8 place-items-center rounded-lg text-zani-muted transition hover:bg-brand-50 hover:text-brand-700"
              onClick={(event) => {
                event.stopPropagation();
                onSelect();
              }}
              aria-label={t("clients.openTelegram")}
            >
              <MessageCircle size={16} />
            </button>
          ) : null}
          <button
            type="button"
            data-testid="client-row-action-open"
            data-client-id={row.client.id}
            className="inline-grid h-8 w-8 place-items-center rounded-lg text-zani-muted opacity-100 transition hover:bg-brand-50 hover:text-brand-700 md:opacity-0 md:group-hover:opacity-100"
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
            aria-label={t("clients.details")}
          >
            <SquareArrowOutUpRight size={17} />
          </button>
        </div>
      </td>
    </tr>
  );
});
