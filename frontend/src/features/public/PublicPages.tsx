import { ArrowRight, Bot, CalendarCheck, CheckCircle2, Clock3, MousePointerClick, Send, ShieldCheck, Sparkles, Users, WalletCards } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { billingApi } from "../../api/billing";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useI18n } from "../../lib/i18n";

const messengerCases = [
  {
    channel: "WhatsApp",
    accent: "bg-emerald-500",
    business: "Салон красоты",
    lead: "Здравствуйте, есть окно на окрашивание завтра после 17:00?",
    bot: "Здравствуйте! Да, есть 17:30 и 19:00. Подскажите длину волос и имя мастера, если есть предпочтение.",
    result: "Заявка создана, клиент квалифицирован, менеджеру поставлена задача подтвердить запись.",
  },
  {
    channel: "Instagram",
    accent: "bg-fuchsia-500",
    business: "Онлайн-магазин",
    lead: "Цена этого комплекта? И можно доставку сегодня?",
    bot: "Комплект стоит 24 900 ₸. Доставка сегодня возможна по Алматы до 20:00. Оформить заказ на этот размер?",
    result: "AI отвечает по каталогу, фиксирует интерес и переводит диалог в сделку.",
  },
  {
    channel: "Telegram",
    accent: "bg-sky-500",
    business: "Образовательный центр",
    lead: "Хочу узнать про курс английского для подростка",
    bot: "Подберу группу. Сколько лет ученику, какой уровень сейчас и удобны будни или выходные?",
    result: "Лид попадает в CRM с возрастом, интересом, уровнем и следующим шагом.",
  },
  {
    channel: "Чат на сайте",
    accent: "bg-indigo-500",
    business: "B2B-услуги",
    lead: "Нужно внедрить CRM для отдела продаж. Сколько стоит?",
    bot: "Стоимость зависит от числа менеджеров и интеграций. Могу задать 3 вопроса и передать заявку специалисту с готовым брифом.",
    result: "Zani собирает бриф, создает сделку и показывает приоритет менеджеру.",
  },
];

const pipelineSteps = [
  { label: "Сообщение", text: "Клиент пишет в WhatsApp", icon: Send },
  { label: "AI-ответ", text: "Бот уточняет детали и снимает возражения", icon: Bot },
  { label: "Заявка", text: "CRM создает лид с источником и интересом", icon: Users },
  { label: "Сделка", text: "Лид переходит в этап «Готов к записи»", icon: WalletCards },
  { label: "Задача", text: "Менеджер получает следующий шаг", icon: CalendarCheck },
];

const crmTabs = [
  {
    name: "Сообщения",
    title: "Входящие из всех каналов",
    items: ["WhatsApp: запись на окрашивание", "Instagram: вопрос по доставке", "Telegram: подбор курса"],
  },
  {
    name: "Заявки",
    title: "AI уже собрал контекст",
    items: ["Алина: окрашивание, завтра 17:30", "Руслан: комплект L, доставка сегодня", "Дина: курс английского, 13 лет"],
  },
  {
    name: "Сделки",
    title: "Воронка обновляется сама",
    items: ["Готов к записи", "Ожидает оплату", "Нужен звонок менеджера"],
  },
];

const crmScreens = [
  {
    name: "Заявки",
    title: "Клиент из WhatsApp сразу становится заявкой",
    src: "/landing/screens/leads.png",
    note: "Владелец видит источник, ответственного, следующий шаг и AI-сводку по каждой заявке.",
    callout: "Менеджер не ответил 18 мин",
    marker: "left-[66%] top-[58%]",
  },
  {
    name: "Сообщения",
    title: "Все диалоги и контроль бота в одном окне",
    src: "/landing/screens/messages.png",
    note: "Команда видит, кто отвечает клиенту, где нужен оператор и где AI может продолжить диалог.",
    callout: "AI предложил ответ",
    marker: "left-[74%] top-[17%]",
  },
  {
    name: "Контроль владельца",
    title: "Деньги в работе видны в воронке",
    src: "/landing/screens/deals.png",
    note: "Заявки становятся сделками, а владелец видит, где зависают деньги и менеджеры.",
    callout: "Сделка: 120 000 ₸",
    marker: "left-[36%] top-[35%]",
  },
];

