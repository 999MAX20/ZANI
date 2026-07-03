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
import "./zaniExperience.css";
import "./zaniExperienceMobileFix.css";

const AUTH_ROUTES = {
  signup: "/signup",
  login: "/login"
} as const;

const AUTH_ACTIONS = new Set(["login", "signup"]);

const landingSections = [
  { id: "top", label: "Главная" },
  { id: "pain", label: "Проблема" },
  { id: "agent", label: "AI агент" },
  { id: "crm", label: "CRM" },
  { id: "marketplace", label: "Маркетплейсы" },
  { id: "ecosystem", label: "Экосистема" },
  { id: "owner", label: "Владелец" },
  { id: "integrations", label: "Интеграции" },
  { id: "proof", label: "Кейсы" },
  { id: "cta", label: "Старт" }
] as const;

type LandingSectionId = (typeof landingSections)[number]["id"];

const channels = [
  { name: "WhatsApp", icon: MessageCircle, tone: "green", text: "Новый клиент" },
  { name: "Telegram", icon: Send, tone: "blue", text: "Вопрос по записи" },
  { name: "Instagram", icon: Sparkles, tone: "pink", text: "Ответьте, пожалуйста" },
  { name: "Kaspi", icon: WalletCards, tone: "red", text: "Новый заказ" },
  { name: "AI", icon: Bot, tone: "violet", text: "Отвечает 24/7" },
  { name: "CRM", icon: UsersRound, tone: "orange", text: "Карточка создана" }
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
  return (
    <header className="zani-stitch-header">
      <div className="zani-stitch-header-inner">
        <a className="zani-stitch-brand" href="#top" aria-label="ZANI">
          <span>Z</span>
          ZANI
        </a>
        <a className="zani-mobile-header-cta" href={AUTH_ROUTES.signup} data-auth-action="signup" data-auth-intent="Мобильный старт">
          Старт
        </a>

        <nav aria-label="Основные разделы">
          {landingSections.slice(0, 7).map((section) => (
            <a className={activeSection === section.id ? "is-active" : ""} href={`#${section.id}`} key={section.id}>
              {section.label}
            </a>
          ))}
        </nav>

        <div className="zani-stitch-actions">
          <a className="zani-stitch-login" href={AUTH_ROUTES.login} data-auth-action="login">
            <LogIn size={16} />
            Войти
          </a>
          <a className="zani-stitch-trial" href={AUTH_ROUTES.signup} data-auth-action="signup" data-auth-intent="Попробовать бесплатно">
            Попробовать бесплатно
          </a>
          <LanguageSelector className="zani-stitch-language" />
        </div>
      </div>
    </header>
  );
}

