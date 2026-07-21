import type { ReactNode } from "react";

import { cn } from "../../../lib/cn";

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1", className)}>{children}</span>;
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group/tooltip relative inline-flex">
      {children}
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-30 w-max max-w-72 -translate-x-1/2 rounded-xl bg-midnight px-3 py-2 text-xs font-bold leading-5 text-white opacity-0 shadow-xl transition group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100">
        {label}
      </span>
    </span>
  );
}
