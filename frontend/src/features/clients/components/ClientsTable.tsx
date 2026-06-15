import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { UsersRound } from "lucide-react";

import type { ClientTableRow, Translate } from "../types";
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
  t,
}: {
  rows: ClientTableRow[];
  selectedClientId: number | null;
  onSelectClient: (id: number) => void;
  totalClients: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
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
      <div ref={scrollRef} className="hidden max-h-[448px] min-h-[448px] overflow-auto md:block" aria-label="Область прокрутки таблицы клиентов">
        <table role="grid" aria-label="Список клиентов" aria-describedby="clients-table-description" className="min-w-[760px] w-full border-separate border-spacing-0">
          <caption id="clients-table-description" className="sr-only">
            Таблица клиентов с фильтрацией. Нажмите Enter или пробел на строке, чтобы выбрать клиента.
          </caption>
          <thead className="sticky top-0 z-10">
            <tr role="row" className="h-10 border-b border-slate-200 bg-white text-left text-xs font-semibold text-slate-600">
              <th role="columnheader" className="w-9 px-3 py-2">
                <input type="checkbox" readOnly className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" aria-label="Выбрать все" />
              </th>
              <th role="columnheader" className="px-2 py-2">Клиент</th>
              <th role="columnheader" className="px-2 py-2">Источник</th>
              <th role="columnheader" className="px-2 py-2">Статус</th>
              <th role="columnheader" className="hidden px-2 py-2 xl:table-cell">Менеджер</th>
              <th role="columnheader" className="px-2 py-2">Последний контакт</th>
              <th role="columnheader" className="px-2 py-2">Следующий шаг</th>
              <th role="columnheader" className="px-2 py-2 text-right"></th>
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

      <Pagination shown={rows.length} total={totalClients} page={page} pageSize={pageSize} onPageChange={onPageChange} />
    </>
  );
}
