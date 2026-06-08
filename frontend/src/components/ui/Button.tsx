import { ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger" | "ai";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
};

export function Button({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }: ButtonProps) {
  const { t } = useI18n();
  const variants = {
    primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700",
    secondary: "border border-slate-200 bg-white text-midnight shadow-sm hover:border-slate-300 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-midnight",
    outline: "border border-brand-600 bg-white text-brand-700 shadow-sm hover:bg-brand-50",
    danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
    ai: "bg-primary-gradient text-white shadow-glow hover:brightness-105",
  };
  const sizes = {
    sm: "min-h-9 rounded-lg px-3 py-1.5 text-xs",
    md: "min-h-10 rounded-lg px-4 py-2 text-sm",
    lg: "min-h-12 rounded-lg px-5 py-3 text-base",
    icon: "zani-touch-target rounded-lg p-0",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
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
