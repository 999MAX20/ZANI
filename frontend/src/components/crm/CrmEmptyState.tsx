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
    <div className={cn("rounded-card border border-dashed border-slate-200 bg-white px-8 py-12 text-center", className)}>
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">
        <Inbox size={22} />
      </div>
      <p className="mt-4 text-lg font-bold text-slate-900">{title}</p>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

