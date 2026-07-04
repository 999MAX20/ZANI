import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Home,
  Inbox,
  KanbanSquare,
  LineChart,
  ListChecks,
  LogIn,
  Mail,
  MessageCircle,
  MessageSquareText,
  PhoneCall,
  PlugZap,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { LanguageSelector } from "../../components/layout/LanguageSelector";
import { useI18n } from "../../lib/i18n";
import "./zaniExperience.css";
import "./zaniExperienceMobileFix.css";

const AUTH_ROUTES = {
  signup: "/signup",
  login: "/login"
} as const;

const AUTH_ACTIONS = new Set(["login", "signup"]);

const landingSections = [
  { id: "top", labelKey: "landing.experience.nav.top" },
  { id: "pain", labelKey: "landing.experience.nav.pain" },
  { id: "agent", labelKey: "landing.experience.nav.agent" },
  { id: "crm", labelKey: "landing.experience.nav.crm" },
  { id: "marketplace", labelKey: "landing.experience.nav.marketplace" },
  { id: "ecosystem", labelKey: "landing.experience.nav.ecosystem" },
  { id: "owner", labelKey: "landing.experience.nav.owner" },
  { id: "integrations", labelKey: "landing.experience.nav.integrations" },
  { id: "proof", labelKey: "landing.experience.nav.proof" },
  { id: "cta", labelKey: "landing.experience.nav.cta" }
] as const;

type LandingSectionId = (typeof landingSections)[number]["id"];

const channels = [
  { name: "WhatsApp", icon: MessageCircle, tone: "green", textKey: "landing.experience.channel.whatsapp" },
  { name: "Instagram", icon: Sparkles, tone: "pink", textKey: "landing.experience.channel.instagram" },
  { name: "Telegram", icon: Send, tone: "blue", textKey: "landing.experience.channel.telegram" },
  { name: "Kaspi", icon: WalletCards, tone: "red", textKey: "landing.experience.channel.kaspi" },
  { name: "Ответ отправлен", icon: CheckCircle2, tone: "orange", textKey: "landing.experience.channel.reply" },
  { name: "Заявка создана", icon: CalendarCheck, tone: "orange", textKey: "landing.experience.channel.lead" }
];

function normalizeIntent(value: string) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, 120);
}

