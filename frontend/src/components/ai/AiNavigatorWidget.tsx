import { Bot, ChevronUp, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { useI18n } from "../../lib/i18n";

export type AiNavigatorSignal = {
  key: string;
  title: string;
  text: string;
  href?: string;
  tone?: "good" | "warning" | "danger" | "info";
};

const toneClasses: Record<NonNullable<AiNavigatorSignal["tone"]>, string> = {
  good: "bg-emerald-500",
  warning: "bg-amber-400",
  danger: "bg-red-500",
  info: "bg-brand-500",
};

export function AiNavigatorWidget({ signals }: { signals: AiNavigatorSignal[] }) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const visibleSignals = signals.length ? signals.slice(0, 4) : [{
    key: "missing",
    title: t("dashboard.aiBrief.missingTitle"),
    text: t("dashboard.aiBrief.missingText"),
    href: "/dashboard/integrations",
    tone: "info" as const,
  }];
  const primarySignal = visibleSignals[0];

  return (
    <div className="w-full">
      {isOpen ? (
        <div className="mb-3 rounded-[1.4rem] border border-white/80 bg-white/95 p-4 shadow-premium backdrop-blur-xl">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-ai-gradient text-white shadow-glow">
                <Bot size={17} />
              </span>
              <div>
                <p className="text-sm font-black text-midnight">{t("dashboard.aiNavigator")}</p>
                <p className="text-xs font-semibold text-slate-500">{t("dashboard.aiNavigatorScope")}</p>
              </div>
            </div>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-midnight"
              onClick={() => setIsOpen(false)}
              aria-label={t("common.close")}
            >
              <X size={17} />
            </button>
          </div>
          <div className="space-y-2">
            {visibleSignals.map((signal) => {
              const content = (
                <div className="flex gap-3 rounded-2xl bg-slate-50 p-3 transition hover:bg-white hover:shadow-soft">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${toneClasses[signal.tone || "info"]}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-midnight">{signal.title}</span>
                    <span className="mt-0.5 block text-xs font-semibold leading-5 text-slate-500">{signal.text}</span>
                  </span>
                </div>
              );

              return signal.href ? <Link key={signal.key} to={signal.href}>{content}</Link> : <div key={signal.key}>{content}</div>;
            })}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-[1.35rem] border border-white/80 bg-white/92 px-4 py-3 text-left shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white hover:shadow-premium"
        onClick={() => setIsOpen((value) => !value)}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-ai-gradient text-white shadow-glow">
            <Sparkles size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-black uppercase tracking-[0.14em] text-brand-700">{t("dashboard.aiNavigator")}</span>
            <span className="block truncate text-sm font-black text-midnight">{primarySignal.title}</span>
          </span>
        </span>
        <ChevronUp className={`shrink-0 text-slate-500 transition ${isOpen ? "" : "rotate-180"}`} size={18} />
      </button>
    </div>
  );
}
