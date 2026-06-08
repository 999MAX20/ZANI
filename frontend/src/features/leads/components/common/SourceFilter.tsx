import { Globe2, Instagram, MessageCircle, Send, Tag } from "lucide-react";

import { cn } from "../../../../lib/cn";
import type { Translate } from "../../types";

function SourceIcon({ source }: { source: string }) {
  if (source === "whatsapp") return <MessageCircle size={16} />;
  if (source === "telegram") return <Send size={16} />;
  if (source === "instagram") return <Instagram size={16} />;
  if (source === "website" || source === "landing") return <Globe2 size={16} />;
  return <Tag size={16} />;
}

export function SourceFilter({
  source,
  active,
  onClick,
  t,
}: {
  source: string;
  active: boolean;
  onClick: () => void;
  t: Translate;
}) {
  return (
    <button
      type="button"
      className={cn(
        "grid h-8 w-8 place-items-center rounded-lg border border-gray-200 bg-white transition focus-visible-ring",
        active ? "opacity-100 ring-2 ring-blue-500" : "opacity-50 hover:opacity-100",
      )}
      onClick={onClick}
      title={t(`leads.source${source[0].toUpperCase()}${source.slice(1)}`)}
      aria-label={source}
    >
      <SourceIcon source={source} />
    </button>
  );
}
