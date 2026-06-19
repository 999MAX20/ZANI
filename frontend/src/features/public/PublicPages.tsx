import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

import "./publicHeroV1.css";

const heroBase = "/backgrounds/hero/v2";
const legacyHeroBase = "/backgrounds/hero/layers";
const aiBotsBase = "/backgrounds/ai-bots";

const layers = {
  scene: `${heroBase}/hero-scene-formatted.webp`,
  berkut: `${heroBase}/berkut.webp`,
};

const aiBotsAssets = {
  background: `${aiBotsBase}/brick-bg.webp`,
  monkey: `${aiBotsBase}/monkey-phone.webp`,
  ownerMonkey: `${aiBotsBase}/owner-monkey-smile.webp`,
  bubble: `${aiBotsBase}/speech-bubble.webp`,
};

const moneyLeads = [
  { id: "whatsapp", src: `${legacyHeroBase}/lead-whatsapp.png`, alt: "Заявка из WhatsApp", delay: 0 },
  { id: "telegram", src: `${legacyHeroBase}/lead-telegram.png`, alt: "Заявка из Telegram", delay: 2.6 },
  { id: "instagram", src: `${legacyHeroBase}/lead-instagram.png`, alt: "Заявка из Instagram", delay: 5.2 },
  { id: "site", src: `${legacyHeroBase}/lead-site.png`, alt: "Заявка с сайта", delay: 7.8 },
  { id: "kaspi", src: `${legacyHeroBase}/lead-kaspi.png`, alt: "Заявка из Kaspi", delay: 10.4 },
];

const resultPopups = ["+85 000 ₸", "+125 000 ₸", "Клиент записан", "Сделка создана", "Оплата получена"];

const featureCards = [
  { title: "CRM бесплатно", text: "Навсегда.\nБез скрытых платежей.", metric: "0 ₸ скрытых платежей" },
  { title: "Ваши данные в безопасности", text: "Серверы в Казахстане.\nРезервное копирование.", metric: "KZ серверы" },
  { title: "Боты и AI работают 24/7", text: "Без выходных.\nБез перерывов.", metric: "24/7" },
  { title: "Рост прибыли", text: "Аналитика.\nАвтоматизация.\nРекомендации.", metric: "+ прибыль" },
];

const aiBotsFeatures = [
  { title: "Отвечают мгновенно 24/7", text: "Не теряют ни одного клиента" },
  { title: "Записывают и напоминают", text: "Клиент не забудет о визите" },
  { title: "Автоматически создают лиды", text: "Вся информация в CRM" },
  { title: "Передают менеджеру", text: "Ничего не теряется" },
  { title: "Доводят до оплаты", text: "Больше записей и выручки" },
];

const aiBotCards = [
  { title: "Консультант-бот", text: "Отвечает на вопросы\nи квалифицирует клиентов", tone: "yellow" },
  { title: "Запись-бот", text: "Записывает клиентов\nи подбирает удобное время", tone: "purple" },
  { title: "Напоминание-бот", text: "Отправляет напоминания\nи снижает количество неявок", tone: "green" },
  { title: "Оплата-бот", text: "Отправляет ссылки\nна оплату и проверяет платежи", tone: "blue" },
];

const integrationItems = [
  { name: "WhatsApp", detail: "Business", mark: "W", tone: "green" },
  { name: "Instagram", detail: "Direct", mark: "I", tone: "pink" },
  { name: "Telegram", detail: "бот", mark: "T", tone: "blue" },
  { name: "Сайт", detail: "Форма", mark: "S", tone: "white" },
  { name: "Kaspi", detail: "Магазин", mark: "K", tone: "red" },
  { name: "API", detail: "и другие", mark: "API", tone: "dark" },
];