const setupSteps = [
  ["01", "Подключаем каналы", "WhatsApp, Telegram, Instagram или сайт, где уже приходят входящие заявки."],
  ["02", "Настраиваем заявки и воронку", "Под вашу сферу, услуги, этапы продаж и ответственных менеджеров."],
  ["03", "Запускаем AI-ответы", "Сценарии для первых сообщений, записи, консультации и передачи менеджеру."],
  ["04", "Показываем владельцу контроль", "Дашборд, заявки, просрочки, сделки и ежедневные AI-сигналы."],
];

const problemCards = [
  ["Заявки размазаны по чатам", "WhatsApp, Instagram и Telegram живут отдельно, а владелец не видит общий поток."],
  ["Менеджеры отвечают с задержкой", "Клиент ждет, уходит к конкуренту, а проблема становится заметна слишком поздно."],
  ["Деньги зависают в сделках", "Нет ясности, какие заявки горячие, кто отвечает и где нужен follow-up."],
];

const ownerCards = [
  ["Заявки по каналам", "WhatsApp, Instagram, Telegram и сайт в единой картине."],
  ["Скорость ответа менеджеров", "Кто отвечает быстро, а кто теряет клиентов."],
  ["Сделки и деньги в работе", "Сколько заявок дошли до продажи и где зависли."],
  ["AI-сигналы", "3 клиента без ответа, 2 сделки зависли, менеджер не закрыл задачу."],
];

const audienceCards = [
  ["Стоматологии и клиники", "Запись, консультации, повторные визиты, контроль администраторов."],
  ["Салоны и услуги", "WhatsApp/Instagram-заявки, расписание, напоминания, повторные продажи."],
  ["Магазины и шоурумы", "Диалоги, предзаказы, клиенты, статусы, возвраты и follow-up."],
  ["Образовательные центры", "Лиды, менеджеры, пробные занятия, оплаты и повторные касания."],
];

const aiManagementCards = [
  ["AI-ответы клиентам", "Быстрые ответы по услугам, ценам, времени и записи."],
  ["AI-контроль заявок", "Видит, где клиент остался без ответа или сделка зависла."],
  ["AI-подсказки менеджерам", "Предлагает следующий шаг: написать, позвонить, напомнить, закрыть сделку."],
  ["AI-сводка для владельца", "Каждый день коротко: что произошло, где проблема, что требует внимания."],
];

const beforeAfterRows = [
  ["Заявки в разных мессенджерах", "Все заявки в одном кабинете"],
  ["Клиенты ждут ответа", "AI отвечает сразу"],
  ["Менеджеры забывают follow-up", "ZANI напоминает и контролирует"],
  ["Владелец узнает проблемы поздно", "Владелец видит сигналы сразу"],
  ["CRM ведут вручную", "Заявки создаются автоматически"],
];

const pilotIncludes = [
  "Подключение 1-2 каналов",
  "Настройка CRM-воронки",
  "Кабинет владельца",
  "AI-подсказки",
  "Тестовые сценарии ответов",
  "Базовая аналитика",
  "Сопровождение запуска",
];

const metricCards = [
  ["Контроль", "кто отвечает и где просрочки"],
  ["Скорость", "AI принимает первое сообщение"],
  ["Деньги", "сделки и заявки в работе"],
];

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-90px" }}
      transition={{ duration: 0.48, delay }}
    >
      {children}
    </motion.div>
  );
}

function SignupButton({ children = "Запустить пилот" }: { children?: string }) {
  return (
    <Link to="/signup">
      <Button variant="ai" size="lg" className="group relative w-full overflow-hidden rounded-full px-6 sm:w-auto">
        <span className="absolute inset-y-0 -left-10 w-8 rotate-12 bg-white/30 opacity-0 blur-sm transition-all duration-700 group-hover:left-[115%] group-hover:opacity-100" />
        {children}
        <ArrowRight size={18} />
      </Button>
    </Link>
  );
}

