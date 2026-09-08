import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ChangeEvent } from "react";

import { cn } from "../../lib/cn";
import { Select } from "../ui/Select";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

export function CrmPagination({
  shown,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  className,
  rangeLabel,
  previousLabel = "Previous",
  nextLabel = "Next",
  pageSizeLabel,
  pageSizeAriaLabel,
  variant = "footer",
}: {
  shown: number;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  className?: string;
  rangeLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
  pageSizeLabel?: (size: number) => string;
  pageSizeAriaLabel?: string;
  variant?: "footer" | "toolbar";
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const isToolbar = variant === "toolbar";
  const Root = isToolbar ? "div" : "footer";

  function onPrev() {
    if (page > 1) onPageChange(page - 1);
  }

  function onNext() {
    if (page < totalPages) onPageChange(page + 1);
  }

  return (
    <Root
      data-testid="crm-pagination"
      data-pagination-variant={variant}
      className={cn(
        "flex text-sm font-semibold text-zani-subtle",
        isToolbar
          ? "min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          : "flex-wrap items-center justify-between gap-3 border-t border-zani-border px-4 py-3",
        className,
      )}
    >
      <p aria-live="polite" className="shrink-0 whitespace-nowrap tabular-nums">
        {rangeLabel || `Showing ${from}—${to} of ${total}`}
      </p>
      <div
        className={cn(
          "flex items-center gap-2",
          isToolbar && "min-w-0 flex-wrap sm:flex-nowrap",
        )}
      >
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 1}
          className={cn(
            "zani-focus-ring rounded-control border border-zani-border bg-surface-card px-3 py-2 text-sm font-semibold text-zani-text transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50",
            isToolbar && "min-h-11 w-11 shrink-0 px-0 sm:min-h-9 sm:w-auto sm:px-3",
          )}
        >
          {isToolbar ? <ChevronLeft aria-hidden="true" size={18} className="sm:hidden" /> : null}
          <span className={isToolbar ? "sr-only sm:not-sr-only" : undefined}>{previousLabel}</span>
        </button>
        <span
          aria-current="page"
          className={cn(
            "rounded-control bg-surface-muted px-3 py-2 text-zani-text tabular-nums",
            isToolbar && "inline-flex min-h-11 shrink-0 items-center sm:min-h-9",
          )}
        >
          {page}/{totalPages}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages}
          className={cn(
            "zani-focus-ring rounded-control border border-zani-border bg-surface-card px-3 py-2 text-sm font-semibold text-zani-text transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50",
            isToolbar && "min-h-11 w-11 shrink-0 px-0 sm:min-h-9 sm:w-auto sm:px-3",
          )}
        >
          <span className={isToolbar ? "sr-only sm:not-sr-only" : undefined}>{nextLabel}</span>
          {isToolbar ? <ChevronRight aria-hidden="true" size={18} className="sm:hidden" /> : null}
        </button>
        <Select
          aria-label={pageSizeAriaLabel}
          value={String(pageSize)}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => onPageSizeChange(Number(event.target.value))}
          options={PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: pageSizeLabel ? pageSizeLabel(size) : `Per ${size}` }))}
          className={cn(
            "w-[110px]",
            isToolbar ? "h-11 min-h-11 shrink-0 sm:h-9 sm:min-h-9" : "h-9 min-h-9",
          )}
        />
      </div>
    </Root>
  );
}
