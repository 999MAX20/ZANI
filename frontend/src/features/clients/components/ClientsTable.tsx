import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useRef } from "react";
import { MoreHorizontal, UsersRound } from "lucide-react";

import { cn } from "../../../lib/cn";
import { formatDate, formatDateTime } from "../../../lib/format";
import type { ClientTableRow, Translate } from "../types";
import { initials, sourceLabel } from "../utils";
import { ClientAvatar, ClientStatusBadge, SourceIcon } from "./ClientPrimitives";

const ROW_HEIGHT = 64;

const ClientRow = memo(function ClientRow({
  row,
  selected,
  onSelect,
  t,
  style,
}: {
  row: ClientTableRow;
  selected: boolean;
  onSelect: () => void;
  t: Translate;
  style?: React.CSSProperties;
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
        "group cursor-pointer border-b border-slate-100 bg-white transition-colors hover:bg-slate-50/80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset",
        selected && "bg-blue-50/40 outline outline-1 -outline-offset-1 outline-blue-400 hover:bg-blue-50/55",
      )}
      style={style}
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
            <p className="truncate text-sm font-bold text-slate-950">{row.client.full_name}</p>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{row.client.phone || row.client.email || t("clients.noContacts")}</p>
          </div>
        </div>
      </td>
      <td role="gridcell" className="min-w-[130px] px-3 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <SourceIcon source={row.client.source} />
          <span>{sourceLabel(row.client.source, t)}</span>
        </div>
      </td>
      <td role="gridcell" className="min-w-[120px] px-3 py-3">
        <ClientStatusBadge status={row.status} />
      </td>
      <td role="gridcell" className="min-w-[150px] px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
            {initials(row.manager)}
          </div>
          <span className="truncate text-sm font-medium text-slate-600">{row.manager}</span>
        </div>
      </td>
      <td role="gridcell" className="min-w-[150px] px-3 py-3">
        <p className="text-sm font-medium text-slate-700">{row.lastContactAt ? formatDateTime(row.lastContactAt) : "Нет контакта"}</p>
      </td>
      <td role="gridcell" className="min-w-[170px] px-3 py-3">
        <p className="text-sm font-semibold text-slate-700">{row.nextStep.title}</p>
        <p className="mt-0.5 text-xs font-medium text-slate-500">{row.nextStep.date ? formatDate(row.nextStep.date) : "Сегодня"}</p>
      </td>
      <td role="gridcell" className="w-12 px-3 py-3 text-right">
        <button
          type="button"
          className="inline-grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
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

export function ClientsTable({
  rows,
  selectedClientId,
  onSelectClient,
  totalClients,
  t,
}: {
  rows: ClientTableRow[];
  selectedClientId: number | null;
  onSelectClient: (id: number) => void;
  totalClients: number;
  t: Translate;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const topPadding = virtualItems[0]?.start || 0;
  const bottomPadding = Math.max(0, rowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end || 0));

  return (
    <>
      <div ref={scrollRef} className="hidden max-h-[calc(100vh-330px)] min-h-[360px] overflow-auto md:block" aria-label="Область прокрутки таблицы клиентов">
        <table role="grid" aria-label="Список клиентов" aria-describedby="clients-table-description" className="min-w-[1040px] w-full border-separate border-spacing-0">
          <caption id="clients-table-description" className="sr-only">
            Таблица клиентов с фильтрацией. Нажмите Enter или пробел на строке, чтобы выбрать клиента.
          </caption>
          <thead className="sticky top-0 z-10">
            <tr role="row" className="border-b border-slate-200 bg-white text-left text-xs font-semibold text-slate-600">
              <th role="columnheader" className="w-10 px-4 py-3">
                <input type="checkbox" readOnly className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" aria-label="Выбрать все" />
              </th>
              <th role="columnheader" className="px-2 py-3">Клиент</th>
              <th role="columnheader" className="px-3 py-3">Источник</th>
              <th role="columnheader" className="px-3 py-3">Статус</th>
              <th role="columnheader" className="px-3 py-3">Менеджер</th>
              <th role="columnheader" className="px-3 py-3">Последний контакт</th>
              <th role="columnheader" className="px-3 py-3">Следующий шаг</th>
              <th role="columnheader" className="px-3 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {topPadding ? <tr><td colSpan={8} style={{ height: topPadding }} /></tr> : null}
            {virtualItems.map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;
              return (
                <ClientRow
                  key={row.client.id}
                  row={row}
                  selected={selectedClientId === row.client.id}
                  onSelect={() => onSelectClient(row.client.id)}
                  t={t}
                />
              );
            })}
            {bottomPadding ? <tr><td colSpan={8} style={{ height: bottomPadding }} /></tr> : null}
          </tbody>
        </table>
      </div>

      {!rows.length ? (
        <div className="px-6 py-12 text-center">
          <UsersRound className="mx-auto text-slate-300" size={34} />
          <p className="mt-3 font-bold text-slate-900">{t("clients.notFoundTitle")}</p>
          <p className="mt-1 text-sm text-slate-500">{t("clients.notFoundText")}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Показано 1-{rows.length} из {totalClients}
        </p>
        <div className="hidden items-center justify-center gap-2 sm:flex">
          <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-50 hover:text-slate-700">‹</button>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">1</button>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-sm font-semibold text-slate-600 transition hover:bg-slate-50">2</button>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-sm font-semibold text-slate-600 transition hover:bg-slate-50">3</button>
          <span className="px-2">...</span>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-50 hover:text-slate-700">›</button>
        </div>
        <button type="button" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
          20 на странице
        </button>
      </div>
    </>
  );
}
