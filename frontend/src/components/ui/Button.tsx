import { ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "warning" | "danger" | "ai" | "icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", isLoading, children, disabled, ...props },
  ref,
) {
  const { t } = useI18n();
  const variants = {
    primary: "bg-brand-500 text-zani-ink shadow-sm ring-1 ring-brand-600/20 hover:bg-brand-600 active:bg-[var(--zani-brand-strong)]",
    secondary: "border border-zani-border bg-surface-card text-zani-text shadow-sm hover:bg-surface-muted",
    ghost: "text-zani-subtle hover:bg-surface-muted hover:text-zani-text",
    outline: "border border-zani-border bg-surface-card text-zani-text shadow-sm hover:bg-surface-muted",
    warning: "bg-[var(--zani-warning-bold)] text-zani-ink shadow-sm ring-1 ring-[rgba(151,90,22,0.18)] hover:bg-[var(--zani-warning-bold-hover)] active:bg-[var(--zani-warning-bold-pressed)]",
    danger: "bg-zani-danger text-white shadow-sm hover:bg-[var(--zani-danger-hover)] active:bg-[var(--zani-danger-pressed)]",
    ai: "bg-ai-600 text-white shadow-sm hover:bg-ai-700 active:bg-ai-700",
    icon: "border border-zani-border bg-surface-card text-zani-subtle shadow-sm hover:bg-surface-muted hover:text-zani-text",
  };
  const sizes = {
    sm: "min-h-9 rounded-control px-3 py-1.5 text-[13px]",
    md: "min-h-10 rounded-control px-4 py-2 text-sm",
    lg: "min-h-11 rounded-control px-5 py-2.5 text-[15px]",
    icon: "h-10 w-10 rounded-control p-0",
  };

  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex max-w-full items-center justify-center gap-2 whitespace-normal text-center font-semibold transition duration-150 active:scale-[0.99] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--zani-focus-ring)] focus-visible:ring-offset-2",
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
});