const pipelineSteps = [
  { title: "Запись создана", rows: ["Пациент: Андрей", "Телефон: +7 777 123 45 67", "Услуга: Первый прием", "Время: 18:00", "Источник: WhatsApp"], time: "14:33" },
  { title: "Лид в CRM", rows: ["Статус: Записан", "Менеджер: Назначен автоматически", "Приоритет: Высокий"], time: "14:33" },
  { title: "Напоминания отправлены", rows: ["За 24 часа", "За 3 часа", "За 1 час"], time: "14:35" },
  { title: "Пациент пришел", rows: ["Визит подтвержден"], time: "18:02" },
  { title: "Прием проведен", rows: ["Услуга: Лечение зуба", "Врач: Данияр Р.", "Статус: Завершен"], time: "19:05" },
  { title: "Сделка завершена", rows: ["Сумма:", "85 000 ₸", "Статус: Оплачено"], time: "19:15", success: true },
];

const aiMetrics = [
  { value: "98%", label: "Заявок обрабатываются автоматически" },
  { value: "-70%", label: "Времени на обработку заявок" },
  { value: "+45%", label: "Больше записей на прием" },
  { value: "24/7", label: "Боты работают без выходных" },
];

const ownerSignals = [
  { title: "Реальные данные", text: "в режиме времени" },
  { title: "AI находит проблемы", text: "и точки роста" },
  { title: "Контроль команды", text: "и качества работы" },
  { title: "Больше прибыли", text: "меньше потерь" },
];

const ownerKpis = [
  { label: "Выручка сегодня", value: "1 245 000 ₸", change: "↗ +42%" },
  { label: "Новые заявки", value: "34", change: "↗ +12%" },
  { label: "Без ответа", value: "14", change: "↗ -20%", alert: true },
  { label: "Конверсия", value: "5%", change: "↗ +1.3%" },
];

const ownerProblems = [
  { title: "14 клиентов ждут ответа", text: "Потенциально потеряно", value: "420 000 ₸", tone: "red" },
  { title: "Администратор Мария", text: "Отвечает на 42% медленнее остальных", tone: "yellow" },
  { title: "3 заявки без статуса", text: "Уточните и не теряйте клиентов", tone: "yellow" },
];

const ownerSources = [
  { name: "Instagram", value: "45%" },
  { name: "WhatsApp", value: "30%" },
  { name: "Telegram", value: "15%" },
  { name: "Сайт", value: "7%" },
  { name: "Звонки", value: "3%" },
];

const ownerStages = [
  { name: "Новая заявка", value: "100% (234)", width: "100%" },
  { name: "В работе", value: "60% (140)", width: "60%" },
  { name: "Предложение", value: "35% (82)", width: "35%" },
  { name: "Переговоры", value: "20% (47)", width: "20%" },
  { name: "Сделка", value: "5% (12)", width: "5%" },
];

const ownerTeam = [
  { name: "Алексей", value: "78 заявок", percent: "92%" },
  { name: "Мария", value: "54 заявки", percent: "58%" },
  { name: "Дмитрий", value: "48 заявок", percent: "85%" },
  { name: "София", value: "32 заявки", percent: "90%" },
];

function PublicLandingHeader({ navHidden }: { navHidden: boolean }) {
  return (
    <header className={`zani-public-header${navHidden ? " zani-public-header--nav-hidden" : ""}`}>
      <span className="zani-public-header__spacer" aria-hidden="true" />
      <nav className="zani-public-header__nav" aria-label="Главная навигация">
        {["Возможности", "Интеграции", "Тарифы", "Кейсы", "О нас"].map((item) => (
          <a key={item} href={`#${item.toLowerCase()}`}>
            {item}
          </a>
        ))}
      </nav>
      <div className="zani-public-header__actions">
        <Link to="/login" className="zani-public-header__login">
          Войти
        </Link>
        <Link to="/contacts" className="zani-public-header__try">
          Попробовать бесплатно
        </Link>
      </div>
    </header>
  );
}

