import { Bot, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/Button";
import type { DealRow, Translate } from "../types";
import { money } from "../utils/dealHelpers";
import { DealRiskIndicator } from "./common/DealRiskIndicator";

const AI_DISMISS_KEY = "zani.deals.aiPriority.dismissedUntil";

export function DealsAIPriority({ deal, onAction, t }: { deal: DealRow | null; onAction: (deal: DealRow) => void; t: Translate }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const dismissedUntil = Number(localStorage.getItem(AI_DISMISS_KEY) || 0);
    setHidden(dismissedUntil > Date.now());
  }, [deal?.id]);

  if (!deal || hidden || deal.riskLevel !== "high") return null;

  function dismiss() {
    localStorage.setItem(AI_DISMISS_KEY, String(Date.now() + 60 * 60 * 1000));
    setHidden(true);
  }

  return (
    <section className="mb-4 flex min-h-14 animate-[slideDown_180ms_ease-out] items-center gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-blue-50 px-3 py-2 shadow-[0_8px_24px_rgba(79,70,229,0.10)]">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 text-white">
        <Bot size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-black text-midnight">Приоритет</p>
          <p className="min-w-0 truncate text-sm font-bold text-slate-700">{deal.title}</p>
          <DealRiskIndicator deal={deal} compact />
        </div>
        <p className="truncate text-xs font-semibold text-slate-500">
          {deal.clientEntity?.full_name || t("deals.clientMissing")} · {money(deal.amount, deal.currency)}
        </p>
      </div>
      <Button className="hidden shrink-0 sm:inline-flex" size="sm" onClick={() => onAction(deal)}>
        {t("deals.takeAction")}
      </Button>
      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Скрыть приоритет" onClick={dismiss}>
        <X size={16} />
      </Button>
    </section>
  );
}
