import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  LineChart,
  LogIn,
  Mail,
  MessageCircle,
  PhoneCall,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  UsersRound,
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
  { name: "Telegram", icon: Send, tone: "blue", textKey: "landing.experience.channel.telegram" },
  { name: "Instagram", icon: Sparkles, tone: "pink", textKey: "landing.experience.channel.instagram" },
  { name: "Kaspi", icon: WalletCards, tone: "red", textKey: "landing.experience.channel.kaspi" },
  { name: "AI", icon: Bot, tone: "violet", textKey: "landing.experience.channel.ai" },
  { name: "CRM", icon: UsersRound, tone: "orange", textKey: "landing.experience.channel.crm" }
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
      {rows.map(({ name, text, time, tone, Icon }) => (
        <article className={`zani-inbox-row tone-${tone}`} key={name}>
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

function FloatingChannel({ channel, index }: { channel: (typeof channels)[number]; index: number }) {
  const { t } = useI18n();
  const Icon = channel.icon;
  return (
    <div className={`zani-floating-channel tone-${channel.tone} pos-${index}`}>
      <span><Icon size={18} /></span>
      <div>
        <b>{channel.name}</b>
        <p>{t(channel.textKey)}</p>
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
            {t("landing.experience.hero.titlePrefix")} <em>{t("landing.experience.hero.titleAccent")}</em>
          </h1>
          <div className="zani-hand-note">{t("landing.experience.hero.note")}</div>
          <p>
            {t("landing.experience.hero.text")}
          </p>
          <div className="zani-light-actions">
            <a className="zani-stitch-primary" href={AUTH_ROUTES.signup} data-auth-action="signup" data-auth-intent={t("landing.experience.getCrmFree")}>
              {t("landing.experience.getCrmFree")}
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
          <div className="zani-hero-paths" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <PhoneMockup />
          {channels.map((channel, index) => (
            <FloatingChannel channel={channel} index={index} key={channel.name} />
          ))}
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

  return (
    <section className="zani-light-section zani-pain" id="pain">
      <div className="zani-stitch-container zani-two-col">
        <Reveal className="zani-section-copy">
          <span className="zani-kicker">{t("landing.experience.pain.kicker")}</span>
          <h2>{t("landing.experience.pain.title")}</h2>
          <p>{t("landing.experience.pain.text")}</p>
          <div className="zani-channel-dock" aria-label={t("landing.experience.pain.channelsAria")}>
            {["WhatsApp", "Instagram", "Telegram", t("landing.experience.channel.calls"), t("landing.experience.channel.email"), "Kaspi"].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </Reveal>
        <Reveal className="zani-pain-board" delay={0.08}>
          <div className="zani-story-card">
            {story.map(([time, title, Icon], index) => (
              <article key={title as string}>
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
          <span className="zani-kicker">{t("landing.experience.agent.kicker")}</span>
          <h2>{t("landing.experience.agent.title")}</h2>
          <p>{t("landing.experience.agent.text")}</p>
        </Reveal>
        <Reveal className="zani-agent-phone" delay={0.08}>
          <PhoneMockup mode="chat" />
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
            <a href="#crm">{t("landing.experience.agent.openCard")}</a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function CrmSection() {
  const { t } = useI18n();
  const flow = [
    t("landing.experience.crm.flow.message"),
    t("landing.experience.crm.flow.client"),
    t("landing.experience.crm.flow.deal"),
    t("landing.experience.crm.flow.task"),
    t("landing.experience.crm.flow.calendar"),
    t("landing.experience.crm.flow.payment")
  ];
  return (
    <section className="zani-light-section zani-crm" id="crm">
      <div className="zani-stitch-container">
        <Reveal className="zani-section-copy zani-center-copy">
          <span className="zani-kicker">CRM</span>
          <h2>{t("landing.experience.crm.title")}</h2>
          <p>{t("landing.experience.crm.text")}</p>
        </Reveal>
        <Reveal className="zani-crm-board">
          <div className="zani-crm-sidebar">
            {[t("landing.experience.crm.sidebar.home"), t("landing.experience.crm.sidebar.clients"), t("landing.experience.crm.sidebar.deals"), t("landing.experience.crm.sidebar.tasks"), t("landing.experience.crm.flow.calendar")].map((item, index) => <span className={index === 0 ? "active" : ""} key={item}>{item}</span>)}
          </div>
          <div className="zani-crm-main">
            <div className="zani-crm-stats">
              <Metric value="248" label={t("landing.experience.metric.newLeads")} good="+24%" />
              <Metric value="68" label={t("landing.experience.metric.deals")} good="+18%" />
              <Metric value="2.45M ₸" label={t("landing.experience.metric.revenue")} good="+32%" />
            </div>
            <div className="zani-flow-strip">
              {flow.map((item) => (
                <article key={item}>
                  <span>{item}</span>
                  <ArrowRight size={16} />
                </article>
              ))}
            </div>
            <div className="zani-crm-workspace">
              <article>
              <h3>{t("landing.experience.crm.card.new")}</h3>
              <p>{t("landing.experience.crm.card.source")}</p>
              <b>{t("landing.experience.person.anna")}</b>
              <span>{t("landing.experience.crm.card.record")}</span>
            </article>
            <article>
              <h3>{t("landing.experience.crm.tasks.title")}</h3>
              <p>{t("landing.experience.crm.tasks.confirm")}</p>
              <p>{t("landing.experience.crm.tasks.remind")}</p>
              <p>{t("landing.experience.crm.tasks.review")}</p>
            </article>
            <article>
              <h3>{t("landing.experience.crm.flow.calendar")}</h3>
                <div className="zani-calendar-bars">
                  <span />
                  <span />
                  <span />
                </div>
              </article>
            </div>
          </div>
        </Reveal>
      </div>
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
