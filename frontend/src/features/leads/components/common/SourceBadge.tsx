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
    whatsapp: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    telegram: "bg-sky-50 text-sky-700 ring-sky-100",
    instagram: "bg-pink-50 text-pink-700 ring-pink-100",
    website: "bg-slate-50 text-slate-700 ring-slate-200",
    landing: "bg-violet-50 text-violet-700 ring-violet-100",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold ring-1", sourceTone[source] || "bg-slate-50 text-slate-600 ring-slate-200")}>
      <SourceIcon source={source} />
      {getSourceLabel(source, t)}
    </span>
  );
}
