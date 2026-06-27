import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import type { CSSProperties, FormEvent, PointerEvent, RefObject } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { aiApi } from "../../api/ai";
import { LanguageSelector } from "../../components/layout/LanguageSelector";
import { useI18n, type Language } from "../../lib/i18n";
import "./zaniExperience.css";
import "./zaniExperienceMobileFix.css";

const AUTH_ROUTES = {
  signup: "/signup",
  login: "/login"
} as const;

const landingSections = [
  { id: "top", selector: ".hero", label: "ZANI" },
  { id: "crm-bots", selector: ".crm-bots-section", label: "CRM и боты" },
  { id: "marketplaces", selector: ".marketplace-section", label: "Маркетплейсы" },
  { id: "crm-free", selector: ".crm-suite-section", label: "CRM" },
  { id: "ai-assistant", selector: ".ai-assistant-section", label: "AI-помощник" },
  { id: "launch", selector: ".launch-section", label: "Запуск" },
  { id: "trust", selector: ".trust-section", label: "Каналы" },
  { id: "pricing", selector: ".pricing-section", label: "Цены" }
] as const;

type LandingSectionId = (typeof landingSections)[number]["id"];

const features = [
  {
    id: "crm",
    title: "CRM",
    subtitle: "Бесплатно навсегда",
    text: "Клиенты, сделки и история общения собраны в рабочей базе.",
    icon: "CRM",
    meta: "база"
  },
  {
    id: "bots",
    title: "AI-Боты",
    text: "Отвечают клиентам 24/7, записывают, создают сделки автоматически.",
    icon: "AI",
    meta: "онлайн"
  },
  {
    id: "marketplaces",
    title: "Маркетплейсы",
    text: "Kaspi, Wildberries, Ozon и Яндекс Маркет в одном окне.",
    icon: "₸",
    meta: "синхронизация"
  },
  {
    id: "advisor",
    title: "AI-Советник",
    text: "Находит просадки и предлагает следующий шаг по делу.",
    icon: "AI",
    meta: "рекомендации"
  }
];

const heroPorts = [
  { label: "WhatsApp", group: "crm" },
  { label: "Формы", group: "crm" },
  { label: "Telegram", group: "bots" },
  { label: "Instagram", group: "bots" },
  { label: "Kaspi", group: "marketplaces" },
  { label: "WB", group: "marketplaces" },
  { label: "Ozon", group: "marketplaces" },
  { label: "1C", group: "advisor" },
  { label: "МойСклад", group: "advisor" },
  { label: "CRM", group: "advisor" },
  { label: "Продажи", group: "advisor" }
];
const marketplaceSync = ["Kaspi", "WB", "Ozon"];
const advisorNotes = ["3 новые рекомендации", "Найдена новая возможность", "Обнаружено снижение прибыли"];
const linePaths = [
  { path: "M258 118 C320 118 322 292 380 310 C438 292 440 118 502 118", start: [258, 118], end: [502, 118] },
  { path: "M258 150 C326 174 326 284 380 310 C434 336 434 490 502 510", start: [258, 150], end: [502, 510] },
  { path: "M258 510 C320 500 326 336 380 310 C434 284 434 150 502 150", start: [258, 510], end: [502, 150] },
  { path: "M258 548 C322 548 322 332 380 310 C438 332 438 548 502 548", start: [258, 548], end: [502, 548] }
];

const marketplaceConnections = [
  { path: "M616.6 114 L826 114 C908 114 956 33 1038 33", start: [616.6, 114], end: [1038, 33] },
  { path: "M616.6 182 L826 182 C908 182 956 168 1038 168", start: [616.6, 182], end: [1038, 168] },
  { path: "M616.6 239 L746 239 C782 239 792 184 826 182", start: [616.6, 239], end: [826, 182] },
  { path: "M616.6 298 L826 298 C910 298 954 302 1038 302", start: [616.6, 298], end: [1038, 302] },
  { path: "M616.6 357 L746 357 C782 357 792 412 826 414", start: [616.6, 357], end: [826, 414] },
  { path: "M616.6 414 L826 414 C908 414 956 451 1038 451", start: [616.6, 414], end: [1038, 451] }
];

const aiConnections = [
  { path: "M198 47 L206 47 C314 47 328 108 390 125 C442 140 442 66 486 66 L570 66", start: [198, 47], end: [570, 66] },
  { path: "M198 117 L206 117 C318 117 326 150 390 180 C442 196 442 181 486 181 L570 181", start: [198, 117], end: [570, 181] },
  { path: "M198 188 L206 188 C320 188 330 208 390 220 C442 230 442 181 486 181 L570 181", start: [198, 188], end: [570, 181] },
  { path: "M198 258 L206 258 C320 258 330 250 390 285 C442 302 442 296 486 296 L570 296", start: [198, 258], end: [570, 296] },
  { path: "M198 329 L206 329 C318 329 326 310 390 340 C442 355 442 410 486 410 L570 410", start: [198, 329], end: [570, 410] },
  { path: "M198 400 L206 400 C318 400 326 342 390 340", start: [198, 400], end: [390, 340] },
  { path: "M198 470 L206 470 C316 470 324 360 390 340", start: [198, 470], end: [390, 340] }
];

const bookingMessages = [
  {
    id: "m1",
    from: "client",
    text: ["Здравствуйте.", "Хочу записаться на стрижку."],
    time: "10:41"
  },
  {
    id: "m2",
    from: "bot",
    text: ["Здравствуйте. Конечно.", "Какой мастер вас интересует?"],
    time: "10:41"
  },
  {
    id: "m3",
    from: "client",
    text: ["Любой свободный."],
    time: "10:41"
  },
  {
    id: "m4",
    from: "bot",
    text: ["Сегодня свободно:"],
    time: "10:41",
    slots: [
      ["14:00", "Александр"],
      ["16:30", "Данияр"],
      ["18:00", "Анна"]
    ]
  },
  {
    id: "m5",
    from: "client",
    text: ["18:00"],
    time: "10:42"
  },
  {
    id: "m6",
    from: "bot",
    text: ["Отлично. Как вас зовут?"],
    time: "10:42"
  },
  {
    id: "m7",
    from: "client",
    text: ["Андрей"],
    time: "10:42"
  },
  {
    id: "m8",
    from: "bot",
    text: ["Укажите, пожалуйста,", "номер телефона."],
    time: "10:43"
  },
  {
    id: "m9",
    from: "client",
    text: ["+7 777 123 45 67"],
    time: "10:43"
  },
  {
    id: "m10",
    from: "system",
    text: ["Запись подтверждена", "Сегодня, 18:00", "Мастер: Анна", "Услуга: Мужская стрижка", "Адрес: ул. Абая 123"],
    time: "10:43"
  },
  {
    id: "m11",
    from: "system",
    text: ["Напоминание будет отправлено", "за 3 часа до визита."],
    time: "10:43",
    icon: "🔔"
  },
  {
    id: "m12",
    from: "system",
    text: ["После визита попросим оставить", "отзыв."],
    time: "10:43",
    icon: "★"
  }
];

const automationCards = [
  {
    id: "crm",
    title: "CRM",
    icon: "◎",
    accent: "blue",
    text: "Карточка клиента создаётся сразу с перепиской, задачей и ответственным.",
    checks: ["Новый клиент создан", "История переписки сохранена", "Задача менеджеру назначена"],
    link: "Открыть CRM →"
  },
  {
    id: "bots",
    title: "AI-Боты",
    icon: "⌘",
    accent: "violet",
    text: "Отвечают мгновенно, записывают, квалифицируют и создают сделки.",
    checks: ["Работают 24/7", "Подбирают свободное время", "Интеграция с CRM"],
    link: "Настроить ботов →"
  },
  {
    id: "broadcasts",
    title: "Рассылки",
    icon: "↗",
    accent: "pink",
    text: "Отправляйте сообщения, напоминания и повторные предложения клиентам.",
    checks: ["Напоминания о визитах", "Массовые и триггерные рассылки", "Запрос отзыва после визита"],
    link: "Создать рассылку →"
  }
];

const marketplaceNodes = [
  ["Kaspi", "Магазин", "kaspi", "/integrations_logos/kaspi.png"],
  ["Wildberries", "", "wb", "/integrations_logos/wildberries.png"],
  ["Ozon", "", "ozon", "/integrations_logos/ozon.svg"],
  ["Яндекс Маркет", "", "yandex", "/integrations_logos/yandex-market.svg"],
  ["1C", "", "one-c", "/integrations_logos/1c.png"],
  ["МойСклад", "", "moysklad", "/integrations_logos/moysklad.svg"]
];

const marketplaceFeatures = [
  {
    title: "Демпинг-бот 24/7",
    text: "Следит за ценами конкурентов и автоматически предлагает оптимальные цены.",
    icon: "⌘",
    accent: "advisor",
    tag: "24/7"
  },
  {
    title: "Склад и остатки",
    text: "Получаем остатки, закупочные цены и себестоимость из 1C / МойСклад в реальном времени.",
    icon: "⌂",
    accent: "sync"
  },
  {
    title: "Заказы и клиенты",
    text: "Все заказы с маркетплейсов попадают в CRM и историю каждого клиента.",
    icon: "↯",
    accent: "crm"
  },
  {
    title: "Авторассылки клиентам",
    text: "Клиенты получают уведомления о заказе, статусе доставки и напоминания автоматически.",
    icon: "↗",
    accent: "online",
    messengers: ["WhatsApp", "Telegram", "Почта"]
  }
];

const marketplaceProofs = [
  ["Прямые интеграции", "Данные подключаются через доступы ваших сервисов", "◇"],
  ["Быстрое подключение", "Подключите все площадки за 15 минут", "⚡"],
  ["Безопасность данных", "Шифруем и защищаем всю информацию", "⌘"],
  ["Работает 24/7", "Боты не спят, ваш бизнес не теряет прибыль", "✦"]
];

const crmSuiteStats = [
  { label: "Лиды", values: ["248", "251", "257", "263"], changes: ["+24%", "+25%", "+27%", "+29%"], accent: "blue" },
  { label: "Сделки", values: ["68", "71", "74", "78"], changes: ["+18%", "+19%", "+21%", "+23%"], accent: "green" },
  { label: "Выручка", values: ["2.45M ₸", "2.51M ₸", "2.58M ₸", "2.64M ₸"], changes: ["+32%", "+34%", "+35%", "+37%"], accent: "pink" },
  { label: "Команда", values: ["12", "13", "14", "14"], changes: ["онлайн", "онлайн", "в работе", "онлайн"], accent: "violet" }
] as const;

const crmFunnelStages = [
  { label: "Новые", values: ["128", "132", "137", "141"], changes: ["+12%", "+13%", "+15%", "+16%"] },
  { label: "В работе", values: ["68", "71", "73", "76"], changes: ["+18%", "+19%", "+20%", "+22%"] },
  { label: "Оплата", values: ["17", "19", "21", "24"], changes: ["+14%", "+15%", "+17%", "+19%"] }
] as const;

const crmLiveEvents = [
  "WhatsApp передал заявку в CRM",
  "Менеджер взял новый лид",
  "Сделка перешла в оплату",
  "AI нашел просадку в воронке"
] as const;

const crmSuiteMenu = ["Главная", "Клиенты", "Сделки", "Задачи", "Каналы", "Аналитика"];

const crmSuiteRoles: Array<[string, string, string, string, string[], string]> = [
  ["Директор", "Видит деньги, просадки и команду", "Полный доступ", "+32%", ["Выручка", "AI-советы"], "violet"],
  ["Менеджер", "Ведет лиды, сделки и историю клиента", "Продажи", "48 лидов", ["CRM", "WhatsApp"], "blue"],
  ["Администратор", "Назначает задачи и контролирует записи", "Операции", "24 задачи", ["Календарь", "Команда"], "green"],
  ["Склад", "Отвечает за остатки и себестоимость", "Учет", "1C / МС", ["Остатки", "Цены"], "pink"]
];

const crmSuiteBenefits: Array<[string, string, string]> = [
  ["База клиентов", "без дублей", "▣"],
  ["Сотрудники", "роли и задачи", "◎"],
  ["Сделки", "по этапам", "▱"],
  ["История", "вся переписка", "⚙"],
  ["Доступы", "под контролем", "◇"],
  ["CRM бесплатно", "навсегда", "✦"]
];

const aiChannels: Array<[string, string[]]> = [
  ["Чат-боты", ["WA", "TG", "IG"]],
  ["Маркетплейсы", ["K", "WB", "OZ", "M"]],
  ["CRM", ["◎"]],
  ["Рассылки", ["WA", "TG", "@"]],
  ["Склад и 1C", ["1C", "DB"]],
  ["Сайт и формы", ["WEB"]],
  ["Платежи", ["₸"]]
];

