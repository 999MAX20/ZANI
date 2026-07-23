import { InputHTMLAttributes, ReactNode, forwardRef } from "react";

import { cn } from "../../lib/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, leftIcon, rightIcon, className, ...props }, ref) => (
  <label className="block">
    {label ? <span className="mb-2 block text-sm font-semibold text-zani-subtle">{label}</span> : null}
    <span className="relative block">
      {leftIcon ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zani-faint">{leftIcon}</span> : null}
      <input
        ref={ref}
        className={cn(
          "zani-focus-ring min-h-11 w-full rounded-control border border-zani-border bg-surface-card px-3 text-sm font-medium text-zani-text shadow-sm placeholder:text-zani-faint",
          "hover:border-brand-100 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-zani-faint read-only:bg-surface-warm read-only:text-zani-subtle",
          leftIcon && "pl-10",
          rightIcon && "pr-10",
          error && "border-zani-danger focus-visible:border-zani-danger focus-visible:ring-[rgba(194,65,12,0.18)]",
          className,
        )}
        {...props}
      />
      {rightIcon ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zani-faint">{rightIcon}</span> : null}
    </span>
    {error ? <span className="mt-1.5 block text-xs font-semibold text-zani-danger">{error}</span> : null}
  </label>
));

Input.displayName = "Input";
