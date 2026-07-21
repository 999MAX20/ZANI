import type { LucideIcon } from "lucide-react";
import { Building2, Globe2, Hand, Instagram, MessageCircle, Phone, Search, Users } from "lucide-react";

import { cn } from "../../../lib/cn";
import type { ClientTableRow, Translate } from "../types";
import { initials, statusMeta } from "../utils";

export function SourceIcon({ source, className }: { source: string | undefined; className?: string }) {
  const icons: Record<string, LucideIcon> = {
    manual: Hand,
    website: Globe2,
    landing: Globe2,
    instagram: Instagram,
    google: Search,
    recommendation: Users,
    coldCall: Phone,
    exhibition: Building2,
    whatsapp: MessageCircle,
    telegram: MessageCircle,
    parser: Search,
    other: Phone,
  };
  const Icon = icons[source || ""] || Phone;
  return <Icon size={15} className={className} />;
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
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  };
  const colors = [
    "bg-blue-100 text-blue-700 ring-blue-200",
    "bg-emerald-100 text-emerald-700 ring-emerald-200",
    "bg-purple-100 text-purple-700 ring-purple-200",
    "bg-orange-100 text-orange-700 ring-orange-200",
    "bg-pink-100 text-pink-700 ring-pink-200",
    "bg-indigo-100 text-indigo-700 ring-indigo-200",
  ];
  const color = colors[name.charCodeAt(0) % colors.length] || colors[0];

  return (
    <div className={cn("grid shrink-0 place-items-center rounded-full font-semibold ring-1", sizes[size], color)}>
      {initials(name)}
    </div>
  );
}

export function ClientStatusBadge({ status, t }: { status: ClientTableRow["status"]; t: Translate }) {
  const meta = statusMeta(status, t);
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold before:h-1.5 before:w-1.5 before:rounded-full", meta.className)}>
      {meta.label}
    </span>
  );
}