const aiSignals: Array<[string, string, string, string]> = [
  ["Тихие часы 15:00-17:00", "Запустить акцию сегодня.", "▥", "pink"],
  ["Маржа выросла на 32%", "Усилить этот канал.", "↗", "green"],
  ["Анна закрывает лучше", "Дать больше лидов.", "★", "yellow"],
  ["Завтра 12 записей", "Отправить напоминания.", "□", "violet"],
  ["Остатки на 3 дня", "Заказать поставку.", "◇", "blue"],
  ["Kaspi просел утром", "Проверить цену и остатки.", "K", "pink"],
  ["7 клиентов без ответа", "Передать менеджеру сейчас.", "◎", "yellow"],
  ["Повторные визиты падают", "Запустить рассылку на завтра.", "TG", "violet"],
  ["Склад тормозит продажи", "Пополнить топ-3 позиции.", "1C", "blue"],
  ["Новый лидер по конверсии", "Дать больше входящих.", "↑", "green"]
];

const aiRoleCards: Array<[string, string, string, string, string, string[], string, string]> = [
  ["Владелец", "Деньги и просадки", "1.24M ₸", "+18%", "Запустите акцию в 15:00.", ["Маржа", "Просадки"], "Маржа по Kaspi выросла, но повторные визиты просели после 14:00.", "Акция на тихие часы и контроль выручки через 2 часа."],
  ["Администратор", "Загрузка и записи", "24 / 32", "75%", "Окно у мастера в 16:00.", ["Записи", "Напоминания"], "У Анны есть окно, а 7 клиентов ждут подтверждения времени.", "Предложить свободный слот и включить напоминание."],
  ["Директор", "Лиды и команда", "48", "+24%", "Instagram просел.", ["Лиды", "Менеджеры"], "Instagram дает меньше заявок, Telegram закрывается быстрее.", "Перераспределить лиды и проверить скрипт ответа."],
  ["Менеджер", "Задачи сегодня", "12", "В работе", "3 клиента ждут ответа.", ["Задачи", "Чаты"], "Три горячих клиента не получили ответ дольше 15 минут.", "Ответить сейчас, создать задачу и сохранить историю в CRM."]
];

const pricingPlans: Array<{
  title: string;
  subtitle: string;
  price: string;
  period: string;
  icon: string;
  accent: "blue" | "violet" | "green";
  cta: string;
  popular?: boolean;
  features: string[];
}> = [
  {
    title: "Базовый",
    subtitle: "Для старта и небольших команд",
    price: "0 ₸",
    period: "бесплатно навсегда",
    icon: "↗",
    accent: "blue",
    cta: "Начать бесплатно",
    features: ["CRM для неограниченного числа клиентов", "AI-помощник и рекомендации", "AI-боты: WhatsApp, Telegram, Instagram", "Рассылки и напоминания", "Календарь и записи", "Базовая аналитика"]
  },
  {
    title: "Про",
    subtitle: "Для растущего бизнеса",
    price: "15 000 ₸",
    period: "в месяц",
    icon: "♕",
    accent: "violet",
    cta: "Попробовать 7 дней бесплатно",
    popular: true,
    features: ["Все из тарифа «Базовый»", "Kaspi, Wildberries, Ozon, Яндекс Маркет", "1C, МойСклад и учет остатков", "AI-бот демпинга и мониторинг цен", "Расширенная аналитика и отчеты", "Приоритетная поддержка"]
  },
  {
    title: "Бизнес",
    subtitle: "Для масштабирования и сетей",
    price: "25 000 ₸",
    period: "в месяц",
    icon: "▣",
    accent: "green",
    cta: "Попробовать 7 дней бесплатно",
    features: ["Все из тарифа «Про»", "Расширенная аналитика и BI", "Мультифилиалы и склады", "Роли и права доступа", "Неограниченное число сотрудников", "Персональный менеджер"]
  }
];

const pricingTrust: Array<[string, string, string]> = [
  ["Без привязки карты", "Никаких обязательных платежей.", "◇"],
  ["Облако в Казахстане", "Данные надежно защищены и хранятся в РК.", "☁"],
  ["Безопасность данных", "Шифрование, резервные копии и защита 24/7.", "▣"],
  ["Поддержка 24/7", "Мы рядом в любое время в чате и по телефону.", "◌"]
];

const launchSteps: Array<[string, string, string, string]> = [
  ["Шаг 1", "Нажмите подключить", "Выберите CRM, мессенджер, маркетплейс или складской сервис.", "01"],
  ["Шаг 2", "Авторизуйтесь", "Войдите в аккаунт сервиса. Код, интегратор и ручная настройка не нужны.", "02"],
  ["Шаг 3", "Добавьте команду", "Пригласите сотрудников, выдайте роли и назначьте первые задачи.", "03"],
  ["Шаг 4", "Работайте сразу", "Заявки, клиенты, заказы и остатки начнут собираться автоматически.", "04"]
];

const proofSignals: Array<[string, string]> = [
  ["Без специалистов", "подключение внутри ZANI"],
  ["Без кода", "только авторизация"],
  ["Без переноса вручную", "данные подтягиваются сами"],
  ["Без долгого внедрения", "первые каналы в тот же день"]
];

const sectionProofs: Record<string, string[]> = {
  crmBots: ["Заявка сразу в CRM", "Бот работает 24/7", "Напоминания уходят сами"],
  marketplaces: ["Остатки в реальном времени", "Маржа без таблиц", "Заказы попадают в CRM"],
  crmSuite: ["CRM бесплатно навсегда", "Роли для сотрудников", "История клиента под рукой"],
  ai: ["Рекомендации по ролям", "Просадки видны заранее", "Следующий шаг понятен"],
  launch: ["Без интегратора", "Без кода", "Первые каналы в тот же день"]
};

const assistantQuickPrompts = [
  "Подойдёт ли мне ZANI?",
  "Сколько займёт подключение?",
  "Что бесплатно?",
  "Как работают AI-боты?"
];

const LANDING_AI_MAX_INPUT_LENGTH = 500;
const LANDING_AI_MAX_MESSAGES = 12;
const AUTH_ACTIONS = new Set(["login", "signup"]);

function normalizeLandingAiInput(value: string) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, LANDING_AI_MAX_INPUT_LENGTH);
}

function appendLandingAiMessage(current: LandingAssistantMessage[], next: LandingAssistantMessage) {
  return [...current, next].slice(-LANDING_AI_MAX_MESSAGES);
}

type LandingAssistantMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  meta?: string;
};

const sectionToneMap: Record<LandingSectionId, string> = {
  top: "blue",
  "crm-bots": "blue",
  marketplaces: "cyan",
  "crm-free": "green",
  "ai-assistant": "pink",
  launch: "violet",
  trust: "green",
  pricing: "violet"
};

const trustIntegrations: Array<{
  name: string;
  label: string;
  logo: string;
  className: string;
  status: string;
}> = [
  { name: "WhatsApp", label: "Чаты и заявки", logo: "WA", className: "whatsapp", status: "OAuth" },
  { name: "Telegram", label: "Боты и рассылки", logo: "TG", className: "telegram", status: "Bot API" },
  { name: "Instagram", label: "Direct и лиды", logo: "IG", className: "instagram", status: "Meta" },
  { name: "Kaspi", label: "Заказы и товары", logo: "K", className: "kaspi", status: "API" },
  { name: "Wildberries", label: "Остатки и цены", logo: "WB", className: "wb", status: "API" },
  { name: "Ozon", label: "Продажи и маржа", logo: "OZ", className: "ozon", status: "API" },
  { name: "1C", label: "Учет и склад", logo: "1C", className: "one-c", status: "Токен" },
  { name: "МойСклад", label: "Склад и закупки", logo: "MS", className: "moysklad", status: "API" }
];

const trustCards: Array<[string, string, string]> = [
  ["Нажмите «Подключить»", "Выберите канал, маркетплейс или CRM-модуль прямо в ZANI.", "01"],
  ["Авторизуйтесь", "Войдите в аккаунт сервиса. Специалисты, код и сложные настройки не нужны.", "02"],
  ["Работайте сразу", "Заявки, сотрудники, клиенты, остатки и заказы появляются в CRM автоматически.", "03"]
];

