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
  previousLabel,
  nextLabel,
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
  previousLabel: string;
  nextLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <div className={CRM_TABLE_PAGINATION_CLASS}>
      <span>{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded-control border border-zani-border bg-surface-card px-2 py-1.5 text-xs font-bold text-zani-muted">
          <span>{pageSizeLabel}</span>
          <select
            className="bg-transparent text-xs font-bold text-zani-text outline-none"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            aria-label={pageSizeLabel}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 rounded-control px-0"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          aria-label={previousLabel}
        >
          <ChevronLeft size={16} />
        </Button>
        {visiblePages.map((itemPage, index) => (
          <button
            key={`${itemPage}-${index}`}
            type="button"
            onClick={() => onPageChange(itemPage)}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-control border text-sm font-bold",
              itemPage === page
                ? "border-brand-100 bg-brand-50 text-brand-700"
                : "border-zani-border text-zani-muted hover:bg-surface-warm hover:text-zani-text",
            )}
          >
            {itemPage}
          </button>
        ))}
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 rounded-control px-0"
          disabled={page >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          aria-label={nextLabel}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
