import { ChangeEvent } from "react";

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
}: {
  shown: number;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  function onPrev() {
    if (page > 1) onPageChange(page - 1);
  }

  function onNext() {
    if (page < totalPages) onPageChange(page + 1);
  }

  return (
    <footer className={cn("flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600", className)}>
      <p>
        Показано {from}—{to} из {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 1}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50"
        >
          Назад
        </button>
        <span className="rounded-lg bg-slate-100 px-3 py-2">{page}/{totalPages}</span>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50"
        >
          Вперёд
        </button>
        <Select
          value={String(pageSize)}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => onPageSizeChange(Number(event.target.value))}
          options={PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: `По ${size}` }))}
          className="h-9 min-h-9 w-[110px]"
        />
      </div>
    </footer>
  );
}

