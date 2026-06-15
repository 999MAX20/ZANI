import { MoreHorizontal, UserX } from "lucide-react";
import { memo } from "react";

import { cn } from "../../../lib/cn";
import { formatDate, formatDateTime } from "../../../lib/format";
import type { ClientTableRow, Translate } from "../types";
import { initials, sourceLabel } from "../utils";
import { ClientAvatar, ClientStatusBadge, SourceIcon } from "./ClientPrimitives";

export const ClientRow = memo(function ClientRow({
  row,
  selected,
  onSelect,
  t,
}: {
  row: ClientTableRow;
  selected: boolean;
  onSelect: () => void;
  t: Translate;
}) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect();
  }

  return (
    <tr
      role="row"
      aria-selected={selected}
      tabIndex={0}
      className={cn(
        "group cursor-pointer border-b border-slate-100 bg-white transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset",
        selected && "bg-blue-50 outline outline-1 -outline-offset-1 outline-blue-400 hover:bg-blue-50",
      )}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <td role="gridcell" className="w-10 px-4 py-3 align-middle">
        <input
          type="checkbox"
          checked={selected}
          readOnly
          aria-label={row.client.full_name}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
      </td>
      <td role="gridcell" className="min-w-[220px] px-2 py-3">
        <div className="flex items-center gap-3">
          <ClientAvatar name={row.client.full_name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">{row.client.full_name}</p>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{row.client.phone || row.client.email || t("clients.noContacts")}</p>
          </div>
        </div>
      </td>
      <td role="gridcell" className="min-w-[120px] px-3 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <SourceIcon source={row.client.source} />
          <span>{sourceLabel(row.client.source, t)}</span>
        </div>
      </td>
      <td role="gridcell" className="min-w-[118px] px-3 py-3">
        <ClientStatusBadge status={row.status} />
      </td>
      <td role="gridcell" className="hidden min-w-[138px] px-3 py-3 xl:table-cell">
        {row.manager === "Не назначен" ? (
          <div className="flex items-center gap-2 text-slate-400">
            <UserX size={16} />
            <span className="truncate text-sm font-medium">Не назначен</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
              {initials(row.manager)}
            </div>
            <span className="truncate text-sm font-medium text-slate-600">{row.manager}</span>
          </div>
        )}
      </td>
      <td role="gridcell" className="min-w-[138px] px-3 py-3">
        <p className="text-sm font-medium text-slate-700">{row.lastContactAt ? formatDateTime(row.lastContactAt) : "Нет контакта"}</p>
      </td>
      <td role="gridcell" className="min-w-[150px] px-3 py-3">
        <p className="truncate text-sm font-medium text-slate-700">{row.nextStep.title}</p>
        <p className="mt-0.5 text-xs font-medium text-slate-500">{row.nextStep.date ? formatDate(row.nextStep.date) : "Сегодня"}</p>
      </td>
      <td role="gridcell" className="w-12 px-3 py-3 text-right">
        <button
          type="button"
          className="inline-grid h-8 w-8 place-items-center rounded-lg text-slate-500 opacity-100 transition hover:bg-slate-100 hover:text-slate-700 md:opacity-0 md:group-hover:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          aria-label="Действия"
        >
          <MoreHorizontal size={18} />
        </button>
      </td>
    </tr>
  );
});
