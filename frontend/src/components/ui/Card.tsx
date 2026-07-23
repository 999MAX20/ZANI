import type { ElementType, HTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/cn";

const surfaceVariants = {
  default: "rounded-card border border-zani-border bg-surface-card shadow-card",
  elevated: "rounded-card border border-zani-border bg-surface-warm shadow-panel",
  outlined: "rounded-card border border-zani-border bg-surface-card",
  muted: "rounded-card border border-zani-border bg-surface-muted",
  ai: "zani-ai-surface rounded-card",
  danger: "rounded-card border border-[rgba(194,65,12,0.2)] bg-[var(--zani-danger-soft)] shadow-sm",
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
export const interactiveSurfaceClass = `${surfaceVariants.default} transition hover:border-brand-100 hover:bg-surface-warm hover:shadow-card`;

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
      className={cn(surfaceVariants[variant], surfacePaddings[padding], interactive && "transition hover:border-brand-100 hover:bg-surface-warm hover:shadow-card", className)}
      {...props}
    >
      {children}
    </Component>
  );
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("min-h-12 border-b border-zani-border px-4 py-3", className)}>{children}</div>;
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("p-4", className)}>{children}</div>;
}