const landingPhraseRows: Array<[string, string, string]> = [
  ["CRM и боты", "CRM және боттар", "CRM and bots"],
  ["Маркетплейсы", "Маркетплейстер", "Marketplaces"],
  ["AI-помощник", "AI-көмекші", "AI assistant"],
  ["Запуск", "Іске қосу", "Launch"],
  ["Каналы", "Арналар", "Channels"],
  ["Цены", "Бағалар", "Pricing"],
  ["Войти", "Кіру", "Sign in"],
  ["Получить CRM бесплатно", "CRM-ды тегін алу", "Get free CRM"],
  ["Бесплатно навсегда", "Мәңгі тегін", "Free forever"],
  ["Клиенты, сделки и история общения собраны в рабочей базе.", "Клиенттер, мәмілелер және байланыс тарихы жұмыс базасында жиналған.", "Clients, deals and conversation history are collected in one working base."],
  ["база", "база", "base"],
  ["AI-Боты", "AI-боттар", "AI bots"],
  ["Отвечают клиентам 24/7, записывают, создают сделки автоматически.", "Клиенттерге 24/7 жауап береді, жазып, мәмілелерді автоматты жасайды.", "Answer clients 24/7, book appointments and create deals automatically."],
  ["онлайн", "онлайн", "online"],
  ["Kaspi, Wildberries, Ozon и Яндекс Маркет в одном окне.", "Kaspi, Wildberries, Ozon және Яндекс Маркет бір терезеде.", "Kaspi, Wildberries, Ozon and Yandex Market in one window."],
  ["синхронизация", "синхрондау", "sync"],
  ["AI-Советник", "AI-кеңесші", "AI advisor"],
  ["Находит просадки и предлагает следующий шаг по делу.", "Төмендеулерді тауып, нақты келесі қадамды ұсынады.", "Finds drops and suggests the next practical step."],
  ["рекомендации", "ұсыныстар", "recommendations"],
  ["3 новые рекомендации", "3 жаңа ұсыныс", "3 new recommendations"],
  ["Найдена новая возможность", "Жаңа мүмкіндік табылды", "New opportunity found"],
  ["Обнаружено снижение прибыли", "Пайда төмендеуі анықталды", "Profit drop detected"],
  ["Здравствуйте.", "Сәлеметсіз бе.", "Hello."],
  ["Хочу записаться на стрижку.", "Шаш қиюға жазылғым келеді.", "I want to book a haircut."],
  ["Здравствуйте. Конечно.", "Сәлеметсіз бе. Әрине.", "Hello. Of course."],
  ["Какой мастер вас интересует?", "Қай маман керек?", "Which specialist do you prefer?"],
  ["Любой свободный.", "Кез келген бос маман.", "Any available one."],
  ["Сегодня свободно:", "Бүгін бос уақыт:", "Available today:"],
  ["Александр", "Александр", "Alexander"],
  ["Данияр", "Данияр", "Daniyar"],
  ["Анна", "Анна", "Anna"],
  ["Отлично. Как вас зовут?", "Керемет. Атыңыз кім?", "Great. What is your name?"],
  ["Андрей", "Андрей", "Andrey"],
  ["Укажите, пожалуйста,", "Өтінеміз,", "Please enter"],
  ["номер телефона.", "телефон нөміріңізді көрсетіңіз.", "your phone number."],
  ["Запись подтверждена", "Жазба расталды", "Booking confirmed"],
  ["Сегодня, 18:00", "Бүгін, 18:00", "Today, 18:00"],
  ["Мастер: Анна", "Маман: Анна", "Specialist: Anna"],
  ["Услуга: Мужская стрижка", "Қызмет: Ерлер шаш қиюы", "Service: Men's haircut"],
  ["Адрес: ул. Абая 123", "Мекенжай: Абай к-сі 123", "Address: Abay St. 123"],
  ["Напоминание будет отправлено", "Еске салу жіберіледі", "Reminder will be sent"],
  ["за 3 часа до визита.", "келуден 3 сағат бұрын.", "3 hours before the visit."],
  ["После визита попросим оставить", "Келгеннен кейін пікір қалдыруды сұраймыз", "After the visit we will ask for"],
  ["отзыв.", "пікір.", "a review."],
  ["Новый клиент создан", "Жаңа клиент жасалды", "New client created"],
  ["Карточка клиента создаётся сразу с перепиской, задачей и ответственным.", "Клиент картасы хат алмасу, тапсырма және жауапты адаммен бірден жасалады.", "The client card is created at once with conversation, task and owner."],
  ["История переписки сохранена", "Хат алмасу тарихы сақталды", "Conversation history saved"],
  ["Задача менеджеру назначена", "Менеджерге тапсырма тағайындалды", "Task assigned to manager"],
  ["Открыть CRM →", "CRM ашу →", "Open CRM →"],
  ["Отвечают мгновенно, записывают, квалифицируют и создают сделки.", "Бірден жауап береді, жазады, сұрыптайды және мәміле жасайды.", "Reply instantly, book, qualify and create deals."],
  ["Работают 24/7", "24/7 жұмыс істейді", "Work 24/7"],
  ["Подбирают свободное время", "Бос уақытты таңдайды", "Find available time"],
  ["Интеграция с CRM", "CRM-мен интеграция", "CRM integration"],
  ["Настроить ботов →", "Боттарды баптау →", "Set up bots →"],
  ["Рассылки", "Таратылымдар", "Outreach"],
  ["Отправляйте сообщения, напоминания и повторные предложения клиентам.", "Клиенттерге хабарлама, еске салу және қайталама ұсыныстар жіберіңіз.", "Send messages, reminders and repeat offers to clients."],
  ["Напоминания о визитах", "Келу туралы еске салулар", "Visit reminders"],
  ["Массовые и триггерные рассылки", "Жаппай және триггерлік таратылымдар", "Bulk and trigger campaigns"],
  ["Запрос отзыва после визита", "Келгеннен кейін пікір сұрау", "Review request after visit"],
  ["Создать рассылку →", "Таратылым жасау →", "Create campaign →"],
  ["Магазин", "Дүкен", "Store"],
  ["Яндекс Маркет", "Яндекс Маркет", "Yandex Market"],
  ["Я", "Я", "Y"],
  ["МойСклад", "МойСклад", "MoySklad"],
  ["М", "М", "MS"],
  ["Демпинг-бот 24/7", "Демпинг-бот 24/7", "Price bot 24/7"],
  ["Следит за ценами конкурентов и автоматически предлагает оптимальные цены.", "Бәсекелестер бағасын бақылап, оңтайлы бағаларды автоматты ұсынады.", "Tracks competitor prices and suggests optimal prices automatically."],
  ["Склад и остатки", "Қойма және қалдықтар", "Stock and inventory"],
  ["Получаем остатки, закупочные цены и себестоимость из 1C / МойСклад в реальном времени.", "1C / МойСклад жүйесінен қалдықтарды, сатып алу бағасын және өзіндік құнды нақты уақытта аламыз.", "Pull stock, purchase prices and cost from 1C / MoySklad in real time."],
  ["Заказы и клиенты", "Тапсырыстар және клиенттер", "Orders and clients"],
  ["Все заказы с маркетплейсов попадают в CRM и историю каждого клиента.", "Маркетплейстердегі барлық тапсырыстар CRM мен клиент тарихына түседі.", "All marketplace orders flow into CRM and each client's history."],
  ["Авторассылки клиентам", "Клиенттерге авто-таратылым", "Automated client messages"],
  ["Клиенты получают уведомления о заказе, статусе доставки и напоминания автоматически.", "Клиенттер тапсырыс, жеткізу күйі және еске салуларды автоматты алады.", "Clients get order, delivery status and reminder messages automatically."],
  ["Прямые интеграции", "Тікелей интеграциялар", "Direct integrations"],
  ["Данные подключаются через доступы ваших сервисов", "Деректер сервистеріңіздің рұқсаттары арқылы қосылады", "Data connects through access to your own services"],
  ["Быстрое подключение", "Жылдам қосылу", "Fast connection"],
  ["Подключите все площадки за 15 минут", "Барлық алаңдарды 15 минутта қосыңыз", "Connect all platforms in 15 minutes"],
  ["Безопасность данных", "Деректер қауіпсіздігі", "Data security"],
  ["Шифруем и защищаем всю информацию", "Барлық ақпаратты шифрлап қорғаймыз", "We encrypt and protect all information"],
  ["Работает 24/7", "24/7 жұмыс істейді", "Works 24/7"],
  ["Боты не спят, ваш бизнес не теряет прибыль", "Боттар ұйықтамайды, бизнес пайда жоғалтпайды", "Bots do not sleep, your business does not lose profit"],
  ["Лиды", "Лидтер", "Leads"],
  ["Сделки", "Мәмілелер", "Deals"],
  ["Выручка", "Түсім", "Revenue"],
  ["Команда", "Команда", "Team"],
  ["Главная", "Басты", "Home"],
  ["Клиенты", "Клиенттер", "Clients"],
  ["Задачи", "Тапсырмалар", "Tasks"],
  ["Аналитика", "Аналитика", "Analytics"],
  ["Чат-боты", "Чат-боттар", "Chat bots"],
  ["Новые заявки сразу в CRM", "Жаңа өтінімдер бірден CRM-ге", "New requests go straight to CRM"],
  ["Заказы и остатки в работе", "Тапсырыстар мен қалдықтар жұмыста", "Orders and stock in work"],
  ["Сотрудники", "Қызметкерлер", "Employees"],
  ["Роли, задачи, доступы", "Рөлдер, тапсырмалар, қолжетімділік", "Roles, tasks, access"],
  ["Склад", "Қойма", "Warehouse"],
  ["Склад и 1C", "Қойма және 1C", "Warehouse and 1C"],
  ["Остатки и себестоимость", "Қалдықтар және өзіндік құн", "Stock and cost"],
  ["База клиентов", "Клиенттер базасы", "Client base"],
  ["без дублей", "дубликатсыз", "without duplicates"],
  ["роли и задачи", "рөлдер және тапсырмалар", "roles and tasks"],
  ["по этапам", "кезеңдер бойынша", "by stages"],
  ["История", "Тарих", "History"],
  ["вся переписка", "барлық хат алмасу", "all conversations"],
  ["Доступы", "Қолжетімділік", "Access"],
  ["под контролем", "бақылауда", "under control"],
  ["CRM бесплатно", "CRM тегін", "Free CRM"],
  ["навсегда", "мәңгі", "forever"],
  ["Сайт и формы", "Сайт және формалар", "Website and forms"],
  ["Платежи", "Төлемдер", "Payments"],
  ["Тихие часы 15:00-17:00", "15:00-17:00 тыныш уақыт", "Quiet hours 15:00-17:00"],
  ["Запустить акцию сегодня.", "Бүгін акция іске қосу.", "Launch a promo today."],
  ["Маржа выросла на 32%", "Маржа 32% өсті", "Margin grew by 32%"],
  ["Усилить этот канал.", "Осы арнаны күшейту.", "Strengthen this channel."],
  ["Анна закрывает лучше", "Анна жақсырақ жабады", "Anna closes better"],
  ["Дать больше лидов.", "Көбірек лид беру.", "Give more leads."],
  ["Завтра 12 записей", "Ертең 12 жазба", "12 bookings tomorrow"],
  ["Отправить напоминания.", "Еске салулар жіберу.", "Send reminders."],
  ["Остатки на 3 дня", "Қалдық 3 күнге жетеді", "Stock for 3 days"],
  ["Заказать поставку.", "Жеткізілімге тапсырыс беру.", "Order supply."],
  ["Владелец", "Иесі", "Owner"],
  ["Деньги и просадки", "Ақша және төмендеулер", "Money and drops"],
  ["Запустите акцию в 15:00.", "15:00-де акция іске қосыңыз.", "Launch a promo at 15:00."],
  ["Маржа", "Маржа", "Margin"],
  ["Просадки", "Төмендеулер", "Drops"],
  ["Администратор", "Әкімші", "Administrator"],
  ["Загрузка и записи", "Жүктеме және жазбалар", "Load and bookings"],
  ["Окно у мастера в 16:00.", "Маманда 16:00-де бос уақыт бар.", "Slot with specialist at 16:00."],
  ["Записи", "Жазбалар", "Bookings"],
  ["Напоминания", "Еске салулар", "Reminders"],
  ["Директор", "Директор", "Director"],
  ["Лиды и команда", "Лидтер және команда", "Leads and team"],
  ["Instagram просел.", "Instagram төмендеді.", "Instagram dropped."],
  ["Менеджеры", "Менеджерлер", "Managers"],
  ["Менеджер", "Менеджер", "Manager"],
  ["Задачи сегодня", "Бүгінгі тапсырмалар", "Tasks today"],
  ["В работе", "Жұмыста", "In progress"],
  ["3 клиента ждут ответа.", "3 клиент жауап күтуде.", "3 clients are waiting for a reply."],
  ["Чаты", "Чаттар", "Chats"],
  ["Базовый", "Базалық", "Basic"],
  ["Для старта и небольших команд", "Старт пен шағын командаларға", "For launch and small teams"],
  ["бесплатно навсегда", "мәңгі тегін", "free forever"],
  ["Начать бесплатно", "Тегін бастау", "Start free"],
  ["CRM для неограниченного числа клиентов", "Шексіз клиенттерге арналған CRM", "CRM for unlimited clients"],
  ["AI-помощник и рекомендации", "AI-көмекші және ұсыныстар", "AI assistant and recommendations"],
  ["AI-боты: WhatsApp, Telegram, Instagram", "AI-боттар: WhatsApp, Telegram, Instagram", "AI bots: WhatsApp, Telegram, Instagram"],
  ["Рассылки и напоминания", "Таратылымдар және еске салулар", "Outreach and reminders"],
  ["Календарь и записи", "Күнтізбе және жазбалар", "Calendar and bookings"],
  ["Базовая аналитика", "Базалық аналитика", "Basic analytics"],
  ["Про", "Про", "Pro"],
  ["Для растущего бизнеса", "Өсіп жатқан бизнеске", "For growing businesses"],
  ["в месяц", "айына", "per month"],
  ["Попробовать 7 дней бесплатно", "7 күн тегін көру", "Try 7 days free"],
  ["Все из тарифа «Базовый»", "«Базалық» тарифіндегі барлығы", "Everything in Basic"],
  ["Kaspi, Wildberries, Ozon, Яндекс Маркет", "Kaspi, Wildberries, Ozon, Яндекс Маркет", "Kaspi, Wildberries, Ozon, Yandex Market"],
  ["1C, МойСклад и учет остатков", "1C, МойСклад және қалдық есебі", "1C, MoySklad and stock accounting"],
  ["AI-бот демпинга и мониторинг цен", "Демпинг AI-боты және баға мониторингі", "Price AI bot and price monitoring"],
  ["Расширенная аналитика и отчеты", "Кеңейтілген аналитика және есептер", "Advanced analytics and reports"],
  ["Приоритетная поддержка", "Басым қолдау", "Priority support"],
  ["Бизнес", "Бизнес", "Business"],
  ["Для масштабирования и сетей", "Масштабтау және желілерге", "For scaling and networks"],
  ["Все из тарифа «Про»", "«Про» тарифіндегі барлығы", "Everything in Pro"],
  ["Расширенная аналитика и BI", "Кеңейтілген аналитика және BI", "Advanced analytics and BI"],
  ["Мультифилиалы и склады", "Көп филиал және қоймалар", "Multi-branch and warehouses"],
  ["Роли и права доступа", "Рөлдер және қолжетімділік құқықтары", "Roles and access rights"],
  ["Неограниченное число сотрудников", "Қызметкерлер саны шектеусіз", "Unlimited employees"],
  ["Персональный менеджер", "Жеке менеджер", "Personal manager"],
  ["Без привязки карты", "Картаны байланыстырмай", "No card required"],
  ["Никаких обязательных платежей.", "Міндетті төлемдер жоқ.", "No mandatory payments."],
  ["Облако в Казахстане", "Қазақстандағы бұлт", "Cloud in Kazakhstan"],
  ["Данные надежно защищены и хранятся в РК.", "Деректер сенімді қорғалып, ҚР-да сақталады.", "Data is protected and stored in Kazakhstan."],
  ["Шифрование, резервные копии и защита 24/7.", "Шифрлау, резервтік көшірме және 24/7 қорғаныс.", "Encryption, backups and 24/7 protection."],
  ["Поддержка 24/7", "24/7 қолдау", "24/7 support"],
  ["Мы рядом в любое время в чате и по телефону.", "Біз чатта және телефонда әрдайым қасыңыздамыз.", "We are available anytime in chat and by phone."],
  ["Шаг 1", "1-қадам", "Step 1"],
  ["Нажмите подключить", "Қосу батырмасын басыңыз", "Click connect"],
  ["Выберите CRM, мессенджер, маркетплейс или складской сервис.", "CRM, мессенджер, маркетплейс немесе қойма сервисін таңдаңыз.", "Choose CRM, messenger, marketplace or warehouse service."],
  ["Шаг 2", "2-қадам", "Step 2"],
  ["Авторизуйтесь", "Авторизациядан өтіңіз", "Authorize"],
  ["Войдите в аккаунт сервиса. Код, интегратор и ручная настройка не нужны.", "Сервис аккаунтына кіріңіз. Код, интегратор және қолмен баптау керек емес.", "Sign in to the service. No code, integrator or manual setup needed."],
  ["Шаг 3", "3-қадам", "Step 3"],
  ["Добавьте команду", "Команданы қосыңыз", "Add the team"],
  ["Пригласите сотрудников, выдайте роли и назначьте первые задачи.", "Қызметкерлерді шақырып, рөлдер беріп, алғашқы тапсырмаларды тағайындаңыз.", "Invite employees, assign roles and first tasks."],
  ["Шаг 4", "4-қадам", "Step 4"],
  ["Работайте сразу", "Бірден жұмыс істеңіз", "Start working"],
  ["Заявки, клиенты, заказы и остатки начнут собираться автоматически.", "Өтінімдер, клиенттер, тапсырыстар және қалдықтар автоматты жинала бастайды.", "Requests, clients, orders and stock start collecting automatically."],
  ["Без специалистов", "Мамандарсыз", "No specialists"],
  ["подключение внутри ZANI", "ZANI ішінде қосылу", "connection inside ZANI"],
  ["Без кода", "Кодсыз", "No code"],
  ["только авторизация", "тек авторизация", "authorization only"],
  ["Без переноса вручную", "Қолмен көшірусіз", "No manual transfer"],
  ["данные подтягиваются сами", "деректер өзі тартылады", "data pulls itself"],
  ["Без долгого внедрения", "Ұзақ енгізусіз", "No long implementation"],
  ["первые каналы в тот же день", "алғашқы арналар сол күні", "first channels the same day"],
  ["Заявка сразу в CRM", "Өтінім бірден CRM-де", "Request straight to CRM"],
  ["Бот работает 24/7", "Бот 24/7 жұмыс істейді", "Bot works 24/7"],
  ["Напоминания уходят сами", "Еске салулар өзі кетеді", "Reminders send themselves"],
  ["Остатки в реальном времени", "Қалдықтар нақты уақытта", "Real-time stock"],
  ["Маржа без таблиц", "Кестесіз маржа", "Margin without sheets"],
  ["Заказы попадают в CRM", "Тапсырыстар CRM-ге түседі", "Orders flow into CRM"],
  ["CRM бесплатно навсегда", "CRM мәңгі тегін", "CRM free forever"],
  ["Роли для сотрудников", "Қызметкерлерге рөлдер", "Employee roles"],
  ["История клиента под рукой", "Клиент тарихы қол астында", "Client history at hand"],
  ["Рекомендации по ролям", "Рөлдер бойынша ұсыныстар", "Role-based recommendations"],
  ["Просадки видны заранее", "Төмендеулер алдын ала көрінеді", "Drops visible early"],
  ["Следующий шаг понятен", "Келесі қадам түсінікті", "Next step is clear"],
  ["Без интегратора", "Интеграторсыз", "No integrator"],
  ["Первые каналы в тот же день", "Алғашқы арналар сол күні", "First channels the same day"],
  ["Подойдёт ли мне ZANI?", "ZANI маған келе ме?", "Will ZANI fit me?"],
  ["Сколько займёт подключение?", "Қосылу қанша уақыт алады?", "How long does connection take?"],
  ["Что бесплатно?", "Не тегін?", "What is free?"],
  ["Как работают AI-боты?", "AI-боттар қалай жұмыс істейді?", "How do AI bots work?"],
  ["Чаты и заявки", "Чаттар және өтінімдер", "Chats and requests"],
  ["Боты и рассылки", "Боттар және таратылымдар", "Bots and outreach"],
  ["Direct и лиды", "Direct және лидтер", "Direct and leads"],
  ["Заказы и товары", "Тапсырыстар және тауарлар", "Orders and products"],
  ["Остатки и цены", "Қалдықтар және бағалар", "Stock and prices"],
  ["Продажи и маржа", "Сату және маржа", "Sales and margin"],
  ["Учет и склад", "Есеп және қойма", "Accounting and warehouse"],
  ["Токен", "Токен", "Token"],
  ["Склад и закупки", "Қойма және сатып алу", "Warehouse and purchasing"],
  ["Нажмите «Подключить»", "«Қосу» батырмасын басыңыз", "Click “Connect”"],
  ["Выберите канал, маркетплейс или CRM-модуль прямо в ZANI.", "Арнаны, маркетплейсті немесе CRM-модульді ZANI ішінде таңдаңыз.", "Choose a channel, marketplace or CRM module inside ZANI."],
  ["Войдите в аккаунт сервиса. Специалисты, код и сложные настройки не нужны.", "Сервис аккаунтына кіріңіз. Мамандар, код және күрделі баптау керек емес.", "Sign in to the service. No specialists, code or complex setup needed."],
  ["Заявки, сотрудники, клиенты, остатки и заказы появляются в CRM автоматически.", "Өтінімдер, қызметкерлер, клиенттер, қалдықтар және тапсырыстар CRM-де автоматты пайда болады.", "Requests, employees, clients, stock and orders appear in CRM automatically."],
  ["Основная навигация", "Негізгі навигация", "Main navigation"],
  ["Я помогу понять, подходит ли ZANI вашему бизнесу: CRM, боты, маркетплейсы, запуск и тарифы.", "ZANI бизнесіңізге келе ме, соны түсінуге көмектесемін: CRM, боттар, маркетплейстер, іске қосу және тарифтер.", "I can help you understand whether ZANI fits your business: CRM, bots, marketplaces, launch and pricing."],
  ["AI-помощник обновляется. Попробуйте ещё раз через несколько секунд.", "AI-көмекші жаңарып жатыр. Бірнеше секундтан кейін қайталап көріңіз.", "AI assistant is updating. Try again in a few seconds."],
  ["AI-помощник ZANI", "ZANI AI-көмекшісі", "ZANI AI assistant"],
  ["Отвечает по запуску, тарифам и возможностям", "Іске қосу, тарифтер және мүмкіндіктер бойынша жауап береді", "Answers about launch, pricing and features"],
  ["Закрыть AI-помощника", "AI-көмекшіні жабу", "Close AI assistant"],
  ["Вопрос AI-помощнику", "AI-көмекшіге сұрақ", "Question for AI assistant"],
  ["Спросите про запуск, CRM или тарифы", "Іске қосу, CRM немесе тарифтер туралы сұраңыз", "Ask about launch, CRM or pricing"],
  ["Спросите помощника", "Көмекшіден сұраңыз", "Ask assistant"],
  ["+1 новый клиент", "+1 жаңа клиент", "+1 new client"],
  ["в CRM", "CRM-де", "in CRM"],
  ["Онлайн", "Онлайн", "Online"],
  ["● Онлайн", "● Онлайн", "● Online"],
  ["клиентов", "клиент", "clients"],
  ["Ваш бизнес работает", "Бизнесіңіз жұмыс істейді", "Your business runs"],
  ["сам.", "өзі.", "itself."],
  ["Заявки, записи, продажи и остатки сходятся в ZANI без ручного контроля каждый час.", "Өтінімдер, жазбалар, сатылымдар және қалдықтар ZANI-де сағат сайын қолмен бақылаусыз жиналады.", "Requests, bookings, sales and stock come together in ZANI without hourly manual control."],
  ["Посмотреть демо (2 минуты)", "Демо көру (2 минут)", "Watch demo (2 minutes)"],
  ["Подключение за 15 минут", "15 минутта қосылу", "Connected in 15 minutes"],
  ["Без карты", "Картасыз", "No card"],
  ["Назад", "Артқа", "Back"],
  ["Меню", "Мәзір", "Menu"],
  ["Добавить", "Қосу", "Add"],
  ["Сообщение...", "Хабарлама...", "Message..."],
  ["Отправить", "Жіберу", "Send"],
  ["Бот записал клиента.", "Бот клиентті жазды.", "Bot booked the client."],
  ["CRM ведёт дальше", "CRM әрі қарай жүргізеді", "CRM takes it from there"],
  ["Клиент пишет в WhatsApp или Instagram, бот подбирает время, создаёт сделку и ставит напоминание. Менеджер видит уже готовую карточку.", "Клиент WhatsApp немесе Instagram-ға жазады, бот уақыт таңдап, мәміле жасап, еске салу қояды. Менеджер дайын карточканы көреді.", "A client writes in WhatsApp or Instagram, the bot picks a time, creates a deal and sets a reminder. The manager sees a ready card."],
  ["Запустить CRM и ботов", "CRM мен боттарды іске қосу", "Launch CRM and bots"],
  ["Посмотреть демо", "Демо көру", "Watch demo"],
  ["2-минутное видео", "2 минуттық видео", "2-minute video"],
  ["Маржа и остатки", "Маржа және қалдықтар", "Margin and stock"],
  ["без ручных таблиц", "қол кестелерінсіз", "without manual sheets"],
  ["Kaspi, Wildberries, Ozon, 1C и МойСклад передают данные в ZANI. Вы видите маржу, наличие и клиентов в одном рабочем окне.", "Kaspi, Wildberries, Ozon, 1C және МойСклад деректерді ZANI-ге береді. Маржа, бар-жоқ және клиенттер бір жұмыс терезесінде көрінеді.", "Kaspi, Wildberries, Ozon, 1C and MoySklad send data to ZANI. You see margin, stock and clients in one workspace."],
  ["Подключить маркетплейсы", "Маркетплейстерді қосу", "Connect marketplaces"],
  ["Посмотреть, как это работает", "Қалай жұмыс істейтінін көру", "See how it works"],
  ["Команда работает", "Команда жұмыс істейді", "The team works"],
  ["с полной", "толық", "with the full"],
  ["картиной", "көрініспен", "picture"],
  ["В CRM видно клиента, ответственного, историю, задачу и этап сделки. Руководитель понимает, где продажа остановилась.", "CRM-де клиент, жауапты адам, тарих, тапсырма және мәміле кезеңі көрінеді. Басшы сатылым қай жерде тоқтағанын түсінеді.", "CRM shows the client, owner, history, task and deal stage. The owner sees where the sale stopped."],
  ["Смотреть обзор", "Шолуды көру", "Watch overview"],
  ["100% бесплатно навсегда", "100% мәңгі тегін", "100% free forever"],
  ["Без скрытых платежей и ограничений по пользователям", "Жасырын төлемдерсіз және пайдаланушы шектеуінсіз", "No hidden fees or user limits"],
  ["Клиент, сделка, задача...", "Клиент, мәміле, тапсырма...", "Client, deal, task..."],
  ["⌕ Клиент, сделка, задача...", "⌕ Клиент, мәміле, тапсырма...", "⌕ Client, deal, task..."],
  ["Добро пожаловать, Atlas Dental", "Қош келдіңіз, Atlas Dental", "Welcome, Atlas Dental"],
  ["AI уже просканировал входящие", "AI кіріс хабарларды қарап шықты", "AI has scanned incoming messages"],
  ["Новый лид", "Жаңа лид", "New lead"],
  ["WhatsApp передал заявку в CRM", "WhatsApp өтінімді CRM-ге жіберді", "WhatsApp sent request to CRM"],
  ["Воронка продаж", "Сату воронкасы", "Sales pipeline"],
  ["Новые", "Жаңа", "New"],
  ["Оплата", "Төлем", "Payment"],
  ["Последние активности", "Соңғы әрекеттер", "Latest activity"],
  ["Лид назначен Анне", "Лид Аннаға тағайындалды", "Lead assigned to Anna"],
  ["Сделка перешла в оплату", "Мәміле төлемге өтті", "Deal moved to payment"],
  ["Задача просрочена", "Тапсырма мерзімінен өтті", "Task overdue"],
  ["мин назад", "мин бұрын", "min ago"],
  ["Смотреть все", "Барлығын көру", "View all"],
  ["Рабочие модули CRM", "CRM жұмыс модульдері", "CRM work modules"],
  ["Открыть", "Ашу", "Open"],
  ["Помощник находит", "Көмекші табады", "Assistant finds"],
  ["следующий шаг", "келесі қадамды", "the next step"],
  ["Он не пересказывает отчёты. Он показывает конкретную просадку, причину и действие, которое стоит сделать сегодня.", "Ол есептерді қайталамайды. Ол нақты төмендеуді, себебін және бүгін істеу керек әрекетті көрсетеді.", "It does not retell reports. It shows a specific drop, the reason and the action to take today."],
  ["Включить AI-помощника", "AI-көмекшіні қосу", "Enable AI assistant"],
  ["Как это работает", "Бұл қалай жұмыс істейді", "How it works"],
  ["Подсказки по ролям", "Рөлдер бойынша кеңестер", "Role-based hints"],
  ["Что сделать сегодня", "Бүгін не істеу керек", "What to do today"],
  ["Прибыль сегодня", "Бүгінгі пайда", "Profit today"],
  ["Записи на сегодня", "Бүгінгі жазбалар", "Bookings today"],
  ["Новые лиды", "Жаңа лидтер", "New leads"],
  ["Мои лиды", "Менің лидтерім", "My leads"],
  ["AI-подсказка", "AI-кеңес", "AI hint"],
  ["Запуск", "Іске қосу", "Launch"],
  ["без", "енгізусіз", "without"],
  ["внедрения", "енгізусіз", "implementation"],
  ["Вы выбираете канал, авторизуетесь и добавляете сотрудников. Первые заявки начинают попадать в CRM в тот же день.", "Сіз арнаны таңдап, авторизациядан өтіп, қызметкерлерді қосасыз. Алғашқы өтінімдер сол күні CRM-ге түсе бастайды.", "You choose a channel, authorize it and add employees. First requests start entering CRM the same day."],
  ["Запустить без специалиста", "Мамансыз іске қосу", "Launch without a specialist"],
  ["Смотреть каналы", "Арналарды көру", "View channels"],
  ["без интегратора", "интеграторсыз", "no integrator"],
  ["До ZANI", "ZANI-ге дейін", "Before ZANI"],
  ["Долгие внедрения, отдельные специалисты, ручной перенос данных и ожидание настройки.", "Ұзақ енгізу, бөлек мамандар, деректерді қолмен көшіру және баптауды күту.", "Long implementations, separate specialists, manual data transfer and setup waiting."],
  ["После ZANI", "ZANI-ден кейін", "After ZANI"],
  ["Канал подключается через авторизацию, сотрудники получают роли, данные появляются в CRM.", "Арна авторизация арқылы қосылады, қызметкерлер рөл алады, деректер CRM-де пайда болады.", "The channel connects through authorization, employees get roles, data appears in CRM."],
  ["Каналы подключаются.", "Арналар қосылады.", "Channels connect."],
  ["CRM сразу принимает данные", "CRM деректерді бірден қабылдайды", "CRM receives data immediately"],
  ["WhatsApp, Telegram, Instagram, Kaspi, Wildberries, Ozon, 1C и МойСклад подключаются через авторизацию. Сотрудники получают роли, данные появляются в CRM.", "WhatsApp, Telegram, Instagram, Kaspi, Wildberries, Ozon, 1C және МойСклад авторизация арқылы қосылады. Қызметкерлер рөл алады, деректер CRM-де пайда болады.", "WhatsApp, Telegram, Instagram, Kaspi, Wildberries, Ozon, 1C and MoySklad connect through authorization. Employees get roles, data appears in CRM."],
  ["CRM готова сразу", "CRM бірден дайын", "CRM is ready immediately"],
  ["Добавьте сотрудников, роли и каналы. Клиенты, сделки и история начнут собираться автоматически.", "Қызметкерлерді, рөлдерді және арналарды қосыңыз. Клиенттер, мәмілелер және тарих автоматты жинала бастайды.", "Add employees, roles and channels. Clients, deals and history start collecting automatically."],
  ["Подключить", "Қосу", "Connect"],
  ["Интеграции ZANI", "ZANI интеграциялары", "ZANI integrations"],
  ["Платите за рост,", "Өсу үшін төлеңіз,", "Pay for growth,"],
  ["а не за", "ал емес", "not for"],
  ["пустые места", "бос орындар", "empty seats"],
  ["CRM остаётся бесплатной. Платные тарифы подключают каналы продаж, расширенную аналитику, роли и персональную поддержку.", "CRM тегін қалады. Ақылы тарифтер сату арналарын, кеңейтілген аналитиканы, рөлдерді және жеке қолдауды қосады.", "CRM stays free. Paid plans add sales channels, advanced analytics, roles and personal support."],
  ["7 дней бесплатно", "7 күн тегін", "7 days free"],
  ["Полный доступ ко всем функциям", "Барлық функцияларға толық қолжетімділік", "Full access to all features"],
  ["Без скрытых платежей", "Жасырын төлемдерсіз", "No hidden fees"],
  ["Отменить можно в любой момент", "Кез келген уақытта тоқтатуға болады", "Cancel anytime"],
  ["Популярный выбор", "Танымал таңдау", "Popular choice"]
];

