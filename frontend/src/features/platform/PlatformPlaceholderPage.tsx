import { ArrowRight, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";

import { Card, CardBody } from "../../components/ui/Card";
import { useI18n } from "../../lib/i18n";

type PlatformPlaceholderPageProps = {
  titleKey: string;
  eyebrowKey: string;
  descriptionKey: string;
  statusItems: string[];
};

export function PlatformPlaceholderPage({ titleKey, eyebrowKey, descriptionKey, statusItems }: PlatformPlaceholderPageProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-5">
      <section className="glass-panel rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{t(eyebrowKey)}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-midnight sm:text-5xl">{t(titleKey)}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{t(descriptionKey)}</p>
          </div>
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {t("platform.placeholder.accessLayerActive")}
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
                <h2 className="text-xl font-semibold tracking-tight text-midnight">{t("platform.placeholder.placeholderOnly")}</h2>
                <p className="mt-2 leading-7 text-slate-600">
                  {t("platform.placeholder.placeholderText")}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-6">
            <h2 className="text-xl font-semibold tracking-tight text-midnight">{t("platform.placeholder.readiness")}</h2>
            <div className="mt-4 space-y-3">
              {statusItems.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-500" size={18} />
                  {t(item)}
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
                <h2 className="text-lg font-semibold text-midnight">{t("platform.placeholder.nextRoadmapStep")}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">{t("platform.placeholder.nextRoadmapText")}</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
              {t("platform.placeholder.stageControlled")}
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
    titleKey: "platform.placeholder.overview.title",
    eyebrowKey: "platform.placeholder.overview.eyebrow",
    descriptionKey: "platform.placeholder.overview.description",
    statusItems: ["platform.placeholder.overview.status1", "platform.placeholder.overview.status2", "platform.placeholder.overview.status3"],
  },
  merchants: {
    titleKey: "platform.placeholder.merchants.title",
    eyebrowKey: "platform.placeholder.merchants.eyebrow",
    descriptionKey: "platform.placeholder.merchants.description",
    statusItems: ["platform.placeholder.merchants.status1", "platform.placeholder.merchants.status2", "platform.placeholder.merchants.status3"],
  },
  prospects: {
    titleKey: "platform.placeholder.prospects.title",
    eyebrowKey: "platform.placeholder.prospects.eyebrow",
    descriptionKey: "platform.placeholder.prospects.description",
    statusItems: ["platform.placeholder.prospects.status1", "platform.placeholder.prospects.status2", "platform.placeholder.prospects.status3"],
  },

  landings: {
    titleKey: "platform.placeholder.landings.title",
    eyebrowKey: "platform.placeholder.landings.eyebrow",
    descriptionKey: "platform.placeholder.landings.description",
    statusItems: ["platform.placeholder.landings.status1", "platform.placeholder.landings.status2", "platform.placeholder.landings.status3"],
  },
  outreach: {
    titleKey: "platform.placeholder.outreach.title",
    eyebrowKey: "platform.placeholder.outreach.eyebrow",
    descriptionKey: "platform.placeholder.outreach.description",
    statusItems: ["platform.placeholder.outreach.status1", "platform.placeholder.outreach.status2", "platform.placeholder.outreach.status3"],
  },
  billing: {
    titleKey: "platform.placeholder.billing.title",
    eyebrowKey: "platform.placeholder.billing.eyebrow",
    descriptionKey: "platform.placeholder.billing.description",
    statusItems: ["platform.placeholder.billing.status1", "platform.placeholder.billing.status2", "platform.placeholder.billing.status3"],
  },
  analytics: {
    titleKey: "platform.placeholder.analytics.title",
    eyebrowKey: "platform.placeholder.analytics.eyebrow",
    descriptionKey: "platform.placeholder.analytics.description",
    statusItems: ["platform.placeholder.analytics.status1", "platform.placeholder.analytics.status2", "platform.placeholder.analytics.status3"],
  },
  settings: {
    titleKey: "platform.placeholder.settings.title",
    eyebrowKey: "platform.placeholder.settings.eyebrow",
    descriptionKey: "platform.placeholder.settings.description",
    statusItems: ["platform.placeholder.settings.status1", "platform.placeholder.settings.status2", "platform.placeholder.settings.status3"],
  },
};
