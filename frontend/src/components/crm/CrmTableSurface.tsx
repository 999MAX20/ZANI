import type { ReactNode } from "react";

import { cn } from "../../lib/cn";
import { surfaceClass } from "../ui/Card";

export function CrmTableSurface({
  filters,
  children,
  className,
  filtersClassName,
}: {
  filters?: ReactNode;
  children: ReactNode;
  className?: string;
  filtersClassName?: string;
}) {
  return (
    <section className={cn(surfaceClass, "flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      {filters ? <div className={cn("shrink-0 border-b border-zani-border bg-surface-card px-4 py-3", filtersClassName)}>{filters}</div> : null}
      {children}
    </section>
  );
}