function buildLandingPhraseMap(language: Language) {
  const targetIndex = language === "kk" ? 1 : language === "en" ? 2 : 0;
  const map = new Map<string, string>();
  landingPhraseRows.forEach((row) => {
    row.forEach((phrase) => {
      map.set(phrase, row[targetIndex]);
    });
  });
  return map;
}

function translateLandingPhrase(value: string, language: Language) {
  return buildLandingPhraseMap(language).get(value) ?? value;
}

function LandingLanguageRuntime() {
  const { language } = useI18n();

  useLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>(".zani-experience");
    if (!root) return;
    const rootNode = root;
    const phraseMap = buildLandingPhraseMap(language);
    let isTranslating = false;

    function translateValue(value: string) {
      const leading = value.match(/^\s*/)?.[0] ?? "";
      const trailing = value.match(/\s*$/)?.[0] ?? "";
      const trimmed = value.trim();
      if (!trimmed) return value;
      const direct = phraseMap.get(trimmed);
      if (direct) return `${leading}${direct}${trailing}`;
      const withCheck = trimmed.startsWith("✓ ") ? phraseMap.get(trimmed.slice(2)) : null;
      if (withCheck) return `${leading}✓ ${withCheck}${trailing}`;
      const minutes = trimmed.match(/^(\d+)\s+мин назад$/);
      if (minutes) return `${leading}${minutes[1]} ${phraseMap.get("мин назад") ?? "мин назад"}${trailing}`;
      return value;
    }

    function translateNodeTree() {
      if (isTranslating) return;
      isTranslating = true;
      const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      while (walker.nextNode()) {
        if (walker.currentNode instanceof Text) textNodes.push(walker.currentNode);
      }
      textNodes.forEach((node) => {
        const nextValue = translateValue(node.nodeValue ?? "");
        if (nextValue !== node.nodeValue) node.nodeValue = nextValue;
      });
      rootNode.querySelectorAll<HTMLElement>("[aria-label], [placeholder], [title]").forEach((node) => {
        ["aria-label", "placeholder", "title"].forEach((attr) => {
          const value = node.getAttribute(attr);
          if (!value) return;
          const nextValue = translateValue(value);
          if (nextValue !== value) node.setAttribute(attr, nextValue);
        });
      });
      isTranslating = false;
    }

    translateNodeTree();
    const observer = new MutationObserver(() => translateNodeTree());
    observer.observe(rootNode, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["aria-label", "placeholder", "title"] });
    return () => {
      observer.disconnect();
    };
  }, [language]);

  return null;
}

