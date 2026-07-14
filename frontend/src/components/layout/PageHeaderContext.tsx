import { createContext, useContext, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type PageHeaderAction = {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
};

export type PageHeaderConfig = {
  title: string;
  primaryAction?: PageHeaderAction;
  secondaryActions?: PageHeaderAction[];
  filterLabel?: string;
  filters?: ReactNode;
  activeFilterCount?: number;
  activeFilters?: ReactNode;
};

type PageHeaderContextValue = {
  pageHeader: PageHeaderConfig | null;
  setPageHeader: (config: PageHeaderConfig | null) => void;
};

export const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function usePageHeader() {
  const context = useContext(PageHeaderContext);
  if (!context) throw new Error("usePageHeader must be used inside PageHeaderContext.Provider");
  return context;
}
