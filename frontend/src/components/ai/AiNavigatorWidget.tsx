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
  good: "bg-zani-success",
  warning: "bg-zani-warning",
  danger: "bg-zani-danger",
  info: "bg-brand-500",
};

export function AiNavigatorWidget({ signals }: { signals: AiNavigatorSignal[] }) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const visibleSignals = signals.length ? signals.slice(0, 4) : [{
    key: "missing",
    title: t("dashboard.aiBrief.missingTitle"),
    text: t("dashboard.aiBrief.missingText"),
    href: "/app/integrations",
    tone: "info" as const,
  }];
  const primarySignal = visibleSignals[0];

  return (
    <div className="w-full">
      {isOpen ? (
        <div className="mb-3 rounded-card border border-ai-100 bg-ai-50 p-4 shadow-card">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-control bg-ai-600 text-white shadow-soft">
                <Bot size={17} />
              </span>
              <div>
                <p className="text-sm font-semibold text-zani-ink">{t("dashboard.aiNavigator")}</p>
                <p className="text-xs font-semibold text-zani-subtle">{t("dashboard.aiNavigatorScope")}</p>
              </div>
            </div>
            <button
              type="button"
              className="zani-focus-ring grid h-9 w-9 place-items-center rounded-control bg-surface-card text-zani-muted transition hover:bg-surface-muted hover:text-zani-text"
              onClick={() => setIsOpen(false)}
              aria-label={t("common.close")}
            >
              <X size={17} />
            </button>
          </div>
          <div className="space-y-2">
            {visibleSignals.map((signal) => {
              const content = (
                <div className="flex gap-3 rounded-card bg-surface-card p-3 ring-1 ring-ai-100 transition hover:bg-surface-warm">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${toneClasses[signal.tone || "info"]}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-zani-ink">{signal.title}</span>
                    <span className="mt-0.5 block text-xs font-semibold leading-5 text-zani-subtle">{signal.text}</span>
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
        className="zani-focus-ring flex w-full items-center justify-between gap-3 rounded-card border border-ai-100 bg-ai-50 px-4 py-3 text-left shadow-soft transition hover:bg-surface-card"
        onClick={() => setIsOpen((value) => !value)}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-ai-600 text-white shadow-soft">
            <Sparkles size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-ai-700">{t("dashboard.aiNavigator")}</span>
            <span className="block truncate text-sm font-semibold text-zani-ink">{primarySignal.title}</span>
          </span>
        </span>
        <ChevronUp className={`shrink-0 text-zani-muted transition ${isOpen ? "" : "rotate-180"}`} size={18} />
      </button>
    </div>
  );
}
