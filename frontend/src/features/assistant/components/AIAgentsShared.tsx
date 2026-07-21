import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bot, CheckCircle2, Plus, Sparkles } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardBody } from "../../../components/ui/Card";
import { useI18n } from "../../../lib/i18n";
import { cn } from "../../../lib/cn";
import type { OnboardingStep } from "../aiAgentsTypes";
export function EmptyAgentsState({ onCreate }: { onCreate: () => void }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardBody className="flex flex-col items-center justify-center py-16 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white">
          <Bot size={24} />
        </div>
        <h3 className="mt-4 text-2xl font-black text-midnight">{t("aiAgents.emptyAgentsTitle")}</h3>
        <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500">
          {t("aiAgents.emptyAgentsText")}
        </p>
        <Button className="mt-5" type="button" onClick={onCreate}>
          <Plus size={16} /> {t("aiAgents.createAgent")}
        </Button>
      </CardBody>
    </Card>
  );
}

export function HelpCard({ title, text, recommendation }: { title: string; text: string; recommendation: string }) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-brand-700">
          <Sparkles size={18} />
        </div>
        <div>
          <h3 className="font-black text-midnight">{title}</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{text}</p>
          <p className="mt-2 text-sm font-black leading-6 text-brand-800">{recommendation}</p>
        </div>
      </div>
    </div>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{children}</p>;
}

export function OnboardingProgress({
  steps,
  compact = false,
}: {
  steps: Array<{ done: boolean; title: string; text: string; href: string }>;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const doneCount = steps.filter((step) => step.done).length;
  const progress = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white p-4", compact ? "mt-5" : "shadow-sm")}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">{t("aiAgents.firstLaunch")}</p>
          <h3 className="mt-1 font-black text-midnight">{t("aiAgents.firstLaunchTitle")}</h3>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-black text-brand-700">{doneCount}/{steps.length}</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-4 space-y-2">
        {steps.map((step) => (
          <Link
            key={step.title}
            to={step.href}
            className="flex gap-3 rounded-xl p-2 transition hover:bg-slate-50"
          >
            <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-white", step.done ? "bg-emerald-500" : "bg-slate-300")}>
              <CheckCircle2 size={14} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black text-midnight">{step.title}</span>
              {!compact ? <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{step.text}</span> : null}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
