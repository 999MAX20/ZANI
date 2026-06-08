import { ArrowRight, MessageCircle, Phone, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/Button";
import type { Lead } from "../../../types";
import type { Translate } from "../types";

const AI_PRIORITY_DISMISSED_KEY = "zani_leads_ai_priority_dismissed_until";

/**
 * AI баннер приоритетного лида
 * Соответствует дизайн-референсам:
 * - Компактный дизайн (min-h-[60px] вместо min-h-[72px])
 * - Уменьшенные padding и шрифты
 * - Unified layout для mobile/desktop
 */
export function AIPriorityBanner({
  priorityLead,
  leadName,
  risk,
  onCall,
  onWhatsApp,
  onOpen,
  t,
}: {
  priorityLead: Lead | null;
  leadName: string;
  risk: number;
  onCall: () => void;
  onWhatsApp: () => void;
  onOpen: () => void;
  t: Translate;
}) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const until = Number(window.localStorage.getItem(AI_PRIORITY_DISMISSED_KEY) || 0);
    setDismissed(until > Date.now());
  }, [priorityLead?.id]);

  if (!priorityLead || dismissed) return null;

  function dismiss() {
    window.localStorage.setItem(AI_PRIORITY_DISMISSED_KEY, String(Date.now() + 60 * 60 * 1000));
    setDismissed(true);
  }

  return (
    <section className="animate-slide-down flex min-h-[60px] flex-col gap-2 border-b border-orange-200 bg-gradient-to-r from-orange-50 to-red-50 px-4 py-2.5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="text-xl leading-none">🔥</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900 sm:text-base">{t("leads.priorityLead", { lead: leadName })}</p>
          <p className="mt-0.5 text-xs text-gray-600 sm:text-sm">
            {t("leads.priorityCallFast")}{" "}
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 sm:text-xs">{risk}%</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="secondary" size="sm" className="h-8 rounded-lg border-gray-300 bg-white px-2.5 text-xs hover:bg-gray-50 sm:px-3" onClick={onCall}>
          <Phone size={14} />
          <span className="hidden sm:inline">{t("leads.call")}</span>
        </Button>
        <Button size="sm" className="h-8 rounded-lg bg-green-600 px-2.5 text-xs text-white hover:bg-green-700 sm:px-3" onClick={onWhatsApp}>
          <MessageCircle size={14} />
          <span className="hidden sm:inline">WhatsApp</span>
        </Button>
        <Button variant="ghost" size="sm" className="h-8 rounded-lg px-2.5 text-xs text-blue-600 hover:bg-blue-50 sm:px-3" onClick={onOpen}>
          <span className="hidden sm:inline">{t("leads.moreDetails")}</span>
          <ArrowRight size={14} className="sm:ml-1" />
        </Button>
        <button
          type="button"
          className="grid h-7 w-7 place-items-center rounded-lg text-gray-400 hover:bg-white/70 hover:text-gray-700"
          onClick={dismiss}
          aria-label={t("common.close")}
        >
          <X size={14} />
        </button>
      </div>
    </section>
  );
}
