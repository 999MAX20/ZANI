import type { BusinessConnector } from "../../../types";

export type ProviderKey = BusinessConnector["provider"] | "kaspi_pricing";
export type ProviderGroup = "messages" | "data" | "marketplace" | "system";

export const providerCatalog: Array<{
  provider: ProviderKey;
  fallbackLabel: string;
  group: ProviderGroup;
  logo?: string;
  primaryUse: string;
  requestName: string;
}> = [
  {
    provider: "excel_csv",
    fallbackLabel: "Excel / CSV",
    group: "data",
    primaryUse: "Быстрая загрузка клиентов, продаж и каталога",
    requestName: "Excel / CSV",
  },
  {
    provider: "1c",
    fallbackLabel: "1C",
    group: "data",
    logo: "/integrations_logos/1c.png",
    primaryUse: "Продажи, счета, остатки и справочники",
    requestName: "1C export/import",
  },
  {
    provider: "moysklad",
    fallbackLabel: "МойСклад",
    group: "data",
    primaryUse: "Склад, остатки и каталог товаров",
    requestName: "МойСклад",
  },
  {
    provider: "kaspi",
    fallbackLabel: "Kaspi",
    group: "marketplace",
    logo: "/integrations_logos/kaspi.png",
    primaryUse: "Заказы, оплаты и бизнес-данные",
    requestName: "Kaspi",
  },
  {
    provider: "kaspi_pricing",
    fallbackLabel: "Kaspi Pricing",
    group: "marketplace",
    logo: "/integrations_logos/kaspi.png",
    primaryUse: "Ценовой агент: мониторинг конкурентов, пороги и автопилот",
    requestName: "Kaspi Pricing",
  },
  {
    provider: "wildberries",
    fallbackLabel: "Wildberries",
    group: "marketplace",
    logo: "/integrations_logos/wildberries.png",
    primaryUse: "Заказы, SKU, остатки и возвраты",
    requestName: "Wildberries",
  },
  {
    provider: "ozon",
    fallbackLabel: "Ozon",
    group: "marketplace",
    primaryUse: "FBS/FBO отправления, остатки и отмены",
    requestName: "Ozon",
  },
  {
    provider: "google_sheets",
    fallbackLabel: "Google Sheets",
    group: "system",
    primaryUse: "Регулярный импорт таблиц без разработки",
    requestName: "Google Sheets",
  },
  {
    provider: "email",
    fallbackLabel: "Email",
    group: "system",
    primaryUse: "Уведомления, входящие письма и fallback",
    requestName: "Email",
  },
];

export const groupLabels: Record<ProviderGroup, { title: string; text: string }> = {
  messages: {
    title: "Каналы",
    text: "Подключите ИИ-агента к каналам, где клиенты пишут вашей компании.",
  },
  data: {
    title: "Учет и склад",
    text: "Источники фактов для AI-аналитика: продажи, остатки, каталог и документы.",
  },
  marketplace: {
    title: "Маркетплейсы",
    text: "Заказы, оплаты, остатки и ценовые риски по внешним площадкам.",
  },
  system: {
    title: "Системные источники",
    text: "Дополнительные способы загрузки данных и служебные каналы.",
  },
};
