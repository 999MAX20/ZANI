import { cn } from "../../lib/cn";

export type BadgeVariant = "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "ai";
export type BadgeSize = "sm" | "md" | "lg";

export const badgeVariants: Record<BadgeVariant, string> = {
  neutral: "bg-surface-muted text-zani-subtle ring-zani-border",
  primary: "bg-brand-50 text-brand-700 ring-brand-100",
  success: "bg-[var(--zani-success-soft)] text-zani-success ring-[rgba(21,128,61,0.18)]",
  warning: "bg-[var(--zani-warning-soft)] text-zani-warning ring-[rgba(151,90,22,0.24)]",
  danger: "bg-[var(--zani-danger-soft)] text-zani-danger ring-[rgba(194,65,12,0.2)]",
  info: "bg-[var(--zani-info-soft)] text-zani-info ring-[rgba(14,116,144,0.2)]",
  ai: "bg-ai-50 text-ai-700 ring-ai-100",
};

const sizes: Record<BadgeSize, string> = {
  sm: "min-h-5 px-2 py-0.5 text-[11px]",
  md: "min-h-6 px-2.5 py-1 text-xs",
  lg: "min-h-7 px-3 py-1 text-[13px]",
};

export function Badge({
  children,
  variant = "neutral",
  size = "md",
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1 rounded-full font-semibold leading-none ring-1", badgeVariants[variant], sizes[size], className)}>
      {children}
    </span>
  );
}
