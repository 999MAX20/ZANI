import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  shown: number;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}; 

export function Pagination({ shown, total, page, pageSize, onPageChange }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil((total || 0) / pageSize));
  const clampedPage = Math.min(Math.max(page, 1), pageCount);
  const from = total ? (clampedPage - 1) * pageSize + 1 : 0;
  const to = Math.min(clampedPage * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <p>
        Показано {from ? `${from}-${to}` : "0"} из {total}
      </p>
      <div className="hidden items-center justify-center gap-2 sm:flex" aria-hidden="true">
        <button
          type="button"
          onClick={() => onPageChange(clampedPage - 1)}
          disabled={clampedPage <= 1}
          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-50 hover:text-slate-900"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="grid h-8 w-12 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">{clampedPage}</span>
        <span className="grid h-8 w-12 place-items-center rounded-lg bg-slate-100 text-sm font-bold">/ {pageCount}</span>
        <button
          type="button"
          onClick={() => onPageChange(clampedPage + 1)}
          disabled={clampedPage >= pageCount}
          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-50 hover:text-slate-900"
        >
          <ChevronRight size={14} />
        </button>
      </div>
      <button type="button" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
        20 на странице <ChevronDown size={14} />
      </button>
    </div>
  );
}
