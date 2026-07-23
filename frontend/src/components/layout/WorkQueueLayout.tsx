import type { CSSProperties, ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";

type WorkQueueLayoutProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

type WorkQueuePaneProps = {
  children: ReactNode;
  className?: string;
  mobileDetailOpen?: boolean;
};

type WorkQueueDetailPaneProps = WorkQueuePaneProps & {
  closeLabel?: string;
  onMobileClose?: () => void;
};

export function WorkQueueLayout({ children, className, style }: WorkQueueLayoutProps) {
  return (
    <section
      style={style}
      className={cn(
        "grid min-h-[calc(100dvh-176px)] overflow-hidden rounded-card border border-zani-border bg-surface-card shadow-card lg:h-[calc(100vh-132px)] lg:min-h-[720px]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function WorkQueueListPane({ children, className, mobileDetailOpen = false }: WorkQueuePaneProps) {
  return (
    <aside
      className={cn(
        "min-h-0 flex-col border-b border-zani-border bg-surface-card lg:flex lg:border-b-0 lg:border-r",
        mobileDetailOpen ? "hidden lg:flex" : "flex",
        className,
      )}
    >
      {children}
    </aside>
  );
}

export function RightDetailPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex min-h-0 flex-1 flex-col bg-surface-warm", className)}>{children}</div>;
}

export function WorkQueueDetailPane({
  children,
  className,
  mobileDetailOpen = false,
  closeLabel = "Close detail",
  onMobileClose,
}: WorkQueueDetailPaneProps) {
  return (
    <main className={cn("min-h-0 flex-col", mobileDetailOpen ? "flex" : "hidden lg:flex", className)}>
      {onMobileClose ? (
        <div className="flex items-center justify-between gap-3 border-b border-zani-border bg-surface-card px-4 py-3 lg:hidden">
          <p className="truncate text-sm font-semibold text-zani-subtle">{closeLabel}</p>
          <Button type="button" variant="secondary" size="icon" aria-label={closeLabel} onClick={onMobileClose}>
            <X size={18} />
          </Button>
        </div>
      ) : null}
      <RightDetailPanel>{children}</RightDetailPanel>
    </main>
  );
}
