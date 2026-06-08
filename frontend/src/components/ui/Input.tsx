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
    {label ? <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span> : null}
    <span className="relative block">
      {leftIcon ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{leftIcon}</span> : null}
      <input
        ref={ref}
        className={cn(
          "zani-focus-ring h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-midnight placeholder:text-slate-400",
          leftIcon && "pl-10",
          rightIcon && "pr-10",
          error && "border-red-300 focus:border-red-400 focus:ring-red-100",
          className,
        )}
        {...props}
      />
      {rightIcon ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{rightIcon}</span> : null}
    </span>
    {error ? <span className="mt-1 block text-sm text-red-600">{error}</span> : null}
  </label>
));

Input.displayName = "Input";
