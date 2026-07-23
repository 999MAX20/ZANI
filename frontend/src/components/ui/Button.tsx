import { ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger" | "ai" | "icon";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
};

export function Button({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }: ButtonProps) {
  const { t } = useI18n();
  const variants = {
    primary: "bg-brand-500 text-white shadow-sm ring-1 ring-brand-600/10 hover:bg-brand-600 active:bg-brand-700",
    secondary: "border border-zani-border bg-surface-card text-zani-text shadow-sm hover:border-brand-100 hover:bg-brand-50",
    ghost: "text-zani-subtle hover:bg-surface-muted hover:text-zani-text",
    outline: "border border-brand-500 bg-surface-card text-brand-700 shadow-sm hover:bg-brand-50",
    danger: "bg-zani-danger text-white shadow-sm hover:brightness-95 active:brightness-90",
    ai: "bg-ai-600 text-white shadow-sm hover:bg-ai-700 active:bg-ai-700",
    icon: "border border-zani-border bg-surface-card text-zani-subtle shadow-sm hover:border-brand-100 hover:bg-brand-50 hover:text-zani-text",
  };
  const sizes = {
    sm: "min-h-9 rounded-control px-3 py-1.5 text-[13px]",
    md: "min-h-10 rounded-control px-4 py-2 text-sm",
    lg: "min-h-11 rounded-control px-5 py-2.5 text-[15px]",
    icon: "h-10 w-10 rounded-control p-0",
  };

  return (
    <button
      className={cn(
        "inline-flex max-w-full items-center justify-center gap-2 whitespace-normal text-center font-semibold transition duration-150 active:scale-[0.99] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20 focus-visible:ring-offset-2",
        "disabled:shadow-none",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? t("common.loading") : children}
    </button>
  );
}
