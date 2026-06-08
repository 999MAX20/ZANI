import { Plus, Search, X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "../../../components/ui/Button";
import type { Translate } from "../types";

/**
 * Компактный header для страницы заявок
 * Соответствует дизайн-референсам "банкинга бизнеса":
 * - Уменьшенные заголовки (text-xl вместо text-2xl)
 * - Compact search bar (h-9 вместо h-10)
 * - Скрыто описание на mobile
 */
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
    <section className="flex min-h-[52px] flex-col gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center">
        <div className="min-w-0 shrink-0">
          <h1 className="whitespace-nowrap text-xl font-bold leading-tight text-gray-900 lg:text-2xl">{title}</h1>
          <p className="mt-0.5 hidden text-xs font-medium text-gray-500 lg:block">{description}</p>
        </div>
        <label className="relative flex h-9 w-full max-w-xl items-center gap-2 rounded-full border border-gray-300 bg-white px-3 text-sm text-gray-500 shadow-sm focus-within:ring-2 focus-within:ring-blue-500">
          <Search size={18} className="shrink-0" />
          <input
            ref={searchInputRef}
            className="min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:text-gray-400"
            placeholder={t("leads.search")}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
          />
          {search ? (
            <button
              type="button"
              className="grid h-6 w-6 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSearchChange("")}
              aria-label={t("common.clear")}
            >
              <X size={14} />
            </button>
          ) : null}
          {suggestions}
        </label>
      </div>
      {/* Desktop: кнопка в header, Mobile: скрыта (используется FAB) */}
      <Button className="hidden min-h-9 shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 lg:inline-flex" onClick={onCreate}>
        <Plus size={18} />
        <span className="hidden xl:inline">{t("leads.create")}</span>
      </Button>
    </section>
  );
}
