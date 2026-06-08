import { CalendarClock, CircleDollarSign, MessageSquareText, RotateCcw } from "lucide-react";

import { formatDateTime } from "../../../../lib/format";
import type { ActivityEvent } from "../../../../types";

function iconFor(type: string) {
  if (type.toLowerCase().includes("message")) return MessageSquareText;
  if (type.toLowerCase().includes("amount")) return CircleDollarSign;
  if (type.toLowerCase().includes("stage")) return RotateCcw;
  return CalendarClock;
}

export function DealTimeline({ events, emptyText }: { events: ActivityEvent[]; emptyText: string }) {
  if (!events.length) return <p className="text-sm font-semibold text-slate-500">{emptyText}</p>;
  return (
    <div className="space-y-3">
      {events.map((event) => {
        const Icon = iconFor(event.event_type);
        return (
          <div key={event.id} className="flex gap-3 rounded-xl bg-slate-50 p-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-blue-600">
              <Icon size={16} />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-midnight">{event.text || event.event_type}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">{formatDateTime(event.created_at)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
