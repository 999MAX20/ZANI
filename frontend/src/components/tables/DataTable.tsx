import { EmptyState, SkeletonBlock } from "../ui/StateViews";
import { useI18n } from "../../lib/i18n";

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
      <div className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-soft backdrop-blur-xl">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-12" />
          ))}
        </div>
      </div>
    );
  }

  if (!rows.length) {
    return <EmptyState title={emptyTitle} description={resolvedEmptyDescription} action={emptyAction} />;
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/90 shadow-soft backdrop-blur-xl">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50/80">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.header}
                  className="whitespace-nowrap px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={index} className="transition hover:bg-brand-50/35">
                {columns.map((column) => (
                  <td key={column.header} className={`whitespace-nowrap px-5 py-4 text-sm text-slate-700 ${column.className || ""}`}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-xs font-semibold text-slate-500">
        <span>{t("table.total", { count: rows.length })}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1">{t("table.records")}</span>
      </div>
    </div>
  );
}
