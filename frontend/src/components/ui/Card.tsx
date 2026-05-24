import { cn } from "../../lib/cn";

type CardProps = React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
};

export function Card({ className, children, ...props }: CardProps) {
  return <section className={cn("zani-surface rounded-3xl", className)} {...props}>{children}</section>;
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("border-b border-slate-100/80 px-4 py-4 sm:px-5", className)}>{children}</div>;
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-4 sm:p-5", className)}>{children}</div>;
}
