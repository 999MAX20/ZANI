import { CSSProperties, ReactNode } from "react";

import { cn } from "../../lib/cn";
import { surfaceClass } from "../ui/Card";

export function CrmDataTable({
  toolbar,
  children,
  className,
  contentClassName,
  style,
}: {
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  style?: CSSProperties;
}) {
  return (
    <section className={cn(surfaceClass, "overflow-hidden", className)} style={style}>
      {toolbar ? <div className="border-b border-zani-border bg-surface-card px-4 py-2">{toolbar}</div> : null}
      <div className={cn("min-h-0", contentClassName)}>{children}</div>
    </section>
  );
}