function ProofStrip({ items }: { items: string[] }) {
  return (
    <div className="section-proof-strip">
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

function Header({ activeSection }: { activeSection: LandingSectionId }) {
  const navItems = landingSections.filter((section) => section.id !== "top" && section.id !== "crm-free" && section.id !== "trust");
  const navActiveSection = activeSection === "crm-free" ? "crm-bots" : activeSection === "trust" ? "launch" : activeSection;

  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="ZANI">
        ZANI
      </a>
      <nav aria-label="Основная навигация">
        {navItems.map((item) => (
          <a className={navActiveSection === item.id ? "is-active" : ""} href={`#${item.id}`} key={item.id}>
            {item.label}
          </a>
        ))}
      </nav>
      <div className="header-actions">
        <a className={activeSection === "top" ? "is-active" : ""} href={AUTH_ROUTES.login} data-auth-action="login">
          Войти
        </a>
        <a className="header-cta" href={AUTH_ROUTES.signup} data-auth-action="signup">
          Получить CRM бесплатно
        </a>
        <LanguageSelector className="landing-language" />
      </div>
    </header>
  );
}

function LandingAiAssistant({ activeSection }: { activeSection: LandingSectionId }) {
  const { language } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<LandingAssistantMessage[]>([
    {
      id: "intro",
      role: "assistant",
      text: "Я помогу понять, подходит ли ZANI вашему бизнесу: CRM, боты, маркетплейсы, запуск и тарифы.",
      meta: "ZANI AI"
    }
  ]);
  const tone = sectionToneMap[activeSection] || "blue";

  async function sendMessage(nextMessage: string) {
    const trimmed = normalizeLandingAiInput(nextMessage).trim();
    if (!trimmed || isLoading) return;

    const userMessage: LandingAssistantMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed
    };
    setMessages((current) => appendLandingAiMessage(current, userMessage));
    setMessage("");
    setIsOpen(true);
    setIsLoading(true);

    try {
      const response = await aiApi.publicLandingAssistant({ message: trimmed, section: activeSection });
      setMessages((current) => appendLandingAiMessage(current, {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: normalizeLandingAiInput(response.answer),
        meta: response.is_mock ? "ZANI AI · demo" : "ZANI AI · live"
      }));
    } catch {
      setMessages((current) => appendLandingAiMessage(current, {
        id: `assistant-error-${Date.now()}`,
        role: "assistant",
        text: "AI-помощник временно недоступен. Попробуйте ещё раз через несколько секунд.",
        meta: "ZANI AI"
      }));
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(message);
  }

  return (
    <aside className={`landing-ai landing-ai-${tone} ${isOpen ? "is-open" : ""}`} aria-label="AI-помощник ZANI">
      {isOpen ? (
        <div className="landing-ai-panel">
          <div className="landing-ai-head">
            <div>
              <span>AI-помощник ZANI</span>
              <b>Отвечает по запуску, тарифам и возможностям</b>
            </div>
            <button aria-label="Закрыть AI-помощника" onClick={() => setIsOpen(false)} type="button">×</button>
          </div>
          <div className="landing-ai-messages">
            {messages.map((item) => (
              <div className={`landing-ai-message is-${item.role}`} key={item.id}>
                {item.meta ? <small>{item.meta}</small> : null}
                <p>{item.text}</p>
              </div>
            ))}
            {isLoading ? (
              <div className="landing-ai-message is-assistant is-loading">
                <small>ZANI AI</small>
                <span><i /><i /><i /></span>
              </div>
            ) : null}
          </div>
          <div className="landing-ai-prompts">
            {assistantQuickPrompts.map((prompt) => (
              <button disabled={isLoading} key={prompt} onClick={() => void sendMessage(translateLandingPhrase(prompt, language))} type="button">
                {prompt}
              </button>
            ))}
          </div>
          <form className="landing-ai-form" onSubmit={handleSubmit}>
            <input
              aria-label="Вопрос AI-помощнику"
              maxLength={LANDING_AI_MAX_INPUT_LENGTH}
              onChange={(event) => setMessage(normalizeLandingAiInput(event.target.value))}
              placeholder="Спросите про запуск, CRM или тарифы"
              value={message}
            />
            <button disabled={isLoading || !message.trim()} type="submit">→</button>
          </form>
        </div>
      ) : null}
      <button className="landing-ai-bar" onClick={() => setIsOpen((value) => !value)} type="button">
        <span>
          <i />
          ZANI AI
        </span>
        <b>Спросите помощника</b>
      </button>
    </aside>
  );
}

function HeroCore() {
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  const metrics = {
    crm: "+1 новый клиент",
    bots: 247,
    advisor: advisorNotes[0]
  };

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setParallax({
      x: ((event.clientX - rect.left) / rect.width - 0.5) * 2,
      y: ((event.clientY - rect.top) / rect.height - 0.5) * 2
    });
  }

  function renderLiveState(feature: (typeof features)[number]) {
    if (feature.id === "crm") {
      return (
        <div className="live-row live-row-strong">
          <span>{metrics.crm}</span>
          <i>в CRM</i>
        </div>
      );
    }

    if (feature.id === "bots") {
      return (
        <div className="live-row">
          <span className="online-dot">Онлайн</span>
          <i>{metrics.bots} клиентов</i>
        </div>
      );
    }

    if (feature.id === "marketplaces") {
      return (
        <div className="sync-list">
          {marketplaceSync.map((item) => (
            <span className="is-synced" key={item}>
              {item}
              <b>✓</b>
            </span>
          ))}
        </div>
      );
    }

    return (
      <div className="advisor-note">
        {metrics.advisor}
      </div>
    );
  }

  return (
    <div
      className="hero-core"
      aria-hidden="true"
      onPointerLeave={() => setParallax({ x: 0, y: 0 })}
      onPointerMove={handlePointerMove}
      style={{ "--px": parallax.x, "--py": parallax.y } as CSSProperties}
    >
      <svg className="core-lines" viewBox="0 0 760 620">
        <defs>
          {linePaths.map((line, index) => (
            <path d={line.path} id={`core-path-${index}`} key={line.path} />
          ))}
        </defs>
        {linePaths.map((line, index) => (
          <g className="data-route hero-route" key={line.path} style={{ animationDelay: `${index * 0.16}s` }}>
            <path className="core-path data-line-base" d={line.path} />
            <path className="core-path data-line-pulse" d={line.path} />
            <circle className="line-dot line-dot-start" cx={line.start[0]} cy={line.start[1]} r="3" />
            <circle className="line-dot line-dot-end" cx={line.end[0]} cy={line.end[1]} r="3" />
          </g>
        ))}
        {linePaths.map((_, index) => (
          <circle className="flow-pulse" key={`pulse-${index}`} r="2.4">
            <animateMotion begin={`${index * 1.15}s`} dur="5.8s" repeatCount="indefinite">
              <mpath href={`#core-path-${index}`} />
            </animateMotion>
          </circle>
        ))}
        <g className="route-junction">
          <circle cx="380" cy="310" r="4" />
          <circle cx="360" cy="310" r="2" />
          <circle cx="400" cy="310" r="2" />
        </g>
      </svg>
      <div className="app-constellation">
        {heroPorts.map((port, index) => (
          <span className={`app-chip app-chip-${index + 1} app-chip-${port.group}`} key={`${port.group}-${port.label}`}>
            <i />
            <b>{port.label}</b>
          </span>
        ))}
      </div>
      {features.map((feature, index) => (
        <article className={`feature-card feature-${index + 1} feature-${feature.id}`} key={feature.title}>
          <div className="feature-icon">{feature.icon}</div>
          <div>
            <small>{feature.meta}</small>
            <h3>{feature.title}</h3>
            {feature.subtitle ? <b className="feature-subtitle">{feature.subtitle}</b> : null}
            <p>{feature.text}</p>
            {renderLiveState(feature)}
          </div>
        </article>
      ))}
    </div>
  );
}

function Hero() {
  return (
    <section className="hero section" id="top">
      <div className="hero-copy">
        <h1>
          Ваш бизнес работает <span>сам.</span>
        </h1>
        <p>
          Заявки, записи, продажи и остатки сходятся в ZANI без ручного контроля каждый час.
        </p>
        <div className="hero-actions">
          <a className="primary-cta" href={AUTH_ROUTES.signup} data-auth-action="signup" data-auth-intent="Получить CRM бесплатно">
            Получить CRM бесплатно
          </a>
          <a className="demo-cta" href="#crm-bots">
            <span>▶</span>
            Посмотреть демо (2 минуты)
          </a>
        </div>
        <div className="trust-list">
          <span>
            <b>15 минут</b>
            <small>первое подключение</small>
          </span>
          <span>
            <b>Бесплатно</b>
            <small>CRM навсегда</small>
          </span>
          <span>
            <b>Без карты</b>
            <small>старт без риска</small>
          </span>
        </div>
      </div>
      <HeroCore />
    </section>
  );
}