function HeroMoneyFlow() {
  return (
    <div className="zani-v2__money-flow" aria-hidden="true">
      <div className="zani-v2__trail zani-v2__trail--main" />
      <div className="zani-v2__trail zani-v2__trail--soft" />
      <div className="zani-v2__trail zani-v2__trail--thin" />
      {moneyLeads.map((lead) => (
        <motion.img
          key={lead.id}
          className={`zani-v2__money-lead zani-v2__money-lead--${lead.id}`}
          src={lead.src}
          alt={lead.alt}
          animate={{
            opacity: [0, 1, 1, 0],
            x: [0, 96, 210, 330],
            y: [0, -20, 32, 126],
            rotate: [-4, -1, 3, -2],
            scale: [0.92, 1.04, 1.02, 0.96],
          }}
          transition={{
            delay: lead.delay,
            duration: 1.8,
            ease: [0.2, 0.78, 0.22, 1],
            repeat: Infinity,
            repeatDelay: 11.2,
            times: [0, 0.28, 0.76, 1],
          }}
        />
      ))}
      {Array.from({ length: 14 }).map((_, index) => (
        <span
          key={index}
          className={`zani-v2__flow-particle zani-v2__flow-particle--${(index % 4) + 1}`}
          style={{ animationDelay: `${index * 0.34}s` }}
        />
      ))}
      <span className="zani-v2__spark zani-v2__spark--start" />
      <span className="zani-v2__spark zani-v2__spark--finish" />
      <span className="zani-v2__dust zani-v2__dust--one" />
      <span className="zani-v2__dust zani-v2__dust--two" />
    </div>
  );
}

function HeroResultPopups() {
  return (
    <div className="zani-v2__results" aria-hidden="true">
      {resultPopups.map((popup, index) => (
        <span key={popup} style={{ animationDelay: `${index * 2.6 + 1.72}s` }}>
          {popup}
        </span>
      ))}
    </div>
  );
}

function HeroFeatures() {
  return (
    <section className="zani-v2__features" aria-label="Преимущества">
      {featureCards.map((card) => (
        <article key={card.title} className="zani-v2__feature">
          <h2>{card.title}</h2>
          <p>{card.text}</p>
          <strong className="zani-v2__feature-metric">{card.metric}</strong>
        </article>
      ))}
    </section>
  );
}

function HeroSection() {
  return (
    <section className="zani-v2" aria-label="Главный экран ZANI">
      <img className="zani-v2__scene" src={layers.scene} alt="" aria-hidden="true" />
      <div className="zani-v2__berkut-flight" aria-hidden="true">
        <img className="zani-v2__berkut" src={layers.berkut} alt="" />
      </div>
      <HeroMoneyFlow />
      <HeroResultPopups />
      <HeroFeatures />
    </section>
  );
}

