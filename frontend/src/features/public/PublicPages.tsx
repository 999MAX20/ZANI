import { ArrowRight, Bot, CalendarCheck, CheckCircle2, MessageSquareText, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { billingApi } from "../../api/billing";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";

const productCards = [
  { title: "Merchant CRM", text: "Заявки, клиенты, сделки, записи и задачи в одном легком кабинете.", icon: Users },
  { title: "AI bots", text: "Будущие боты для сайта, Telegram, WhatsApp и Instagram без перегруза команды.", icon: Bot },
  { title: "Smart booking", text: "Календарь, услуги, ресурсы и свободные слоты для сервисного бизнеса.", icon: CalendarCheck },
];

function Hero({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <section className="px-4 pb-10 pt-10 sm:pt-16">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-4 py-2 text-sm font-bold text-brand-700 shadow-soft backdrop-blur-xl">
            <Sparkles size={16} />
            {eyebrow}
          </div>
          <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tight text-midnight sm:text-6xl lg:text-7xl">{title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">{description}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/login">
              <Button variant="ai" className="w-full rounded-full px-6 sm:w-auto">
                Открыть CRM
                <ArrowRight size={18} />
              </Button>
            </Link>
            <Link to="/contacts">
              <Button variant="secondary" className="w-full rounded-full px-6 sm:w-auto">
                Связаться
              </Button>
            </Link>
          </div>
        </div>
        <div className="glass-panel rounded-[2rem] p-5 shadow-premium">
          <div className="rounded-[1.5rem] bg-midnight p-5 text-white">
            <p className="text-sm font-semibold text-white/55">Business cockpit</p>
            <div className="mt-5 grid gap-3">
              {[
                ["Новые заявки", "12", "needs attention"],
                ["Записи сегодня", "8", "confirmed"],
                ["Клиенты", "248", "active base"],
              ].map(([label, value, hint]) => (
                <div key={label} className="rounded-3xl border border-white/10 bg-white/7 p-4">
                  <p className="text-sm text-white/55">{label}</p>
                  <p className="mt-2 text-4xl font-semibold">{value}</p>
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
  return (
    <>
      <Hero
        eyebrow="AI-first CRM for SMB"
        title="NeuroBoost держит заявки, клиентов и записи под контролем."
        description="Официальный публичный сайт продукта. Merchant CRM уже работает, а AI-боты, billing и публичные каналы будут добавляться по дорожной карте."
      />
      <section className="px-4 pb-16">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {productCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title}>
                <CardBody className="p-6">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ai-gradient text-white shadow-glow">
                    <Icon size={22} />
                  </div>
                  <h2 className="mt-5 text-xl font-semibold text-midnight">{card.title}</h2>
                  <p className="mt-3 leading-7 text-slate-600">{card.text}</p>
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
  return (
    <PublicContentPage
      eyebrow="Merchant CRM"
      title="Легкая CRM для малого бизнеса без ощущения сложной ERP."
      description="CRM-ядро уже включает клиентов, заявки, сделки, задачи, календарь, услуги и ресурсы. Данные проходят через Django API и tenant permissions."
      bullets={["Multi-tenant доступ через Business", "Pipeline/deals foundation", "Calendar and appointment workflow", "Activity timeline and audit"]}
    />
  );
}

export function PublicBotsPage() {
  return (
    <PublicContentPage
      eyebrow="AI bots"
      title="AI-боты будут подключаться поверх CRM-ядра."
      description="Этот раздел публичного сайта готовит продуктовую упаковку будущих ботов. Реальных bots API на этом этапе не добавляем."
      bullets={["Website chat later", "Telegram skeleton later", "AI Core after bot foundation", "No external API secrets yet"]}
    />
  );
}

export function PublicContactsPage() {
  return (
    <PublicContentPage
      eyebrow="Contacts"
      title="Подключить CRM или обсудить пилот."
      description="Пока форма заявки не подключена к backend. Для MVP это статичная публичная страница с CTA, без billing и outreach."
      bullets={["CTA: подключить CRM", "CTA: подключить AI-бота", "Контакт через владельца проекта", "Формы и лидогенерация позже"]}
    />
  );
}

export function PublicPricingPage() {
  const plans = useQuery({ queryKey: ["billing-plans"], queryFn: billingApi.plans });

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Pricing</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-midnight">Тарифы NeuroBoost без подключения оплаты на этом этапе.</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">Планы берутся из billing API. Реальные платежи и webhooks будут добавлены отдельным этапом.</p>
        </div>
        {plans.isLoading ? <div className="mt-8"><LoadingState label="Загружаем тарифы..." /></div> : null}
        {plans.error ? <div className="mt-8"><ErrorState message="Не удалось загрузить тарифы." /></div> : null}
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {(plans.data || []).map((plan) => (
            <Card key={plan.name}>
              <CardBody className="p-6">
                <h2 className="text-2xl font-semibold text-midnight">{plan.name}</h2>
                <p className="mt-2 text-4xl font-semibold tracking-tight">{formatPrice(plan.monthly_price)}</p>
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

function formatPrice(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (numeric === 0) return "0 ₸";
  return `${numeric.toLocaleString("ru-RU")} ₸/мес`;
}

function PublicContentPage({ eyebrow, title, description, bullets }: { eyebrow: string; title: string; description: string; bullets: string[] }) {
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
                Войти в кабинет
                <ArrowRight size={17} />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="secondary" className="rounded-full">
                Смотреть тарифы
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
                <h2 className="text-xl font-semibold text-midnight">What is ready</h2>
                <p className="text-sm text-slate-500">Public shell only, product core untouched.</p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {bullets.map((bullet) => (
                <div key={bullet} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <MessageSquareText size={17} className="mt-0.5 text-brand-600" />
                  {bullet}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </section>
  );
}
