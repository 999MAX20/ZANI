import { Globe2, Instagram, MessageCircle, Send, Tag } from "lucide-react";

import { cn } from "../../../../lib/cn";
import type { Translate } from "../../types";
import { getSourceLabel } from "../../utils/leadFormat";

function SourceIcon({ source }: { source: string }) {
  if (source === "whatsapp") return <MessageCircle size={14} />;
  if (source === "telegram") return <Send size={14} />;
  if (source === "instagram") return <Instagram size={14} />;
  if (source === "website" || source === "landing") return <Globe2 size={14} />;
  return <Tag size={14} />;
}

export function SourceBadge({ source, t }: { source: string; t: Translate }) {
  const sourceTone: Record<string, string> = {
    whatsapp:
      "bg-[var(--zani-success-soft)] text-zani-success ring-[rgba(21,128,61,0.18)]",
    telegram:
      "bg-[var(--zani-info-soft)] text-zani-info ring-[rgba(14,116,144,0.18)]",
    instagram: "bg-ai-50 text-ai-700 ring-ai-100",
    website: "bg-surface-muted text-zani-muted ring-zani-border",
    landing: "bg-brand-50 text-brand-700 ring-brand-100",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold ring-1",
        sourceTone[source] ||
          "bg-surface-muted text-zani-muted ring-zani-border",
      )}
    >
      <SourceIcon source={source} />
      {getSourceLabel(source, t)}
    </span>
  );
}