function TypingDots() {
  return (
    <div className="chat-bubble chat-bubble-bot typing-bubble">
      <i />
      <i />
      <i />
    </div>
  );
}

function PhoneChat({ activeModule, onVisibleCountChange }: { activeModule: string | null; onVisibleCountChange?: (count: number) => void }) {
  const phoneRef = useRef<HTMLDivElement | null>(null);
  const chatViewportRef = useRef<HTMLDivElement | null>(null);
  const chatInnerRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [activeFlowCount, setActiveFlowCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [chatScroll, setChatScroll] = useState(0);

  useEffect(() => {
    const node = phoneRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.42 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isInView) return;

    let cancelled = false;
    const timers: number[] = [];

    function wait(ms: number) {
      return new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, ms);
        timers.push(timer);
      });
    }

    async function runChat() {
      while (!cancelled) {
        setVisibleCount(0);
        setActiveFlowCount(0);
        setIsTyping(false);

        for (let index = 0; index < bookingMessages.length; index += 1) {
          const message = bookingMessages[index];
          if (message.from === "bot" || message.from === "system") {
            setIsTyping(true);
            await wait(index === 9 ? 360 : 620);
            if (cancelled) return;
            setIsTyping(false);
          }

          const nextCount = index + 1;
          const lineDuration = message.slots ? 1280 : message.from === "system" ? 1120 : 1040;
          const holdDuration = message.slots ? 260 : message.from === "system" ? 180 : 120;

          setVisibleCount(nextCount);
          setActiveFlowCount(nextCount);
          await wait(lineDuration);
          if (cancelled) return;
          setActiveFlowCount(0);
          await wait(holdDuration);
          if (cancelled) return;
        }

        await wait(3500);
      }
    }

    runChat();

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [isInView]);

  useLayoutEffect(() => {
    const viewport = chatViewportRef.current;
    const inner = chatInnerRef.current;
    if (!viewport || !inner) return;

    const frame = window.requestAnimationFrame(() => {
      const viewportStyles = window.getComputedStyle(viewport);
      const verticalPadding = parseFloat(viewportStyles.paddingTop) + parseFloat(viewportStyles.paddingBottom);
      const visibleArea = Math.max(0, viewport.clientHeight - verticalPadding);
      const overflow = Math.max(0, inner.scrollHeight - visibleArea);
      setChatScroll(-overflow);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [visibleCount, isTyping]);

  const visibleMessages = bookingMessages.slice(0, visibleCount);
  const flowSourceByMessage: Record<string, "crm" | "bots" | "broadcasts"> = {
    m1: "bots",
    m2: "bots",
    m3: "bots",
    m4: "bots",
    m5: "bots",
    m6: "bots",
    m7: "bots",
    m8: "bots",
    m9: "bots",
    m10: "crm",
    m11: "broadcasts",
    m12: "broadcasts"
  };

  useEffect(() => {
    onVisibleCountChange?.(activeFlowCount);
  }, [activeFlowCount, onVisibleCountChange]);

  return (
    <motion.div
      className="phone-stage"
      initial={{ opacity: 0, y: 34, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.36 }}
      transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="phone-glow-ring" />
      <div className="iphone-mockup" ref={phoneRef}>
        <div className="iphone-screen">
          <div className="dynamic-island">
            <span />
          </div>
          <div className="phone-status">
            <span>9:41</span>
            <b>▴ ᯤ ▰</b>
          </div>
          <div className="chat-header">
            <button aria-label="Назад" type="button" tabIndex={-1}>‹</button>
            <div className="bot-avatar">Z</div>
            <div>
              <strong>ZANI Bot</strong>
              <small>● Онлайн</small>
            </div>
            <button aria-label="Меню" type="button" tabIndex={-1}>⋮</button>
          </div>
          <div className={`chat-messages is-${activeModule ?? "idle"}`} ref={chatViewportRef}>
            <div className="chat-messages-inner" ref={chatInnerRef} style={{ "--chat-scroll": `${chatScroll}px` } as CSSProperties}>
              {visibleMessages.map((message) => (
                <div
                  className={`chat-bubble chat-bubble-${message.from} ${message.id === "m10" ? "crm-created-card" : ""} ${
                    message.id === "m11" || message.id === "m12" ? "broadcast-message" : ""
                  } ${flowSourceByMessage[message.id] ? `flow-source flow-source-${flowSourceByMessage[message.id]}` : ""}`}
                  key={message.id}
                >
                  {message.icon ? <span className="message-icon">{message.icon}</span> : null}
                  {message.id === "m10" ? <b>✅ {message.text[0]}</b> : null}
                  {(message.id === "m10" ? message.text.slice(1) : message.text).map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                  {message.slots ? (
                    <div className="time-slots">
                      {message.slots.map(([time, name]) => (
                        <button className={time === "18:00" ? "is-active" : ""} key={time} type="button" tabIndex={-1}>
                          <b>{time}</b>
                          <span>{name}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <small>{message.time}</small>
                </div>
              ))}
              {isTyping ? <TypingDots /> : null}
            </div>
          </div>
          <div className="phone-input">
            <button aria-label="Добавить" type="button" tabIndex={-1}>+</button>
            <span>Сообщение...</span>
            <button aria-label="Отправить" type="button" tabIndex={-1}>›</button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

type ChargingCableId = "crm" | "bots" | "broadcasts";

type ChargingCableGeometry = {
  id: ChargingCableId;
  color: string;
  path: string;
  start: [number, number];
  end: [number, number];
};

type ChargingCableState = {
  width: number;
  height: number;
  cables: ChargingCableGeometry[];
};

const chargingCableConfig: Array<{
  id: ChargingCableId;
  color: string;
  inputRatio: number;
  laneRatio: number;
}> = [
  { id: "crm", color: "#4CB4FF", inputRatio: 0.24, laneRatio: 0.36 },
  { id: "bots", color: "#8B5CF6", inputRatio: 0.5, laneRatio: 0.5 },
  { id: "broadcasts", color: "#F56EDB", inputRatio: 0.76, laneRatio: 0.64 }
];

function PhoneConnector({
  activeModule,
  sectionRef,
  onVisibleCountChange
}: {
  activeModule: string | null;
  sectionRef: RefObject<HTMLElement | null>;
  onVisibleCountChange: (count: number) => void;
}) {
  const [geometry, setGeometry] = useState<ChargingCableState | null>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let frame = 0;

    const readGeometry = () => {
      const sectionRect = section.getBoundingClientRect();
      const phone = section.querySelector<HTMLElement>(".iphone-mockup");
      const charger = section.querySelector<HTMLElement>(".phone-charger");

      if (!phone || !charger || sectionRect.width <= 0 || sectionRect.height <= 0) return;

      const phoneRect = phone.getBoundingClientRect();
      const chargerRect = charger.getBoundingClientRect();
      const phoneRight = phoneRect.right - sectionRect.left;
      const chargerTop = chargerRect.top - sectionRect.top;
      const chargerBottom = chargerRect.bottom - sectionRect.top;
      const cables = chargingCableConfig
        .map((config) => {
          const card = section.querySelector<HTMLElement>(`.automation-card[data-module="${config.id}"]`);
          if (!card) return null;

          const cardRect = card.getBoundingClientRect();
          const cardLeft = cardRect.left - sectionRect.left;
          const connectorX = cardLeft - 30;
          const cardCenterY = cardRect.top - sectionRect.top + cardRect.height / 2;
          const adapterDotInset = 10;
          const adapterX = chargerRect.left - sectionRect.left + adapterDotInset + (chargerRect.width - adapterDotInset * 2) * config.inputRatio;
          const adapterY = chargerBottom - 4;
          const gap = Math.max(96, cardLeft - phoneRight);
          const laneMin = phoneRight + 24;
          const laneMax = cardLeft - 42;
          const rawLaneX = phoneRight + gap * config.laneRatio;
          const laneX = Math.max(laneMin, Math.min(laneMax, rawLaneX));
          const branchX = Math.max(laneMin, Math.min(laneMax, cardLeft - 74));
          const bundleY = chargerBottom + 22;
          const branchControlY = cardCenterY + (bundleY - cardCenterY) * 0.42;
          const path = [
            `M ${adapterX.toFixed(1)} ${adapterY.toFixed(1)}`,
            `C ${adapterX.toFixed(1)} ${(adapterY + 24).toFixed(1)} ${laneX.toFixed(1)} ${(bundleY + 8).toFixed(1)} ${laneX.toFixed(1)} ${bundleY.toFixed(1)}`,
            `C ${laneX.toFixed(1)} ${branchControlY.toFixed(1)} ${branchX.toFixed(1)} ${cardCenterY.toFixed(1)} ${(connectorX - 58).toFixed(1)} ${cardCenterY.toFixed(1)}`,
            `L ${connectorX.toFixed(1)} ${cardCenterY.toFixed(1)}`
          ].join(" ");

          return {
            id: config.id,
            color: config.color,
            path,
            start: [adapterX, adapterY] as [number, number],
            end: [connectorX, cardCenterY] as [number, number]
          };
        })
        .filter((cable): cable is ChargingCableGeometry => Boolean(cable));

      setGeometry({
        width: sectionRect.width,
        height: sectionRect.height,
        cables
      });
    };

    const scheduleRead = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(readGeometry);
    };

    scheduleRead();

    const observedPhone = section.querySelector<HTMLElement>(".iphone-mockup");
    const observedCharger = section.querySelector<HTMLElement>(".phone-charger");
    const observer = new ResizeObserver(scheduleRead);
    observer.observe(section);
    if (observedPhone) observer.observe(observedPhone);
    if (observedCharger) observer.observe(observedCharger);
    section.querySelectorAll<HTMLElement>(".automation-card").forEach((card) => observer.observe(card));
    const syncInterval = window.setInterval(scheduleRead, 120);
    const stopSync = window.setTimeout(() => window.clearInterval(syncInterval), 2400);
    section.addEventListener("transitionend", scheduleRead, true);
    section.addEventListener("animationend", scheduleRead, true);
    window.addEventListener("scroll", scheduleRead, { passive: true });
    window.addEventListener("resize", scheduleRead);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.clearInterval(syncInterval);
      window.clearTimeout(stopSync);
      section.removeEventListener("transitionend", scheduleRead, true);
      section.removeEventListener("animationend", scheduleRead, true);
      window.removeEventListener("scroll", scheduleRead);
      window.removeEventListener("resize", scheduleRead);
    };
  }, [sectionRef]);

  const cables = geometry?.cables ?? [];
  const viewBox = geometry ? `0 0 ${geometry.width} ${geometry.height}` : "0 0 1 1";

  return (
    <>
    <svg className={`charging-cables active-${activeModule ?? "none"}`} viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        {cables.map((cable) => (
          <path d={cable.path} id={`charge-cable-${cable.id}`} key={cable.id} />
        ))}
      </defs>
      {cables.map((cable) => (
        <g className={`charging-cable charging-cable-${cable.id}`} key={cable.id} style={{ "--charge-color": cable.color } as CSSProperties}>
          <path className="charging-cable-shadow" d={cable.path} />
          <path className="charging-cable-base" d={cable.path} />
          <path className="charging-cable-core" d={cable.path} />
          <circle className="charging-cable-pin charging-cable-pin-start" cx={cable.start[0]} cy={cable.start[1]} r="3" />
          <circle className="charging-cable-pin charging-cable-pin-end" cx={cable.end[0]} cy={cable.end[1]} r="3.5" />
          <circle className="charging-cable-pulse" r="3.2">
            <animateMotion dur="1.1s" repeatCount="indefinite">
              <mpath href={`#charge-cable-${cable.id}`} />
            </animateMotion>
          </circle>
        </g>
      ))}
    </svg>
      <PhoneChat activeModule={activeModule} onVisibleCountChange={onVisibleCountChange} />
    </>
  );
}

function FlowLines({ activeModule, visibleCount }: { activeModule: string | null; visibleCount: number }) {
  const lines = [
    {
      id: "request-bots",
      target: "crm",
      visibleAt: 1,
      path: "M716 314 C770 286 790 178 832 164",
      start: [716, 314],
      end: [832, 164],
      color: "#4CB4FF",
      dur: "5.2s"
    },
    {
      id: "reply-bots",
      target: "bots",
      visibleAt: 2,
      path: "M742 398 C784 398 800 344 832 338",
      start: [742, 398],
      end: [832, 338],
      color: "#8B5CF6",
      dur: "5.8s"
    },
    {
      id: "free-bots",
      target: "bots",
      visibleAt: 3,
      path: "M724 444 C780 444 804 384 832 366",
      start: [724, 444],
      end: [832, 366],
      color: "#8B5CF6",
      dur: "5.6s"
    },
    {
      id: "slots-bots",
      target: "bots",
      visibleAt: 4,
      path: "M742 476 C794 476 806 408 832 404",
      start: [742, 476],
      end: [832, 404],
      color: "#8B5CF6",
      dur: "6s"
    },
    {
      id: "choice-bots",
      target: "crm",
      visibleAt: 5,
      path: "M724 492 C792 492 798 210 832 206",
      start: [724, 492],
      end: [832, 206],
      color: "#4CB4FF",
      dur: "5.7s"
    },
    {
      id: "name-bots",
      target: "crm",
      visibleAt: 7,
      path: "M724 420 C778 420 800 186 832 184",
      start: [724, 420],
      end: [832, 184],
      color: "#4CB4FF",
      dur: "5.4s"
    },
    {
      id: "phone-bots",
      target: "crm",
      visibleAt: 9,
      path: "M724 470 C786 470 802 234 832 226",
      start: [724, 470],
      end: [832, 226],
      color: "#4CB4FF",
      dur: "5.9s"
    },
    {
      id: "created-crm",
      target: "crm",
      visibleAt: 10,
      path: "M724 348 C786 338 782 164 832 164",
      start: [724, 348],
      end: [832, 164],
      color: "#4CB4FF",
      dur: "4.8s"
    },
    {
      id: "reminder-broadcasts",
      target: "broadcasts",
      visibleAt: 11,
      path: "M724 462 C784 462 790 562 832 562",
      start: [724, 462],
      end: [832, 562],
      color: "#F56EDB",
      dur: "5.6s"
    },
    {
      id: "review-broadcasts",
      target: "broadcasts",
      visibleAt: 12,
      path: "M724 526 C782 526 792 562 832 562",
      start: [724, 526],
      end: [832, 562],
      color: "#F56EDB",
      dur: "6.1s"
    }
  ];
  const visibleLines = lines.filter((line) => visibleCount === line.visibleAt);

  return (
    <svg className={`crm-flow-lines active-${activeModule ?? "none"}`} viewBox="0 0 1180 720" aria-hidden="true">
      <defs>
        {visibleLines.map((line) => (
          <path d={line.path} id={`flow-${line.id}`} key={line.id} />
        ))}
      </defs>
      {visibleLines.map((line) => (
        <g className={`flow-line flow-line-${line.id} flow-line-${line.target}`} key={line.id}>
          <path d={line.path} style={{ stroke: line.color }} />
          <circle className="flow-endpoint" cx={line.start[0]} cy={line.start[1]} r="3.4" style={{ fill: line.color }} />
          <circle className="flow-endpoint" cx={line.end[0]} cy={line.end[1]} r="3.4" style={{ fill: line.color }} />
          <circle r="3.2" style={{ fill: line.color }}>
            <animateMotion dur={line.dur} repeatCount="indefinite">
              <mpath href={`#flow-${line.id}`} />
            </animateMotion>
          </circle>
        </g>
      ))}
    </svg>
  );
}

function CrmBotsSection() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [, setVisibleChatCount] = useState(0);
  const sectionRef = useRef<HTMLElement | null>(null);

  return (
    <section className="crm-bots-section" id="crm-bots" ref={sectionRef}>
      <div className="crm-bots-particles" aria-hidden="true" />
      <div className="crm-bots-layout">
        <motion.div
          className="crm-bots-copy"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.42 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2>
            Бот записал клиента. <span>CRM ведёт дальше</span>
          </h2>
          <p>
            Клиент пишет в WhatsApp или Instagram, бот подбирает время, создаёт сделку и ставит напоминание. Менеджер видит уже готовую карточку.
          </p>
          <div className="crm-bots-actions">
            <a className="crm-bots-primary" href={AUTH_ROUTES.signup} data-auth-action="signup" data-auth-intent="Запустить CRM и ботов">
              Запустить CRM и ботов <span>→</span>
            </a>
            <a className="crm-bots-demo" href="#crm-free">
              <span>▷</span>
              <b>
                Посмотреть демо
                <small>2-минутное видео</small>
              </b>
            </a>
          </div>
          <ProofStrip items={sectionProofs.crmBots} />
        </motion.div>

        <PhoneChat activeModule={activeModule} onVisibleCountChange={setVisibleChatCount} />

        <div className="automation-cards">
          {automationCards.map((card, index) => (
            <motion.article
              className={`automation-card automation-card-${card.accent}`}
              data-module={card.id}
              key={card.id}
              initial={{ opacity: 0, x: 36 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.34 }}
              transition={{ duration: 0.6, delay: 0.22 + index * 0.12, ease: [0.22, 1, 0.36, 1] }}
              onMouseEnter={() => setActiveModule(card.id)}
              onMouseLeave={() => setActiveModule(null)}
            >
              <div className="automation-card-head">
                <span>{card.icon}</span>
                <h3>{card.title}</h3>
              </div>
              <p>{card.text}</p>
              <ul>
                {card.checks.map((check) => (
                  <li key={check}>✓ {check}</li>
                ))}
              </ul>
              {card.id === "broadcasts" ? (
                <div className="messenger-icons" aria-hidden="true">
                  <i>WA</i>
                  <i>TG</i>
                </div>
              ) : null}
              <a href={AUTH_ROUTES.signup} data-auth-action="signup" data-auth-intent={card.link}>{card.link}</a>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function MarketplaceSection() {
  return (
    <section className="marketplace-section" id="marketplaces">
      <div className="marketplace-layout">
        <motion.div
          className="marketplace-copy"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.38 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2>
            Маржа и остатки <span>без ручных таблиц</span>
          </h2>
          <p>Kaspi, Wildberries, Ozon, 1C и МойСклад передают данные в ZANI. Вы видите маржу, наличие и клиентов в одном рабочем окне.</p>
          <div className="marketplace-actions">
            <a className="crm-bots-primary" href={AUTH_ROUTES.signup} data-auth-action="signup" data-auth-intent="Подключить маркетплейсы">
              Подключить маркетплейсы <span>→</span>
            </a>
            <a className="crm-bots-demo" href="#crm-free">
              <span>▷</span>
              <b>
                Посмотреть, как это работает
                <small>2-минутное видео</small>
              </b>
            </a>
          </div>
          <ProofStrip items={sectionProofs.marketplaces} />
        </motion.div>

        <div className="marketplace-map" aria-hidden="true">
          <div className="marketplace-left-nodes">
            {marketplaceNodes.map(([name, sub, brand, logoSrc], index) => (
              <motion.div
                className={`market-node market-node-${index + 1}`}
                key={name}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.45, delay: index * 0.07 }}
              >
                <span className={`market-logo market-logo-${brand}`}>
                  <img src={logoSrc} alt="" loading="lazy" />
                </span>
                <b>{name}</b>
                {sub ? <small>{sub}</small> : null}
              </motion.div>
            ))}
          </div>
        </div>

        <svg className="market-lines" viewBox="0 0 1440 500" aria-hidden="true">
          <path className="route-guide route-guide-left" d="M616.6 92 L616.6 436" />
          <path className="route-guide route-guide-right" d="M1038 12 L1038 472" />
          {marketplaceConnections.map((line, index) => (
            <g className="data-route market-route" key={line.path} style={{ animationDelay: `${index * 0.13}s` }}>
              <path className="data-line-base" d={line.path} />
              <path className="data-line-pulse" d={line.path} />
            </g>
          ))}
        </svg>

        <div className="marketplace-feature-list">
          {marketplaceFeatures.map((item, index) => (
            <motion.article
              className={`market-feature market-feature-${item.accent}`}
              key={item.title}
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.55, delay: index * 0.1 }}
            >
              <div>
                <span>{item.icon}</span>
                {item.tag ? <small>{item.tag}</small> : null}
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              {item.messengers ? (
                <div className="market-messengers">
                  {item.messengers.map((messenger) => (
                    <b key={messenger}>{messenger}</b>
                  ))}
                </div>
              ) : null}
            </motion.article>
          ))}
        </div>
      </div>
      <div className="market-proof-row">
        {marketplaceProofs.map(([title, text, icon]) => (
          <article key={title}>
            <span>{icon}</span>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CrmSuiteSection() {
  const [crmPulseStep, setCrmPulseStep] = useState(0);
  const crmActiveMetric = crmPulseStep % crmSuiteStats.length;
  const crmCycle = Math.floor(crmPulseStep / crmSuiteStats.length);
  const crmValueIndex = (index: number, length: number) => (crmCycle + (index <= crmActiveMetric ? 1 : 0)) % length;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCrmPulseStep((step) => step + 1);
    }, 1450);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="crm-suite-section" id="crm-free">
      <div className="crm-suite-layout">
        <motion.div
          className="crm-suite-copy"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.38 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2>
            Команда работает с полной <span>картиной</span>
          </h2>
          <p>
            В CRM видно клиента, ответственного, историю, задачу и этап сделки. Руководитель понимает, где продажа остановилась.
          </p>
          <div className="crm-suite-actions">
            <a className="crm-bots-primary" href={AUTH_ROUTES.signup} data-auth-action="signup" data-auth-intent="Получить CRM бесплатно">
              Получить CRM бесплатно <span>→</span>
            </a>
            <a className="crm-bots-demo" href="#launch">
              <span>▷</span>
              <b>
                Смотреть обзор
                <small>2-минутное видео</small>
              </b>
            </a>
          </div>
          <ProofStrip items={sectionProofs.crmSuite} />
          <div className="crm-suite-free">
            <span>▣</span>
            <div>
              <b>100% бесплатно навсегда</b>
              <small>Без скрытых платежей и ограничений по пользователям</small>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="crm-suite-dashboard"
          initial={{ opacity: 0, y: 34, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.28 }}
          transition={{ duration: 0.75, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="crm-dash-top">
            <strong>ZANI</strong>
            <div className="crm-search">⌕ Клиент, сделка, задача...</div>
            <div className="crm-user">
              <span>12</span>
              <b>Директор</b>
            </div>
          </div>
          <div className="crm-dash-body">
            <aside className="crm-dash-menu">
              {crmSuiteMenu.map((item, index) => (
                <span className={index === 0 ? "is-active" : ""} key={item}>
                  <i>{["⌂", "◎", "◉", "✓", "▱", "▥"][index]}</i>
                  {item}
                </span>
              ))}
            </aside>
            <div className="crm-dash-main">
              <div className="crm-stat-grid">
                {crmSuiteStats.map(({ label, values, changes, accent }, index) => {
                  const valueIndex = crmValueIndex(index, values.length);
                  return (
                  <article
                    className={`crm-stat-card crm-stat-${accent}${index === crmActiveMetric ? " is-live" : ""}`}
                    key={label}
                    style={{ "--metric-delay": `${index * 0.58}s` } as CSSProperties}
                  >
                    <span>{label}</span>
                    <b key={`${label}-${values[valueIndex]}`}>{values[valueIndex]}</b>
                    <small>{changes[valueIndex]}</small>
                    <i />
                  </article>
                  );
                })}
              </div>
              <div className="crm-live-toast">
                <span>Новый лид</span>
                <b key={crmLiveEvents[crmPulseStep % crmLiveEvents.length]}>{crmLiveEvents[crmPulseStep % crmLiveEvents.length]}</b>
              </div>
              <div className="crm-dash-lower">
                <div className="crm-funnel">
                  <h3>Воронка продаж</h3>
                  <div className="funnel-metrics">
                    {crmFunnelStages.map(({ label, values, changes }, index) => {
                      const valueIndex = crmValueIndex(index, values.length);
                      return (
                      <div className={index === crmActiveMetric % crmFunnelStages.length ? "is-live" : ""} key={label}>
                        <span>{label}</span>
                        <b key={`${label}-${values[valueIndex]}`}>{values[valueIndex]}</b>
                        <small>{changes[valueIndex]}</small>
                      </div>
                      );
                    })}
                  </div>
                  <div className="funnel-flow">
                    {["Новый лид", "В работе", "Оплата"].map((item) => (
                      <span key={item}>{item}<i>›</i></span>
                    ))}
                  </div>
                </div>
                <div className="crm-activity">
                  <h3>Последние активности</h3>
                  {["Лид назначен Анне", "Сделка перешла в оплату", "Задача просрочена"].map((item, index) => (
                    <div key={item}>
                      <i>{["◎", "₸", ""][index]}</i>
                      <span>
                        <b>{item}</b>
                        <small>{[2, 5, 11][index]} мин назад</small>
                      </span>
                    </div>
                  ))}
                  <button type="button" tabIndex={-1}>Смотреть все</button>
                </div>
              </div>
              <div className="crm-roles-panel">
                <div className="crm-roles-head">
                  <h3>Роли и доступы</h3>
                  <span>4 профиля</span>
                </div>
                <div className="crm-role-grid">
                  {crmSuiteRoles.map(([role, text, access, metric, tags, accent], index) => (
                    <article className={`crm-role-card crm-role-${accent}`} key={role}>
                      <div className="crm-role-top">
                        <span>{["Д", "М", "А", "С"][index]}</span>
                        <div>
                          <b>{role}</b>
                          <small>{access}</small>
                        </div>
                      </div>
                      <strong>{metric}</strong>
                      <p>{text}</p>
                      <div className="crm-role-tags">
                        {tags.map((tag) => (
                          <i key={tag}>{tag}</i>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="crm-suite-benefits">
        {crmSuiteBenefits.map(([title, text, icon]) => (
          <article key={title}>
            <span>{icon}</span>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AiAssistantSection() {
  return (
    <section className="ai-assistant-section" id="ai-assistant">
      <div className="ai-assistant-top">
        <motion.div
          className="ai-copy"
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.38 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2>
            Помощник находит <span>следующий шаг</span>
          </h2>
          <p>
            Он не пересказывает отчёты. Он показывает конкретную просадку, причину и действие, которое стоит сделать сегодня.
          </p>
          <div className="ai-actions">
            <a className="crm-bots-primary" href={AUTH_ROUTES.signup} data-auth-action="signup" data-auth-intent="Включить AI-помощника">
              Включить AI-помощника <span>→</span>
            </a>
            <a className="crm-bots-demo" href="#launch">
              <span>▷</span>
              <b>
                Как это работает
                <small>2-минутное видео</small>
              </b>
            </a>
          </div>
          <ProofStrip items={sectionProofs.ai} />
        </motion.div>

        <div className="ai-system-map">
          <div className="ai-channel-list">
            {aiChannels.map(([title, icons], index) => (
              <motion.article
                key={title}
                initial={{ opacity: 0, x: -18 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.42 }}
                transition={{ duration: 0.45, delay: index * 0.05 }}
              >
                <b>{title}</b>
                <span>
                  {icons.map((icon) => (
                    <i key={icon}>{icon}</i>
                  ))}
                </span>
              </motion.article>
            ))}
          </div>
          <svg className="ai-lines" viewBox="0 0 760 500" preserveAspectRatio="none" aria-hidden="true">
            <path className="route-bus" d="M390 125 L390 340" />
            {aiConnections.map((line, index) => (
              <g className="data-route ai-route" key={line.path} style={{ animationDelay: `${index * 0.1}s` }}>
                <path className="data-line-base" d={line.path} />
                <path className="data-line-pulse" d={line.path} />
                <circle className="line-dot line-dot-start" cx={line.start[0]} cy={line.start[1]} r="3" />
                <circle className="line-dot line-dot-end" cx={line.end[0]} cy={line.end[1]} r="3" />
              </g>
            ))}
            <g className="route-junction">
              <circle cx="390" cy="125" r="3.2" />
              <circle cx="390" cy="180" r="3.2" />
              <circle cx="390" cy="220" r="3.2" />
              <circle cx="390" cy="285" r="3.2" />
              <circle cx="390" cy="340" r="3.2" />
            </g>
          </svg>
          <div className="ai-signal-list">
            {aiSignals.map(([title, text, icon, accent], index) => (
              <motion.article
                className={`ai-signal ai-signal-${accent}`}
                key={title}
                initial={{ opacity: 0, x: 18 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.45, delay: index * 0.06 }}
              >
                <span className="ai-signal-charge" aria-hidden="true" />
                <span>{icon}</span>
                <div>
                  <b>{title}</b>
                  <p>{text}</p>
                </div>
                <i>›</i>
              </motion.article>
            ))}
          </div>
        </div>
      </div>

      <div className="ai-roles-panel">
        <div className="ai-panel-heading">
          <h3>Подсказки по ролям</h3>
          <span>Что сделать сегодня</span>
        </div>
        <div className="ai-role-grid">
          {aiRoleCards.map(([role, subtitle, metric, change, tip, checks, insight, action], index) => (
            <article className={`ai-role-card ai-role-${index + 1}`} key={role}>
              <div className="ai-role-head">
                <span>{["◎", "◌", "▵", "▱"][index]}</span>
                <div>
                  <b>{role}</b>
                  <small>{subtitle}</small>
                </div>
              </div>
              <div className="ai-role-body">
                <div>
                  <small>{index === 0 ? "Прибыль сегодня" : index === 1 ? "Записи на сегодня" : index === 2 ? "Новые лиды" : "Мои лиды"}</small>
                  <strong>{metric}</strong>
                  <em>{change}</em>
                </div>
                <ul>
                  {checks.map((check) => (
                    <li key={check}>✓ {check}</li>
                  ))}
                </ul>
              </div>
              <p><b>AI-подсказка</b>{tip}</p>
              <div className="ai-role-detail">
                <span>
                  <b>Увидел</b>
                  {insight}
                </span>
                <span>
                  <b>Действие</b>
                  {action}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function LaunchSection() {
  return (
    <section className="launch-section" id="launch">
      <div className="launch-layout">
        <motion.div
          className="launch-copy"
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.38 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2>
            Запуск без <span>внедрения</span>
          </h2>
          <p>
            Вы выбираете канал, авторизуетесь и добавляете сотрудников. Первые заявки начинают попадать в CRM в тот же день.
          </p>
          <div className="launch-actions">
            <a className="crm-bots-primary" href={AUTH_ROUTES.signup} data-auth-action="signup" data-auth-intent="Запустить без специалиста">
              Запустить без специалиста <span>→</span>
            </a>
            <a className="crm-bots-demo" href="#trust">
              <span>↗</span>
              <b>
                Смотреть каналы
                <small>без интегратора</small>
              </b>
            </a>
          </div>
          <ProofStrip items={sectionProofs.launch} />
        </motion.div>

        <motion.div
          className="launch-board"
          initial={{ opacity: 0, y: 28, scale: 0.985 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.28 }}
          transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="launch-before-after">
            <motion.article
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.42 }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4 }}
            >
              <span>До ZANI</span>
              <p>Долгие внедрения, отдельные специалисты, ручной перенос данных и ожидание настройки.</p>
            </motion.article>
            <motion.article
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.42 }}
              transition={{ duration: 0.5, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4 }}
            >
              <span>После ZANI</span>
              <p>Канал подключается через авторизацию, сотрудники получают роли, данные появляются в CRM.</p>
            </motion.article>
          </div>
          <div className="launch-steps">
            {launchSteps.map(([day, title, text, number], index) => (
              <motion.article
                key={day}
                data-step={number}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.5, delay: 0.34 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -5, scale: 1.015 }}
              >
                <strong>{number}</strong>
                <small>{day}</small>
                <h3>{title}</h3>
                <p>{text}</p>
              </motion.article>
            ))}
          </div>
          <div className="launch-proof">
            {proofSignals.map(([title, text], index) => (
              <motion.span
                key={title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.42 }}
                transition={{ duration: 0.45, delay: 0.62 + index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -3 }}
              >
                <b>{title}</b>
                {text}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function TrustSection() {
  return (
    <section className="trust-section" id="trust">
      <div className="trust-layout">
        <motion.div
          className="trust-heading"
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.34 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2>
            Каналы подключаются. <span>CRM сразу принимает данные</span>
          </h2>
          <p>WhatsApp, Telegram, Instagram, Kaspi, Wildberries, Ozon, 1C и МойСклад подключаются через авторизацию. Сотрудники получают роли, данные появляются в CRM.</p>
          <motion.div
            className="trust-crm-card"
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.42 }}
            transition={{ duration: 0.52, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -4 }}
          >
            <div className="trust-crm-logo">CRM</div>
            <div>
              <b>CRM готова сразу</b>
              <span>Добавьте сотрудников, роли и каналы. Клиенты, сделки и история начнут собираться автоматически.</span>
            </div>
            <a href={AUTH_ROUTES.signup} data-auth-action="signup" data-auth-intent="Подключить CRM и сотрудников">Подключить</a>
          </motion.div>
        </motion.div>
        <div className="trust-integrations" aria-label="Интеграции ZANI">
          {trustIntegrations.map((item, index) => (
            <motion.article
              className={`trust-channel trust-channel-${item.className}`}
              key={item.name}
              initial={{ opacity: 0, y: 24, scale: 0.985 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.26 }}
              transition={{ duration: 0.5, delay: 0.08 + index * 0.045, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -5, scale: 1.015 }}
            >
              <div className="trust-channel-top">
                <span className="trust-channel-logo">{item.logo}</span>
                <small>{item.status}</small>
              </div>
              <h3>{item.name}</h3>
              <p>{item.label}</p>
              <a href={AUTH_ROUTES.signup} data-auth-action="signup" data-auth-intent={`Подключить ${item.name}`}>Подключить</a>
            </motion.article>
          ))}
        </div>
        <div className="trust-card-grid">
          {trustCards.map(([title, text, number], index) => (
            <motion.article
              key={title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.36 }}
              transition={{ duration: 0.5, delay: 0.42 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4 }}
            >
              <small>{number}</small>
              <h3>{title}</h3>
              <p>{text}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section className="pricing-section" id="pricing">
      <div className="pricing-layout">
        <motion.div
          className="pricing-copy"
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.38 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2>
            Платите за рост, а не за <span>пустые места</span>
          </h2>
          <p>CRM остаётся бесплатной. Платные тарифы подключают каналы продаж, расширенную аналитику, роли и персональную поддержку.</p>
          <div className="pricing-notes">
            <motion.article
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.42 }}
              transition={{ duration: 0.48, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4 }}
            >
              <span>▣</span>
              <div>
                <b>7 дней бесплатно</b>
                <p>Полный доступ ко всем функциям</p>
              </div>
            </motion.article>
            <motion.article
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.42 }}
              transition={{ duration: 0.48, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4 }}
            >
              <span>▱</span>
              <div>
                <b>Без скрытых платежей</b>
                <p>Отменить можно в любой момент</p>
              </div>
            </motion.article>
          </div>
        </motion.div>

        <div className="pricing-cards">
          {pricingPlans.map((plan, index) => (
            <motion.article
              className={`pricing-card pricing-card-${plan.accent} ${plan.popular ? "is-popular" : ""}`}
              key={plan.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.55, delay: 0.1 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6, scale: plan.popular ? 1.012 : 1.01 }}
            >
              {plan.popular ? <div className="popular-ribbon">Популярный выбор</div> : null}
              <div className="plan-icon">{plan.icon}</div>
              <h3>{plan.title}</h3>
              <p>{plan.subtitle}</p>
              <div className="plan-price">
                <strong>{plan.price}</strong>
                <span>{plan.period}</span>
              </div>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>✓ {feature}</li>
                ))}
              </ul>
              <a href={AUTH_ROUTES.signup} data-auth-action="signup" data-auth-intent={`${plan.title}: ${plan.cta}`}>{plan.cta}</a>
            </motion.article>
          ))}
        </div>
      </div>

      <motion.div
        className="pricing-trust"
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.58, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        {pricingTrust.map(([title, text, icon], index) => (
          <motion.article
            key={title}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.44, delay: 0.38 + index * 0.055, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -3 }}
          >
            <span>{icon}</span>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}

export default function ZaniExperience() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<LandingSectionId>("top");
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 110, damping: 30, mass: 0.22 });
  const width = useTransform(progress, [0, 1], ["0%", "100%"]);

  useEffect(() => {
    const sections = landingSections
      .map((item) => document.querySelector<HTMLElement>(item.selector))
      .filter((section): section is HTMLElement => Boolean(section));
    if (!sections.length) return;
    let frame = 0;

    function setActive(section: HTMLElement) {
      sections.forEach((item) => item.classList.toggle("is-active", item === section));
      const config = landingSections.find((item) => item.selector === `.${section.classList[0]}` || section.matches(item.selector));
      if (!config) return;
      setActiveSection(config.id);
    }

    function setNearestActive() {
      const center = window.scrollY + window.innerHeight / 2;
      const nearest = sections.reduce((current, section) => {
        const currentDistance = Math.abs(current.offsetTop + current.offsetHeight / 2 - center);
        const sectionDistance = Math.abs(section.offsetTop + section.offsetHeight / 2 - center);
        return sectionDistance < currentDistance ? section : current;
      }, sections[0]);
      setActive(nearest);
    }

    function handleScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(setNearestActive);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target instanceof HTMLElement) {
          setActive(visible.target);
        }
      },
      { threshold: [0.42, 0.58, 0.72] }
    );

    sections.forEach((section) => observer.observe(section));
    setActive(sections[0]);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    function handleAuthClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const trigger = target.closest<HTMLElement>("[data-auth-action]");
      if (!trigger) return;

      event.preventDefault();
      const action = trigger.dataset.authAction;
      if (!action || !AUTH_ACTIONS.has(action)) return;

      const intent = trigger.dataset.authIntent ? normalizeLandingAiInput(trigger.dataset.authIntent).slice(0, 120) : "";
      if (action === "login") {
        try {
          window.sessionStorage.removeItem("zani_signup_intent");
        } catch {
          // Storage can be disabled in private or hardened browsers.
        }
      } else if (intent) {
        try {
          window.sessionStorage.setItem("zani_signup_intent", intent);
        } catch {
          // Navigation must keep working even if storage is unavailable.
        }
      }
      navigate(action === "login" ? AUTH_ROUTES.login : AUTH_ROUTES.signup);
    }

    document.addEventListener("click", handleAuthClick);
    return () => document.removeEventListener("click", handleAuthClick);
  }, [navigate]);

  return (
    <main className="zani-experience">
      <motion.div className="progress-line" style={{ width }} />
      <div className="ambient-bg" aria-hidden="true" />
      <LandingLanguageRuntime />
      <Header activeSection={activeSection} />
      <LandingAiAssistant activeSection={activeSection} />
      <Hero />
      <CrmBotsSection />
      <MarketplaceSection />
      <CrmSuiteSection />
      <AiAssistantSection />
      <LaunchSection />
      <TrustSection />
      <PricingSection />
    </main>
  );
}
