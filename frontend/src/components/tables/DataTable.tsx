import type React from "react";

import { CRM_TABLE_ROW_HEIGHT } from "../crm";
import { surfaceClass } from "../ui/Card";
import { EmptyState, SkeletonBlock } from "../ui/StateViews";
import { useI18n } from "../../lib/i18n";
import { cn } from "../../lib/cn";

export type Column<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
};

export function DataTable<T>({
  rows,
  columns,
  emptyTitle,
  emptyDescription,
  emptyAction,
  isLoading = false,
}: {
  rows: T[];
  columns: Column<T>[];
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  isLoading?: boolean;
}) {
  const { t } = useI18n();
  const resolvedEmptyDescription = emptyDescription || t("table.emptyDescription");
  if (isLoading) {
    return (
      <div className={cn(surfaceClass, "p-4")}>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-[52px]" />
          ))}
        </div>
      </div>
    );
  }

  if (!rows.length) {
    return <EmptyState title={emptyTitle} description={resolvedEmptyDescription} action={emptyAction} />;
  }

  return (
    <div className={cn(surfaceClass, "overflow-hidden")}>
      <div className="divide-y divide-zani-border md:hidden">
        {rows.map((row, index) => (
          <article key={index} className="space-y-2.5 px-3 py-2.5">
            {columns.map((column, columnIndex) => (
              <div key={column.header} className={columnIndex === 0 ? "" : "flex items-start justify-between gap-4"}>
                {columnIndex === 0 ? (
                  <div className="text-sm font-semibold text-midnight">{column.cell(row)}</div>
                ) : (
                  <>
                    <span className="shrink-0 text-[11px] font-semibold text-zani-faint">{column.header}</span>
                    <div className="min-w-0 text-right text-sm font-semibold text-zani-subtle">{column.cell(row)}</div>
                  </>
                )}
              </div>
            ))}
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-zani-border">
          <thead className="bg-surface-card">
            <tr className="h-10">
              {columns.map((column) => (
                <th
                  key={column.header}
                  className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-zani-subtle"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zani-border">
            {rows.map((row, index) => (
              <tr key={index} className="transition hover:bg-surface-warm" style={{ minHeight: CRM_TABLE_ROW_HEIGHT }}>
                {columns.map((column) => (
                  <td key={column.header} className={`whitespace-nowrap px-3 py-2 text-sm text-zani-subtle ${column.className || ""}`}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-zani-border px-4 py-3 text-xs font-semibold text-zani-subtle">
        <span>{t("table.total", { count: rows.length })}</span>
        <span className="rounded-control bg-surface-muted px-2.5 py-1">{t("table.records")}</span>
      </div>
    </div>
  );
}
