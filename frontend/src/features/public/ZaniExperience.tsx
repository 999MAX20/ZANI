import { useGSAP } from "@gsap/react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarCheck,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Headphones,
  Inbox,
  LogIn,
  Menu,
  MessageCircle,
  PackageCheck,
  Send,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { LanguageSelector } from "../../components/layout/LanguageSelector";
import { useI18n } from "../../lib/i18n";
import { InteractiveProductDemo } from "./InteractiveProductDemo";
import type { DemoScenario } from "./interactiveDemoScenarios";
import "./zaniExperience.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const AUTH_ROUTES = { login: "/login", signup: "/signup" } as const;

const sections = [
  { id: "top", key: "landing.experience.nav.top" },
  { id: "pain", key: "landing.experience.nav.pain" },
  { id: "agent", key: "landing.experience.nav.agent" },
  { id: "crm", key: "landing.experience.nav.crm" },
  { id: "owner", key: "landing.experience.nav.owner" },
] as const;

function useAuthNavigation() {
  const navigate = useNavigate();

  return (action: keyof typeof AUTH_ROUTES, intent?: string) => {
    try {
      if (action === "signup" && intent) {
        window.sessionStorage.setItem("zani_signup_intent", intent.slice(0, 120));
      }
    } catch {
      // Navigation must remain available when storage is blocked.
    }
    navigate(AUTH_ROUTES[action]);
  };
}

function Header() {
  const { t } = useI18n();
  const goToAuth = useAuthNavigation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="zani-nav">
      <div className="zani-shell zani-nav-inner">
        <a className="zani-brand" href="#top" aria-label="ZANI">
          <span aria-hidden="true">Z</span>
          <b>ZANI</b>
        </a>

        <nav className="zani-nav-links" aria-label={t("landing.experience.nav.aria")}>
          {sections.map((section) => (
            <a href={`#${section.id === "crm" ? "agent" : section.id}`} key={section.id}>{t(section.key)}</a>
          ))}
        </nav>

        <div className="zani-nav-actions">
          <button className="zani-login" type="button" onClick={() => goToAuth("login")}>
            <LogIn size={17} />
            {t("landing.experience.login")}
          </button>
          <button className="zani-button zani-button-small" type="button" onClick={() => goToAuth("signup", t("landing.experience.tryFree"))}>
            {t("landing.experience.tryFree")}
          </button>
          <LanguageSelector className="zani-language" />
        </div>

        <button
          className="zani-menu-button"
          type="button"
          aria-label={t("common.openNavigation")}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>

      {menuOpen ? (
        <nav className="zani-mobile-menu" aria-label={t("landing.experience.nav.aria")}>
          {sections.map((section) => (
            <a href={`#${section.id}`} key={section.id} onClick={() => setMenuOpen(false)}>{t(section.key)}</a>
          ))}
          <button type="button" onClick={() => goToAuth("login")}>{t("landing.experience.login")}</button>
          <LanguageSelector className="zani-language" />
        </nav>
      ) : null}
    </header>
  );
}

const notificationRows = [
  { name: "WhatsApp", key: "landing.experience.phone.inbox.whatsapp", logo: "/integrations_logos/whatsapp.png", scenario: "beauty" },
  { name: "Instagram", key: "landing.experience.phone.inbox.instagram", logo: "/integrations_logos/instagram.png", scenario: "medical" },
  { name: "Telegram", key: "landing.experience.phone.inbox.telegram", logo: "/integrations_logos/telegram.png", scenario: "services" },
] as const;

const marketplaceChannels = [
  { id: "kaspi", name: "Kaspi", product: "Sonic Pro", sku: "KSP-8842", price: "24 990 ₸", margin: "31%", stock: "18" },
  { id: "wildberries", name: "Wildberries", product: "Sonic Mini", sku: "WB-3168", price: "22 490 ₸", margin: "27%", stock: "24" },
  { id: "ozon", name: "Ozon", product: "Sonic Air", sku: "OZN-5021", price: "26 990 ₸", margin: "34%", stock: "11" },
] as const;

type MarketplaceChannelId = (typeof marketplaceChannels)[number]["id"];

