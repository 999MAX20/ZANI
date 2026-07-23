import type { CSSProperties, ReactNode } from "react";

import { cn } from "../../lib/cn";

type WorkbenchLayoutProps = {
  header?: ReactNode;
  metrics?: ReactNode;
  tabs?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  contextPanel?: ReactNode;
  className?: string;
  contentClassName?: string;
  style?: CSSProperties;
};

type WorkbenchSectionProps = {
  children: ReactNode;
  className?: string;
};

export type WorkbenchMetricItem = {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger" | "ai";
};

const metricToneClasses: Record<NonNullable<WorkbenchMetricItem["tone"]>, string> = {
  neutral: "border-zani-border bg-surface-card text-zani-text",
  brand: "border-brand-100 bg-brand-50 text-brand-700",
  success: "border-[rgba(21,128,61,0.18)] bg-[var(--zani-success-soft)] text-zani-success",
  warning: "border-[rgba(183,121,31,0.22)] bg-[var(--zani-warning-soft)] text-zani-warning",
  danger: "border-[rgba(194,65,12,0.2)] bg-[var(--zani-danger-soft)] text-zani-danger",
  ai: "border-ai-100 bg-ai-50 text-ai-700",
};

export function WorkbenchLayout({
  header,
  metrics,
  tabs,
  toolbar,
  children,
  contextPanel,
  className,
  contentClassName,
  style,
}: WorkbenchLayoutProps) {
  return (
    <section style={style} className={cn("flex min-h-0 w-full flex-col gap-3", className)}>
      {header ? <div className="min-w-0">{header}</div> : null}
      {metrics ? <MetricStrip>{metrics}</MetricStrip> : null}
      {tabs ? <ViewTabs>{tabs}</ViewTabs> : null}
      {toolbar ? <WorkbenchToolbar>{toolbar}</WorkbenchToolbar> : null}
      <div className={cn("grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]", !contextPanel && "lg:block", contentClassName)}>
        <MainWorkspace>{children}</MainWorkspace>
        {contextPanel ? <ContextPanel>{contextPanel}</ContextPanel> : null}
      </div>
    </section>
  );
}

export function MetricStrip({ children, className }: WorkbenchSectionProps) {
  return <section className={cn("grid gap-2 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</section>;
}

export function WorkbenchMetric({ label, value, detail, tone = "neutral" }: WorkbenchMetricItem) {
  return (
    <div className={cn("min-w-0 rounded-card border px-3 py-2.5 shadow-soft", metricToneClasses[tone])}>
      <p className="truncate text-xs font-semibold opacity-75">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold tracking-tight">{value}</p>
      {detail ? <p className="mt-1 truncate text-xs font-semibold opacity-70">{detail}</p> : null}
    </div>
  );
}

export function WorkbenchToolbar({ children, className }: WorkbenchSectionProps) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-2 rounded-card border border-zani-border bg-surface-card p-2 shadow-soft md:flex-row md:items-center md:justify-between", className)}>
      {children}
    </section>
  );
}

export function ViewTabs({ children, className }: WorkbenchSectionProps) {
  return (
    <section className={cn("min-w-0 overflow-x-auto rounded-card border border-zani-border bg-surface-card p-1 shadow-soft", className)}>
      <div className="flex min-w-max items-center gap-1">{children}</div>
    </section>
  );
}

export function MainWorkspace({ children, className }: WorkbenchSectionProps) {
  return <main className={cn("min-w-0 rounded-card border border-zani-border bg-surface-card shadow-card", className)}>{children}</main>;
}

export function ContextPanel({ children, className }: WorkbenchSectionProps) {
  return <aside className={cn("min-w-0 rounded-card border border-zani-border bg-surface-card shadow-card", className)}>{children}</aside>;
}

export function WorkbenchStateRegion({ children, className }: WorkbenchSectionProps) {
  return (
    <div className={cn("grid min-h-[320px] place-items-center rounded-card border border-zani-border bg-surface-card p-4 shadow-card", className)}>
      {children}
    </div>
  );
}