function Reveal({
  children,
  className = "",
  delay = 0
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.62, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Header({ activeSection }: { activeSection: LandingSectionId }) {
  const { t } = useI18n();

  return (
    <header className="zani-stitch-header">
      <div className="zani-stitch-header-inner">
        <a className="zani-stitch-brand" href="#top" aria-label="ZANI">
          <span aria-hidden="true">Z</span>
          ZANI
        </a>
        <a className="zani-mobile-header-cta" href={AUTH_ROUTES.signup} data-auth-action="signup" data-auth-intent={t("landing.experience.nav.cta")}>
          {t("landing.experience.nav.cta")}
        </a>

        <nav aria-label={t("landing.experience.nav.aria")}>
          {landingSections.slice(0, 7).map((section) => (
            <a className={activeSection === section.id ? "is-active" : ""} href={`#${section.id}`} key={section.id}>
              {t(section.labelKey)}
            </a>
          ))}
        </nav>

        <div className="zani-stitch-actions">
          <a className="zani-stitch-login" href={AUTH_ROUTES.login} data-auth-action="login">
            <LogIn size={16} />
            {t("landing.experience.login")}
          </a>
          <a className="zani-stitch-trial" href={AUTH_ROUTES.signup} data-auth-action="signup" data-auth-intent={t("landing.experience.tryFree")}>
            {t("landing.experience.tryFree")}
          </a>
          <LanguageSelector className="zani-stitch-language" />
        </div>
      </div>
    </header>
  );
}

function PhoneMockup({ mode = "inbox" }: { mode?: "inbox" | "chat" | "dashboard" }) {
  const { t } = useI18n();

  return (
    <div className={`zani-light-phone is-${mode}`} aria-label={t("landing.experience.phone.aria")}>
      <div className="zani-light-phone-top">
        <span>9:41</span>
        <i />
        <b />
      </div>
      <div className="zani-light-notch" />
      {mode === "dashboard" ? <PhoneDashboard /> : mode === "chat" ? <PhoneChat /> : <PhoneInbox />}
    </div>
  );
}

function PhoneInbox() {
  const { t } = useI18n();
  const rows = [
    { name: "WhatsApp", text: t("landing.experience.phone.inbox.whatsapp"), time: "09:41", tone: "green", Icon: MessageCircle },
    { name: "Instagram", text: t("landing.experience.phone.inbox.instagram"), time: "09:40", tone: "pink", Icon: Sparkles },
    { name: "Telegram", text: t("landing.experience.phone.inbox.telegram"), time: "09:38", tone: "blue", Icon: Send },
    { name: "Kaspi", text: t("landing.experience.phone.inbox.kaspi"), time: "09:37", tone: "red", Icon: WalletCards }
  ];

  return (
    <div className="zani-phone-screen">
      <h4>{t("landing.experience.phone.inbox.title")} <span>12</span></h4>
      {rows.map(({ name, text, time, tone, Icon }, index) => (
        <article className={`zani-inbox-row tone-${tone} ${index === 0 ? "is-latest" : ""}`} data-channel={name.toLowerCase()} key={name}>
          <span><Icon aria-hidden="true" size={18} strokeWidth={2.4} /></span>
          <div>
            <b>{name}</b>
            <p>{text}</p>
          </div>
          <time>{time}</time>
        </article>
      ))}
    </div>
  );
}

function PhoneChat() {
  const { t } = useI18n();

  return (
    <div className="zani-chat-screen">
      <div className="zani-chat-head">
        <span>Z</span>
        <div>
          <b>ZANI Bot</b>
          <p>● {t("landing.experience.phone.online")}</p>
        </div>
      </div>
      <p className="bubble client">{t("landing.experience.phone.chat.client1")}</p>
      <p className="bubble bot">{t("landing.experience.phone.chat.bot1")}</p>
      <p className="bubble client small">{t("landing.experience.phone.chat.client2")}</p>
      <p className="bubble bot">{t("landing.experience.phone.chat.bot2")}</p>
      <div className="zani-chat-input">{t("landing.experience.phone.chat.input")}</div>
    </div>
  );
}

function PhoneDashboard() {
  const { t } = useI18n();

  return (
    <div className="zani-phone-dashboard">
      <h4>{t("landing.experience.today")}</h4>
      <div className="zani-mini-stats">
        <span><b>128</b>{t("landing.experience.metric.leads")}</span>
        <span><b>24</b>{t("landing.experience.metric.records")}</span>
      </div>
      <div className="zani-mini-chart">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <article>
        <b>{t("landing.experience.phone.dashboard.recommendation")}</b>
        <p>{t("landing.experience.phone.dashboard.action")}</p>
      </article>
    </div>
  );
}

function AgentPhone() {
  const { t } = useI18n();
  const [dialogStep, setDialogStep] = useState(0);
  const dialog = [
    { type: "message", tone: "client", text: t("landing.experience.agent.dialog.clientStart") },
    { type: "typing" },
    { type: "message", tone: "bot", text: t("landing.experience.agent.dialog.botSlots") },
    { type: "message", tone: "client small", text: t("landing.experience.agent.dialog.clientTime") },
    { type: "typing" },
    { type: "message", tone: "bot", text: t("landing.experience.agent.dialog.botContact") },
    { type: "message", tone: "client small", text: t("landing.experience.agent.dialog.clientPhone") },
    { type: "typing" },
    { type: "message", tone: "bot", text: t("landing.experience.agent.dialog.botBooked") },
    { type: "message", tone: "system", text: t("landing.experience.agent.dialog.autoReminder") },
    { type: "message", tone: "system", text: t("landing.experience.agent.dialog.autoCampaign") }
  ];
  const currentDialogItem = dialog[dialogStep];

  useEffect(() => {
    const delay = currentDialogItem?.type === "typing" ? 760 : dialogStep === dialog.length - 1 ? 2100 : 1180;
    const timeout = window.setTimeout(() => {
      setDialogStep((step) => (step >= dialog.length - 1 ? 0 : step + 1));
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [currentDialogItem?.type, dialog.length, dialogStep]);

  return (
    <div className="zani-agent-iphone-stage" aria-label={t("landing.experience.phone.aria")}>
      <img
        alt=""
        aria-hidden="true"
        className="zani-agent-iphone"
        src="/backgrounds/hero/zani-orange-iphone-agent-screen.png"
      />
      <div className="zani-agent-phone-ui">
        <div className="zani-agent-status">
          <span>9:41</span>
          <IosStatusIcons />
        </div>
        <div className="zani-agent-chat-head">
          <span>Z</span>
          <div>
            <b>ZANI Bot</b>
            <p>{t("landing.experience.phone.online")}</p>
          </div>
        </div>
        <div className="zani-agent-dialog" aria-live="polite">
          <div className="zani-agent-dialog-track">
            {dialog.map((item, index) =>
              index <= dialogStep && item.type === "typing" && index === dialogStep ? (
                <span className="zani-agent-typing-indicator" key={`typing-${index}`} style={{ "--step": index } as CSSProperties}>
                  <i />
                  <i />
                  <i />
                </span>
              ) : index <= dialogStep && item.type === "message" ? (
                <p className={`zani-agent-bubble ${item.tone}`} key={`${item.tone}-${index}`} style={{ "--step": index } as CSSProperties}>
                  {item.text}
                </p>
              ) : null
            )}
          </div>
        </div>
        <div className="zani-agent-input">{t("landing.experience.phone.chat.input")}</div>
      </div>
    </div>
  );
}

function ClientCardModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="zani-client-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        aria-modal="true"
        className="zani-client-modal"
        role="dialog"
        aria-labelledby="zani-client-card-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="zani-client-modal-close" type="button" aria-label={t("landing.experience.agent.modal.close")} onClick={onClose}>
          ×
        </button>
        <span>{t("landing.experience.agent.modal.status")}</span>
        <h3 id="zani-client-card-title">{t("landing.experience.person.anna")}</h3>
        <p>{t("landing.experience.agent.cardTime")}</p>
        <div className="zani-client-modal-grid">
          <article>
            <b>{t("landing.experience.agent.modal.contact")}</b>
            <p>+7 777 418 22 10</p>
          </article>
          <article>
            <b>{t("landing.experience.agent.modal.source")}</b>
            <p>WhatsApp</p>
          </article>
          <article>
            <b>{t("landing.experience.agent.modal.automation")}</b>
            <p>{t("landing.experience.agent.modal.automationText")}</p>
          </article>
          <article>
            <b>{t("landing.experience.agent.modal.next")}</b>
            <p>{t("landing.experience.agent.modal.nextText")}</p>
          </article>
        </div>
      </section>
    </div>
  );
}

function FloatingChannel({ channel, index }: { channel: (typeof channels)[number]; index: number }) {
  const { t } = useI18n();
  const Icon = channel.icon;
  return (
    <div className={`zani-floating-channel tone-${channel.tone} pos-${index}`} data-channel={channel.name.toLowerCase()}>
      <span><Icon size={18} /></span>
      <div>
        <b>{channel.name}</b>
        <p>{t(channel.textKey)}</p>
      </div>
    </div>
  );
}

function IosStatusIcons() {
  return (
    <span className="zani-ios-status-icons" aria-hidden="true">
      <span className="zani-ios-signal">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="zani-ios-wifi">
        <i />
        <i />
        <i />
      </span>
      <span className="zani-ios-battery">
        <b>33</b>
      </span>
    </span>
  );
}

function ChannelLogo({ kind, name }: { kind: "whatsapp" | "instagram" | "telegram" | "zani"; name: string }) {
  if (kind === "zani") {
    return <span className="zani-logo-mark" aria-hidden="true">Z</span>;
  }

  return (
    <img
      alt=""
      aria-hidden="true"
      draggable="false"
      src={`/integrations_logos/${kind}.png`}
      title={name}
    />
  );
}

function HeroPhone() {
  const { t } = useI18n();
  const notifications = [
    { name: "WhatsApp", text: "Новый клиент: можно записаться сегодня?", tone: "green", kind: "whatsapp" },
    { name: "Instagram", text: "Ответьте, пожалуйста. Нужна цена", tone: "pink", kind: "instagram" },
    { name: "Telegram", text: "Вопрос по записи на завтра", tone: "blue", kind: "telegram" },
    { name: "ZANI", text: t("landing.experience.channel.reply"), tone: "orange", kind: "zani" },
    { name: "WhatsApp", text: "Клиент ждет подтверждение", tone: "green", kind: "whatsapp" }
  ];

  return (
    <div className="zani-generated-iphone-stage" aria-label={t("landing.experience.phone.aria")}>
      <img
        alt=""
        aria-hidden="true"
        className="zani-generated-iphone"
        src="/backgrounds/hero/zani-orange-iphone-front.png"
      />
      <div className="zani-generated-phone-ui">
        <div className="zani-lock-status">
          <span>Tele2</span>
          <IosStatusIcons />
        </div>
        <div className="zani-lock-head">
          <b>Пт 3 июля</b>
          <span>23:38</span>
        </div>
        <div className="zani-lock-title">
          Центр уведомлений
        </div>
        <div className="zani-lock-dnd">
          <i><Clock3 aria-hidden="true" size={14} strokeWidth={2.5} /></i>
          <div>
            <strong>В режиме «Не беспокоить»</strong>
            <p>112, ZANI и YouTube</p>
          </div>
        </div>
        <div className="zani-lock-notifications">
          {notifications.map(({ name, text, tone, kind }, index) => (
            <article className={`zani-lock-notification tone-${tone}`} key={`${name}-${index}`}>
              <i><ChannelLogo kind={kind as "whatsapp" | "instagram" | "telegram" | "zani"} name={name} /></i>
              <div>
                <strong>{name}</strong>
                <p>{text}</p>
              </div>
              <time>сейчас</time>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function Hero() {
  const { t } = useI18n();

  return (
    <section className="zani-light-hero" id="top">
      <div className="zani-stitch-container zani-light-hero-grid">
        <Reveal className="zani-light-hero-copy">
          <span className="zani-kicker">{t("landing.experience.hero.kicker")}</span>
          <h1>
            <span>{t("landing.experience.hero.titleLine1")}</span>
            <span>{t("landing.experience.hero.titleLine2")}</span>
            <span className="zani-hand-accent">
              <img alt={t("landing.experience.hero.titleAccent")} src="/backgrounds/hero/hero-busy-handwriting.png" />
            </span>
          </h1>
          <p>
            {t("landing.experience.hero.text")}
          </p>
          <div className="zani-light-actions">
            <a className="zani-stitch-primary" href={AUTH_ROUTES.signup} data-auth-action="signup" data-auth-intent={t("landing.experience.tryFree")}>
              {t("landing.experience.tryFree")}
              <ArrowRight size={18} />
            </a>
            <a className="zani-light-secondary" href="#agent">
              {t("landing.experience.watchHow")}
            </a>
          </div>
          <div className="zani-light-proof">
            <div><span /> <span /> <span /> <span /></div>
            <p>{t("landing.experience.hero.proof")}</p>
          </div>
        </Reveal>

        <Reveal className="zani-light-hero-visual" delay={0.1}>
          <HeroPhone />
        </Reveal>
      </div>
    </section>
  );
}

function PainSection() {
  const { t } = useI18n();
  const story = [
    ["09:37", t("landing.experience.pain.story.client"), MessageCircle],
    ["09:42", t("landing.experience.pain.story.noAnswer"), Clock3],
    ["09:51", t("landing.experience.pain.story.competitor"), XCircle],
    ["10:05", t("landing.experience.pain.story.money"), CircleDollarSign]
  ];
  const channelDock = [
    { label: "WhatsApp", kind: "whatsapp" },
    { label: "Instagram", kind: "instagram" },
    { label: "Telegram", kind: "telegram" },
    { label: t("landing.experience.channel.calls"), kind: "calls" },
    { label: t("landing.experience.channel.email"), kind: "email" },
    { label: "Kaspi", kind: "kaspi" }
  ];

  return (
    <section className="zani-light-section zani-pain" id="pain">
      <div className="zani-stitch-container zani-two-col">
        <Reveal className="zani-section-copy">
          <h2>{t("landing.experience.pain.title")}</h2>
          <p>{t("landing.experience.pain.text")}</p>
          <div className="zani-channel-dock" aria-label={t("landing.experience.pain.channelsAria")}>
            {channelDock.map((item) => (
              <span className={`tone-${item.kind}`} key={item.label}>
                {["whatsapp", "instagram", "telegram", "kaspi"].includes(item.kind) ? (
                  <img alt="" aria-hidden="true" draggable="false" src={`/integrations_logos/${item.kind}.png`} />
                ) : item.kind === "calls" ? (
                  <PhoneCall aria-hidden="true" size={18} strokeWidth={2.4} />
                ) : (
                  <Mail aria-hidden="true" size={18} strokeWidth={2.4} />
                )}
                {item.label}
              </span>
            ))}
          </div>
        </Reveal>
        <Reveal className="zani-pain-board" delay={0.08}>
          <div className="zani-story-card">
            {story.map(([time, title, Icon], index) => (
              <article className={`step-${index + 1}`} key={title as string}>
                <span>{time as string}</span>
                <i><Icon size={20} /></i>
                <b>{title as string}</b>
                {index < story.length - 1 ? <em /> : null}
              </article>
            ))}
            <div className="zani-story-zani">
              <Sparkles size={20} />
              {t("landing.experience.pain.zani")}
            </div>
          </div>
          <div className="zani-reference-mini">
            <article>
              <b>{t("landing.experience.today")}</b>
              <span>{t("landing.experience.pain.calendar.record")}</span>
              <span>{t("landing.experience.pain.calendar.meeting")}</span>
              <span className="is-lost">{t("landing.experience.pain.calendar.callback")}</span>
              <span>{t("landing.experience.pain.calendar.consult")}</span>
            </article>
            <p>{t("landing.experience.pain.note")}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function AgentSection() {
  const { t } = useI18n();
  const [isClientCardOpen, setIsClientCardOpen] = useState(false);
  const abilities = [
    [t("landing.experience.agent.ability.reply"), t("landing.experience.agent.ability.replyText")],
    [t("landing.experience.agent.ability.details"), t("landing.experience.agent.ability.detailsText")],
    [t("landing.experience.agent.ability.record"), t("landing.experience.agent.ability.recordText")],
    [t("landing.experience.agent.ability.return"), t("landing.experience.agent.ability.returnText")]
  ];

  return (
    <section className="zani-light-section zani-agent" id="agent">
      <div className="zani-stitch-container zani-three-col">
        <Reveal className="zani-section-copy">
          <h2>{t("landing.experience.agent.title")}</h2>
          <p>{t("landing.experience.agent.text")}</p>
        </Reveal>
        <Reveal className="zani-agent-phone" delay={0.08}>
          <AgentPhone />
        </Reveal>
        <Reveal className="zani-agent-flow" delay={0.14}>
          {abilities.map(([title, text]) => (
            <article key={title}>
              <CheckCircle2 size={18} />
              <b>{title}</b>
              <p>{text}</p>
            </article>
          ))}
          <div className="zani-appointment-card">
            <span>{t("landing.experience.agent.cardCreated")}</span>
            <b>{t("landing.experience.person.anna")}</b>
            <p>{t("landing.experience.agent.cardTime")}</p>
            <button type="button" onClick={() => setIsClientCardOpen(true)}>
              {t("landing.experience.agent.openCard")}
            </button>
          </div>
        </Reveal>
      </div>
      {isClientCardOpen ? <ClientCardModal onClose={() => setIsClientCardOpen(false)} /> : null}
    </section>
  );
}

function CrmSection() {
  const { t } = useI18n();
  type CrmLead = {
    id: string;
    name: string;
    phone: string;
    source: string;
    status: string;
    manager: string;
    service: string;
    time: string;
    amount: string;
    score: number;
    risk: number;
    next: string;
    summary: string;
    message: string;
    deals: number;
    bookings: number;
    dialogs: number;
    task: string;
    dealStage: string;
    campaign: string;
    timeline: string[];
    chat: Array<{ from: "client" | "bot"; text: string }>;
  };
  const makeLead = (lead: CrmLead) => lead;
  const crmNiches: Record<string, {
    label: string;
    subtitle: string;
    prompt: string;
    services: string[];
    stats: string[];
    channels: string[];
    automations: string[];
    leads: CrmLead[];
  }> = {
    dentistry: {
      label: "Стоматология",
      subtitle: "Запись к врачу, острая боль, повторные визиты",
      prompt: "AI уточняет жалобу, врача, время, телефон и создает запись.",
      services: ["Терапевт", "Чистка", "Ортодонт", "Имплантация"],
      stats: ["4 новых лида", "2 без ответственного", "1 острая боль"],
      channels: ["WhatsApp", "Instagram", "Сайт"],
      automations: ["Напоминание за 2 часа", "Анкета после визита", "Повторная чистка через 6 мес."],
      leads: [
        makeLead({
          id: "anna",
          name: t("landing.experience.person.anna"),
          phone: "+7 777 418 22 10",
          source: "whatsapp",
          status: "new",
          manager: "Без менеджера",
          service: "Острая боль",
          time: "Сегодня, 16:30",
          amount: "18 000 ₸",
          score: 94,
          risk: 12,
          next: "Подтвердить запись",
          summary: "Клиент жалуется на острую боль. ZANI предложил ближайшие окна и запросил телефон.",
          message: "Здравствуйте. Болит зуб, можно сегодня?",
          deals: 1,
          bookings: 1,
          dialogs: 3,
          task: "Подтвердить запись и отправить адрес",
          dealStage: "Запись создана",
          campaign: "После визита: отзыв + план лечения",
          timeline: ["09:37 входящий WhatsApp", "09:38 ZANI уточнил жалобу", "09:40 запись на 16:30"],
          chat: [
            { from: "client", text: "Здравствуйте. Болит зуб, можно сегодня?" },
            { from: "bot", text: "Есть терапевт в 16:30 и 18:00. Боль острая?" },
            { from: "client", text: "Да, 16:30 подойдет" },
            { from: "bot", text: "Записала. Напоминание придет за 2 часа." }
          ]
        }),
        makeLead({
          id: "aigerim",
          name: "Айгерим Касымова",
          phone: "+7 701 880 14 44",
          source: "instagram",
          status: "contacted",
          manager: "Алия",
          service: "Чистка",
          time: "Завтра, 12:00",
          amount: "24 000 ₸",
          score: 81,
          risk: 28,
          next: "Отправить подготовку к визиту",
          summary: "Клиент спросил цену чистки и свободные окна. Ответ отправлен автоматически.",
          message: "Сколько стоит чистка и когда можно?",
          deals: 1,
          bookings: 1,
          dialogs: 2,
          task: "Отправить памятку перед чисткой",
          dealStage: "Подтверждение",
          campaign: "Через 6 месяцев: повторная чистка",
          timeline: ["10:12 вопрос из Instagram", "10:13 цена отправлена", "10:16 выбрано окно"],
          chat: [
            { from: "client", text: "Сколько стоит чистка?" },
            { from: "bot", text: "24 000 ₸. Есть окно завтра в 12:00." },
            { from: "client", text: "Запишите" },
            { from: "bot", text: "Готово. Отправила памятку." }
          ]
        }),
        makeLead({
          id: "daniyar",
          name: "Данияр Оспанов",
          phone: "+7 705 491 30 02",
          source: "telegram",
          status: "in_progress",
          manager: "Руслан",
          service: "Повторный визит",
          time: "Пятница, 11:00",
          amount: "32 000 ₸",
          score: 76,
          risk: 34,
          next: "Создать повторную запись",
          summary: "Повторный клиент готов прийти утром. Нужна запись к тому же врачу.",
          message: "Можно к моему врачу утром?",
          deals: 1,
          bookings: 0,
          dialogs: 2,
          task: "Проверить врача и подтвердить слот",
          dealStage: "В работе",
          campaign: "После лечения: контрольный осмотр",
          timeline: ["11:20 Telegram", "11:22 ZANI нашел врача", "11:25 ожидает подтверждения"],
          chat: [
            { from: "client", text: "Можно к моему врачу утром?" },
            { from: "bot", text: "Проверяю ближайшее окно у вашего врача." },
            { from: "bot", text: "Есть пятница 11:00. Подтвердить?" }
          ]
        })
      ]
    },
    beauty: {
      label: "Салон красоты",
      subtitle: "Услуга, мастер, окно, допродажа ухода",
      prompt: "AI подбирает мастера, длительность, окно и добавляет услугу.",
      services: ["Маникюр", "Окрашивание", "Стрижка", "Брови"],
      stats: ["5 новых заявок", "3 записи сегодня", "2 допродажи"],
      channels: ["WhatsApp", "Instagram", "Telegram"],
      automations: ["Напоминание за 1 час", "Уход после визита", "Возврат через 3 недели"],
      leads: [
        makeLead({
          id: "aliya",
          name: "Алия Нурлан",
          phone: "+7 777 111 45 90",
          source: "instagram",
          status: "new",
          manager: "Без менеджера",
          service: "Маникюр + снятие",
          time: "Завтра, 17:30",
          amount: "16 000 ₸",
          score: 91,
          risk: 14,
          next: "Подтвердить мастера",
          summary: "Клиент выбрал маникюр с гель-лаком. ZANI добавил снятие и подобрал мастера.",
          message: "Есть маникюр на завтра вечером?",
          deals: 1,
          bookings: 1,
          dialogs: 4,
          task: "Подтвердить мастера Айгуль",
          dealStage: "Запись создана",
          campaign: "Через 3 недели: коррекция и уход",
          timeline: ["13:04 Instagram", "13:05 уточнено покрытие", "13:07 запись 17:30"],
          chat: [
            { from: "client", text: "Есть маникюр на завтра вечером?" },
            { from: "bot", text: "Есть 17:30 у Айгуль. Гель-лак?" },
            { from: "client", text: "Да, и снятие" },
            { from: "bot", text: "Записала: снятие + маникюр + гель-лак." }
          ]
        }),
        makeLead({
          id: "madina",
          name: "Мадина Ермек",
          phone: "+7 701 333 22 18",
          source: "whatsapp",
          status: "contacted",
          manager: "Жанна",
          service: "Окрашивание",
          time: "Суббота, 14:00",
          amount: "42 000 ₸",
          score: 85,
          risk: 25,
          next: "Запросить фото волос",
          summary: "Клиент хочет окрашивание. ZANI запросил фото и предложил консультацию мастера.",
          message: "Хочу окрашивание, можно цену?",
          deals: 1,
          bookings: 0,
          dialogs: 2,
          task: "Передать фото мастеру",
          dealStage: "Консультация",
          campaign: "После окрашивания: уход + повтор через 6 недель",
          timeline: ["15:10 WhatsApp", "15:12 запрошено фото", "15:18 консультация создана"],
          chat: [
            { from: "client", text: "Хочу окрашивание, можно цену?" },
            { from: "bot", text: "Цена зависит от длины. Пришлите фото волос?" },
            { from: "client", text: "Сейчас отправлю" }
          ]
        })
      ]
    },
    restaurant: {
      label: "Ресторан",
      subtitle: "Бронь столика, гости, время, возвратный оффер",
      prompt: "AI проверяет столы, фиксирует бронь и запускает напоминание.",
      services: ["Бронь стола", "Банкет", "Доставка", "День рождения"],
      stats: ["8 броней", "2 банкета", "92% подтверждений"],
      channels: ["WhatsApp", "Instagram", "Сайт"],
      automations: ["Напоминание за 1 час", "Подтверждение гостей", "Оффер на следующий визит"],
      leads: [
        makeLead({
          id: "marat",
          name: "Марат Сейдахмет",
          phone: "+7 701 200 10 20",
          source: "whatsapp",
          status: "new",
          manager: "Без менеджера",
          service: "Бронь на 6 гостей",
          time: "Сегодня, 20:30",
          amount: "60 000 ₸",
          score: 88,
          risk: 18,
          next: "Подтвердить стол у окна",
          summary: "Клиент хочет стол на 6 гостей. ZANI предложил свободные слоты и оформил бронь.",
          message: "Можно столик сегодня вечером на 6 человек?",
          deals: 1,
          bookings: 1,
          dialogs: 3,
          task: "Подготовить стол у окна",
          dealStage: "Бронь подтверждена",
          campaign: "После визита: отзыв + купон на ужин",
          timeline: ["16:05 WhatsApp", "16:06 выбрано 20:30", "16:08 бронь в календаре"],
          chat: [
            { from: "client", text: "Можно столик сегодня на 6?" },
            { from: "bot", text: "Есть 19:00 в зале и 20:30 у окна." },
            { from: "client", text: "20:30 у окна" },
            { from: "bot", text: "Бронь подтверждена на Марат, 6 гостей." }
          ]
        })
      ]
    },
    education: {
      label: "Курсы",
      subtitle: "Пробный урок, уровень, группа, рассылка",
      prompt: "AI квалифицирует ученика, подбирает группу и создает trial.",
      services: ["Английский", "Математика", "IELTS", "Робототехника"],
      stats: ["6 заявок", "4 trial-урока", "2 группы подобраны"],
      channels: ["Instagram", "Сайт", "Telegram"],
      automations: ["Материалы перед уроком", "Follow-up после trial", "Дожим до оплаты"],
      leads: [
        makeLead({
          id: "gulmira",
          name: "Гульмира Ахметова",
          phone: "+7 707 440 55 10",
          source: "website",
          status: "new",
          manager: "Без менеджера",
          service: "Английский для ребенка",
          time: "Суббота, 11:00",
          amount: "35 000 ₸",
          score: 87,
          risk: 22,
          next: "Отправить материалы к trial",
          summary: "Родитель ищет английский для ребенка 9 лет. ZANI подобрал пробный урок.",
          message: "Хочу записать ребенка на английский.",
          deals: 1,
          bookings: 1,
          dialogs: 2,
          task: "Подтвердить пробный урок",
          dealStage: "Trial назначен",
          campaign: "После trial: оффер на абонемент",
          timeline: ["12:41 заявка с сайта", "12:43 уточнен возраст", "12:46 trial в календаре"],
          chat: [
            { from: "client", text: "Хочу записать ребенка на английский." },
            { from: "bot", text: "Возраст и уровень?" },
            { from: "client", text: "9 лет, начинающий" },
            { from: "bot", text: "Есть пробный урок в субботу 11:00." }
          ]
        })
      ]
    }
  };
  const [activeNicheId, setActiveNicheId] = useState("dentistry");
  const activeNiche = crmNiches[activeNicheId];
  const [filter, setFilter] = useState("all");
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState(activeNiche.leads[0].id);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState("leads");
  const [notice, setNotice] = useState(`Демо CRM: ${activeNiche.label}`);
  const [noteDraft, setNoteDraft] = useState("@Команда подтвердить следующий шаг");
  const [demoLeads, setDemoLeads] = useState<CrmLead[]>(activeNiche.leads);

  useEffect(() => {
    const nextNiche = crmNiches[activeNicheId];
    setDemoLeads(nextNiche.leads);
    setSelectedLeadId(nextNiche.leads[0].id);
    setSelectedLeadIds([]);
    setFilter("all");
    setSource("");
    setSearch("");
    setActiveMenu("leads");
    setDrawerOpen(false);
    setNotice(`Ниша выбрана: ${nextNiche.label}`);
    setNoteDraft(`@Команда обработать сценарий: ${nextNiche.subtitle}`);
  }, [activeNicheId]);

  const filters = [
    ["all", "Все"],
    ["new", "Новые"],
    ["hot", "Горячие"],
    ["unanswered", "Без ответа"],
    ["attention", "Внимание"],
    ["mine", "Мои"],
  ];
  const statusLabel: Record<string, string> = {
    new: "Новый",
    contacted: "Связались",
    in_progress: "В работе",
    appointment_created: "Запись создана",
    closed: "Успешно",
    lost: "Потерян",
  };
  const sourceLabel: Record<string, string> = {
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    telegram: "Telegram",
    website: "Сайт",
    manual: "Вручную",
  };
  const counts = {
    all: demoLeads.length,
    new: demoLeads.filter((lead) => lead.status === "new").length,
    hot: demoLeads.filter((lead) => lead.status === "new" && lead.manager === "Без менеджера").length,
    unanswered: demoLeads.filter((lead) => lead.manager === "Без менеджера").length,
    attention: demoLeads.filter((lead) => lead.risk >= 70).length,
    mine: demoLeads.filter((lead) => lead.manager !== "Без менеджера").length,
  };
  const selected = demoLeads.find((lead) => lead.id === selectedLeadId) || demoLeads[0];
  const crmMenu = [
    { id: "leads", label: t("nav.leads"), icon: Inbox, count: counts.new },
    { id: "clients", label: t("nav.clients"), icon: Users },
    { id: "deals", label: t("nav.deals"), icon: KanbanSquare, count: demoLeads.reduce((sum, lead) => sum + lead.deals, 0) },
    { id: "tasks", label: t("nav.tasks"), icon: ListChecks, count: demoLeads.length },
    { id: "calendar", label: t("nav.calendar"), icon: CalendarDays, count: demoLeads.reduce((sum, lead) => sum + lead.bookings, 0) },
  ];
  const filteredLeads = demoLeads.filter((lead) => {
    if (source && lead.source !== source) return false;
    if (filter === "new" && lead.status !== "new") return false;
    if (filter === "hot" && !(lead.status === "new" && lead.manager === "Без менеджера")) return false;
    if (filter === "unanswered" && lead.manager !== "Без менеджера") return false;
    if (filter === "attention" && lead.risk < 70) return false;
    if (filter === "mine" && lead.manager === "Без менеджера") return false;
    const query = search.trim().toLowerCase();
    if (query && !`${lead.name} ${lead.phone} ${lead.service} ${lead.message}`.toLowerCase().includes(query)) return false;
    return true;
  });
  const updateLead = (id: string, patch: Partial<CrmLead>, message: string) => {
    setDemoLeads((leads) => leads.map((lead) => lead.id === id ? { ...lead, ...patch } : lead));
    setNotice(message);
  };
  const toggleBulk = (id: string) => {
    setSelectedLeadIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  };
  const openMenu = (id: string, label?: string) => {
    setActiveMenu(id);
    setNotice(id === "leads" ? `Открыты заявки: ${activeNiche.label}` : `Открыт раздел: ${label || crmMenu.find((item) => item.id === id)?.label}`);
  };
  const moduleActions: Record<string, Array<[string, string]>> = {
    dashboard: [["Открыть заявки", "leads"], ["Клиенты", "clients"], ["Задачи", "tasks"]],
    deals: [["Открыть клиента", "clients"], ["Задачи по сделке", "tasks"], ["Вернуться к заявкам", "leads"]],
    clients: [["Сообщения", "conversations"], ["Сделки", "deals"], ["Календарь", "calendar"]],
    tasks: [["Календарь", "calendar"], ["Клиент", "clients"], ["Заявки", "leads"]],
    calendar: [["Клиент", "clients"], ["Сообщения", "conversations"], ["Задачи", "tasks"]],
    conversations: [["Клиент", "clients"], ["Заявки", "leads"], ["Каналы", "channels"]],
    channels: [["Сообщения", "conversations"], ["Настройки", "settings"], ["Заявки", "leads"]],
    business: [["Календарь", "calendar"], ["Настройки", "settings"], ["Заявки", "leads"]],
    analytics: [["Сделки", "deals"], ["Заявки", "leads"], ["Клиенты", "clients"]],
    settings: [["Каналы", "channels"], ["Бизнес", "business"], ["Заявки", "leads"]],
  };
  const moduleTitle: Record<string, string> = {
    dashboard: `Рабочий стол: ${activeNiche.label}`,
    deals: `Сделка: ${selected.service}`,
    clients: `Клиент: ${selected.name}`,
    tasks: "Задачи менеджера",
    calendar: "Календарь записей",
    conversations: "Диалог с клиентом",
    channels: "Каналы и рассылки",
    business: "Настройки бизнеса",
    analytics: "Аналитика ниши",
    settings: "Правила AI и CRM",
  };
  const moduleText: Record<string, string> = {
    dashboard: `${activeNiche.subtitle}. ${activeNiche.prompt}`,
    deals: `${selected.dealStage}: ${selected.amount}. Следующий шаг - ${selected.next}.`,
    clients: `${selected.phone}. Источник: ${sourceLabel[selected.source]}. История, сделки, записи и диалоги связаны в одной карточке.`,
    tasks: selected.task,
    calendar: `${selected.time}. Услуга: ${selected.service}. Запись создана из входящего обращения.`,
    conversations: selected.message,
    channels: `Подключены каналы: ${activeNiche.channels.join(", ")}. Автоматизации запускаются после записи.`,
    business: `Услуги: ${activeNiche.services.join(", ")}. Эти данные использует AI при записи клиента.`,
    analytics: `CRM считает источники, скорость ответа, записи и деньги по нише "${activeNiche.label}".`,
    settings: `Промт ниши: ${activeNiche.prompt}`,
  };
  const moduleStats: Record<string, string[]> = {
    dashboard: activeNiche.stats,
    deals: [selected.dealStage, selected.amount, selected.campaign],
    clients: [`${selected.dialogs} диалоги`, `${selected.bookings} записи`, `${selected.deals} сделки`],
    tasks: [selected.task, `Next: ${selected.next}`, selected.campaign],
    calendar: [selected.time, selected.service, selected.name],
    conversations: selected.chat.map((item) => `${item.from === "bot" ? "ZANI" : "Клиент"}: ${item.text}`),
    channels: activeNiche.channels,
    business: activeNiche.services,
    analytics: [`AI score ${selected.score}`, `Риск ${selected.risk}%`, selected.amount],
    settings: activeNiche.automations,
  };

  return (
    <section className="zani-light-section zani-crm" id="crm">
      <div className="zani-stitch-container">
        <Reveal className="zani-section-copy zani-center-copy">
          <h2>{t("landing.experience.crm.title")}</h2>
          <p>{t("landing.experience.crm.text")}</p>
        </Reveal>
        <Reveal className="zani-crm-board zani-real-crm-board">
          <aside className="zani-real-crm-sidebar" aria-label="Меню CRM">
            <div className="zani-real-crm-brand">
              <span>Z</span>
              <div>
                <b>{t("sidebar.product")}</b>
                <small>{t("sidebar.subtitle")}</small>
              </div>
            </div>
            <nav>
              {crmMenu.map(({ id, label, icon: Icon, count }) => (
                <button
                  className={activeMenu === id ? "active" : ""}
                  key={id}
                  type="button"
                  onClick={() => openMenu(id, label)}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                  {typeof count === "number" && count > 0 ? <em>{count}</em> : null}
                </button>
              ))}
            </nav>
          </aside>

          <div className="zani-real-crm-content zani-crm-showcase-content">
            <div className="zani-real-crm-niches" aria-label="Выбор ниши CRM">
              {Object.entries(crmNiches).map(([id, niche]) => (
                <button className={activeNicheId === id ? "active" : ""} key={id} type="button" onClick={() => setActiveNicheId(id)}>
                  <b>{niche.label}</b>
                  <span>{niche.subtitle}</span>
                </button>
              ))}
            </div>
            <div className="zani-crm-showcase-hero">
              <div>
                <span>{activeNiche.label}</span>
                <h3>{activeNiche.subtitle}</h3>
                <p>{activeNiche.prompt}</p>
              </div>
              <div className="zani-crm-showcase-stats">
                <strong>{filteredLeads.length}</strong>
                {activeNiche.stats.map((item) => <span key={item}>{item}</span>)}
              </div>
            </div>

            <div className="zani-crm-showcase-flow" aria-label="Сценарий работы CRM">
              {[
                ["leads", "Сообщение", selected.message],
                ["clients", "Клиент", selected.name],
                ["deals", "Сделка", selected.dealStage],
                ["tasks", "Задача", selected.task],
                ["calendar", "Календарь", selected.time],
              ].map(([id, title, text]) => (
                <button className={activeMenu === id ? "active" : ""} key={id} type="button" onClick={() => openMenu(id, title)}>
                  <b>{title}</b>
                  <span>{text}</span>
                </button>
              ))}
            </div>

            <div className="zani-real-crm-notice">{notice}</div>

            <div className="zani-crm-showcase-workspace" aria-live="polite">
              <section className="zani-crm-showcase-primary">
                <span>{crmMenu.find((item) => item.id === activeMenu)?.label}</span>
                <h3>{moduleTitle[activeMenu] || `Заявка: ${selected.service}`}</h3>
                <p>{moduleText[activeMenu] || selected.summary}</p>
                <div className="zani-crm-showcase-actions">
                  <button type="button" onClick={() => updateLead(selected.id, { manager: "Алия", status: "in_progress", next: "Менеджер подключился" }, "Менеджер подключился к заявке")}>Взять в работу</button>
                  <button type="button" onClick={() => updateLead(selected.id, { status: "appointment_created", bookings: selected.bookings + 1, next: "Напоминание перед визитом" }, "Запись создана и попала в календарь")}>Создать запись</button>
                  <button type="button" onClick={() => setDrawerOpen(true)}>Открыть карточку</button>
                </div>
              </section>

              <section className="zani-crm-showcase-detail">
                <div className="zani-crm-showcase-mini-tabs">
                  {demoLeads.map((lead) => (
                    <button className={selected.id === lead.id ? "active" : ""} key={lead.id} type="button" onClick={() => setSelectedLeadId(lead.id)}>
                      {lead.name}
                    </button>
                  ))}
                </div>
                <div className="zani-crm-showcase-chat">
                  {selected.chat.map((item, index) => (
                    <p className={item.from} key={`${item.from}-${index}`}>{item.text}</p>
                  ))}
                </div>
                <div className="zani-crm-showcase-result">
                  <b>{selected.next}</b>
                  <span>{selected.campaign}</span>
                </div>
              </section>
            </div>
          </div>
        </Reveal>
      </div>

      {drawerOpen ? (
        <div className="zani-real-crm-drawer-backdrop" role="presentation" onClick={() => setDrawerOpen(false)}>
          <aside className="zani-real-crm-drawer" role="dialog" aria-modal="true" aria-label="Полная карточка лида" onClick={(event) => event.stopPropagation()}>
            <button type="button" aria-label="Закрыть" onClick={() => setDrawerOpen(false)}>×</button>
            <span>Lead #{selected.id}</span>
            <h3>{selected.name}</h3>
            <p>{selected.phone} · {sourceLabel[selected.source]}</p>
            <nav>
              {['Обзор', 'Таймлайн', 'Задачи', 'Сделки', 'Сообщения', 'Заметки'].map((tab) => <button type="button" key={tab}>{tab}</button>)}
            </nav>
            <section><b>Сводка</b><p>{selected.summary}</p></section>
            <section><b>История</b><p>Лид создан из {sourceLabel[selected.source]}</p><p>{selected.next}</p><p>Ответственный: {selected.manager}</p></section>
            <section><b>Связанные сущности</b><p>{selected.deals} сделки · {selected.bookings} записи · {selected.dialogs} диалоги</p></section>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ value, label, good }: { value: string; label: string; good: string }) {
  return (
    <article>
      <b>{value}</b>
      <span>{label}</span>
      <em>{good}</em>
    </article>
  );
}

function MarketplaceSection() {
  const { t } = useI18n();
  const chain = ["Kaspi", "Wildberries", "Ozon", "AI", "1C", t("landing.experience.integration.moysklad"), t("landing.experience.market.chain.stock"), t("landing.experience.market.chain.prices"), t("landing.experience.market.chain.analytics"), t("landing.experience.market.chain.outreach")];
  return (
    <section className="zani-light-section zani-marketplace" id="marketplace">
      <div className="zani-stitch-container zani-two-col">
        <Reveal className="zani-section-copy">
          <span className="zani-kicker">{t("landing.experience.market.kicker")}</span>
          <h2>{t("landing.experience.market.title")}</h2>
          <p>{t("landing.experience.market.text")}</p>
        </Reveal>
        <Reveal className="zani-market-network" delay={0.08}>
          {chain.map((item, index) => (
            <article className={item === "AI" ? "is-ai" : ""} key={`${item}-${index}`}>
              <span>{item}</span>
              {index < chain.length - 1 ? <i /> : null}
            </article>
          ))}
          <div className="zani-market-insight">
            <BarChart3 size={18} />
            <b>{t("landing.experience.market.dumping")}</b>
            <p>{t("landing.experience.market.dumpingText")}</p>
          </div>
          <div className="zani-market-insight">
            <Store size={18} />
            <b>{t("landing.experience.market.stock")}</b>
            <p>{t("landing.experience.market.stockText")}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function EcosystemSection() {
  const { t } = useI18n();
  const products = ["CRM", "Bots", "AI", "Marketplace", "Loyalty", "Analytics", "Websites", "Landing", "Mobile", "Automation", "Integrations"];
  return (
    <section className="zani-light-section zani-ecosystem" id="ecosystem">
      <div className="zani-stitch-container">
        <Reveal className="zani-section-copy zani-center-copy">
          <span className="zani-kicker">{t("landing.experience.ecosystem.kicker")}</span>
          <h2>{t("landing.experience.ecosystem.title")}</h2>
          <p>{t("landing.experience.ecosystem.text")}</p>
        </Reveal>
        <Reveal className="zani-ecosystem-board">
          <aside>
            <strong>ZANI</strong>
            {products.slice(0, 7).map((item, index) => (
              <span className={index === 0 ? "active" : ""} key={item}>{item}</span>
            ))}
          </aside>
          <main>
            <div className="zani-eco-top">
              <Metric value="12" label={t("landing.experience.metric.channels")} good={t("landing.experience.metric.connected")} />
              <Metric value="248" label={t("landing.experience.metric.leads")} good="+24%" />
              <Metric value="₸2.45M" label={t("landing.experience.metric.revenue")} good="+32%" />
            </div>
            <div className="zani-eco-bento">
              <article>
                <Bot size={22} />
                <b>{t("landing.experience.ecosystem.ai")}</b>
                <p>{t("landing.experience.ecosystem.aiText")}</p>
              </article>
              <article>
                <ShoppingBag size={22} />
                <b>{t("landing.experience.ecosystem.market")}</b>
                <p>{t("landing.experience.ecosystem.marketText")}</p>
              </article>
              <article>
                <CalendarCheck size={22} />
                <b>{t("landing.experience.ecosystem.team")}</b>
                <p>{t("landing.experience.ecosystem.teamText")}</p>
              </article>
            </div>
          </main>
        </Reveal>
      </div>
    </section>
  );
}

function OwnerSection() {
  const { t } = useI18n();
  return (
    <section className="zani-light-section zani-owner" id="owner">
      <div className="zani-stitch-container zani-two-col">
        <Reveal className="zani-section-copy">
          <span className="zani-kicker">{t("landing.experience.owner.kicker")}</span>
          <h2>{t("landing.experience.owner.title")}</h2>
          <p>{t("landing.experience.owner.text")}</p>
          <div className="zani-owner-list">
            <CheckItem icon={ShieldCheck} title={t("landing.experience.owner.control")} text={t("landing.experience.owner.controlText")} />
            <CheckItem icon={LineChart} title={t("landing.experience.owner.growth")} text={t("landing.experience.owner.growthText")} />
          </div>
        </Reveal>
        <Reveal className="zani-owner-dashboard" delay={0.08}>
          <PhoneMockup mode="dashboard" />
          <div className="zani-calm-panel">
            <Metric value="100%" label={t("landing.experience.metric.requestsProcessed")} good={t("landing.experience.hero.titleAccent")} />
            <Metric value="12" label={t("landing.experience.metric.teamOnline")} good={t("landing.experience.metric.working")} />
            <Metric value="₸1.24M" label={t("landing.experience.metric.profitToday")} good="+18%" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function CheckItem({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) {
  return (
    <article>
      <Icon size={20} />
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </article>
  );
}

function IntegrationsSection() {
  const { t } = useI18n();
  const logos = ["WhatsApp", "Instagram", "Telegram", "Kaspi", "1C", t("landing.experience.integration.moysklad"), "Google", "Email", t("landing.experience.integration.telephony")];
  return (
    <section className="zani-light-section zani-integrations" id="integrations">
      <div className="zani-stitch-container">
        <Reveal className="zani-section-copy zani-center-copy">
          <span className="zani-kicker">{t("landing.experience.integrations.kicker")}</span>
          <h2>{t("landing.experience.integrations.title")}</h2>
          <p>{t("landing.experience.integrations.text")}</p>
        </Reveal>
        <Reveal className="zani-integration-grid">
          {logos.map((logo, index) => (
            <article key={logo}>
              <span>{logo.slice(0, 2)}</span>
              <b>{logo}</b>
              {index < logos.length - 1 ? <i /> : null}
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

function ProofSection() {
  const { t } = useI18n();
  const cases = [
    ["+32%", t("landing.experience.proof.repeat"), t("landing.experience.proof.salon"), t("landing.experience.proof.quoteRepeat")],
    ["-47%", t("landing.experience.proof.missed"), t("landing.experience.proof.medical"), t("landing.experience.proof.quoteMissed")],
    [t("landing.experience.proof.connectTime"), t("landing.experience.proof.connect"), t("landing.experience.proof.retail"), t("landing.experience.proof.quoteConnect")]
  ];
  return (
    <section className="zani-light-section zani-proof-section" id="proof">
      <div className="zani-stitch-container">
        <Reveal className="zani-section-copy zani-center-copy">
          <span className="zani-kicker">{t("landing.experience.proof.kicker")}</span>
          <h2>{t("landing.experience.proof.title")}</h2>
        </Reveal>
        <div className="zani-case-grid">
          {cases.map(([value, text, company, quote]) => (
            <Reveal className="zani-case-card" key={value}>
              <strong>{value}</strong>
              <p>{text}</p>
              <blockquote>{quote}</blockquote>
              <span>{company}</span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCtaSection() {
  const { t } = useI18n();
  return (
    <section className="zani-light-section zani-final-cta" id="cta">
      <div className="zani-stitch-container">
        <Reveal className="zani-stitch-cta">
          <h2>
            {t("landing.experience.cta.titlePrefix")} <span>{t("landing.experience.cta.titleAccent")}</span>
          </h2>
          <p>{t("landing.experience.cta.text")}</p>
          <form>
            <input type="email" name="email" placeholder={t("landing.experience.cta.email")} aria-label={t("landing.experience.cta.email")} />
            <a href={AUTH_ROUTES.signup} data-auth-action="signup" data-auth-intent={t("landing.experience.tryFree")}>
              {t("landing.experience.tryFree")}
              <ArrowRight size={18} />
            </a>
          </form>
          <div>
            <span>{t("landing.experience.cta.noCard")}</span>
            <span>{t("landing.experience.cta.fastStart")}</span>
            <span>{t("landing.experience.cta.freeCrm")}</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useI18n();

  return (
    <footer className="zani-stitch-footer" id="footer">
      <div className="zani-stitch-container">
        <div>
          <a className="zani-stitch-brand" href="#top" aria-label="ZANI">
            <span aria-hidden="true">Z</span>
            ZANI
          </a>
          <p>{t("landing.experience.footer.text")}</p>
        </div>
        <nav aria-label={t("landing.experience.footer.aria")}>
          <a href="#agent">{t("landing.experience.nav.agent")}</a>
          <a href="#crm">CRM</a>
          <a href="#marketplace">{t("landing.experience.nav.marketplace")}</a>
          <a href={AUTH_ROUTES.login} data-auth-action="login">{t("landing.experience.login")}</a>
        </nav>
        <small>{t("landing.experience.footer.rights")}</small>
      </div>
    </footer>
  );
}

export default function ZaniExperience() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<LandingSectionId>("top");
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 32, mass: 0.25 });
  const scaleX = useTransform(progress, [0, 1], [0, 1]);

  const sectionIds = useMemo(() => landingSections.map((section) => section.id), []);

  useEffect(() => {
    function scrollToCurrentHash() {
      const id = window.location.hash.slice(1);
      if (!sectionIds.includes(id as LandingSectionId)) return;
      window.requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ block: "start" });
      });
    }

    scrollToCurrentHash();
    window.addEventListener("hashchange", scrollToCurrentHash);
    return () => window.removeEventListener("hashchange", scrollToCurrentHash);
  }, [sectionIds]);

  useEffect(() => {
    function handleAuthClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const trigger = target.closest<HTMLElement>("[data-auth-action]");
      if (!trigger) return;

      event.preventDefault();
      const action = trigger.dataset.authAction;
      if (!action || !AUTH_ACTIONS.has(action)) return;

      const intent = trigger.dataset.authIntent ? normalizeIntent(trigger.dataset.authIntent) : "";
      try {
        if (action === "signup" && intent) {
          window.sessionStorage.setItem("zani_signup_intent", intent);
        } else {
          window.sessionStorage.removeItem("zani_signup_intent");
        }
        const emailInput = trigger.closest("form")?.querySelector<HTMLInputElement>('input[type="email"]');
        const email = emailInput?.value.trim() || "";
        if (action === "signup" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          window.sessionStorage.setItem("zani_signup_email", email);
        } else if (action !== "signup") {
          window.sessionStorage.removeItem("zani_signup_email");
        }
      } catch {
        // Navigation must work even when storage is unavailable.
      }

      navigate(action === "login" ? AUTH_ROUTES.login : AUTH_ROUTES.signup);
    }

    document.addEventListener("click", handleAuthClick);
    return () => document.removeEventListener("click", handleAuthClick);
  }, [navigate]);

  useEffect(() => {
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));

    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const match = landingSections.find((section) => section.id === visible?.target.id);
        if (match) setActiveSection(match.id);
      },
      { rootMargin: "-35% 0px -50% 0px", threshold: [0.1, 0.35, 0.6] }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [sectionIds]);

  return (
    <main className="zani-stitch zani-light">
      <motion.div className="zani-stitch-progress" style={{ scaleX }} />
      <Header activeSection={activeSection} />
      <Hero />
      <PainSection />
      <AgentSection />
      <CrmSection />
      <MarketplaceSection />
      <EcosystemSection />
      <OwnerSection />
      <IntegrationsSection />
      <ProofSection />
      <FinalCtaSection />
      <Footer />
    </main>
  );
}
