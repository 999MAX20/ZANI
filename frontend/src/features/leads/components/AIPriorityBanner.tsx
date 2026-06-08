import { ArrowRight, MessageCircle, Phone, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/Button";
import type { Lead } from "../../../types";
import type { Translate } from "../types";

const AI_PRIORITY_DISMISSED_KEY = "zani_leads_ai_priority_dismissed_until";

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
    <section className="animate-slide-down flex min-h-[72px] flex-col gap-3 border-b border-orange-200 bg-gradient-to-r from-orange-50 to-red-50 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="text-2xl leading-none">🔥</div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{t("leads.priorityLead", { lead: leadName })}</p>
          <p className="mt-1 text-sm text-gray-600">
            {t("leads.priorityCallFast")} <span className="rounded bg-red-100 px-2 py-0.5 font-bold text-red-700">{risk}%</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" className="rounded-lg border-gray-300 bg-white hover:bg-gray-50" onClick={onCall}>
          <Phone size={16} />
          {t("leads.call")}
        </Button>
        <Button size="sm" className="rounded-lg bg-green-600 text-white hover:bg-green-700" onClick={onWhatsApp}>
          <MessageCircle size={16} />
          WhatsApp
        </Button>
        <Button variant="ghost" size="sm" className="rounded-lg text-blue-600 hover:bg-blue-50" onClick={onOpen}>
          {t("leads.moreDetails")}
          <ArrowRight size={16} />
        </Button>
        <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-white/70 hover:text-gray-700" onClick={dismiss} aria-label={t("common.close")}>
          <X size={16} />
        </button>
      </div>
    </section>
  );
}
