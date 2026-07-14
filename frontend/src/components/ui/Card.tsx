import type { ElementType, HTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/cn";

const surfaceVariants = {
  default: "rounded-card border border-slate-200 bg-white shadow-card",
  elevated: "rounded-card border border-slate-200 bg-white shadow-card",
  outlined: "rounded-card border border-slate-200 bg-white",
  muted: "rounded-card border border-slate-200 bg-slate-50",
  ai: "zani-ai-surface rounded-xl",
  danger: "rounded-card border border-red-200 bg-red-50 shadow-sm",
};

const surfacePaddings = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

type SurfaceVariant = keyof typeof surfaceVariants;
type SurfacePadding = keyof typeof surfacePaddings;

export const surfaceClass = surfaceVariants.default;
export const mutedSurfaceClass = surfaceVariants.muted;
export const outlinedSurfaceClass = surfaceVariants.outlined;
export const interactiveSurfaceClass = `${surfaceVariants.default} transition hover:border-brand-200 hover:shadow-card`;

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  variant?: "default" | "elevated" | "outlined" | "muted" | "ai" | "danger";
  padding?: SurfacePadding;
};

export function Card({ className, children, variant = "default", padding = "none", ...props }: CardProps) {
  return <section className={cn(surfaceVariants[variant], surfacePaddings[padding], className)} {...props}>{children}</section>;
}

type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  children: ReactNode;
  href?: string;
  interactive?: boolean;
  to?: string;
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
};

export function Surface({ as: Component = "div", className, children, interactive = false, variant = "default", padding = "md", ...props }: SurfaceProps) {
  return (
    <Component
      className={cn(surfaceVariants[variant], surfacePaddings[padding], interactive && "transition hover:border-brand-200 hover:shadow-card", className)}
      {...props}
    >
      {children}
    </Component>
  );
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("border-b border-slate-200 px-4 py-3", className)}>{children}</div>;
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("p-4", className)}>{children}</div>;
}
