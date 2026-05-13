import { ArrowRight, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";

import { Card, CardBody } from "../../components/ui/Card";

type PlatformPlaceholderPageProps = {
  title: string;
  eyebrow: string;
  description: string;
  statusItems: string[];
};

export function PlatformPlaceholderPage({ title, eyebrow, description, statusItems }: PlatformPlaceholderPageProps) {
  return (
    <div className="space-y-5">
      <section className="glass-panel rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{eyebrow}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-midnight sm:text-5xl">{title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{description}</p>
          </div>
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            Access layer active
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardBody className="p-6">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ai-gradient text-white shadow-glow">
                <ShieldCheck size={23} />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-midnight">Placeholder only</h2>
                <p className="mt-2 leading-7 text-slate-600">
                  Эта страница намеренно не содержит реальной бизнес-логики. На этапе 1.2 мы фиксируем
                  отдельный Platform Admin интерфейс и защищенные routes, не добавляя API merchants,
                  prospects, subscriptions или billing.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-6">
            <h2 className="text-xl font-semibold tracking-tight text-midnight">Readiness</h2>
            <div className="mt-4 space-y-3">
              {statusItems.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-500" size={18} />
                  {item}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Clock3 className="mt-1 text-brand-600" size={21} />
              <div>
                <h2 className="text-lg font-semibold text-midnight">Next roadmap step</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">Реальные platform modules появятся только в следующих изолированных этапах.</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
              Stage controlled
              <ArrowRight size={16} />
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export const platformPages = {
  overview: {
    title: "Platform overview",
    eyebrow: "Stage 1.2",
    description: "Отдельная панель владельцев платформы с защищенным layout. Сейчас это интерфейсная оболочка без реальной операционной логики.",
    statusItems: ["PlatformRoute protects the page", "Merchant sidebar is not rendered here", "Foundation is ready for future modules"],
  },
  merchants: {
    title: "Merchants",
    eyebrow: "Future operations",
    description: "Будущая зона управления мерчантами. На этом этапе реальные merchants API и dashboards не добавляются.",
    statusItems: ["Route exists", "No merchant API added", "Ready for later platform module"],
  },
  prospects: {
    title: "Prospects",
    eyebrow: "Internal tools boundary",
    description: "Будущая зона prospects/internal tools. Parser, scraping и outreach не входят в публичное ядро продукта.",
    statusItems: ["Route exists", "No prospects models added", "Internal tools boundary preserved"],
  },
  billing: {
    title: "Billing",
    eyebrow: "Subscription foundation later",
    description: "Будущая зона тарифов и подписок платформы. Реальная оплата и billing API будут добавлены отдельным этапом.",
    statusItems: ["Route exists", "No payment logic added", "No subscription models added"],
  },
  analytics: {
    title: "Platform analytics",
    eyebrow: "Insights later",
    description: "Будущая аналитика платформы. На этом этапе графики, MRR и operational dashboards намеренно не реализуются.",
    statusItems: ["Route exists", "No charts added", "No analytics API added"],
  },
  settings: {
    title: "Platform settings",
    eyebrow: "Configuration later",
    description: "Будущая зона настроек платформы. Сейчас здесь только защищенный placeholder для следующей итерации.",
    statusItems: ["Route exists", "Access protected", "No product settings changed"],
  },
};
