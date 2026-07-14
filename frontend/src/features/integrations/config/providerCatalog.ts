import type { BusinessConnector } from "../../../types";

export type ProviderKey = BusinessConnector["provider"] | "kaspi_pricing";
export type ProviderGroup = "messages" | "data" | "marketplace" | "system";

export const providerCatalog: Array<{
  provider: ProviderKey;
  fallbackLabelKey: string;
  group: ProviderGroup;
  logo?: string;
  primaryUseKey: string;
  requestName: string;
}> = [
  {
    provider: "website",
    fallbackLabelKey: "integrations.provider.website",
    group: "messages",
    primaryUseKey: "integrations.provider.websiteUse",
    requestName: "Website",
  },
  {
    provider: "telegram",
    fallbackLabelKey: "integrations.provider.telegram",
    group: "messages",
    logo: "/integrations_logos/telegram.png",
    primaryUseKey: "integrations.provider.telegramUse",
    requestName: "Telegram",
  },
  {
    provider: "whatsapp",
    fallbackLabelKey: "integrations.provider.whatsapp",
    group: "messages",
    logo: "/integrations_logos/whatsapp.png",
    primaryUseKey: "integrations.provider.whatsappUse",
    requestName: "WhatsApp",
  },
  {
    provider: "instagram",
    fallbackLabelKey: "integrations.provider.instagram",
    group: "messages",
    logo: "/integrations_logos/instagram.png",
    primaryUseKey: "integrations.provider.instagramUse",
    requestName: "Instagram",
  },
  {
    provider: "excel_csv",
    fallbackLabelKey: "integrations.provider.excelCsv",
    group: "data",
    primaryUseKey: "integrations.provider.excelCsvUse",
    requestName: "Excel / CSV",
  },
  {
    provider: "1c",
    fallbackLabelKey: "integrations.provider.oneC",
    group: "data",
    logo: "/integrations_logos/1c.png",
    primaryUseKey: "integrations.provider.oneCUse",
    requestName: "1C export/import",
  },
  {
    provider: "moysklad",
    fallbackLabelKey: "integrations.provider.moysklad",
    group: "data",
    primaryUseKey: "integrations.provider.moyskladUse",
    requestName: "MoySklad",
  },
  {
    provider: "kaspi",
    fallbackLabelKey: "integrations.provider.kaspi",
    group: "marketplace",
    logo: "/integrations_logos/kaspi.png",
    primaryUseKey: "integrations.provider.kaspiUse",
    requestName: "Kaspi",
  },
  {
    provider: "kaspi_pricing",
    fallbackLabelKey: "integrations.provider.kaspiPricing",
    group: "marketplace",
    logo: "/integrations_logos/kaspi.png",
    primaryUseKey: "integrations.provider.kaspiPricingUse",
    requestName: "Kaspi Pricing",
  },
  {
    provider: "wildberries",
    fallbackLabelKey: "integrations.provider.wildberries",
    group: "marketplace",
    logo: "/integrations_logos/wildberries.png",
    primaryUseKey: "integrations.provider.wildberriesUse",
    requestName: "Wildberries",
  },
  {
    provider: "ozon",
    fallbackLabelKey: "integrations.provider.ozon",
    group: "marketplace",
    primaryUseKey: "integrations.provider.ozonUse",
    requestName: "Ozon",
  },
  {
    provider: "google_sheets",
    fallbackLabelKey: "integrations.provider.googleSheets",
    group: "system",
    primaryUseKey: "integrations.provider.googleSheetsUse",
    requestName: "Google Sheets",
  },
  {
    provider: "email",
    fallbackLabelKey: "integrations.provider.email",
    group: "system",
    primaryUseKey: "integrations.provider.emailUse",
    requestName: "Email",
  },
];

export const groupLabels: Record<ProviderGroup, { titleKey: string; textKey: string }> = {
  messages: {
    titleKey: "integrations.group.messages",
    textKey: "integrations.group.messagesText",
  },
  data: {
    titleKey: "integrations.group.data",
    textKey: "integrations.group.dataText",
  },
  marketplace: {
    titleKey: "integrations.group.marketplace",
    textKey: "integrations.group.marketplaceText",
  },
  system: {
    titleKey: "integrations.group.system",
    textKey: "integrations.group.systemText",
  },
};
