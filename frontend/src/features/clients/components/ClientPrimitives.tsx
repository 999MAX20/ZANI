import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Globe2,
  Hand,
  Instagram,
  MessageCircle,
  Phone,
  Search,
  Users,
} from "lucide-react";

import { cn } from "../../../lib/cn";
import type { ClientTableRow, Translate } from "../types";
import { initials, statusMeta } from "../utils";

export function SourceIcon({
  source,
  className,
}: {
  source: string | undefined;
  className?: string;
}) {
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

export function TagPill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full bg-surface-muted px-2.5 text-[11px] font-semibold text-zani-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ClientAvatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  };

  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-surface-muted font-semibold text-brand-700 ring-1 ring-zani-border",
        sizes[size],
      )}
    >
      {initials(name)}
    </div>
  );
}

export function ClientStatusBadge({
  status,
  t,
}: {
  status: ClientTableRow["status"];
  t: Translate;
}) {
  const meta = statusMeta(status, t);
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold before:h-1.5 before:w-1.5 before:rounded-full",
        meta.className,
      )}
    >
      {meta.label}
    </span>
  );
}
