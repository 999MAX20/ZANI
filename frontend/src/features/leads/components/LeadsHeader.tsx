import { Plus, Search, X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "../../../components/ui/Button";
import type { Translate } from "../types";

export function LeadsHeader({
  title,
  description,
  search,
  onSearchChange,
  onSearchFocus,
  onSearchBlur,
  searchInputRef,
  suggestions,
  onCreate,
  t,
}: {
  title: string;
  description: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  suggestions?: ReactNode;
  onCreate: () => void;
  t: Translate;
}) {
  return (
    <section className="flex min-h-20 flex-col gap-4 border-b border-gray-200 bg-white py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 shrink-0">
          <h1 className="whitespace-nowrap text-2xl font-bold leading-tight text-gray-900">{title}</h1>
          <p className="mt-1 text-sm font-semibold leading-5 text-gray-500">{description}</p>
        </div>
        <label className="relative flex h-10 w-full max-w-xl items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-500 shadow-sm focus-within:ring-2 focus-within:ring-blue-500">
          <Search size={20} />
          <input
            ref={searchInputRef}
            className="min-w-0 flex-1 bg-transparent font-semibold outline-none placeholder:text-gray-400"
            placeholder={t("leads.search")}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
          />
          {search ? (
            <button type="button" className="grid h-7 w-7 place-items-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700" onMouseDown={(event) => event.preventDefault()} onClick={() => onSearchChange("")} aria-label={t("common.clear")}>
              <X size={15} />
            </button>
          ) : null}
          {suggestions}
        </label>
      </div>
      <Button className="min-h-10 shrink-0 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700" onClick={onCreate}>
        <Plus size={20} />
        {t("leads.create")}
      </Button>
    </section>
  );
}
