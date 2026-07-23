import { ReactNode } from "react";
import { Inbox } from "lucide-react";

import { cn } from "../../lib/cn";

export function CrmEmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-card border border-dashed border-zani-border bg-surface-card px-8 py-12 text-center shadow-card", className)}>
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-card bg-surface-muted text-zani-subtle">
        <Inbox size={22} />
      </div>
      <p className="mt-4 text-lg font-bold text-zani-text">{title}</p>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm text-zani-subtle">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
