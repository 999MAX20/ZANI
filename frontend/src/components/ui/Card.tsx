import { cn } from "../../lib/cn";

type CardProps = React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
  variant?: "default" | "muted" | "ai" | "danger";
};

export function Card({ className, children, variant = "default", ...props }: CardProps) {
  const variants = {
    default: "zani-surface rounded-xl",
    muted: "rounded-xl border border-slate-200 bg-slate-50/80",
    ai: "zani-ai-surface rounded-xl",
    danger: "rounded-xl border border-red-100 bg-red-50/80 shadow-sm",
  };

  return <section className={cn(variants[variant], className)} {...props}>{children}</section>;
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("border-b border-slate-100/80 px-4 py-4 sm:px-5", className)}>{children}</div>;
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-4 sm:p-5", className)}>{children}</div>;
}