function MessengerBubble({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={`max-w-[88%] rounded-[1.15rem] px-4 py-3 text-sm leading-6 shadow-soft ${className}`}>{children}</p>;
}

function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-[#f7f8fb] px-4 pb-16 pt-8 sm:pb-20">
      <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_50%_0%,rgba(79,70,229,0.16),transparent_62%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white/80 to-transparent" />
      <div className="relative mx-auto grid max-w-7xl gap-12 pt-10 lg:grid-cols-[0.84fr_1.16fr] lg:items-center lg:pt-16">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-brand-700 shadow-soft sm:text-sm">
            <Sparkles size={16} />
            <span className="truncate">AI-система контроля заявок и продаж</span>
          </div>
          <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[0.99] tracking-tight text-midnight sm:text-6xl lg:text-[4rem]">
            ZANI превращает WhatsApp, Instagram и Telegram в систему продаж
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Все заявки, диалоги, менеджеры, сделки и AI-подсказки в одном кабинете. Владелец видит, кто отвечает, где теряются клиенты и сколько денег уже в работе.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <SignupButton />
            <a href="#crm-screens" className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-6 text-base font-semibold text-midnight shadow-soft transition hover:border-slate-400">
              Посмотреть демо
            </a>
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-500">Подключение без сложной внедренческой системы. Первый запуск — за 3 дня.</p>
          <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
            {metricCards.map(([value, label]) => (
              <motion.div key={value} whileHover={{ y: -3 }} className="rounded-card border border-slate-200 bg-white/92 p-4 shadow-soft backdrop-blur">
                <p className="text-2xl font-semibold tabular-nums text-midnight">{value}</p>
                <p className="mt-2 text-sm leading-5 text-slate-500">{label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.08 }}
        >
          <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity }} className="absolute -right-6 -top-6 hidden rounded-card border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-panel lg:block">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Новая заявка из WhatsApp
          </motion.div>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 4.8, repeat: Infinity }} className="absolute -bottom-5 left-8 z-10 hidden rounded-card border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-panel lg:block">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-brand-600" />
            Сделка: 120 000 ₸
          </motion.div>
          <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 5.3, repeat: Infinity }} className="absolute right-12 top-24 z-10 hidden rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 shadow-panel xl:block">
            Менеджер не ответил 18 мин
          </motion.div>
          <div className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-panel ring-1 ring-slate-100">
            <div className="grid md:grid-cols-[220px_1fr]">
              <aside className="hidden border-r border-slate-200 bg-slate-50 p-4 md:block">
                <div className="mb-5 flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-card bg-primary-gradient text-white">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-midnight">Zani</p>
                    <p className="text-xs text-slate-500">Sales workspace</p>
                  </div>
                </div>
                {["Сообщения", "Заявки", "Сделки", "Задачи", "AI-боты"].map((item, index) => (
                  <div key={item} className={`mb-2 rounded-card px-3 py-2 text-sm font-semibold ${index === 0 ? "bg-midnight text-white" : "text-slate-600"}`}>
                    {item}
                  </div>
                ))}
              </aside>
              <div>
                <CrmShowcase />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function CrmShowcase() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="min-h-[520px] p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Live CRM demo</p>
          <h2 className="mt-1 text-xl font-semibold text-midnight">Входящая заявка из WhatsApp</h2>
        </div>
        <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">AI online</div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {crmTabs.map((tab, index) => (
          <button
            key={tab.name}
            className={`min-h-10 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition ${activeTab === index ? "bg-midnight text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            onClick={() => setActiveTab(index)}
          >
            {tab.name}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.95fr]">
        <motion.div layout className="rounded-card border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-midnight">{crmTabs[activeTab].title}</p>
            <Clock3 size={17} className="text-slate-400" />
          </div>
          <div className="mt-4 space-y-3">
            {crmTabs[activeTab].items.map((item, index) => (
              <motion.div
                key={item}
                className="rounded-card border border-slate-200 bg-white p-3 shadow-soft"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-midnight">{item}</p>
                  <span className="rounded-full bg-primary-50 px-2 py-1 text-xs font-bold text-brand-700">new</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className="rounded-card border border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">AI-цепочка</p>
              <p className="mt-1 font-semibold text-midnight">WhatsApp → заявка → сделка</p>
            </div>
            <MousePointerClick size={18} className="text-brand-600" />
          </div>
          <div className="mt-5 space-y-3">
            {pipelineSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.label}
                  className="flex items-start gap-3 rounded-card border border-slate-200 bg-slate-50 p-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.2 + index * 0.13, repeat: Infinity, repeatDelay: 5 }}
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-card bg-white text-brand-700 shadow-soft">
                    <Icon size={17} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-midnight">{step.label}</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">{step.text}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function DialogExamples() {
  const [active, setActive] = useState(0);
  const [visibleStep, setVisibleStep] = useState(0);
  const current = messengerCases[active];
  const animatedSteps = useMemo(
    () => [
      { kind: "client", text: current.lead },
      { kind: "bot", text: current.bot },
      { kind: "client", text: "Да, давайте. Меня зовут Алина, номер этот." },
      { kind: "bot", text: "Готово. Создаю заявку в CRM, закрепляю источник и ставлю менеджеру следующий шаг." },
      { kind: "event", text: "Заявка создана" },
      { kind: "event", text: "Сделка обновлена" },
      { kind: "event", text: "Задача менеджеру" },
    ],
    [current],
  );
  const progress = Math.min(100, (visibleStep / animatedSteps.length) * 100);

  useEffect(() => {
    setVisibleStep(0);
    const timers = animatedSteps.map((_, index) => window.setTimeout(() => setVisibleStep(index + 1), 550 + index * 950));
    const restart = window.setTimeout(() => setVisibleStep(0), 550 + animatedSteps.length * 950 + 2200);
    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(restart);
    };
  }, [active, animatedSteps]);

  return (
    <section id="dialogs" className="bg-white px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <Reveal className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Реальные сценарии общения</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-midnight sm:text-5xl">
              ZANI отвечает клиенту быстрее администратора
            </h2>
          </div>
          <p className="text-base leading-7 text-slate-600 sm:text-lg">
            Пока менеджер занят, AI принимает первое сообщение, уточняет услугу, собирает контакт и создает заявку в CRM.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-[330px_1fr]">
          <div className="grid gap-3">
            {messengerCases.map((item, index) => (
              <motion.button
                key={item.channel}
                whileHover={{ x: 3 }}
                className={`rounded-card border p-4 text-left transition ${active === index ? "border-brand-500 bg-primary-50 shadow-card" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-soft"}`}
                onClick={() => setActive(index)}
              >
                <div className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full ${item.accent} ${active === index ? "animate-pulse" : ""}`} />
                  <span className="font-semibold text-midnight">{item.channel}</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">{item.business}</p>
              </motion.button>
            ))}
          </div>

          <motion.div
            key={current.channel}
            className="grid gap-4 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 shadow-card lg:grid-cols-[1fr_0.8fr]"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="rounded-[1.1rem] border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{current.channel}</p>
                  <p className="mt-1 text-sm font-semibold text-midnight">{current.business}</p>
                </div>
                <span className={`h-3 w-3 rounded-full ${current.accent}`} />
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <motion.div className="h-full rounded-full bg-primary-gradient" animate={{ width: `${progress}%` }} transition={{ duration: 0.35 }} />
              </div>
              <div className="mt-5 min-h-[340px] space-y-4">
                {animatedSteps.slice(0, visibleStep).filter((step) => step.kind !== "event").map((step, index) => (
                  <motion.div
                    key={`${current.channel}-${index}-${step.text}`}
                    initial={{ opacity: 0, y: 14, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.28 }}
                    className={step.kind === "bot" ? "flex justify-end" : ""}
                  >
                    <MessengerBubble className={step.kind === "bot" ? "ml-auto bg-primary-600 text-white" : "bg-slate-100 text-midnight"}>
                      {step.text}
                    </MessengerBubble>
                  </motion.div>
                ))}
                {(visibleStep === 1 || visibleStep === 3) ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ml-auto flex w-fit items-center gap-1 rounded-full bg-primary-50 px-4 py-2 text-sm font-semibold text-brand-700">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-600" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-600 [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-600 [animation-delay:240ms]" />
                    AI печатает
                  </motion.div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[1.1rem] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">Что делает Zani в CRM</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-midnight">{current.result}</h3>
              <div className="mt-5 grid gap-3">
                {animatedSteps.filter((step) => step.kind === "event").map((step, index) => (
                  <motion.div
                    key={step.text}
                    className="flex items-center gap-3 rounded-card border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                    initial={{ opacity: 0.35, x: 12 }}
                    animate={visibleStep >= 5 + index ? { opacity: 1, x: 0, borderColor: "rgb(16 185 129)", backgroundColor: "rgb(240 253 244)" } : { opacity: 0.35, x: 12 }}
                    transition={{ delay: index * 0.08 }}
                  >
                    <CheckCircle2 size={17} className="text-emerald-500" />
                    {step.text}
                  </motion.div>
                ))}
                <div className="flex items-center gap-3 rounded-card border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                  <Clock3 size={17} className="text-slate-400" />
                  Передать менеджеру
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function CrmScreensShowcase() {
  const [activeScreen, setActiveScreen] = useState(0);
  const current = crmScreens[activeScreen];
  const [screenProgress, setScreenProgress] = useState(0);

  useEffect(() => {
    setScreenProgress(0);
    const progressInterval = window.setInterval(() => {
      setScreenProgress((value) => (value >= 100 ? 100 : value + 2.5));
    }, 100);
    const interval = window.setInterval(() => {
      setActiveScreen((value) => (value + 1) % crmScreens.length);
    }, 4200);
    return () => {
      window.clearInterval(interval);
      window.clearInterval(progressInterval);
    };
  }, [activeScreen]);

  return (
    <section id="crm-screens" className="bg-white px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <Reveal className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">CRM в действии</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-midnight sm:text-5xl">
              Реальный кабинет ZANI: заявки, менеджеры, сделки и AI-сигналы
            </h2>
          </div>
          <p className="text-base leading-7 text-slate-600 sm:text-lg">
            Реальные экраны продукта показывают, как входящие, диалоги и деньги в работе становятся понятной системой контроля.
          </p>
        </Reveal>

        <div className="mt-10 overflow-hidden rounded-[1.35rem] border border-slate-200 bg-slate-950 shadow-panel">
          <div className="flex flex-col gap-3 border-b border-white/10 bg-slate-900 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-amber-300" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ml-3 text-sm font-semibold text-white/70">app.zani.crm</span>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {crmScreens.map((screen, index) => (
                <button
                  key={screen.name}
                  className={`min-h-9 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition ${activeScreen === index ? "bg-white text-midnight" : "bg-white/8 text-white/70 hover:bg-white/14"}`}
                  onClick={() => setActiveScreen(index)}
                >
                  {screen.name}
                </button>
              ))}
            </div>
          </div>
          <div className="h-1 bg-white/8">
            <motion.div className="h-full bg-cyan-300" animate={{ width: `${screenProgress}%` }} transition={{ duration: 0.1 }} />
          </div>

          <div className="grid gap-0 lg:grid-cols-[330px_1fr]">
            <div className="border-b border-white/10 bg-slate-900 p-5 text-white lg:border-b-0 lg:border-r">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Сейчас на экране</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight">{current.title}</h3>
              <p className="mt-4 leading-7 text-white/68">{current.note}</p>
              <div className="mt-6 grid gap-3">
                {pipelineSteps.slice(0, 4).map((step, index) => (
                  <motion.div
                    key={step.label}
                    className="flex items-center gap-3 rounded-card border border-white/10 bg-white/6 px-3 py-2 text-sm font-semibold text-white/82"
                    animate={index === activeScreen + 1 ? { x: [0, 4, 0], borderColor: "rgba(125, 211, 252, 0.6)" } : { x: 0 }}
                    transition={{ duration: 0.8, repeat: index === activeScreen + 1 ? Infinity : 0, repeatDelay: 1.6 }}
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-xs">{index + 1}</span>
                    {step.label}
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="relative overflow-x-auto bg-slate-100 p-3 sm:p-5">
              <p className="mb-3 text-xs font-semibold text-slate-500 sm:hidden">Свайпните экран CRM горизонтально</p>
              <div className="relative min-w-[860px] lg:min-w-0">
                <motion.img
                  key={current.src}
                  src={current.src}
                  alt={`Экран CRM Zani: ${current.name}`}
                  className="aspect-[16/10] w-full rounded-card border border-slate-200 bg-white object-cover object-left-top shadow-card"
                  initial={{ opacity: 0, y: 18, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.45 }}
                />
                <motion.div
                  key={`${current.name}-callout`}
                  className="absolute right-6 top-6 rounded-card border border-slate-200 bg-white/94 px-4 py-3 text-sm font-semibold text-midnight shadow-panel backdrop-blur"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  {current.callout}
                </motion.div>
                <motion.div
                  className={`absolute ${current.marker} hidden h-5 w-5 rounded-full border-4 border-white bg-brand-600 shadow-panel lg:block`}
                  animate={{ scale: [1, 1.35, 1], opacity: [0.92, 0.55, 0.92] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section className="bg-white px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <Reveal className="max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Проблема владельца</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-midnight sm:text-5xl">Заявки теряются не потому, что нет CRM. А потому что нет контроля.</h2>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">Клиенты пишут в разные каналы, менеджеры отвечают в разное время, сделки живут отдельно. Владелец узнает о потерях, когда деньги уже ушли.</p>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {problemCards.map(([title, text], index) => (
            <motion.article key={title} whileHover={{ y: -4 }} className="rounded-[1.35rem] border border-slate-200 bg-[#f7f8fc] p-6 shadow-soft">
              <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-500 shadow-soft">0{index + 1}</div>
              <h3 className="text-xl font-semibold tracking-tight text-midnight">{title}</h3>
              <p className="mt-3 leading-7 text-slate-600">{text}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function OwnerControlSection() {
  return (
    <section className="bg-[#f7f8fc] px-4 py-16 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Кабинет владельца</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-midnight sm:text-5xl">Владелец видит бизнес без звонков менеджерам</h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">Кто отвечает клиентам, сколько заявок в работе, где просрочки, какие сделки зависли и сколько денег может быть потеряно.</p>
        </Reveal>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-panel">
          <div className="grid gap-4 sm:grid-cols-2">
            {ownerCards.map(([title, text], index) => (
              <motion.div key={title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.06 }} className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-5">
                <div className="mb-4 h-1.5 w-14 rounded-full bg-primary-gradient" />
                <h3 className="text-lg font-semibold text-midnight">{title}</h3>
                <p className="mt-2 leading-7 text-slate-600">{text}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-4 rounded-[1.1rem] bg-midnight p-5 text-white">
            <p className="text-sm font-semibold text-white/55">AI-сводка сегодня</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">3 клиента без ответа, 2 сделки зависли, 1 менеджер не закрыл задачу.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function AiManagementSection() {
  return (
    <section className="bg-white px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <Reveal className="max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">AI как операционный контроль</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-midnight sm:text-5xl">AI не просто отвечает. Он помогает управлять продажами</h2>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">ZANI говорит языком бизнеса: где клиент ждёт, где менеджер тормозит, где сделка требует следующего шага.</p>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {aiManagementCards.map(([title, text]) => (
            <motion.article key={title} whileHover={{ y: -4 }} className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-soft hover:shadow-card">
              <Sparkles className="text-brand-600" size={22} />
              <h3 className="mt-5 text-lg font-semibold text-midnight">{title}</h3>
              <p className="mt-3 leading-7 text-slate-600">{text}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AudienceSection() {
  return (
    <section className="bg-[#f7f8fc] px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <Reveal className="max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Для кого ZANI</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-midnight sm:text-5xl">ZANI для бизнесов, где нельзя терять входящие заявки</h2>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {audienceCards.map(([title, text]) => (
            <motion.article key={title} whileHover={{ y: -4 }} className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-soft">
              <h3 className="text-xl font-semibold text-midnight">{title}</h3>
              <p className="mt-4 leading-7 text-slate-600">{text}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function BeforeAfterSection() {
  return (
    <section className="bg-white px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <Reveal className="max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">До / После</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-midnight sm:text-5xl">Как выглядит бизнес до и после ZANI</h2>
        </Reveal>
        <div className="mt-10 overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-card">
          {beforeAfterRows.map(([before, after]) => (
            <div key={before} className="grid gap-0 border-b border-slate-200 last:border-b-0 md:grid-cols-2">
              <div className="bg-slate-50 p-5 text-slate-600">{before}</div>
              <div className="flex items-center gap-3 p-5 font-semibold text-midnight">
                <CheckCircle2 size={18} className="text-emerald-500" />
                {after}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EconomySection() {
  return (
    <section id="pricing-preview" className="bg-[#f7f8fc] px-4 py-16 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Экономика</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-midnight sm:text-5xl">Одна сохраненная заявка может окупить ZANI</h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">Если бизнес теряет хотя бы 2-3 заявки в месяц из-за долгого ответа, забытых сообщений или слабого follow-up — ZANI уже начинает возвращать деньги.</p>
        </Reveal>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
          <div className="grid gap-4 sm:grid-cols-3">
            {[["Средний чек", "20 000 ₸"], ["Потерянные заявки", "5 / мес"], ["Конверсия", "30%"]].map(([label, value]) => (
              <div key={label} className="rounded-[1.1rem] bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-semibold text-midnight">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-[1.1rem] bg-midnight p-5 text-white">
            <p className="text-sm font-semibold text-white/55">Потенциально возвращено</p>
            <p className="mt-2 text-4xl font-semibold">30 000 ₸+</p>
            <p className="mt-2 text-sm leading-6 text-white/65">Это пример для малого бизнеса. Реальный расчет зависит от среднего чека, каналов и скорости ответа.</p>
          </div>
          <div className="mt-5">
            <SignupButton>Посчитать для моего бизнеса</SignupButton>
          </div>
        </div>
      </div>
    </section>
  );
}

function PilotSection() {
  return (
    <section className="bg-white px-4 py-16 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Пилот ZANI</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-midnight sm:text-5xl">Что входит в пилот ZANI</h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">Пилот нужен, чтобы показать на ваших реальных заявках, где теряются клиенты и сколько контроля можно вернуть.</p>
        </Reveal>
        <div className="grid gap-3 sm:grid-cols-2">
          {pilotIncludes.map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-[1.1rem] border border-slate-200 bg-[#f7f8fc] p-4 font-semibold text-midnight">
              <CheckCircle2 size={18} className="text-emerald-500" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PublicHomePage() {
  return (
    <>
      <LandingHero />
      <ProblemSection />
      <section id="demo" className="bg-[#f7f8fb] px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <Reveal className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Автоматический путь заявки</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-midnight sm:text-5xl">
                Сообщение превращается в заявку, сделку и контроль владельца
              </h2>
            </div>
            <p className="text-base leading-7 text-slate-600 sm:text-lg">
              Клиент пишет в WhatsApp, AI отвечает, заявка попадает в CRM, сделка двигается по этапам, а менеджер получает следующий шаг.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-4 lg:grid-cols-5">
            {pipelineSteps.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.article
                  key={item.label}
                  whileHover={{ y: -4 }}
                  className="relative rounded-card border border-slate-200 bg-white p-5 shadow-soft transition-shadow hover:shadow-card"
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ delay: index * 0.08 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="grid h-11 w-11 place-items-center rounded-card bg-primary-50 text-brand-700">
                      <Icon size={21} />
                    </div>
                    <span className="text-sm font-bold text-slate-300">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-midnight">{item.label}</h3>
                  <p className="mt-3 leading-7 text-slate-600">{item.text}</p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>
      <DialogExamples />
      <OwnerControlSection />
      <AiManagementSection />
      <CrmScreensShowcase />
      <AudienceSection />
      <BeforeAfterSection />

      <section id="setup" className="bg-[#f7f8fb] px-4 py-16 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.82fr_1.18fr]">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Запуск</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-midnight sm:text-5xl">Запуск без программистов, долгих интеграций и обучения команды</h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">Начните с входящих заявок: подключаем каналы, настраиваем воронку, запускаем AI-ответы и показываем владельцу контроль.</p>
            <div className="mt-6 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">Обычно пилот можно запустить за 3 дня.</div>
            <div className="mt-8">
              <SignupButton>Запустить пилот</SignupButton>
            </div>
          </Reveal>
          <div className="grid gap-3">
            {setupSteps.map(([number, title, text]) => (
              <motion.article key={number} whileHover={{ x: 4 }} className="grid gap-4 rounded-card border border-slate-200 bg-white p-5 shadow-soft sm:grid-cols-[72px_1fr]">
                <div className="text-3xl font-semibold text-brand-600">{number}</div>
                <div>
                  <h3 className="text-xl font-semibold text-midnight">{title}</h3>
                  <p className="mt-2 leading-7 text-slate-600">{text}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
      <EconomySection />
      <PilotSection />

      <section id="faq" className="bg-white px-4 py-16 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">FAQ</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-midnight sm:text-5xl">Что важно уточнить перед запуском</h2>
          </Reveal>
          <div className="grid gap-3">
            {[
              ["Что будет после заявки на пилот?", "Мы уточним каналы, сферу бизнеса, текущий путь заявки и покажем, с чего лучше начать запуск."],
              ["Какие каналы подключать первыми?", "Для пилота лучше выбрать 1-2 ключевых канала, где уже есть входящие заявки: WhatsApp, Telegram, Instagram или сайт."],
              ["Нужно ли менять всю текущую систему?", "Нет. Пилот можно начать с входящих заявок и контроля менеджеров без полной перестройки процессов."],
              ["Что делает менеджер после подключения AI?", "Берет сложные диалоги, работает со сделками и видит приоритетные действия, которые ZANI подсвечивает в CRM."],
            ].map(([question, answer]) => (
              <details key={question} className="group rounded-card border border-slate-200 bg-white p-5 shadow-soft transition hover:border-slate-300 hover:shadow-card" open={question.startsWith("Что будет")}>
                <summary className="cursor-pointer list-none text-lg font-semibold text-midnight">{question}</summary>
                <motion.p initial={{ opacity: 0.8 }} animate={{ opacity: 1 }} className="mt-3 leading-7 text-slate-600">{answer}</motion.p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f7f8fb] px-4 py-16 sm:py-24">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-card border border-slate-200 bg-white p-6 shadow-panel sm:p-10">
          <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_80%_35%,rgba(79,70,229,0.16),transparent_58%)] lg:block" />
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative">
              <h2 className="text-3xl font-semibold leading-tight tracking-tight text-midnight sm:text-5xl">Проверьте, сколько заявок теряется в вашем бизнесе</h2>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">Запустим ZANI на пилоте: подключим каналы, покажем заявки, менеджеров, сделки и AI-сигналы в одном кабинете.</p>
              <p className="mt-3 text-sm font-semibold text-slate-500">Без сложного внедрения. Без замены всей вашей системы. Начинаем с входящих заявок.</p>
            </div>
            <div className="relative flex flex-col gap-3 sm:flex-row lg:flex-col">
              <SignupButton>Запустить пилот</SignupButton>
              <Link to="/contacts" className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-6 text-base font-semibold text-midnight shadow-soft transition hover:border-slate-400">
                Получить консультацию
              </Link>
            </div>
          </div>
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
