import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export function CrmPageLayout({
  header,
  metrics,
  filters,
  toolbar,
  children,
  aside,
  className,
}: {
  header: ReactNode;
  metrics?: ReactNode;
  filters?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("flex min-h-[calc(100dvh-112px)] flex-col", className)}>
      {header}
      {metrics ? <section className="mb-4">{metrics}</section> : null}
      {filters ? <section className="mb-3">{filters}</section> : null}
      <section className="grid min-h-0 flex-1 overflow-hidden rounded-card border border-slate-200 bg-white shadow-card lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-col">
          {toolbar}
          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </div>
        {aside ? <aside className="hidden min-h-0 w-[420px] border-l border-slate-200 bg-slate-50/60 lg:flex">{aside}</aside> : null}
      </section>
    </main>
  );
}

export function CrmToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex min-h-12 flex-col gap-3 border-b border-slate-200 bg-white px-3 py-2 lg:flex-row lg:items-center lg:justify-between", className)}>{children}</div>;
}

export function CrmPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-card border border-slate-200 bg-white shadow-card", className)}>{children}</section>;
}

export function CrmPanelHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div className="min-w-0">
        <h2 className="truncate text-crm-section font-bold text-midnight">{title}</h2>
        {subtitle ? <p className="mt-1 truncate text-crm-caption text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
