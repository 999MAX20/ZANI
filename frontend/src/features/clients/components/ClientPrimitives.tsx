import { Globe2, MessageCircle, Phone } from "lucide-react";

import { cn } from "../../../lib/cn";
import type { ClientTableRow } from "../types";
import { initials, statusMeta } from "../utils";

export function SourceIcon({ source }: { source: string | undefined }) {
  if (source === "whatsapp" || source === "telegram" || source === "instagram") return <MessageCircle size={15} />;
  if (source === "website" || source === "landing") return <Globe2 size={15} />;
  return <Phone size={15} />;
}

export function TagPill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full bg-slate-100 px-2.5 text-[11px] font-semibold text-slate-600", className)}>
      {children}
    </span>
  );
}

export function ClientAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-9 w-9 text-xs",
    lg: "h-12 w-12 text-sm",
  };

  return (
    <div className={cn("grid shrink-0 place-items-center rounded-full bg-blue-50 font-bold text-blue-700 ring-1 ring-blue-100", sizes[size])}>
      {initials(name)}
    </div>
  );
}

export function ClientStatusBadge({ status }: { status: ClientTableRow["status"] }) {
  const meta = statusMeta(status);
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold before:h-1.5 before:w-1.5 before:rounded-full", meta.className)}>
      {meta.label}
    </span>
  );
}
