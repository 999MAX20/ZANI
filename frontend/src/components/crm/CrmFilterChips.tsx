import { ReactNode } from "react";

import { CrmControlBar } from "./CrmControlBar";

type FilterOption<TValue extends string> = { value: TValue; label: string; count?: number };

type CrmFilterChip = {
  id: string;
  label: string;
  value: string;
};

export function CrmFilterChips<TValue extends string>({
  value,
  options,
  onChange,
  advanced,
  advancedLabel,
  activeFilters,
  onClearFilter,
  children,
  onClearAll,
  className,
  ariaLabel,
  activeFiltersLabel,
  clearAllLabel,
  filtersLabel,
}: {
  value: TValue;
  options: Array<FilterOption<TValue>>;
  onChange: (value: TValue) => void;
  advanced?: ReactNode;
  advancedLabel?: string;
  activeFilters?: CrmFilterChip[];
  onClearFilter?: (id: string) => void;
  onClearAll?: () => void;
  children?: ReactNode;
  className?: string;
  ariaLabel: string;
  activeFiltersLabel?: string;
  clearAllLabel?: string;
  filtersLabel?: string;
}) {
  return (
    <CrmControlBar
      value={value}
      tabs={options}
      onChange={onChange}
      advanced={advanced}
      advancedLabel={advancedLabel}
      activeFilters={activeFilters}
      onClearFilter={onClearFilter}
      onClearAll={onClearAll}
      actions={children}
      className={className}
      ariaLabel={ariaLabel}
      activeFiltersLabel={activeFiltersLabel}
      clearAllLabel={clearAllLabel}
      filtersLabel={filtersLabel}
    />
  );
}
