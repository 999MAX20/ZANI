import { cn } from "../../lib/cn";

export type BadgeVariant = "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "ai";
export type BadgeSize = "sm" | "md";

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  primary: "bg-brand-50 text-brand-700 ring-brand-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-blue-50 text-blue-700 ring-blue-200",
  ai: "bg-violet-50 text-violet-700 ring-violet-200",
};

const sizes: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
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
    <span className={cn("inline-flex w-fit items-center gap-1 rounded-full font-semibold ring-1", variants[variant], sizes[size], className)}>
      {children}
    </span>
  );
}