function PhoneMockup({ mode = "inbox" }: { mode?: "inbox" | "chat" | "dashboard" }) {
  return (
    <div className={`zani-light-phone is-${mode}`} aria-label="Телефон с интерфейсом ZANI">
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
  return (
    <div className="zani-phone-screen">
      <h4>Все сообщения <span>12</span></h4>
      {[
        ["WhatsApp", "Здравствуйте! Можно записаться сегодня?", "09:41", "green"],
        ["Instagram", "Ответьте, пожалуйста", "09:40", "pink"],
        ["Telegram", "Добрый день! Есть свободное время?", "09:38", "blue"],
        ["Kaspi", "Новый вопрос покупателя", "09:37", "red"]
      ].map(([name, text, time, tone]) => (
        <article className={`zani-inbox-row tone-${tone}`} key={name}>
          <span>{name.slice(0, 2)}</span>
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
  return (
    <div className="zani-chat-screen">
      <div className="zani-chat-head">
        <span>Z</span>
        <div>
          <b>ZANI Bot</b>
          <p>● онлайн</p>
        </div>
      </div>
      <p className="bubble client">Здравствуйте! Можно записаться сегодня?</p>
      <p className="bubble bot">Здравствуйте. Сегодня есть 16:30 и 18:00. Как вам удобнее?</p>
      <p className="bubble client small">16:30 подойдет</p>
      <p className="bubble bot">Отлично. Записали вас на 16:30. Напоминание придет за час.</p>
      <div className="zani-chat-input">Сообщение...</div>
    </div>
  );
}

function PhoneDashboard() {
  return (
    <div className="zani-phone-dashboard">
      <h4>Сегодня</h4>
      <div className="zani-mini-stats">
        <span><b>128</b>лидов</span>
        <span><b>24</b>записи</span>
      </div>
      <div className="zani-mini-chart">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <article>
        <b>AI рекомендация</b>
        <p>Запустить рассылку на 15:00</p>
      </article>
    </div>
  );
}

function FloatingChannel({ channel, index }: { channel: (typeof channels)[number]; index: number }) {
  const Icon = channel.icon;
  return (
    <div className={`zani-floating-channel tone-${channel.tone} pos-${index}`}>
      <span><Icon size={18} /></span>
      <div>
        <b>{channel.name}</b>
        <p>{channel.text}</p>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="zani-light-hero" id="top">
      <div className="zani-stitch-container zani-light-hero-grid">
        <Reveal className="zani-light-hero-copy">
          <span className="zani-kicker">AI-экосистема для бизнеса</span>
          <h1>
            Ваш бизнес наконец работает <em>спокойно</em>
          </h1>
          <div className="zani-hand-note">даже когда команда занята</div>
          <p>
            ZANI отвечает клиентам, создает заявки, ведет CRM, подключает маркетплейсы и показывает владельцу картину дня без ручного контроля.
          </p>
          <div className="zani-light-actions">
            <a className="zani-stitch-primary" href={AUTH_ROUTES.signup} data-auth-action="signup" data-auth-intent="Получить CRM бесплатно">
              Получить CRM бесплатно
              <ArrowRight size={18} />
            </a>
            <a className="zani-light-secondary" href="#agent">
              Смотреть, как работает
            </a>
          </div>
          <div className="zani-light-proof">
            <div><span /> <span /> <span /> <span /></div>
            <p>Более 14 000 компаний уже растут с ZANI</p>
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
  const story = [
    ["09:37", "Клиент написал", MessageCircle],
    ["09:42", "Ответа нет", Clock3],
    ["09:51", "Выбрал конкурента", XCircle],
    ["10:05", "Деньги ушли", CircleDollarSign]
  ];

  return (
    <section className="zani-light-section zani-pain" id="pain">
      <div className="zani-stitch-container zani-two-col">
        <Reveal className="zani-section-copy">
          <span className="zani-kicker">Боль</span>
          <h2>Клиенты уходят не из-за цены</h2>
          <p>Пока команда переключается между мессенджерами, звонками и таблицами, клиент уже получает ответ в другом месте.</p>
          <div className="zani-channel-dock" aria-label="Каналы, где теряются обращения">
            {["WhatsApp", "Instagram", "Telegram", "Звонки", "Почта", "Kaspi"].map((item) => (
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
              ZANI отвечает до того, как клиент остыл
            </div>
          </div>
          <div className="zani-reference-mini">
            <article>
              <b>Сегодня</b>
              <span>10:00 Запись: Анна</span>
              <span>11:30 Встреча</span>
              <span className="is-lost">14:00 Перезвонить клиенту</span>
              <span>16:30 Консультация</span>
            </article>
            <p>Ничего не забыть!</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function AgentSection() {
  const abilities = [
    ["Ответил сразу", "клиент не ждет менеджера"],
    ["Уточнил детали", "услуга, время и контакт в диалоге"],
    ["Создал запись", "визит и напоминание появились сами"],
    ["Вернул после визита", "просит отзыв и предлагает следующий шаг"]
  ];

  return (
    <section className="zani-light-section zani-agent" id="agent">
      <div className="zani-stitch-container zani-three-col">
        <Reveal className="zani-section-copy">
          <span className="zani-kicker">AI агент</span>
          <h2>AI доводит клиента до записи</h2>
          <p>ZANI не просто отвечает. Он уточняет, предлагает время, фиксирует контакт и передает команде уже готовый результат.</p>
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
            <span>Новая запись создана</span>
            <b>Анна Смирнова</b>
            <p>Сегодня, 16:30 · Консультация</p>
            <a href="#crm">Открыть карточку</a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function CrmSection() {
  const flow = ["Сообщение", "Клиент", "Сделка", "Задача", "Календарь", "Оплата"];
  return (
    <section className="zani-light-section zani-crm" id="crm">
      <div className="zani-stitch-container">
        <Reveal className="zani-section-copy zani-center-copy">
          <span className="zani-kicker">CRM</span>
          <h2>CRM появляется автоматически</h2>
          <p>Менеджеру не нужно переносить данные руками. Сообщение превращается в клиента, сделку, задачу и запись в одном рабочем окне.</p>
        </Reveal>
        <Reveal className="zani-crm-board">
          <div className="zani-crm-sidebar">
            {["Главная", "Клиенты", "Сделки", "Задачи", "Календарь"].map((item, index) => <span className={index === 0 ? "active" : ""} key={item}>{item}</span>)}
          </div>
          <div className="zani-crm-main">
            <div className="zani-crm-stats">
              <Metric value="248" label="новые лиды" good="+24%" />
              <Metric value="68" label="сделки" good="+18%" />
              <Metric value="2.45M ₸" label="выручка" good="+32%" />
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
                <h3>Новая карточка</h3>
                <p>Источник: WhatsApp</p>
                <b>Анна Смирнова</b>
                <span>Запись на сегодня, 16:30</span>
              </article>
              <article>
                <h3>Задачи менеджера</h3>
                <p>Подтвердить запись · 5 мин</p>
                <p>Отправить напоминание · 45 мин</p>
                <p>Попросить отзыв · после визита</p>
              </article>
              <article>
                <h3>Календарь</h3>
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
  const chain = ["Kaspi", "Wildberries", "Ozon", "AI", "1C", "МойСклад", "Остатки", "Цены", "Аналитика", "Рассылки"];
  return (
    <section className="zani-light-section zani-marketplace" id="marketplace">
      <div className="zani-stitch-container zani-two-col">
        <Reveal className="zani-section-copy">
          <span className="zani-kicker">Маркетплейсы</span>
          <h2>Маржа и остатки без ручных таблиц</h2>
          <p>Заказы, остатки, цены и себестоимость сходятся в ZANI. AI видит просадки и подсказывает, что менять сегодня.</p>
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
            <b>Демпинг-бот 24/7</b>
            <p>Следит за ценами и предлагает оптимальную цену.</p>
          </div>
          <div className="zani-market-insight">
            <Store size={18} />
            <b>Склад и остатки</b>
            <p>Остатки и себестоимость подтягиваются автоматически.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function EcosystemSection() {
  const products = ["CRM", "Bots", "AI", "Marketplace", "Loyalty", "Analytics", "Websites", "Landing", "Mobile", "Automation", "Integrations"];
  return (
    <section className="zani-light-section zani-ecosystem" id="ecosystem">
      <div className="zani-stitch-container">
        <Reveal className="zani-section-copy zani-center-copy">
          <span className="zani-kicker">Экосистема</span>
          <h2>ZANI — не CRM. Это операционная система бизнеса</h2>
          <p>Все продукты связаны между собой, чтобы бизнес не собирался из отдельных сервисов вручную.</p>
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
              <Metric value="12" label="каналов" good="подключены" />
              <Metric value="248" label="лидов" good="+24%" />
              <Metric value="₸2.45M" label="выручка" good="+32%" />
            </div>
            <div className="zani-eco-bento">
              <article>
                <Bot size={22} />
                <b>AI отвечает клиентам</b>
                <p>Первый ответ, запись, уточнение и повторная продажа.</p>
              </article>
              <article>
                <ShoppingBag size={22} />
                <b>Маркетплейсы в работе</b>
                <p>Kaspi, WB, Ozon, склад и цены в одном контуре.</p>
              </article>
              <article>
                <CalendarCheck size={22} />
                <b>Команда видит задачи</b>
                <p>Ответственные, дедлайны и история клиента рядом.</p>
              </article>
            </div>
          </main>
        </Reveal>
      </div>
    </section>
  );
}

function OwnerSection() {
  return (
    <section className="zani-light-section zani-owner" id="owner">
      <div className="zani-stitch-container zani-two-col">
        <Reveal className="zani-section-copy">
          <span className="zani-kicker">Владелец</span>
          <h2>Вы открываете кабинет — и все спокойно</h2>
          <p>AI отвечает. Сотрудники видят задачи. Продажи идут. Деньги приходят. Владелец понимает день без звонков каждому менеджеру.</p>
          <div className="zani-owner-list">
            <CheckItem icon={ShieldCheck} title="Все под контролем" text="Клиенты, продажи, задачи и риски видны сразу." />
            <CheckItem icon={LineChart} title="Рост понятен" text="AI подсвечивает, где можно заработать больше." />
          </div>
        </Reveal>
        <Reveal className="zani-owner-dashboard" delay={0.08}>
          <PhoneMockup mode="dashboard" />
          <div className="zani-calm-panel">
            <Metric value="100%" label="заявок обработано" good="спокойно" />
            <Metric value="12" label="сотрудников онлайн" good="работают" />
            <Metric value="₸1.24M" label="прибыль сегодня" good="+18%" />
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
  const logos = ["WhatsApp", "Instagram", "Telegram", "Kaspi", "1C", "МойСклад", "Google", "Email", "Телефония"];
  return (
    <section className="zani-light-section zani-integrations" id="integrations">
      <div className="zani-stitch-container">
        <Reveal className="zani-section-copy zani-center-copy">
          <span className="zani-kicker">Интеграции</span>
          <h2>Не логотипы. Сеть, по которой идут данные</h2>
          <p>Каналы, склад, реклама, почта и телефония связаны в одну рабочую картину.</p>
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
  const cases = [
    ["+32%", "рост повторных продаж", "Салон услуг"],
    ["-47%", "пропущенных заявок", "Медицинский центр"],
    ["15 мин", "до первого подключения", "Розница"]
  ];
  return (
    <section className="zani-light-section zani-proof-section" id="proof">
      <div className="zani-stitch-container">
        <Reveal className="zani-section-copy zani-center-copy">
          <span className="zani-kicker">Доказательство</span>
          <h2>Минимум слов. Видимый результат</h2>
        </Reveal>
        <div className="zani-case-grid">
          {cases.map(([value, text, company]) => (
            <Reveal className="zani-case-card" key={value}>
              <strong>{value}</strong>
              <p>{text}</p>
              <span>{company}</span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCtaSection() {
  return (
    <section className="zani-light-section zani-final-cta" id="cta">
      <div className="zani-stitch-container">
        <Reveal className="zani-stitch-cta">
          <h2>
            Подключите ZANI за несколько минут и дайте бизнесу работать <span>самостоятельно</span>
          </h2>
          <p>CRM бесплатно. Карта не нужна. Подключение начинается сразу после регистрации.</p>
          <form>
            <input type="email" placeholder="Ваш e-mail" aria-label="Ваш e-mail" />
            <a href={AUTH_ROUTES.signup} data-auth-action="signup" data-auth-intent="Начать бесплатно">
              Попробовать бесплатно
              <ArrowRight size={18} />
            </a>
          </form>
          <div>
            <span>Без карты</span>
            <span>Быстрый старт</span>
            <span>CRM бесплатно</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="zani-stitch-footer" id="footer">
      <div className="zani-stitch-container">
        <div>
          <a className="zani-stitch-brand" href="#top">
            <span>Z</span>
            ZANI
          </a>
          <p>AI-экосистема для коммуникаций, продаж, маркетплейсов и контроля команды.</p>
        </div>
        <nav aria-label="Нижняя навигация">
          <a href="#agent">AI агент</a>
          <a href="#crm">CRM</a>
          <a href="#marketplace">Маркетплейсы</a>
          <a href={AUTH_ROUTES.login} data-auth-action="login">Войти</a>
        </nav>
        <small>© 2026 ZANI. Все права защищены.</small>
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
