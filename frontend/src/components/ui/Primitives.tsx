import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";
import { Button } from "./Button";
import { Card, CardBody } from "./Card";

export type UiTone = "brand" | "ai" | "green" | "amber" | "red" | "slate";

const toneClasses: Record<UiTone, string> = {
  brand: "bg-brand-50 text-brand-700 ring-brand-100",
  ai: "bg-ai-50 text-ai-700 ring-ai-100",
  green: "bg-[var(--zani-success-soft)] text-zani-success ring-[rgba(21,128,61,0.18)]",
  amber: "bg-[var(--zani-warning-soft)] text-zani-warning ring-[rgba(183,121,31,0.22)]",
  red: "bg-[var(--zani-danger-soft)] text-zani-danger ring-[rgba(194,65,12,0.2)]",
  slate: "bg-surface-muted text-zani-text ring-zani-border",
};

export function IconBubble({
  icon: Icon,
  tone = "slate",
  className,
}: {
  icon: LucideIcon;
  tone?: UiTone;
  className?: string;
}) {
  return (
    <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl ring-1", toneClasses[tone], className)}>
      <Icon size={21} />
    </div>
  );
}

export function MetricTile({
  label,
  value,
  hint,
  icon,
  tone = "slate",
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: UiTone;
  className?: string;
}) {
  return (
    <Card className={cn("group overflow-hidden", className)}>
      <CardBody className="flex items-start gap-3">
        <IconBubble icon={icon} tone={tone} className="h-10 w-10 rounded-control" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zani-subtle">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-zani-ink">{value}</p>
          {hint ? <p className="mt-1 text-xs font-medium text-zani-faint">{hint}</p> : null}
        </div>
      </CardBody>
    </Card>
  );
}

export function ProductionKpiCard({
  label,
  value,
  hint,
  trend,
  icon,
  tone = "slate",
  href,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  trend?: string;
  icon: LucideIcon;
  tone?: UiTone;
  href?: string;
  className?: string;
}) {
  const content = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-zani-subtle">{label}</p>
        <p className="mt-2 truncate text-3xl font-semibold tracking-tight text-zani-ink">{value}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
          {trend ? <span className={cn("rounded-full px-2 py-1 ring-1", toneClasses[tone])}>{trend}</span> : null}
          {hint ? <span className="text-zani-faint">{hint}</span> : null}
        </div>
      </div>
      <IconBubble icon={icon} tone={tone} className="h-11 w-11" />
    </div>
  );

  const baseClassName = cn(
    "rounded-card border border-zani-border bg-surface-card p-4 shadow-card transition-colors hover:border-brand-100 hover:bg-surface-warm",
    className,
  );

  if (!href) return <div className={baseClassName}>{content}</div>;
  return <a href={href} className={baseClassName}>{content}</a>;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-control bg-surface-muted p-1", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={cn(
              "zani-focus-ring min-h-8 rounded-control px-3 text-sm font-semibold transition",
              active ? "bg-surface-card text-brand-700 shadow-sm" : "text-zani-subtle hover:bg-surface-warm hover:text-zani-text",
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function FilterChips<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: string; count?: number; icon?: LucideIcon }>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("no-scrollbar flex gap-2 overflow-x-auto pb-1", className)}>
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={cn(
              "zani-focus-ring inline-flex min-h-9 shrink-0 items-center gap-2 rounded-control border px-3 text-sm font-semibold transition",
              active
                ? "border-brand-100 bg-brand-50 text-brand-700"
                : "border-zani-border bg-surface-card text-zani-subtle hover:border-brand-100 hover:bg-surface-warm hover:text-zani-text",
            )}
            onClick={() => onChange(option.value)}
          >
            {Icon ? <Icon size={16} /> : null}
            {option.label}
            {typeof option.count === "number" ? <span className="rounded-control bg-surface-muted px-2 py-0.5 text-xs text-zani-subtle">{option.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function FloatingActionButton({
  label,
  icon: Icon,
  onClick,
  className,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] right-5 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-panel transition hover:bg-brand-700 sm:hidden",
        className,
      )}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Icon size={24} strokeWidth={2.5} />
    </button>
  );
}

export function DetailPanel({
  title,
  subtitle,
  open,
  onClose,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <aside className={cn("hidden h-full min-w-[22rem] max-w-[26rem] rounded-card border border-zani-border bg-surface-card shadow-card xl:block", className)}>
      <div className="flex min-h-16 items-start justify-between gap-3 border-b border-zani-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-zani-ink">{title}</h2>
          {subtitle ? <p className="mt-1 truncate text-sm font-semibold text-zani-subtle">{subtitle}</p> : null}
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={onClose} aria-label={t("common.close")}>
          <X size={23} strokeWidth={2.4} />
        </Button>
      </div>
      <div className="max-h-[calc(100dvh-11rem)] overflow-auto p-5">{children}</div>
    </aside>
  );
}

export function BottomSheet({
  title,
  subtitle,
  open,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[rgba(23,18,15,0.46)] backdrop-blur-sm xl:hidden">
      <button className="absolute inset-0 cursor-default" type="button" aria-label={t("common.close")} onClick={onClose} />
      <section className="relative max-h-[86dvh] w-full overflow-hidden rounded-t-[1.25rem] border border-zani-border bg-surface-card shadow-panel">
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-surface-muted" />
        <div className="flex min-h-16 items-start justify-between gap-3 border-b border-zani-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-zani-ink">{title}</h2>
            {subtitle ? <p className="mt-1 truncate text-sm font-semibold text-zani-subtle">{subtitle}</p> : null}
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={onClose} aria-label={t("common.close")}>
            <X size={23} strokeWidth={2.4} />
          </Button>
        </div>
        <div className="max-h-[calc(86dvh-5.5rem)] overflow-auto px-5 py-4">{children}</div>
      </section>
    </div>
  );
}

export function EntityListItem({
  title,
  subtitle,
  meta,
  status,
  avatar,
  selected,
  onClick,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  status?: ReactNode;
  avatar?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  action?: ReactNode;
  className?: string;
}) {
  const content = (
    <>
      {avatar ? <div className="shrink-0">{avatar}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate font-semibold text-zani-ink">{title}</p>
          {status}
        </div>
        {subtitle ? <p className="mt-1 truncate text-sm font-semibold text-zani-subtle">{subtitle}</p> : null}
        {meta ? <p className="mt-1 truncate text-xs font-semibold text-zani-faint">{meta}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </>
  );

  const baseClassName = cn(
    "flex min-h-[4.25rem] w-full items-center gap-3 rounded-card border bg-surface-card px-3.5 py-3 text-left shadow-sm transition-colors",
    selected ? "border-brand-100 bg-brand-50 ring-2 ring-brand-100" : "border-zani-border hover:border-brand-100 hover:bg-surface-warm",
    className,
  );

  if (!onClick) return <div className={baseClassName}>{content}</div>;
  return <button type="button" className={baseClassName} onClick={onClick}>{content}</button>;
}
