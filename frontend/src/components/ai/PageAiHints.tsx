import { Sparkles } from "lucide-react";

import { useI18n } from "../../lib/i18n";
import { Card, CardBody } from "../ui/Card";
import { AiInsightCard, type AiInsightSeverity } from "./AiInsightCard";
import type { LucideIcon } from "lucide-react";

export type PageAiHint = {
  id: string;
  title: string;
  description: string;
  actionLabel?: string;
  href?: string;
  icon: LucideIcon;
  severity?: AiInsightSeverity;
};

type PageAiHintsProps = {
  items: PageAiHint[];
  className?: string;
};

export function PageAiHints({ items, className }: PageAiHintsProps) {
  const { t } = useI18n();

  if (!items.length) return null;

  return (
    <Card className={className}>
      <CardBody>
        <div className="mb-4 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-ai-gradient text-white shadow-glow">
            <Sparkles size={17} />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-ai-700">{t("aiHints.eyebrow")}</p>
            <h2 className="text-lg font-black text-midnight">{t("aiHints.title")}</h2>
          </div>
        </div>
        <div className="grid gap-3">
          {items.map((item) => (
            <AiInsightCard
              key={item.id}
              title={item.title}
              description={item.description}
              actionLabel={item.actionLabel}
              href={item.href}
              icon={item.icon}
              severity={item.severity}
              compact
              className="shadow-none"
            />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
