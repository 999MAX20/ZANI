import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useState } from "react";
import { MousePointer2, X } from "lucide-react";

import { CrmDataTable, CrmPagination } from "../../../components/crm";
import type { ClientTableColumn, ClientTableRow, Translate } from "../types";
import { ClientRow } from "./ClientRow";

const ROW_HEIGHT = 52;

export function ClientsTable({
  rows,
  selectedClientId,
  onSelectClient,
  totalClients,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  visibleColumns,
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
  visibleColumns: Set<ClientTableColumn>;
  t: Translate;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [checkedRows, setCheckedRows] = useState<Set<number>>(() => new Set());

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
  const firstCheckedRow = rows.find((row) => checkedRows.has(row.client.id));

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

  function clearCheckedRows() {
    setCheckedRows(new Set());
  }

  return (
    <CrmDataTable
      className="flex min-h-0 flex-1 flex-col rounded-none border-0 shadow-none"
      contentClassName="flex min-h-0 flex-1 flex-col"
      toolbar={
        checkedRows.size ? (
          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                {t("clients.selectedCount", { count: checkedRows.size })}
              </span>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={() => firstCheckedRow && onSelectClient(firstCheckedRow.client.id)}
                disabled={!firstCheckedRow}
              >
                <MousePointer2 size={14} />
                {t("clients.openSelected")}
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                onClick={clearCheckedRows}
              >
                <X size={14} />
                {t("clients.clearSelection")}
              </button>
            </div>
          </div>
        ) : undefined
      }
    >
      <div
        ref={scrollRef}
        className="hidden min-h-0 flex-1 overflow-y-auto overflow-x-hidden md:block"
        aria-label="Область прокрутки таблицы клиентов"
      >
        <table
          role="grid"
          aria-label="Список клиентов"
          aria-describedby="clients-table-description"
          className="w-full table-fixed border-separate border-spacing-0 text-sm"
        >
          <caption id="clients-table-description" className="sr-only">
            Таблица клиентов с фильтрацией. Нажмите Enter или пробел на строке, чтобы выбрать клиента.
          </caption>
          <thead className="sticky top-0 z-10">
            <tr role="row" className="h-10 border-b border-slate-200 bg-white text-left text-xs font-semibold text-slate-600">
              <th role="columnheader" className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allPageRowsChecked}
                  readOnly
                  onClick={toggleAllPageRows}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  aria-label="Выбрать все на странице"
                />
              </th>
              <th role="columnheader" className="w-[32%] px-2 py-2">Клиент</th>
              {visibleColumns.has("source") ? <th role="columnheader" className="w-[12%] px-2 py-2">Источник</th> : null}
              <th role="columnheader" className="w-[12%] px-2 py-2">Статус</th>
              {visibleColumns.has("manager") ? <th role="columnheader" className="w-[15%] px-2 py-2">Менеджер</th> : null}
              <th role="columnheader" className="w-[15%] px-2 py-2">Последний контакт</th>
              <th role="columnheader" className="px-2 py-2">Следующий шаг</th>
              <th role="columnheader" className="w-[92px] px-2 py-2 text-right"></th>
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
          <p className="font-bold text-slate-900">{t("clients.notFoundTitle")}</p>
          <p className="mt-1 text-sm text-slate-500">{t("clients.notFoundText")}</p>
        </div>
      ) : null}

      <CrmPagination
        shown={rows.length}
        total={totalClients}
        page={page}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={(nextPageSize) => {
          onPageSizeChange(nextPageSize);
        }}
      />
    </CrmDataTable>
  );
}