function HeroPhone({ onStepChange }: { onStepChange: (step: number) => void }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const [flowStep, setFlowStep] = useState(reduce ? 5 : 0);
  const [channelIndex, setChannelIndex] = useState(0);
  const channel = notificationRows[channelIndex];

  useEffect(() => {
    if (reduce) {
      setFlowStep(5);
      return undefined;
    }

    const delays = [700, 1500, 1650, 1250, 1450, 2600];
    const timer = window.setTimeout(() => {
      if (flowStep >= 5) {
        setFlowStep(0);
      } else {
        setFlowStep((current) => current + 1);
      }
    }, delays[flowStep]);

    return () => window.clearTimeout(timer);
  }, [flowStep, reduce]);

  useEffect(() => {
    onStepChange(flowStep);
  }, [flowStep, onStepChange]);

  function openDemo(scenario: DemoScenario) {
    window.dispatchEvent(new CustomEvent("zani:demo-manual", { detail: { scenario } }));
    document.getElementById("agent")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  function selectChannel(index: number) {
    setChannelIndex(index);
    setFlowStep(reduce ? 5 : 1);
  }

  return (
    <div className="zani-phone-stage" aria-label={t("landing.experience.phone.aria")}>
      <div className="zani-phone-halo" />
      <div className="zani-phone">
        <div className="zani-phone-island" />
        <div className="zani-phone-status">
          <span>9:41</span>
          <span className="zani-ios-status-icons" aria-hidden="true"><i /><i /><i /></span>
        </div>
        <div className="zani-lock-heading">
          <small>{t("landing.experience.today")}</small>
          <strong>9:41</strong>
        </div>
        <div className="zani-notification-list" aria-live="polite">
          <AnimatePresence mode="popLayout">
            {flowStep >= 1 ? (
            <motion.button
              type="button"
              className="zani-notification"
              key={`${channel.name}-incoming`}
              initial={reduce ? false : { opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => openDemo(channel.scenario)}
            >
              <img src={channel.logo} alt="" aria-hidden="true" />
              <div><b>{channel.name}</b><p>{t(channel.key)}</p></div>
              <time>{t("landing.experience.today")}</time>
            </motion.button>
            ) : null}
            {flowStep >= 2 ? (
              <motion.button
                type="button"
                className="zani-notification is-zani"
                key={`${channel.name}-reply`}
                initial={reduce ? false : { opacity: 0, y: -14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => openDemo(channel.scenario)}
              >
                <span className="zani-app-icon">Z</span>
                <div><b>ZANI</b><p>{t("landing.experience.phone.chat.bot1")}</p></div>
                <time>9:41</time>
              </motion.button>
            ) : null}
            {flowStep >= 4 ? (
              <motion.button
                type="button"
                className="zani-notification"
                key={`${channel.name}-choice`}
                initial={reduce ? false : { opacity: 0, y: -14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => openDemo(channel.scenario)}
              >
                <img src={channel.logo} alt="" aria-hidden="true" />
                <div><b>{channel.name}</b><p>{t("landing.experience.phone.chat.client2")}</p></div>
                <time>9:42</time>
              </motion.button>
            ) : null}
            {flowStep >= 5 ? (
              <motion.button
                type="button"
                className="zani-notification is-zani"
                key={`${channel.name}-confirmed`}
                initial={reduce ? false : { opacity: 0, y: -14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => openDemo(channel.scenario)}
              >
                <span className="zani-app-icon">Z</span>
                <div><b>ZANI</b><p>{t("landing.experience.phone.chat.bot2")}</p></div>
                <Check size={17} />
              </motion.button>
            ) : null}
          </AnimatePresence>
        </div>
        <div className="zani-channel-picker" role="group" aria-label={t("landing.experience.heroFlow.channelsAria")}>
          {notificationRows.map((item, index) => (
            <button
              type="button"
              className={index === channelIndex ? "is-active" : undefined}
              aria-pressed={index === channelIndex}
              aria-label={item.name}
              key={item.name}
              onClick={() => selectChannel(index)}
            >
              <img src={item.logo} alt="" aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className="zani-phone-home" />
      </div>
      <AnimatePresence>
        {flowStep >= 3 ? (
          <motion.div
            className="zani-float-card zani-float-card-left"
            initial={reduce ? false : { opacity: 0, x: 18, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 12, scale: 0.94 }}
          >
            <Inbox size={18} />
            <div><b>{t("landing.experience.heroFlow.leadTitle")}</b><span>{t("landing.experience.heroFlow.leadText")} · {channel.name}</span></div>
          </motion.div>
        ) : null}
        {flowStep >= 5 ? (
          <motion.div
            className="zani-float-card zani-float-card-right"
            initial={reduce ? false : { opacity: 0, x: -18, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -12, scale: 0.94 }}
          >
            <CalendarCheck size={18} />
            <div><b>{t("landing.experience.heroFlow.bookingTitle")}</b><span>{t("landing.experience.heroFlow.bookingText")}</span></div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Hero() {
  const { t } = useI18n();
  const [flowStep, setFlowStep] = useState(0);
  const statusKeys = [
    "landing.experience.heroFlow.status.waiting",
    "landing.experience.heroFlow.status.message",
    "landing.experience.heroFlow.status.replied",
    "landing.experience.heroFlow.status.lead",
    "landing.experience.heroFlow.status.time",
    "landing.experience.heroFlow.status.booked",
  ] as const;

  function openManualDemo() {
    window.dispatchEvent(new CustomEvent("zani:demo-manual", { detail: { scenario: "beauty" } }));
    document.getElementById("agent")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="zani-hero" id="top">
      <div className="zani-shell zani-hero-grid">
        <div className="zani-hero-copy">
          <div className="zani-hero-kicker-row">
            <p className="zani-eyebrow">{t("landing.experience.hero.kicker")}</p>
            <p className="zani-hero-script">{t("landing.experience.hero.note")}</p>
          </div>
          <h1>
            {t("landing.experience.hero.titlePrefix")}{" "}
            <em>{t("landing.experience.hero.titleAccent")}</em>
          </h1>
          <p className="zani-hero-lead">{t("landing.experience.hero.text")}</p>
          <div className="zani-hero-actions">
            <button className="zani-button" type="button" onClick={openManualDemo}>
              {t("landing.experience.hero.tryMessage")}
              <ArrowRight size={19} />
            </button>
            <a
              className="zani-text-link"
              href="#agent"
              onClick={() => window.dispatchEvent(new CustomEvent("zani:demo-manual", { detail: { scenario: "beauty" } }))}
            >
              {t("landing.experience.watchHow")}<ChevronRight size={18} />
            </a>
          </div>
          <p className="zani-hero-flow-status" aria-live="polite">
            <span aria-hidden="true" />
            {t(statusKeys[flowStep] ?? statusKeys[0])}
          </p>
        </div>
        <HeroPhone onStepChange={setFlowStep} />
      </div>
    </section>
  );
}

function PainSection() {
  const { t } = useI18n();

  function openManualDemo() {
    window.dispatchEvent(new CustomEvent("zani:demo-manual", { detail: { scenario: "beauty" } }));
    document.getElementById("agent")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="zani-pain" id="pain">
      <div className="zani-shell zani-pain-strip">
        <motion.div
          className="zani-pain-message"
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <img src="/integrations_logos/whatsapp.png" alt="" aria-hidden="true" />
          <div><b>WhatsApp</b><p>{t("landing.experience.phone.inbox.whatsapp")}</p></div>
          <time>09:37</time>
        </motion.div>
        <div className="zani-pain-wait">
          <strong>05:00</strong>
          <div><small>{t("landing.experience.pain.compact.timer")}</small><p>{t("landing.experience.pain.compact.text")}</p></div>
        </div>
        <button className="zani-text-link zani-pain-action" type="button" onClick={openManualDemo}>
          {t("landing.experience.pain.compact.action")}<ArrowRight size={18} />
        </button>
      </div>
    </section>
  );
}

function ChatScene() {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const messages = [
    ["client", "landing.experience.agent.dialog.clientStart"],
    ["bot", "landing.experience.agent.dialog.botSlots"],
    ["client", "landing.experience.agent.dialog.clientTime"],
    ["bot", "landing.experience.agent.dialog.botContact"],
    ["client", "landing.experience.agent.dialog.clientPhone"],
    ["bot", "landing.experience.agent.dialog.botBooked"],
  ] as const;

  return (
    <div className="zani-chat-product">
      <div className="zani-chat-header"><span>Z</span><div><b>ZANI Bot</b><small>{t("landing.experience.phone.online")}</small></div></div>
      <div className="zani-chat-messages">
        {messages.map(([role, key], index) => (
          <motion.p
            className={`zani-bubble is-${role}`}
            key={key}
            initial={reduce ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ delay: index * 0.11, duration: 0.42 }}
          >
            {t(key)}
          </motion.p>
        ))}
      </div>
      <div className="zani-chat-input"><span>{t("landing.experience.phone.chat.input")}</span><Send size={17} /></div>
    </div>
  );
}

function AgentScene() {
  const { t } = useI18n();
  const abilities = [
    [Clock3, "landing.experience.agent.ability.reply", "landing.experience.agent.ability.replyText"],
    [MessageCircle, "landing.experience.agent.ability.details", "landing.experience.agent.ability.detailsText"],
    [CalendarCheck, "landing.experience.agent.ability.record", "landing.experience.agent.ability.recordText"],
    [Sparkles, "landing.experience.agent.ability.return", "landing.experience.agent.ability.returnText"],
  ] as const;

  return (
    <article className="zani-story-card zani-agent-card" id="agent">
      <div className="zani-story-copy">
        <h2>{t("landing.experience.agent.title")}</h2>
        <p>{t("landing.experience.agent.text")}</p>
        <div className="zani-ability-list">
          {abilities.map(([Icon, title, text]) => (
            <div key={title}><Icon size={19} /><span><b>{t(title)}</b><small>{t(text)}</small></span></div>
          ))}
        </div>
      </div>
      <div className="zani-agent-visual">
        <ChatScene />
        <div className="zani-created-card">
          <span><Check size={19} /></span>
          <div><b>{t("landing.experience.agent.cardCreated")}</b><p>{t("landing.experience.person.anna")}</p><small>{t("landing.experience.agent.cardTime")}</small></div>
        </div>
      </div>
    </article>
  );
}

function CrmScene() {
  const { t } = useI18n();
  const flow = [
    [MessageCircle, "landing.experience.crm.flow.message"],
    [Users, "landing.experience.crm.flow.client"],
    [CircleDollarSign, "landing.experience.crm.flow.deal"],
    [Check, "landing.experience.crm.flow.task"],
    [CalendarCheck, "landing.experience.crm.flow.calendar"],
  ] as const;

  return (
    <article className="zani-story-card zani-crm-card" id="crm">
      <div className="zani-crm-visual">
        <aside>
          <span className="zani-crm-logo">Z</span>
          {[Inbox, Users, CircleDollarSign, CalendarCheck].map((Icon, index) => <span key={index}><Icon size={19} /></span>)}
        </aside>
        <div className="zani-crm-main">
          <div className="zani-crm-top"><b>{t("landing.experience.crm.sidebar.home")}</b><span>{t("landing.experience.today")}</span></div>
          <div className="zani-crm-metrics">
            <article><span>{t("landing.experience.metric.newLeads")}</span><b>12</b><small>+4</small></article>
            <article><span>{t("landing.experience.metric.deals")}</span><b>7</b><small>+2</small></article>
            <article><span>{t("landing.experience.metric.revenue")}</span><b>2.4M ₸</b><small>+18%</small></article>
          </div>
          <div className="zani-crm-customer">
            <span>АС</span>
            <div><b>{t("landing.experience.person.anna")}</b><p>{t("landing.experience.crm.card.source")}</p></div>
            <strong>{t("landing.experience.crm.card.record")}</strong>
          </div>
          <div className="zani-crm-chart"><i /><i /><i /><i /><i /><i /><i /></div>
        </div>
      </div>
      <div className="zani-story-copy">
        <h2>{t("landing.experience.crm.title")}</h2>
        <p>{t("landing.experience.crm.text")}</p>
        <div className="zani-flow-list">
          {flow.map(([Icon, key], index) => <span key={key}><Icon size={18} />{t(key)}{index < flow.length - 1 ? <ChevronRight size={15} /> : null}</span>)}
        </div>
      </div>
    </article>
  );
}

function MarketplaceScene() {
  const { t } = useI18n();
  const [activeChannelId, setActiveChannelId] = useState<MarketplaceChannelId>("kaspi");
  const [recommendationApplied, setRecommendationApplied] = useState(false);
  const activeChannel = marketplaceChannels.find((channel) => channel.id === activeChannelId) ?? marketplaceChannels[0];

  return (
    <article className="zani-story-card zani-market-card" id="marketplace">
      <div className="zani-story-copy">
        <h2>{t("landing.experience.market.title")}</h2>
        <p>{t("landing.experience.market.text")}</p>
        <div className="zani-market-benefits">
          <div><BarChart3 size={20} /><span><b>{t("landing.experience.market.dumping")}</b><small>{t("landing.experience.market.dumpingText")}</small></span></div>
          <div><PackageCheck size={20} /><span><b>{t("landing.experience.market.stock")}</b><small>{t("landing.experience.market.stockText")}</small></span></div>
        </div>
      </div>
      <div className="zani-market-visual">
        <div className="zani-market-tabs" role="tablist" aria-label={t("landing.experience.nav.marketplace")}>
          {marketplaceChannels.map((channel) => (
            <button
              type="button"
              role="tab"
              className={channel.id === activeChannelId ? "is-active" : undefined}
              aria-selected={channel.id === activeChannelId}
              aria-controls="zani-market-channel-panel"
              id={`zani-market-tab-${channel.id}`}
              key={channel.id}
              onClick={() => {
                setActiveChannelId(channel.id);
                setRecommendationApplied(false);
              }}
            >
              {channel.name}
            </button>
          ))}
        </div>
        <div
          id="zani-market-channel-panel"
          role="tabpanel"
          aria-labelledby={`zani-market-tab-${activeChannel.id}`}
        >
        <div className="zani-product-row">
          <span><ShoppingBag size={25} /></span>
          <div><b>{activeChannel.product}</b><small>SKU {activeChannel.sku}</small></div>
          <strong>{activeChannel.price}</strong>
        </div>
        <div className="zani-market-metrics"><article><b>{activeChannel.margin}</b><span>{t("landing.experience.metric.profitToday")}</span></article><article><b>{activeChannel.stock}</b><span>{t("landing.experience.market.chain.stock")}</span></article></div>
        <div className={`zani-ai-note${recommendationApplied ? " is-applied" : ""}`} aria-live="polite">
          <Sparkles size={20} />
          <p>{t(recommendationApplied ? "ai.widget.applied" : "landing.experience.phone.dashboard.action")}</p>
          <button
            type="button"
            aria-label={t(recommendationApplied ? "ai.widget.applied" : "landing.experience.phone.dashboard.action")}
            disabled={recommendationApplied}
            onClick={() => setRecommendationApplied(true)}
          >
            <Check size={17} />
          </button>
        </div>
        </div>
      </div>
    </article>
  );
}

function StoryStack() {
  return <InteractiveProductDemo />;
}

function EcosystemSection() {
  const { t } = useI18n();
  const blocks = [
    [Bot, "landing.experience.ecosystem.ai", "landing.experience.ecosystem.aiText", "strong"],
    [Users, "landing.experience.ecosystem.team", "landing.experience.ecosystem.teamText", "warm"],
    [Headphones, "landing.experience.integrations.title", "landing.experience.integrations.text", "plain"],
  ] as const;

  return (
    <section className="zani-section zani-ecosystem" id="ecosystem">
      <div className="zani-shell">
        <div className="zani-section-heading"><h2>{t("landing.experience.ecosystem.title")}</h2><p>{t("landing.experience.ecosystem.text")}</p></div>
        <div className="zani-bento">
          {blocks.map(([Icon, title, text, tone]) => <article className={`is-${tone}`} key={title}><Icon size={25} /><h3>{t(title)}</h3><p>{t(text)}</p></article>)}
        </div>
      </div>
    </section>
  );
}

function OwnerSection() {
  const { t } = useI18n();
  return (
    <section className="zani-section zani-owner" id="owner">
      <div className="zani-shell zani-owner-grid">
        <div className="zani-owner-copy"><h2>{t("landing.experience.owner.title")}</h2><p>{t("landing.experience.owner.text")}</p></div>
        <div className="zani-owner-board">
          <div className="zani-owner-top"><b>{t("landing.experience.owner.control")}</b><span>{t("landing.experience.today")}</span></div>
          <div className="zani-owner-numbers">
            <article><b>1</b><span>{t("landing.demo.result.client")}</span></article>
            <article><b>16:30</b><span>{t("landing.demo.result.appointment")}</span></article>
            <article><b>35 000 ₸</b><span>{t("landing.demo.result.value")}</span></article>
          </div>
          <div className="zani-owner-activity">
            <span><MessageCircle size={17} />WhatsApp</span>
            <span><Bot size={17} />{t("landing.experience.heroFlow.status.replied")}</span>
            <span><Users size={17} />{t("landing.experience.heroFlow.status.lead")}</span>
            <span><CalendarCheck size={17} />16:30</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProofSection() {
  const { t } = useI18n();
  const facts = [
    ["0 ₸", "landing.demo.proof.freeCrm", "landing.demo.proof.freeCrmText"],
    [t("landing.experience.proof.noCardValue"), "landing.experience.proof.noCard", "landing.experience.proof.noCardText"],
    [t("landing.experience.proof.demoValue"), "landing.experience.proof.demo", "landing.experience.proof.demoText"],
  ] as const;
  return (
    <section className="zani-section zani-proof" id="proof">
      <div className="zani-shell">
        <div className="zani-section-heading"><h2>{t("landing.demo.proof.title")}</h2><p>{t("landing.demo.proof.text")}</p></div>
        <div className="zani-proof-grid">
          {facts.map(([value, label, text]) => <article key={label}><strong>{value}</strong><span>{t(label)}</span><p>{t(text)}</p></article>)}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  const { t } = useI18n();
  const goToAuth = useAuthNavigation();
  return (
    <section className="zani-cta" id="cta">
      <div className="zani-shell zani-cta-inner">
        <div><h2>{t("landing.experience.cta.titlePrefix")} <em>{t("landing.experience.cta.titleAccent")}</em></h2><p>{t("landing.experience.cta.text")}</p></div>
        <button className="zani-button zani-button-dark" type="button" onClick={() => goToAuth("signup", t("landing.experience.tryFree"))}>{t("landing.experience.tryFree")}<ArrowRight size={20} /></button>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="zani-footer">
      <div className="zani-shell">
        <a className="zani-brand" href="#top"><span>Z</span><b>ZANI</b></a>
        <p>{t("landing.experience.footer.text")}</p>
        <nav aria-label={t("landing.experience.footer.aria")}><a href="#agent">{t("landing.experience.nav.agent")}</a><a href="#crm">CRM</a><a href="#ecosystem">{t("landing.experience.nav.marketplace")}</a><a href={AUTH_ROUTES.login}>{t("landing.experience.login")}</a></nav>
        <small>{t("landing.experience.footer.rights")}</small>
      </div>
    </footer>
  );
}

export default function ZaniExperience() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const location = useLocation();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 32, mass: 0.2 });

  useEffect(() => {
    const id = location.hash.slice(1);
    if (!id) return undefined;
    let timeout = 0;
    const scrollToAnchor = () => document.getElementById(id)?.scrollIntoView({ block: "start" });
    const frame = window.requestAnimationFrame(() => {
      scrollToAnchor();
      timeout = window.setTimeout(scrollToAnchor, 80);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [location.hash]);

  useGSAP(() => {
    if (!rootRef.current) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(".zani-hero-copy > *", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.72, stagger: 0.09, ease: "power3.out" });
      gsap.fromTo(".zani-phone-stage", { opacity: 0, scale: 0.92, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 1, ease: "power3.out" });
      gsap.utils.toArray<HTMLElement>(".zani-section-heading, .zani-bento, .zani-owner-board, .zani-proof-grid").forEach((element) => {
        gsap.fromTo(element, { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.75, ease: "power3.out", scrollTrigger: { trigger: element, start: "top 86%", once: true } });
      });
    });
    return () => media.revert();
  }, { scope: rootRef });

  return (
    <div className="zani-public" ref={rootRef}>
      <motion.div className="zani-scroll-progress" style={{ scaleX }} />
      <a className="zani-skip-link" href="#top">{t("common.skipToContent")}</a>
      <Header />
      <Hero />
      <PainSection />
      <StoryStack />
      <EcosystemSection />
      <OwnerSection />
      <ProofSection />
      <FinalCta />
      <Footer />
    </div>
  );
}
