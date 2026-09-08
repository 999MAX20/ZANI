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

type RowKey = React.Key;

export type DataTableRowInteraction =
  | { source: "pointer" }
  | { source: "keyboard"; key: "Enter" | " " };

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("a, button, input, select, textarea, [role='button'], [role='link']"));
}

export function DataTable<T>({
  rows,
  columns,
  emptyTitle,
  emptyDescription,
  emptyAction,
  isLoading = false,
  rowKey,
  selectedRowKey,
  onRowSelect,
  rowAriaLabel,
  rowFocusReturnId,
  rowTestId,
  rowClassName,
  tableLabel,
  toolbar,
  footer,
  hideFooter = false,
  className,
  contentClassName,
}: {
  rows: T[];
  columns: Column<T>[];
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  isLoading?: boolean;
  rowKey?: (row: T, index: number) => RowKey;
  selectedRowKey?: RowKey | null;
  onRowSelect?: (row: T, index: number, interaction: DataTableRowInteraction) => void;
  rowAriaLabel?: (row: T) => string;
  rowFocusReturnId?: (row: T) => string;
  rowTestId?: (row: T) => string;
  rowClassName?: (row: T) => string | undefined;
  tableLabel?: string;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  hideFooter?: boolean;
  className?: string;
  contentClassName?: string;
}) {
  const { t } = useI18n();
  const resolvedEmptyDescription = emptyDescription || t("table.emptyDescription");
  if (isLoading) {
    return (
      <div className={cn(surfaceClass, "overflow-hidden", className)} aria-busy="true">
        {toolbar ? <div className="border-b border-zani-border bg-surface-card px-4 py-3">{toolbar}</div> : null}
        <div className="space-y-3">
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-[52px]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className={cn(surfaceClass, "flex min-h-0 flex-col overflow-hidden", className)}>
        {toolbar ? <div className="shrink-0 border-b border-zani-border bg-surface-card px-4 py-3">{toolbar}</div> : null}
        <div className="p-4">
          <EmptyState title={emptyTitle} description={resolvedEmptyDescription} action={emptyAction} />
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div className={cn(surfaceClass, "flex min-h-0 flex-col overflow-hidden", className)}>
      {toolbar ? <div className="shrink-0 border-b border-zani-border bg-surface-card px-4 py-3">{toolbar}</div> : null}
      <div className={cn("min-h-0 flex-1 overflow-auto", contentClassName)}>
        <div className="divide-y divide-zani-border md:hidden" aria-label={tableLabel}>
          {rows.map((row, index) => {
            const resolvedRowKey = rowKey?.(row, index) ?? index;
            const selected = selectedRowKey !== null && selectedRowKey !== undefined && String(resolvedRowKey) === String(selectedRowKey);
            return (
              <article
                key={resolvedRowKey}
                tabIndex={onRowSelect ? 0 : undefined}
                aria-current={onRowSelect && selected ? "true" : undefined}
                aria-label={rowAriaLabel?.(row)}
                data-focus-return-id={rowFocusReturnId?.(row)}
                data-testid={rowTestId?.(row)}
                className={cn(
                  "space-y-2.5 px-3 py-2.5 transition-colors",
                  onRowSelect && "cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-inset",
                  selected && "bg-brand-50/80 shadow-[inset_5px_0_0_var(--zani-brand)]",
                  rowClassName?.(row),
                )}
                onClick={(event) => {
                  if (!onRowSelect || isInteractiveTarget(event.target)) return;
                  onRowSelect(row, index, { source: "pointer" });
                }}
                onKeyDown={(event) => {
                  if (!onRowSelect || event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
                  event.preventDefault();
                  onRowSelect(row, index, { source: "keyboard", key: event.key });
                }}
              >
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
            );
          })}
        </div>
        <div className="hidden min-h-0 overflow-x-auto md:block">
          <table className="min-w-full divide-y divide-zani-border" aria-label={tableLabel}>
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
            {rows.map((row, index) => {
              const resolvedRowKey = rowKey?.(row, index) ?? index;
              const selected = selectedRowKey !== null && selectedRowKey !== undefined && String(resolvedRowKey) === String(selectedRowKey);
              return (
                <tr
                  key={resolvedRowKey}
                  tabIndex={onRowSelect ? 0 : undefined}
                  aria-selected={onRowSelect ? selected : undefined}
                  aria-label={rowAriaLabel?.(row)}
                  data-focus-return-id={rowFocusReturnId?.(row)}
                  data-testid={rowTestId?.(row)}
                  className={cn(
                    "transition hover:bg-surface-warm",
                    onRowSelect && "cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-inset",
                    selected && "bg-brand-50/80 shadow-[inset_5px_0_0_var(--zani-brand)] hover:bg-brand-50/80",
                    rowClassName?.(row),
                  )}
                  style={{ minHeight: CRM_TABLE_ROW_HEIGHT }}
                  onClick={(event) => {
                    if (!onRowSelect || isInteractiveTarget(event.target)) return;
                    onRowSelect(row, index, { source: "pointer" });
                  }}
                  onKeyDown={(event) => {
                    if (!onRowSelect || event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
                    event.preventDefault();
                    onRowSelect(row, index, { source: "keyboard", key: event.key });
                  }}
                >
                  {columns.map((column) => (
                    <td key={column.header} className={`whitespace-nowrap px-3 py-2 text-sm text-zani-subtle ${column.className || ""}`}>
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      </div>
      {!hideFooter && (footer || (
        <div className="flex shrink-0 items-center justify-between border-t border-zani-border px-4 py-3 text-xs font-semibold text-zani-subtle">
          <span>{t("table.total", { count: rows.length })}</span>
          <span className="rounded-control bg-surface-muted px-2.5 py-1">{t("table.records")}</span>
        </div>
      ))}
    </div>
  );
}
