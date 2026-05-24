import { ArrowRight, Bot, CalendarCheck, CheckCircle2, MessageSquareText, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { billingApi } from "../../api/billing";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useI18n } from "../../lib/i18n";

const productCards = [
  { titleKey: "public.home.cardCrmTitle", textKey: "public.home.cardCrmText", icon: Users },
  { titleKey: "public.home.cardBotsTitle", textKey: "public.home.cardBotsText", icon: Bot },
  { titleKey: "public.home.cardBookingTitle", textKey: "public.home.cardBookingText", icon: CalendarCheck },
];

function Hero({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  const { t } = useI18n();
  const cockpitItems = [
    [t("public.home.cockpitNewLeads"), "12", t("public.home.cockpitNeedsAttention")],
    [t("public.home.cockpitBookings"), "8", t("public.home.cockpitConfirmed")],
    [t("public.home.cockpitClients"), "248", t("public.home.cockpitActiveBase")],
  ];

  return (
    <section className="px-3 pb-8 pt-6 sm:px-4 sm:pb-10 sm:pt-16">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-8">
        <div>
          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3 py-2 text-xs font-bold text-brand-700 shadow-soft backdrop-blur-xl sm:px-4 sm:text-sm">
            <Sparkles size={16} />
            <span className="truncate">{eyebrow}</span>
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.08] tracking-tight text-midnight sm:mt-6 sm:text-6xl sm:leading-[1.02] lg:text-7xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:mt-6 sm:text-lg sm:leading-8">{description}</p>
          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
            <Link to="/login">
              <Button variant="ai" className="w-full rounded-full px-6 sm:w-auto">
                {t("public.openCrm")}
                <ArrowRight size={18} />
              </Button>
            </Link>
            <Link to="/contacts">
              <Button variant="secondary" className="w-full rounded-full px-6 sm:w-auto">
                {t("public.contact")}
              </Button>
            </Link>
          </div>
        </div>
        <div className="glass-panel rounded-[1.6rem] p-3 shadow-premium sm:rounded-[2rem] sm:p-5">
          <div className="rounded-[1.25rem] bg-midnight p-4 text-white sm:rounded-[1.5rem] sm:p-5">
            <p className="text-sm font-semibold text-white/55">{t("public.home.cockpit")}</p>
            <div className="mt-4 grid gap-2 sm:mt-5 sm:gap-3">
              {cockpitItems.map(([label, value, hint]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/7 p-3 sm:rounded-3xl sm:p-4">
                  <p className="text-sm text-white/55">{label}</p>
                  <p className="mt-2 text-3xl font-semibold sm:text-4xl">{value}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{hint}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PublicHomePage() {
  const { t } = useI18n();

  return (
    <>
      <Hero
        eyebrow={t("public.home.eyebrow")}
        title={t("public.home.title")}
        description={t("public.home.description")}
      />
      <section className="px-4 pb-16">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {productCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.titleKey}>
                <CardBody className="p-6">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ai-gradient text-white shadow-glow">
                    <Icon size={22} />
                  </div>
                  <h2 className="mt-5 text-xl font-semibold text-midnight">{t(card.titleKey)}</h2>
                  <p className="mt-3 leading-7 text-slate-600">{t(card.textKey)}</p>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </section>
    </>
  );
}

export function PublicCrmPage() {
  const { t } = useI18n();

  return (
    <PublicContentPage
      eyebrow={t("public.crm.eyebrow")}
      title={t("public.crm.title")}
      description={t("public.crm.description")}
      bullets={["public.crm.bullet1", "public.crm.bullet2", "public.crm.bullet3", "public.crm.bullet4"]}
    />
  );
}

export function PublicBotsPage() {
  const { t } = useI18n();

  return (
    <PublicContentPage
      eyebrow={t("public.bots.eyebrow")}
      title={t("public.bots.title")}
      description={t("public.bots.description")}
      bullets={["public.bots.bullet1", "public.bots.bullet2", "public.bots.bullet3", "public.bots.bullet4"]}
    />
  );
}

export function PublicContactsPage() {
  const { t } = useI18n();

  return (
    <PublicContentPage
      eyebrow={t("public.contacts.eyebrow")}
      title={t("public.contacts.title")}
      description={t("public.contacts.description")}
      bullets={["public.contacts.bullet1", "public.contacts.bullet2", "public.contacts.bullet3", "public.contacts.bullet4"]}
    />
  );
}

export function PublicPricingPage() {
  const { t, language } = useI18n();
  const plans = useQuery({ queryKey: ["billing-plans"], queryFn: billingApi.plans });
  const locale = language === "kk" ? "kk-KZ" : language === "en" ? "en-US" : "ru-RU";

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{t("public.pricing.eyebrow")}</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-midnight">{t("public.pricing.title")}</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">{t("public.pricing.description")}</p>
        </div>
        {plans.isLoading ? <div className="mt-8"><LoadingState label={t("public.pricing.loading")} /></div> : null}
        {plans.error ? <div className="mt-8"><ErrorState message={t("public.pricing.error")} /></div> : null}
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {(plans.data || []).map((plan) => (
            <Card key={plan.name}>
              <CardBody className="p-6">
                <h2 className="text-2xl font-semibold text-midnight">{plan.name}</h2>
                <p className="mt-2 text-4xl font-semibold tracking-tight">{formatPrice(plan.monthly_price, locale, t("public.pricing.monthSuffix"))}</p>
                <p className="mt-3 min-h-14 leading-7 text-slate-600">{plan.description}</p>
                <div className="mt-5 space-y-3">
                  {(plan.features_json.features || []).map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <CheckCircle2 size={17} className="text-emerald-500" />
                      {feature}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatPrice(value: string, locale: string, monthSuffix: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (numeric === 0) return "0 ₸";
  return `${numeric.toLocaleString(locale)} ₸${monthSuffix}`;
}

function PublicContentPage({ eyebrow, title, description, bullets }: { eyebrow: string; title: string; description: string; bullets: string[] }) {
  const { t } = useI18n();

  return (
    <section className="px-4 py-12">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{eyebrow}</p>
          <h1 className="mt-3 text-5xl font-semibold leading-tight tracking-tight text-midnight">{title}</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">{description}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/login">
              <Button variant="ai" className="rounded-full">
                {t("public.login")}
                <ArrowRight size={17} />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="secondary" className="rounded-full">
                {t("public.viewPricing")}
              </Button>
            </Link>
          </div>
        </div>
        <Card>
          <CardBody className="p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-midnight text-white">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-midnight">{t("public.readyTitle")}</h2>
                <p className="text-sm text-slate-500">{t("public.readyText")}</p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {bullets.map((bullet) => (
                <div key={bullet} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <MessageSquareText size={17} className="mt-0.5 text-brand-600" />
                  {t(bullet)}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </section>
  );
}
