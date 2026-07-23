import { ReactNode } from "react";

import { cn } from "../../lib/cn";

export function CrmInspector({
  children,
  open,
  className,
}: {
  children: ReactNode;
  open: boolean;
  className?: string;
}) {
  if (!open) return null;
  return (
    <aside className={cn("hidden min-h-0 w-full overflow-hidden rounded-card border-x border-zani-border bg-surface-card lg:block", className)}>
      {children}
    </aside>
  );
}