function AiBotsCopy() {
  return (
    <section className="zani-ai__copy" aria-label="AI-боты">
      <h1>
        <span>AI-боты</span>
        <br />
        <span>работают,</span>
        <br />
        <span>вы получаете</span>
        <br />
        <span>деньги</span>
      </h1>
      <p>
        ZANI AI-боты мгновенно обрабатывают заявки из всех каналов, записывают клиентов,
        передают в CRM и доводят до оплаты.
      </p>
      <div className="zani-ai__feature-list">
        {aiBotsFeatures.map((feature) => (
          <article key={feature.title}>
            <span aria-hidden="true" />
            <div>
              <strong>{feature.title}</strong>
              <p>{feature.text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AiBotsIntegrations() {
  return (
    <section className="zani-ai__integrations" aria-label="Интеграции">
      <div className="zani-ai__integration-row">
        {integrationItems.map((item) => (
          <article key={item.name} className={`zani-ai__integration zani-ai__integration--${item.tone}`}>
            <span>{item.mark}</span>
            <div>
              <strong>{item.name}</strong>
              <p>{item.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AiBotsPipeline({ activeStep }: { activeStep: number }) {
  return (
    <section className="zani-ai__pipeline" aria-label="Полный путь заявки">
      <h2>Полный путь заявки</h2>
      <div className="zani-ai__pipeline-grid">
        {pipelineSteps.map((step, index) => (
          <article
            key={step.title}
            className={`zani-ai__step${index <= activeStep ? " zani-ai__step--active" : ""}${step.success ? " zani-ai__step--success" : ""}`}
            style={{ animationDelay: `${index * 0.18}s` }}
          >
            <span className="zani-ai__step-number">{index + 1}</span>
            <h3>{step.title}</h3>
            <div>
              {step.rows.map((row) => (
                <p key={row}>{row}</p>
              ))}
            </div>
            <time>{step.time}</time>
          </article>
        ))}
      </div>
    </section>
  );
}

function AiBotsBottom() {
  return (
    <div className="zani-ai__bottom">
      <section className="zani-ai__bots" aria-label="Наши AI-боты">
        <div className="zani-ai__bot-grid">
          {aiBotCards.map((bot, index) => (
            <article
              key={bot.title}
              className={`zani-ai__bot zani-ai__bot--${bot.tone}`}
              style={{ animationDelay: `${index * 0.14}s`, animationDuration: "560ms" }}
            >
              <span aria-hidden="true" />
              <div>
                <strong>{bot.title}</strong>
                <p>{bot.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="zani-ai__metrics" aria-label="Метрики AI-ботов">
        {aiMetrics.map((metric, index) => (
          <article key={metric.value} style={{ animationDelay: `${index * 0.16 + 0.14}s` }}>
            <strong>{metric.value}</strong>
            <p>{metric.label}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

function AiBotsSection() {
  return (
    <section className="zani-ai" aria-label="AI-боты и интеграции">
      <img className="zani-ai__bg" src={aiBotsAssets.background} alt="" aria-hidden="true" />
      <div className="zani-ai__shade" aria-hidden="true" />
      <div className="zani-brick-motion" aria-hidden="true" />
      <span className="zani-ai__bubble-aura" aria-hidden="true" />
      <span className="zani-ai__monkey-aura" aria-hidden="true" />
      <div className="zani-ai__route-trails" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <img className="zani-ai__monkey" src={aiBotsAssets.monkey} alt="" aria-hidden="true" />
      <img className="zani-ai__bubble" src={aiBotsAssets.bubble} alt="" aria-hidden="true" />
      <AiBotsCopy />
      <AiBotsIntegrations />
      <AiBotsPipeline activeStep={pipelineSteps.length - 1} />
      <AiBotsBottom />
    </section>
  );
}

function OwnerControlSection() {
  return (
    <section className="zani-owner" aria-label="Панель владельца">
      <img className="zani-owner__bg" src={aiBotsAssets.background} alt="" aria-hidden="true" />
      <div className="zani-owner__shade" aria-hidden="true" />
      <div className="zani-brick-motion zani-brick-motion--owner" aria-hidden="true" />
      <div className="zani-owner__ring" aria-hidden="true" />
      <img className="zani-owner__monkey" src={aiBotsAssets.ownerMonkey} alt="" aria-hidden="true" />

      <section className="zani-owner__copy" aria-label="Весь бизнес под контролем">
        <p>Панель владельца</p>
        <h1>
          <span>Весь бизнес</span>
          <br />
          <span>под контролем</span>
        </h1>
        <strong>
          ZANI показывает владельцу главное. Вы видите картину целиком и принимаете
          решения на основе данных, а не догадок.
        </strong>
        <div className="zani-owner__signals">
          {ownerSignals.map((signal) => (
            <article key={signal.title}>
              <span aria-hidden="true" />
              <b>{signal.title}</b>
              <small>{signal.text}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="zani-owner__dashboard" aria-label="Главная панель">
        <header>
          <div>
            <h2>Главная панель</h2>
            <p>Обзор вашего бизнеса на сегодня</p>
          </div>
          <time>17 июня, среда</time>
        </header>

        <div className="zani-owner__kpis">
          {ownerKpis.map((kpi) => (
            <article key={kpi.label} className={kpi.alert ? "zani-owner__kpi zani-owner__kpi--alert" : "zani-owner__kpi"}>
              <span>{kpi.label}</span>
              <strong>{kpi.value}</strong>
              <small>{kpi.change} к вчерашнему дню</small>
            </article>
          ))}
        </div>

        <div className="zani-owner__main-grid">
          <article className="zani-owner__chart">
            <h3>Динамика выручки</h3>
            <strong>1 245 000 ₸ <span>↗ +42%</span></strong>
            <svg viewBox="0 0 520 170" aria-hidden="true">
              <defs>
                <linearGradient id="ownerRevenueGlow" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f6b800" stopOpacity="0.46" />
                  <stop offset="100%" stopColor="#f6b800" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 132 C34 108 48 138 82 106 C118 74 132 112 174 80 C214 48 238 82 278 70 C320 58 318 30 366 44 C408 58 412 18 456 24 C488 30 498 18 520 6 L520 170 L0 170 Z" fill="url(#ownerRevenueGlow)" />
              <path d="M0 132 C34 108 48 138 82 106 C118 74 132 112 174 80 C214 48 238 82 278 70 C320 58 318 30 366 44 C408 58 412 18 456 24 C488 30 498 18 520 6" fill="none" stroke="#f6b800" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </article>

          <article className="zani-owner__problems">
            <header>
              <h3>AI нашёл проблемы</h3>
              <button type="button">Смотреть все</button>
            </header>
            {ownerProblems.map((problem) => (
              <div key={problem.title} className={`zani-owner__problem zani-owner__problem--${problem.tone}`}>
                <span aria-hidden="true" />
                <div>
                  <strong>{problem.title}</strong>
                  <p>{problem.text}</p>
                  {problem.value ? <b>{problem.value}</b> : null}
                </div>
              </div>
            ))}
          </article>
        </div>

        <div className="zani-owner__mini-grid">
          <article className="zani-owner__sources">
            <h3>Источники заявок</h3>
            <div className="zani-owner__donut"><strong>234</strong><span>всего</span></div>
            {ownerSources.map((source) => (
              <p key={source.name}><span>{source.name}</span><b>{source.value}</b></p>
            ))}
          </article>

          <article className="zani-owner__stages">
            <h3>Конверсия по этапам</h3>
            {ownerStages.map((stage) => (
              <div key={stage.name}>
                <p><span>{stage.name}</span><b>{stage.value}</b></p>
                <i style={{ width: stage.width }} />
              </div>
            ))}
          </article>

          <article className="zani-owner__team">
            <h3>Активность команды</h3>
            {ownerTeam.map((member) => (
              <div key={member.name}>
                <span aria-hidden="true" />
                <p><b>{member.name}</b><small>{member.value}</small></p>
                <strong>{member.percent}</strong>
              </div>
            ))}
          </article>
        </div>

        <article className="zani-owner__summary">
          <div className="zani-owner__ai-icon" aria-hidden="true">AI</div>
          <div>
            <h3>AI-итог за сегодня</h3>
            <p>Выручка растёт. Но 14 клиентов ждут ответа. Это может стоить вам до 420 000 ₸.</p>
          </div>
          <strong>1 356 <span>ответов от AI</span></strong>
          <strong>243 <span>напоминания команде</span></strong>
          <strong>18 <span>сделок закрыто</span></strong>
          <strong>+850 000 ₸ <span>дополнительной выручки</span></strong>
        </article>
      </section>
    </section>
  );
}

export function PublicHomePage() {
  const landingRef = useRef<HTMLElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const [isHeaderNavHidden, setIsHeaderNavHidden] = useState(false);

  useEffect(() => {
    const landing = landingRef.current;
    if (!landing) {
      return undefined;
    }

    let frame = 0;

    const updateHeader = () => {
      frame = 0;
      const currentScrollTop = landing.scrollTop;
      const isSecondScreen = currentScrollTop > landing.clientHeight * 0.45;
      const isScrollingUp = currentScrollTop < lastScrollTopRef.current - 4;

      setIsHeaderNavHidden(isSecondScreen && isScrollingUp);
      lastScrollTopRef.current = currentScrollTop;
    };

    const handleScroll = () => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(updateHeader);
    };

    landing.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      landing.removeEventListener("scroll", handleScroll);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return (
    <main ref={landingRef} className="zani-public-landing">
      <PublicLandingHeader navHidden={isHeaderNavHidden} />
      <HeroSection />
      <AiBotsSection />
      <OwnerControlSection />
    </main>
  );
}

export function PublicCrmPage() {
  return <main className="min-h-screen bg-black" />;
}

export function PublicBotsPage() {
  return <main className="min-h-screen bg-black" />;
}

export function PublicPricingPage() {
  return <main className="min-h-screen bg-black" />;
}

export function PublicContactsPage() {
  return <main className="min-h-screen bg-black" />;
}
