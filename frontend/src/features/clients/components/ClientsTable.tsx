import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef, useState } from "react";
import { Columns3, UsersRound } from "lucide-react";

import { cn } from "../../../lib/cn";
import type { ClientTableColumn, ClientTableRow, Translate } from "../types";
import { ClientRow } from "./ClientRow";
import { Pagination } from "./Pagination";

const ROW_HEIGHT = 56;

export function ClientsTable({
  rows,
  selectedClientId,
  onSelectClient,
  totalClients,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  inspectorOpen,
  t,
}: {
  rows: ClientTableRow[];
  selectedClientId: number | null;
  onSelectClient: (id: number) => void;
  totalClients: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  inspectorOpen: boolean;
  t: Translate;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [checkedRows, setCheckedRows] = useState<Set<number>>(() => new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<ClientTableColumn>>(() => new Set(["source"]));
  const columns = useMemo(
    () => [
      { id: "source" as const, label: "Источник" },
      { id: "manager" as const, label: "Менеджер" },
    ],
    [],
  );
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const topPadding = virtualItems[0]?.start || 0;
  const bottomPadding = Math.max(0, rowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end || 0));
  const colSpan = 6 + visibleColumns.size;
  const allPageRowsChecked = rows.length > 0 && rows.every((row) => checkedRows.has(row.client.id));

  function toggleRowCheck(clientId: number) {
    setCheckedRows((current) => {
      const next = new Set(current);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  function toggleAllPageRows() {
    setCheckedRows((current) => {
      const next = new Set(current);
      if (allPageRowsChecked) rows.forEach((row) => next.delete(row.client.id));
      else rows.forEach((row) => next.add(row.client.id));
      return next;
    });
  }

  function toggleColumn(column: ClientTableColumn) {
    setVisibleColumns((current) => {
      const next = new Set(current);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      return next;
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2">
        <p className="text-xs font-semibold text-slate-500">
          {checkedRows.size ? `Выбрано: ${checkedRows.size}` : "Основные данные в списке, детали в карточке справа"}
        </p>
        <div className="relative">
          <button
            type="button"
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            onClick={() => setColumnsOpen((value) => !value)}
          >
            <Columns3 size={14} /> Столбцы
          </button>
          {columnsOpen ? (
            <div className="absolute right-0 top-9 z-30 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              {columns.map((column) => (
                <label key={column.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <input type="checkbox" checked={visibleColumns.has(column.id)} onChange={() => toggleColumn(column.id)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  {column.label}
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div ref={scrollRef} className="hidden max-h-[calc(100vh-374px)] min-h-[448px] overflow-y-auto overflow-x-hidden md:block" aria-label="Область прокрутки таблицы клиентов">
        <table
          role="grid"
          aria-label="Список клиентов"
          aria-describedby="clients-table-description"
          className={cn("w-full table-fixed border-separate border-spacing-0", inspectorOpen ? "text-[13px]" : "text-sm")}
        >
          <caption id="clients-table-description" className="sr-only">
            Таблица клиентов с фильтрацией. Нажмите Enter или пробел на строке, чтобы выбрать клиента.
          </caption>
          <thead className="sticky top-0 z-10">
            <tr role="row" className="h-10 border-b border-slate-200 bg-white text-left text-xs font-semibold text-slate-600">
              <th role="columnheader" className="w-10 px-3 py-2">
                <input type="checkbox" checked={allPageRowsChecked} readOnly onClick={toggleAllPageRows} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" aria-label="Выбрать все на странице" />
              </th>
              <th role="columnheader" className={cn("px-2 py-2", inspectorOpen ? "w-[29%]" : "w-[32%]")}>Клиент</th>
              {visibleColumns.has("source") ? <th role="columnheader" className="w-[12%] px-2 py-2">Источник</th> : null}
              <th role="columnheader" className="w-[12%] px-2 py-2">Статус</th>
              {visibleColumns.has("manager") ? <th role="columnheader" className="w-[15%] px-2 py-2">Менеджер</th> : null}
              <th role="columnheader" className="w-[15%] px-2 py-2">Последний контакт</th>
              <th role="columnheader" className="px-2 py-2">Следующий шаг</th>
              <th role="columnheader" className="w-10 px-2 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {topPadding ? <tr><td colSpan={colSpan} style={{ height: topPadding }} /></tr> : null}
            {virtualItems.map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;
              return (
                <ClientRow
                  key={row.client.id}
                  row={row}
                  selected={selectedClientId === row.client.id}
                  checked={checkedRows.has(row.client.id)}
                  visibleColumns={visibleColumns}
                  onSelect={() => onSelectClient(row.client.id)}
                  onToggleCheck={() => toggleRowCheck(row.client.id)}
                  t={t}
                />
              );
            })}
            {bottomPadding ? <tr><td colSpan={colSpan} style={{ height: bottomPadding }} /></tr> : null}
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

      <Pagination shown={rows.length} total={totalClients} page={page} pageSize={pageSize} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
    </>
  );
}
