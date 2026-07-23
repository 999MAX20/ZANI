import { ArrowLeft } from "lucide-react";
import type {
  AnchorHTMLAttributes,
  ComponentProps,
  ElementType,
  ReactNode,
} from "react";

import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../ui/StateViews";
import { StatusBadge } from "../ui/StatusBadge";
import { CrmWorkspacePage } from "./CrmWorkspacePage";

export function EntityWorkspaceRoot({ children }: { children: ReactNode }) {
  return (
    <CrmWorkspacePage
      className="h-auto min-h-[calc(100vh-5.5rem)] bg-surface"
      maxWidthClassName="max-w-[1440px]"
    >
      <div className="space-y-4 pb-6">{children}</div>
    </CrmWorkspacePage>
  );
}

export function EntityWorkspaceHeader({
  backLabel,
  onBack,
  avatar,
  title,
  subtitle,
  status,
  actions,
}: {
  backLabel: string;
  onBack: () => void;
  avatar: ReactNode;
  title: string;
  subtitle?: string;
  status?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="rounded-card border border-zani-border bg-surface-warm p-4 shadow-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            className="zani-focus-ring mb-3 inline-flex items-center gap-2 rounded-control text-sm font-semibold text-zani-subtle transition hover:text-zani-text"
            onClick={onBack}
          >
            <ArrowLeft size={16} />
            {backLabel}
          </button>
          <div className="flex min-w-0 items-center gap-3">
            {avatar}
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="truncate text-[22px] font-semibold leading-[30px] text-zani-text">
                  {title}
                </h1>
                {status ? <StatusBadge status={status} /> : null}
              </div>
              {subtitle ? (
                <p className="mt-1 truncate text-sm font-semibold text-zani-subtle">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function EntityWorkspaceAvatar({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-control bg-brand-50 text-base font-semibold text-brand-700 ring-1 ring-brand-100">
      {children}
    </div>
  );
}

export function EntityWorkspaceMetrics({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{children}</div>
  );
}

export function EntityWorkspaceMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-card border border-zani-border bg-surface-card px-4 py-3 shadow-card">
      <p className="text-xs font-semibold text-zani-faint">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold tabular-nums text-zani-text">
        {value}
      </p>
    </div>
  );
}

export function EntityWorkspaceBody({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      {children}
    </div>
  );
}

export function EntityWorkspaceAside({ children }: { children: ReactNode }) {
  return <aside className="space-y-4">{children}</aside>;
}

export function EntityWorkspaceMain({ children }: { children: ReactNode }) {
  return <main className="grid min-w-0 gap-4 lg:grid-cols-2">{children}</main>;
}

export function EntityWorkspaceSection({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: ElementType;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-card border border-zani-border bg-surface-card shadow-card",
        className,
      )}
    >
      <div className="flex min-h-12 items-center gap-2 border-b border-zani-border px-4">
        <Icon size={17} className="text-zani-faint" />
        <h2 className="text-sm font-semibold text-zani-text">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function EntityWorkspaceLinkButton({
  children,
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cn(
        "zani-focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-control border border-zani-border bg-surface-card px-4 py-2 text-sm font-semibold text-zani-text shadow-sm transition duration-150 hover:border-brand-100 hover:bg-surface-warm",
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
}

export function EntitySecondaryButton({
  children,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button type="button" variant="secondary" {...props}>
      {children}
    </Button>
  );
}

export function EntityWorkspaceLoadingState({ label }: { label?: string }) {
  return (
    <CrmWorkspacePage>
      <LoadingState label={label} />
    </CrmWorkspacePage>
  );
}

export function EntityWorkspaceErrorState({ message }: { message: string }) {
  return (
    <CrmWorkspacePage>
      <ErrorState message={message} />
    </CrmWorkspacePage>
  );
}

export function EntityWorkspaceEmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <CrmWorkspacePage>
      <EmptyState title={title} description={description} />
    </CrmWorkspacePage>
  );
}
