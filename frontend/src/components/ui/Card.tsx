import { cn } from "../../lib/cn";

type CardProps = React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
  variant?: "default" | "elevated" | "outlined" | "muted" | "ai" | "danger";
  padding?: "none" | "sm" | "md" | "lg";
};

export function Card({ className, children, variant = "default", padding = "none", ...props }: CardProps) {
  const variants = {
    default: "rounded-card border border-slate-200 bg-white shadow-soft",
    elevated: "rounded-card border border-slate-200 bg-white shadow-card",
    outlined: "rounded-card border border-slate-200 bg-white",
    muted: "rounded-xl border border-slate-200 bg-slate-50/80",
    ai: "zani-ai-surface rounded-xl",
    danger: "rounded-xl border border-red-100 bg-red-50/80 shadow-sm",
  };
  const paddings = {
    none: "",
    sm: "p-3",
    md: "p-4",
    lg: "p-5",
  };

  return <section className={cn(variants[variant], paddings[padding], className)} {...props}>{children}</section>;
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("border-b border-slate-100/80 px-4 py-4 sm:px-5", className)}>{children}</div>;
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-4 sm:p-5", className)}>{children}</div>;
}
