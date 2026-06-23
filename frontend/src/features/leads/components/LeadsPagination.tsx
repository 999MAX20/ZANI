import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { CRM_TABLE_PAGINATION_CLASS } from "../../../components/crm";
import { cn } from "../../../lib/cn";

export function LeadsPagination({
  page,
  pageCount,
  pageSize,
  pageSizeOptions,
  visiblePages,
  label,
  pageSizeLabel,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  pageSizeOptions: number[];
  visiblePages: number[];
  label: string;
  pageSizeLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <div className={cn(CRM_TABLE_PAGINATION_CLASS, "bg-white")}>
      <span className="tabular-nums">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-500">
          <span>{pageSizeLabel}</span>
          <select
            className="bg-transparent text-xs font-black text-midnight outline-none"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            aria-label={pageSizeLabel}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
        <Button variant="secondary" size="icon" className="h-9 w-9 rounded-lg px-0 shadow-none" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}>
          <ChevronLeft size={16} />
        </Button>
        {visiblePages.map((itemPage, index) => (
          <button
            key={`${itemPage}-${index}`}
            type="button"
            onClick={() => onPageChange(itemPage)}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-lg border text-sm font-bold transition duration-200 active:scale-[0.98]",
              itemPage === page ? "border-brand-200 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500 hover:text-midnight",
            )}
          >
            {itemPage}
          </button>
        ))}
        <Button variant="secondary" size="icon" className="h-9 w-9 rounded-lg px-0 shadow-none" disabled={page >= pageCount} onClick={() => onPageChange(Math.min(pageCount, page + 1))}>
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
