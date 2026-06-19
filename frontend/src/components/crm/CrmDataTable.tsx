import { ReactNode } from "react";

import { cn } from "../../lib/cn";

export function CrmDataTable({
  toolbar,
  children,
  className,
  contentClassName,
}: {
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-card border border-slate-200 bg-white shadow-card", className)}>
      {toolbar ? <div className="border-b border-slate-100 bg-white px-4 py-2">{toolbar}</div> : null}
      <div className={cn("min-h-0", contentClassName)}>{children}</div>
    </section>
  );
}
