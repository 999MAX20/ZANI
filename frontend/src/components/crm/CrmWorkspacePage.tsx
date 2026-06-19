import type { CSSProperties, ReactNode } from "react";

import { cn } from "../../lib/cn";

export function CrmWorkspacePage({
  children,
  className,
  contentClassName,
  maxWidthClassName = "max-w-[1480px]",
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  maxWidthClassName?: string;
}) {
  return (
    <section className={cn("flex h-[calc(100vh-5.5rem)] min-h-[620px] w-full flex-col bg-[#f8fafc] px-3 py-2 sm:px-4", className)}>
      <div className={cn("mx-auto flex min-h-0 w-full flex-1 flex-col", maxWidthClassName, contentClassName)}>
        {children}
      </div>
    </section>
  );
}

export function CrmWorkspaceGrid({
  children,
  inspectorOpen,
  className,
  inspectorColumnClassName = "clamp(340px,25vw,400px)",
}: {
  children: ReactNode;
  inspectorOpen?: boolean;
  className?: string;
  inspectorColumnClassName?: string;
}) {
  const inspectorStyle = inspectorOpen ? ({ "--crm-inspector-column": inspectorColumnClassName } as CSSProperties & Record<string, string>) : undefined;

  return (
    <div
      className={cn("grid min-h-0 w-full flex-1 grid-cols-1 gap-3", inspectorOpen && "lg:grid-cols-[minmax(0,1fr)_var(--crm-inspector-column)]", className)}
      style={inspectorStyle}
    >
      {children}
    </div>
  );
}
