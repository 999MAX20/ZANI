import { useState } from "react";

import { cn } from "../../../lib/cn";
import { formatDateTime } from "../../../lib/format";
import type { Client, Lead, Service } from "../../../types";
import { statusClass, type Translate } from "../types";
import { getSourceLabel, getStatusLabel, initials, nextAction, Pill } from "../utils/leadFormat";

export function LeadQueueItem({
  lead,
  client,
  service,
  selected,
  onClick,
  onSwipeLeft,
  onSwipeRight,
  onLongPress,
  t,
}: {
  lead: Lead;
  client?: Client;
  service?: Service;
  selected: boolean;
  onClick: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onLongPress: (event: React.TouchEvent | React.MouseEvent) => void;
  t: Translate;
}) {
  const title = client?.full_name || t("leads.leadFallback", { id: lead.id });
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<number | null>(null);

  function clearLongPress() {
    if (longPressTimer) window.clearTimeout(longPressTimer);
    setLongPressTimer(null);
  }

  return (
    <button
      type="button"
      className={cn(
        "group relative w-full touch-pan-y overflow-hidden border-b border-slate-100 px-5 py-4 text-left transition hover:bg-slate-50",
        selected ? "bg-brand-50/80" : "bg-white",
      )}
      onClick={onClick}
      onContextMenu={(event) => {
        event.preventDefault();
        onLongPress(event);
      }}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        setTouchStart({ x: touch.clientX, y: touch.clientY });
        const timer = window.setTimeout(() => onLongPress(event), 520);
        setLongPressTimer(timer);
      }}
      onTouchMove={(event) => {
        if (!touchStart) return;
        const touch = event.touches[0];
        if (Math.abs(touch.clientX - touchStart.x) > 12 || Math.abs(touch.clientY - touchStart.y) > 12) clearLongPress();
      }}
      onTouchEnd={(event) => {
        clearLongPress();
        if (!touchStart) return;
        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - touchStart.x;
        const deltaY = Math.abs(touch.clientY - touchStart.y);
        setTouchStart(null);
        if (deltaY > 45 || Math.abs(deltaX) < 72) return;
        if (deltaX < 0) onSwipeLeft();
        else onSwipeRight();
      }}
      onTouchCancel={() => {
        clearLongPress();
        setTouchStart(null);
      }}
    >
      <span className="pointer-events-none absolute inset-y-0 left-0 hidden w-1 bg-brand-500 group-active:block" />
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-sm font-black text-brand-700 ring-1 ring-slate-200">
          {initials(title)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-black text-midnight">{title}</p>
            <span className="shrink-0 text-xs font-bold text-slate-400">{formatDateTime(lead.created_at)}</span>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-slate-500">
            {client?.phone || t("leads.noPhoneLower")} · {service?.name || getSourceLabel(lead.source, t)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill className={statusClass[lead.status]}>{getStatusLabel(lead.status, t)}</Pill>
            <span className="text-xs font-bold text-slate-400">{nextAction(lead, t)}</span>
          </div>
          <p className="mt-2 text-[11px] font-bold text-slate-400 lg:hidden">{t("leads.mobileSwipeHint")}</p>
        </div>
      </div>
    </button>
  );
}
