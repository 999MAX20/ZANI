import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseZap,
  ExternalLink,
  FileSpreadsheet,
  Link2,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  TrendingDown,
  Upload,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  businessConnectorsApi,
  businessEventsApi,
  connectorSyncRunsApi,
  type BusinessConnectorPayload,
} from "../../api/connectors";
import { botChannelsApi, botsApi, integrationEventLogsApi, instagramChannelApi, telegramChannelApi, whatsappChannelApi } from "../../api/bots";
import { importExportApi, type ImportEntity } from "../../api/importExport";
import { kaspiPricingApi, type KaspiPriceChangeLog, type KaspiPricingRule } from "../../api/pricing";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../auth/AuthProvider";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { cn } from "../../lib/cn";
import { hasPermission } from "../../lib/permissions";
import type {
  BotChannel,
  Bot,
  BusinessConnector,
  BusinessEvent,
  ConnectorCapability,
  ConnectorSyncRun,
  Id,
  ImportJob,
  IntegrationEventLog,
} from "../../types";

type ProviderKey = BusinessConnector["provider"] | "kaspi_pricing";
type ProviderGroup = "messages" | "data" | "marketplace" | "system";
type WhatsAppEmbeddedSignupCallback = {
  type: "zani.whatsapp.embedded_signup_callback";
  code?: string;
  state?: string;
  phone_number_id?: string;
  waba_id?: string;
  display_phone_number?: string;
};
type InstagramOAuthCallback = {
  type: "zani.instagram.oauth_callback";
  code?: string;
  state?: string;
};

const whatsappEmbeddedSignupCallbackType = "zani.whatsapp.embedded_signup_callback";
const instagramOAuthCallbackType = "zani.instagram.oauth_callback";
const facebookSdkUrl = "https://connect.facebook.net/en_US/sdk.js";

declare global {
  interface Window {
    FB?: {
      init: (options: { appId: string; autoLogAppEvents?: boolean; xfbml?: boolean; version: string }) => void;
      login: (
        callback: (response: { authResponse?: { code?: string }; status?: string }) => void,
        options: {
          config_id: string;
          response_type: "code";
          override_default_response_type: true;
          extras: { setup: Record<string, never>; featureType: string; sessionInfoVersion: string };
        },
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

function parseWhatsAppEmbeddedSignupMessage(event: MessageEvent): WhatsAppEmbeddedSignupCallback | null {
  if (event.origin === window.location.origin && event.data?.type === whatsappEmbeddedSignupCallbackType) {
    return event.data as WhatsAppEmbeddedSignupCallback;
  }

  if (!["https://www.facebook.com", "https://web.facebook.com"].includes(event.origin)) {
    return null;
  }

  const payload = typeof event.data === "string" ? safeParseJson(event.data) : event.data;
  if (payload?.type !== "WA_EMBEDDED_SIGNUP" || !["FINISH", "FINISH_ONLY_WABA"].includes(payload?.event)) {
    return null;
  }
  return {
    type: whatsappEmbeddedSignupCallbackType,
    phone_number_id: payload.data?.phone_number_id,
    waba_id: payload.data?.waba_id,
    display_phone_number: payload.data?.display_phone_number,
  };
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function loadFacebookSdk({ appId, version }: { appId: string; version: string }) {
  return new Promise<typeof window.FB>((resolve, reject) => {
    if (window.FB) {
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      resolve(window.FB);
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${facebookSdkUrl}"]`);
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      resolve(window.FB);
    };
    if (existingScript) return;

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.src = facebookSdkUrl;
    script.onerror = () => reject(new Error("Facebook SDK не загрузился."));
    document.body.appendChild(script);
  });
}

const providerCatalog: Array<{
  provider: ProviderKey;
  fallbackLabel: string;
  group: ProviderGroup;
  logo?: string;
  primaryUse: string;
  requestName: string;
}> = [
  {
    provider: "website",
    fallbackLabel: "Website chat",
    group: "messages",
    primaryUse: "Заявки и сообщения с сайта",
    requestName: "Website chat",
  },
  {
    provider: "telegram",
    fallbackLabel: "Telegram",
    group: "messages",
    logo: "/integrations_logos/telegram.png",
    primaryUse: "Бот, входящие сообщения и handoff",
    requestName: "Telegram",
  },
  {
    provider: "whatsapp",
    fallbackLabel: "WhatsApp",
    group: "messages",
    logo: "/integrations_logos/whatsapp.png",
    primaryUse: "Основной канал общения с клиентами",
    requestName: "WhatsApp connection request",
  },
  {
    provider: "instagram",
    fallbackLabel: "Instagram",
    group: "messages",
    logo: "/integrations_logos/instagram.png",
    primaryUse: "Direct, заявки и handoff оператору",
    requestName: "Instagram connection request",
  },
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

const groupLabels: Record<ProviderGroup, { title: string; text: string }> = {
  messages: {
    title: "Каналы и боты",
    text: "Все входящие каналы, которые должны создавать лиды, диалоги и задачи менеджеру.",
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

const statusTone: Record<string, string> = {
  connected: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  received: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  processed: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  succeeded: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  pending_request: "bg-violet-50 text-violet-700 ring-violet-100",
  provider_configuring: "bg-violet-50 text-violet-700 ring-violet-100",
  setup_required: "bg-amber-50 text-amber-700 ring-amber-100",
  needs_attention: "bg-amber-50 text-amber-700 ring-amber-100",
  syncing: "bg-blue-50 text-blue-700 ring-blue-100",
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  disabled: "bg-slate-100 text-slate-700 ring-slate-200",
  disconnected: "bg-slate-100 text-slate-700 ring-slate-200",
  roadmap: "bg-slate-100 text-slate-700 ring-slate-200",
  soon: "bg-slate-100 text-slate-700 ring-slate-200",
  request: "bg-violet-50 text-violet-700 ring-violet-100",
  failed: "bg-red-50 text-red-700 ring-red-100",
  error: "bg-red-50 text-red-700 ring-red-100",
  expired_credentials: "bg-red-50 text-red-700 ring-red-100",
};

const providerLogos = new Set(
  providerCatalog
    .map((item) => item.logo)
    .filter(Boolean),
);

function formatDate(value?: string | null) {
  if (!value) return "Нет данных";
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readableStatus(status?: string, fallback = "Не подключено") {
  if (!status) return fallback;
  const labels: Record<string, string> = {
    active: "Активно",
    connected: "Подключено",
    draft: "Черновик",
    pending_request: "Запрошено",
    provider_configuring: "Настраивается",
    setup_required: "Нужна настройка",
    needs_attention: "Требует внимания",
    syncing: "Синхронизация",
    disabled: "Отключено",
    disconnected: "Отключено",
    error: "Ошибка",
    failed: "Ошибка",
    expired_credentials: "Доступ истек",
    roadmap: "Roadmap",
    soon: "Скоро",
    request: "По заявке",
    received: "Получено",
    processed: "Обработано",
    simulated: "Симуляция",
    applied: "Применено",
    blocked: "Заблокировано",
    ignored: "Пропущено",
    succeeded: "Успешно",
    running: "В процессе",
    queued: "В очереди",
  };
  return labels[status] || status;
}

function statusClass(status?: string) {
  return statusTone[status || ""] || "bg-slate-100 text-slate-700 ring-slate-200";
}

function providerTitle(provider: ProviderKey, capability?: ConnectorCapability) {
  return capability?.label || providerCatalog.find((item) => item.provider === provider)?.fallbackLabel || provider;
}

function providerLogo(provider: ProviderKey) {
  return providerCatalog.find((item) => item.provider === provider)?.logo;
}

function providerCapability(provider: ProviderKey, capabilities: ConnectorCapability[]) {
  return capabilities.find((item) => item.provider === provider);
}

function providerConnector(provider: ProviderKey, connectors: BusinessConnector[]) {
  return connectors.find((item) => item.provider === provider);
}

function providerChannel(provider: ProviderKey, channels: BotChannel[]) {
  if (!["website", "telegram", "whatsapp", "instagram"].includes(String(provider))) return undefined;
  return channels.find((item) => item.channel === provider);
}

function deriveProviderStatus({
  capability,
  channel,
  connector,
}: {
  capability?: ConnectorCapability;
  channel?: BotChannel;
  connector?: BusinessConnector;
}) {
  if (connector?.status) return connector.status;
  if (channel?.status === "active") return "active";
  if (channel?.status) return channel.status;
  if (capability?.availability === "roadmap" || capability?.launch_status === "roadmap") return "roadmap";
  if (capability?.availability === "request" || capability?.launch_status === "request") return "request";
  if (capability?.launch_status === "soon") return "soon";
  if (capability?.setup_state === "active" || capability?.availability === "included") return "setup_required";
  return "draft";
}

function compactPayload(payload: Record<string, unknown>) {
  const entries = Object.entries(payload || {}).slice(0, 4);
  if (!entries.length) return "Без payload";
  return entries
    .map(([key, value]) => {
      if (value === null || value === undefined || value === "") return `${key}: -`;
      if (typeof value === "object") return `${key}: object`;
      return `${key}: ${String(value).slice(0, 48)}`;
    })
    .join(" · ");
}

function LogoMark({ logo, label }: { logo?: string; label: string }) {
  if (logo && providerLogos.has(logo)) {
    return (
      <img
        src={logo}
        alt=""
        className="h-11 w-11 rounded-2xl bg-white object-contain p-2 shadow-sm ring-1 ring-slate-100"
      />
    );
  }
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-sm font-black text-white shadow-sm">
      {label.slice(0, 2).toUpperCase()}
    </span>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className="rounded-3xl border border-white/80 bg-white/92 p-4 shadow-soft">
      <div className={`grid h-10 w-10 place-items-center rounded-2xl ${tone}`}>{icon}</div>
      <p className="mt-3 text-2xl font-black text-midnight">{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
    </div>
  );
}

function ProviderCard({
  businessId,
  bots,
  canManage,
  capability,
  channel,
  connector,
  provider,
  onImport,
}: {
  businessId: Id;
  bots: Bot[];
  canManage: boolean;
  capability?: ConnectorCapability;
  channel?: BotChannel;
  connector?: BusinessConnector;
  provider: (typeof providerCatalog)[number];
  onImport: () => void;
}) {
  const queryClient = useQueryClient();
  const [connectOpen, setConnectOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [accountId, setAccountId] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const isPricingProvider = provider.provider === "kaspi_pricing";
  const status = isPricingProvider ? "setup_required" : deriveProviderStatus({ capability, channel, connector });
  const title = providerTitle(provider.provider, capability);
  const isDataProvider = ["kaspi", "1c", "moysklad", "wildberries"].includes(String(provider.provider));
  const isRequestProvider = ["whatsapp", "1c", "google_sheets", "email"].includes(String(provider.provider));

  const requestConnector = useMutation({
    mutationFn: () => {
      if (provider.provider === "whatsapp") {
        return businessConnectorsApi.requestWhatsApp({
          business: businessId,
          company_name: "ZANI merchant",
          phone_number: "+77000000000",
          contact_person: "",
          preferred_method: "not_sure",
          monthly_messages: 0,
          has_meta_assets: false,
          comment: "Запрос создан из status center.",
        });
      }
      if (isPricingProvider) {
        throw new Error("Kaspi Pricing открывается отдельным окном настройки.");
      }
      const payload: BusinessConnectorPayload = {
        business: businessId,
        provider: provider.provider as BusinessConnector["provider"],
        name: provider.requestName,
        capability: capability?.capability,
        auth_type: capability?.auth_type,
        scopes_json: [],
        config_json: {
          requested_from_ui: true,
          request_status: "pending_request",
          source: "integrations_status_center",
        },
      };
      if (connector) {
        return businessConnectorsApi.update({ id: connector.id, payload });
      }
      return businessConnectorsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const healthCheck = useMutation({
    mutationFn: () => businessConnectorsApi.healthCheck(connector!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["connector-sync-runs"] });
    },
  });

  const mockSync = useMutation({
    mutationFn: () => businessConnectorsApi.mockSync(connector!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-events"] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const saveGenericConfig = useMutation({
    mutationFn: () => {
      if (isPricingProvider) {
        throw new Error("Kaspi Pricing не использует generic connector config.");
      }
      const payload: BusinessConnectorPayload = {
        business: businessId,
        provider: provider.provider as BusinessConnector["provider"],
        name: provider.requestName,
        capability: capability?.capability,
        auth_type: capability?.auth_type || "token",
        scopes_json: [],
        config_json: {
          account_id: accountId,
          api_key: apiKey,
          webhook_secret: webhookSecret,
          configured_from_ui: true,
        },
      };
      if (connector) return businessConnectorsApi.update({ id: connector.id, payload });
      return businessConnectorsApi.create(payload);
    },
    onSuccess: () => {
      setNotice("Данные подключения сохранены.");
      setApiKey("");
      setWebhookSecret("");
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const error = requestConnector.error || healthCheck.error || mockSync.error || saveGenericConfig.error;
  const isConnected = ["connected", "active"].includes(status);
  const isUnavailable = ["roadmap", "soon"].includes(status);
  const isWebsiteProvider = provider.provider === "website";

  const handlePrimaryAction = () => {
    if (provider.provider === "excel_csv") {
      onImport();
      return;
    }
    setConnectOpen(true);
  };

  const renderPrimaryButton = () => (
    <Button
      type="button"
      className="h-10 min-w-[148px] rounded-xl px-5 text-sm"
      disabled={!canManage || isUnavailable}
      onClick={handlePrimaryAction}
    >
      {isConnected ? "Настроить" : "Подключить"}
    </Button>
  );

  const frontContent = (
    <>
      <div className="flex items-start justify-between gap-4">
        <LogoMark logo={provider.logo} label={title} />
        {renderPrimaryButton()}
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-black text-midnight">{title}</h3>
          <span className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${statusClass(status)}`}>{readableStatus(status, "Не подключен")}</span>
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{provider.primaryUse}</p>
      </div>

      {connector?.last_error ? (
        <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {connector.last_error}
        </div>
      ) : null}

      {error ? <div className="mt-3"><ErrorState message={getApiErrorMessage(error)} /></div> : null}
    </>
  );

  return (
    <article
      className={cn(
        isWebsiteProvider
          ? "group min-h-[172px] rounded-2xl [perspective:1200px]"
          : "min-h-[172px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft",
        isUnavailable && "opacity-60",
      )}
    >
      {isWebsiteProvider ? (
        <div className="relative min-h-[172px] rounded-2xl transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
          <div className="absolute inset-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm [backface-visibility:hidden]">
            {frontContent}
          </div>
          <div className="absolute inset-0 flex rounded-2xl border border-brand-100 bg-white p-5 shadow-soft [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="flex min-h-full w-full flex-col justify-between gap-4">
              <div>
                <p className="text-sm font-black leading-6 text-midnight">
                  Не теряйте заявки с сайта после первого клика.
                </p>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                  Посетитель пишет в виджет или форму, ZANI сразу создаёт диалог, клиента и заявку в CRM. Менеджер видит источник, историю обращения и следующий шаг без ручного переноса контактов.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">Сайт → Inbox → CRM</span>
                {renderPrimaryButton()}
              </div>
            </div>
          </div>
        </div>
      ) : (
        frontContent
      )}

      <Modal title={`Подключение: ${title}`} open={connectOpen} onClose={() => setConnectOpen(false)}>
        <div className="space-y-4">
          {notice ? <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{notice}</div> : null}
          {provider.provider === "telegram" ? (
            <TelegramInlineSetup businessId={businessId} bots={bots} canManage={canManage} channel={channel} />
          ) : provider.provider === "instagram" ? (
            <InstagramInlineSetup businessId={businessId} bots={bots} canManage={canManage} channel={channel} />
          ) : provider.provider === "kaspi" ? (
            <KaspiInlineSetup businessId={businessId} canManage={canManage} connector={connector} />
          ) : provider.provider === "kaspi_pricing" ? (
            <KaspiPricingInlineSetup businessId={businessId} canManage={canManage} />
          ) : provider.provider === "moysklad" ? (
            <MoySkladInlineSetup businessId={businessId} canManage={canManage} connector={connector} />
          ) : provider.provider === "wildberries" ? (
            <WildberriesInlineSetup businessId={businessId} canManage={canManage} connector={connector} />
          ) : provider.provider === "ozon" ? (
            <OzonInlineSetup businessId={businessId} canManage={canManage} connector={connector} />
          ) : (
            <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-4">
              <div>
                <p className="text-sm font-black text-midnight">{title}</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{provider.primaryUse}</p>
              </div>
              {provider.provider === "website" ? (
                <div className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">
                  Website chat работает через публичный widget token канала. Дополнительные keys не требуются.
                </div>
              ) : (
                <>
                  <Input label="Account / Business ID" value={accountId} onChange={(event) => setAccountId(event.target.value)} placeholder="ID аккаунта, магазина или кабинета" />
                  <Input label="API key / Access token" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Вставьте token" type="password" autoComplete="off" />
                  <Input label="Webhook secret / Verify token" value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} placeholder="Опционально" type="password" autoComplete="off" />
                </>
              )}
              <div className="flex flex-wrap gap-2">
                {provider.provider !== "website" ? (
                  <Button type="button" disabled={!canManage || (!apiKey.trim() && !accountId.trim())} isLoading={saveGenericConfig.isPending} onClick={() => saveGenericConfig.mutate()}>
                    <ShieldCheck size={16} /> Сохранить
                  </Button>
                ) : null}
                {connector ? (
                  <Button type="button" variant="secondary" disabled={!canManage} isLoading={healthCheck.isPending} onClick={() => healthCheck.mutate()}>
                    <RefreshCw size={16} /> Проверить
                  </Button>
                ) : null}
                {connector && isDataProvider ? (
                  <Button type="button" variant="secondary" disabled={!canManage} isLoading={mockSync.isPending} onClick={() => mockSync.mutate()}>
                    <DatabaseZap size={16} /> Demo sync
                  </Button>
                ) : null}
                {isRequestProvider && !connector ? (
                  <Button type="button" variant="secondary" disabled={!canManage} isLoading={requestConnector.isPending} onClick={() => requestConnector.mutate()}>
                    <Send size={16} /> Запросить подключение
                  </Button>
                ) : null}
                {["telegram", "whatsapp", "instagram", "website"].includes(String(provider.provider)) ? (
                  <Link to={`/dashboard/conversations?channel=${provider.provider}`}>
                    <Button type="button" variant="ghost">
                      <Link2 size={16} /> Inbox
                    </Button>
                  </Link>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </article>
  );
}

function TelegramInlineSetup({
  businessId,
  bots,
  canManage,
  channel,
}: {
  businessId: Id;
  bots: Bot[];
  canManage: boolean;
  channel?: BotChannel;
}) {
  const queryClient = useQueryClient();
  const [botToken, setBotToken] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ["telegram-status", channel?.id],
    queryFn: () => telegramChannelApi.status(Number(channel?.id)),
    enabled: Boolean(channel?.id),
  });

  const ensureChannel = useMutation({
    mutationFn: async () => {
      const bot = bots[0] || await botsApi.create({
        business: businessId,
        name: "Telegram bot",
        status: "active",
        default_language: "ru",
        settings_json: {},
      });
      return botChannelsApi.create({
        bot: bot.id,
        channel: "telegram",
        status: "draft",
        external_id: "",
        config_json: {},
      });
    },
    onSuccess: () => {
      setNotice("Telegram channel создан. Теперь вставьте BotFather token.");
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
    },
  });

  const saveToken = useMutation({
    mutationFn: () => telegramChannelApi.configure({ channelId: Number(channel?.id), botToken }),
    onSuccess: () => {
      setBotToken("");
      setNotice("Token сохранен. Проверьте token и подключите webhook.");
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["telegram-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => telegramChannelApi.testConnection(Number(channel?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? "Token проверен." : data.reason || "Token не прошел проверку.");
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["telegram-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const setWebhook = useMutation({
    mutationFn: async () => {
      const current = status.data || await telegramChannelApi.status(Number(channel?.id));
      return telegramChannelApi.setWebhook({ channelId: Number(channel?.id), webhookUrl: current.webhook_url });
    },
    onSuccess: (data) => {
      setNotice(
        data.ok && data.mock
          ? "Локальный режим: webhook не установлен в Telegram. Используйте «Загрузить сообщения» или публичный HTTPS URL."
          : data.ok
            ? "Webhook подключен. Напишите сообщение боту и проверьте Inbox."
            : data.reason || "Webhook не подключен.",
      );
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["telegram-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["integration-event-logs"] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const syncUpdates = useMutation({
    mutationFn: () => telegramChannelApi.syncUpdates(Number(channel?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? `Загружено обновлений: ${data.processed}. Проверьте Conversations.` : data.reason || "Не удалось загрузить сообщения Telegram.");
      queryClient.invalidateQueries({ queryKey: ["inbox-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-summary"] });
      queryClient.invalidateQueries({ queryKey: ["telegram-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["integration-event-logs"] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const error = ensureChannel.error || saveToken.error || testConnection.error || setWebhook.error || syncUpdates.error || status.error;
  const tokenConfigured = Boolean(status.data?.token_configured);
  const webhookConfigured = Boolean(status.data?.webhook_configured);
  const webhookPublicReady = Boolean(status.data?.webhook_public_ready);
  const inboundBackendReady = Boolean(status.data?.inbound_backend_ready);
  const inboundReady = Boolean(status.data?.inbound_ready);

  if (!channel) {
    return (
      <div className="w-full space-y-3">
        {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
        {notice ? <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{notice}</div> : null}
        <Button type="button" disabled={!canManage} isLoading={ensureChannel.isPending} onClick={() => ensureChannel.mutate()}>
          <Send size={16} /> Создать Telegram channel
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
      {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
      {notice ? <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{notice}</div> : null}

      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Token</p>
          <p className="mt-1 text-sm font-black text-midnight">{tokenConfigured ? "Сохранен" : "Нужен"}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Secret</p>
          <p className="mt-1 text-sm font-black text-midnight">{status.data?.webhook_secret_configured ? "Готов" : "Авто"}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Webhook</p>
          <p className="mt-1 text-sm font-black text-midnight">
            {status.data?.last_outbound_status === "mocked" ? "Локально" : webhookConfigured ? "Подключен" : "Нужен"}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Backend</p>
          <p className="mt-1 text-sm font-black text-midnight">{inboundBackendReady ? "Принимает" : "Нет входящих"}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Public HTTPS</p>
          <p className="mt-1 text-sm font-black text-midnight">{webhookPublicReady ? "Готов" : "Нужен tunnel"}</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <Input
          label={tokenConfigured ? "BotFather token сохранен приватно" : "BotFather token"}
          value={botToken}
          onChange={(event) => setBotToken(event.target.value)}
          placeholder={tokenConfigured ? "Token уже сохранен. Вставьте новый только для замены." : "123456789:AA..."}
          type="password"
          autoComplete="off"
        />
        <Button
          type="button"
          variant={botToken.trim().length >= 9 ? "primary" : "secondary"}
          disabled={!canManage || botToken.trim().length < 9}
          isLoading={saveToken.isPending}
          onClick={() => saveToken.mutate()}
          className="min-w-[172px]"
        >
          <ShieldCheck size={16} /> {tokenConfigured ? "Заменить token" : "Сохранить token"}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <button
          type="button"
          disabled={!canManage || !tokenConfigured || testConnection.isPending}
          onClick={() => testConnection.mutate()}
          className="flex min-h-[78px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
            <RefreshCw size={18} />
          </span>
          <span>
            <span className="block text-sm font-black text-midnight">Проверить token</span>
            <span className="mt-1 block text-xs font-semibold text-slate-500">Telegram getMe</span>
          </span>
        </button>
        <button
          type="button"
          disabled={!canManage || !tokenConfigured || setWebhook.isPending || status.isFetching}
          onClick={() => setWebhook.mutate()}
          className="flex min-h-[78px] items-center gap-3 rounded-2xl bg-midnight px-4 text-left text-white shadow-premium transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/12 text-white">
            <CheckCircle2 size={18} />
          </span>
          <span>
            <span className="block text-sm font-black">Подключить webhook</span>
            <span className="mt-1 block text-xs font-semibold text-white/70">Входящие сообщения</span>
          </span>
        </button>
        <button
          type="button"
          disabled={!canManage || !tokenConfigured || syncUpdates.isPending}
          onClick={() => syncUpdates.mutate()}
          className="flex min-h-[78px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700">
            <RefreshCw size={18} />
          </span>
          <span>
            <span className="block text-sm font-black text-midnight">Загрузить сообщения</span>
            <span className="mt-1 block text-xs font-semibold text-slate-500">Для локального режима</span>
          </span>
        </button>
      </div>
      <div className={cn(
        "rounded-2xl px-4 py-3 text-xs font-semibold leading-5",
        inboundReady ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800",
      )}>
        {inboundReady
          ? "Telegram готов принимать реальные входящие сообщения: token, webhook, backend и public HTTPS в порядке."
          : webhookPublicReady
            ? "Public HTTPS доступен, но нужно дождаться первого входящего сообщения или проверить webhook после подключения."
            : "Backend webhook работает локально, но Telegram не достучится до локального адреса без public HTTPS tunnel/domain. Для временной проверки можно использовать «Загрузить сообщения»."}
      </div>
    </div>
  );
}

function WhatsAppInlineSetup({
  businessId,
  bots,
  canManage,
  channel,
}: {
  businessId: Id;
  bots: Bot[];
  canManage: boolean;
  channel?: BotChannel;
}) {
  const queryClient = useQueryClient();
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState("");
  const [showManualSetup, setShowManualSetup] = useState(false);
  const [signupCode, setSignupCode] = useState("");
  const [signupState, setSignupState] = useState("");
  const [signupRedirectUri, setSignupRedirectUri] = useState("");
  const [signupPhoneNumberId, setSignupPhoneNumberId] = useState("");
  const [signupWabaId, setSignupWabaId] = useState("");
  const [signupDisplayPhone, setSignupDisplayPhone] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const applyCallback = (payload: WhatsAppEmbeddedSignupCallback) => {
      if (payload.code) setSignupCode(payload.code);
      if (payload.state) setSignupState(payload.state);
      if (payload.phone_number_id) setSignupPhoneNumberId(payload.phone_number_id);
      if (payload.waba_id) setSignupWabaId(payload.waba_id);
      if (payload.display_phone_number) setSignupDisplayPhone(payload.display_phone_number);
      setNotice("Meta вернула данные подключения. Проверьте поля и завершите подключение.");
    };

    const handleMessage = (event: MessageEvent) => {
      const payload = parseWhatsAppEmbeddedSignupMessage(event);
      if (payload) applyCallback(payload);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const status = useQuery({
    queryKey: ["whatsapp-status", channel?.id],
    queryFn: () => whatsappChannelApi.status(Number(channel?.id)),
    enabled: Boolean(channel?.id),
  });

  const ensureChannel = useMutation({
    mutationFn: async () => {
      const bot = bots[0] || await botsApi.create({
        business: businessId,
        name: "WhatsApp bot",
        status: "active",
        default_language: "ru",
        settings_json: {},
      });
      return botChannelsApi.create({
        bot: bot.id,
        channel: "whatsapp",
        status: "draft",
        external_id: "",
        config_json: { provider_mode: "meta_cloud" },
      });
    },
    onSuccess: () => {
      setNotice("WhatsApp channel создан. Теперь нажмите «Подключить через Meta».");
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
    },
  });

  const saveCredentials = useMutation({
    mutationFn: () => whatsappChannelApi.configure({
      channelId: Number(channel?.id),
      providerMode: "meta_cloud",
      phoneNumberId,
      accessToken,
      businessAccountId,
      displayPhoneNumber,
    }),
    onSuccess: () => {
      setPhoneNumberId("");
      setAccessToken("");
      setBusinessAccountId("");
      setDisplayPhoneNumber("");
      setNotice("Доступ WhatsApp сохранен приватно. Теперь проверьте подключение.");
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => whatsappChannelApi.testConnection(Number(channel?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? "WhatsApp подключение проверено." : data.reason || "WhatsApp доступ не прошел проверку.");
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const startEmbeddedSignup = useMutation({
    mutationFn: () => businessConnectorsApi.startWhatsAppEmbeddedSignup({
      business: businessId,
      redirectUri: window.location.origin + "/dashboard/integrations?zani_provider=whatsapp",
    }),
    onSuccess: async (data) => {
      setSignupState(data.state);
      setSignupRedirectUri(data.redirect_uri);
      if (!data.app_configured || !data.config_id_configured) {
        setNotice("Meta app env не настроен. Проверьте META_APP_ID/META_APP_SECRET/WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID.");
        return;
      }

      try {
        const sdk = await loadFacebookSdk({ appId: data.app_id, version: data.graph_api_version || "v25.0" });
        sdk?.login(
          (response) => {
            const code = response.authResponse?.code;
            if (!code) {
              setNotice("Meta Embedded Signup не вернул code. Проверьте popup и разрешения Meta app.");
              return;
            }
            setSignupCode(code);
            setNotice("Meta вернула code. Дождитесь Phone number ID/WABA ID или заполните их вручную из WhatsApp Manager.");
          },
          {
            config_id: data.config_id,
            response_type: "code",
            override_default_response_type: true,
            extras: {
              setup: {},
              featureType: "whatsapp_business_app_onboarding",
              sessionInfoVersion: "3",
            },
          },
        );
      } catch {
        setNotice("Facebook SDK недоступен, открыт OAuth fallback. После завершения popup вернёт code/state.");
        window.open(data.authorization_url, "zani_whatsapp_meta_signup", "width=720,height=820");
      }
    },
  });

  const completeEmbeddedSignup = useMutation({
    mutationFn: () => businessConnectorsApi.completeWhatsAppEmbeddedSignup({
      business: businessId,
      code: signupCode,
      state: signupState,
      redirect_uri: signupRedirectUri || window.location.origin + "/dashboard/integrations?zani_provider=whatsapp",
      phone_number_id: signupPhoneNumberId,
      waba_id: signupWabaId,
      display_phone_number: signupDisplayPhone,
    }),
    onSuccess: () => {
      setSignupCode("");
      setSignupPhoneNumberId("");
      setSignupWabaId("");
      setSignupDisplayPhone("");
      setNotice("WhatsApp подключен через Meta Embedded Signup.");
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const error = ensureChannel.error || saveCredentials.error || testConnection.error || startEmbeddedSignup.error || completeEmbeddedSignup.error || status.error;
  const credentialsConfigured = Boolean(status.data?.phone_number_id_configured && status.data?.access_token_configured);

  if (!channel) {
    return (
      <div className="w-full space-y-3">
        {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
        {notice ? <div className="rounded-2xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{notice}</div> : null}
        <Button type="button" disabled={!canManage} isLoading={ensureChannel.isPending} onClick={() => ensureChannel.mutate()}>
          <Send size={16} /> Создать WhatsApp channel
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
      {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
      {notice ? <div className="rounded-2xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{notice}</div> : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Номер</p>
          <p className="mt-1 text-sm font-black text-midnight">{status.data?.phone_number_id_configured ? "Сохранен" : "Нужен"}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Доступ</p>
          <p className="mt-1 text-sm font-black text-midnight">{status.data?.access_token_configured ? "Сохранен" : "Нужен"}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Сообщения</p>
          <p className="mt-1 text-sm font-black text-midnight">{status.data?.verify_token_configured ? "Готов" : "Env"}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-green-100 bg-green-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-green-950">Подключение через Meta</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-green-800">
              Мерчант входит в Meta, выбирает бизнес-аккаунт WhatsApp и номер. ZANI сам сохранит доступ и проверит подключение.
            </p>
          </div>
          <Button type="button" disabled={!canManage} isLoading={startEmbeddedSignup.isPending} onClick={() => startEmbeddedSignup.mutate()}>
            <ExternalLink size={16} /> Подключить через Meta
          </Button>
        </div>
        {signupCode || signupPhoneNumberId ? (
          <div className="mt-4 rounded-2xl bg-white/70 p-3">
            <p className="text-sm font-black text-green-950">Meta вернула данные. Завершите подключение.</p>
          </div>
        ) : null}
        <div className="mt-3">
          <Button
            type="button"
            variant="secondary"
            disabled={!canManage || !signupCode.trim() || !signupState.trim() || !signupPhoneNumberId.trim()}
            isLoading={completeEmbeddedSignup.isPending}
            onClick={() => completeEmbeddedSignup.mutate()}
          >
            <ShieldCheck size={16} /> Завершить подключение
          </Button>
        </div>
      </div>

      <button type="button" className="text-sm font-black text-brand-700" onClick={() => setShowManualSetup((value) => !value)}>
        {showManualSetup ? "Скрыть ручное подключение" : "Ручное подключение для поддержки"}
      </button>
      {showManualSetup ? (
        <div className="space-y-3 rounded-3xl border border-slate-100 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Phone number ID" value={phoneNumberId} onChange={(event) => setPhoneNumberId(event.target.value)} placeholder={status.data?.phone_number_id_configured ? "Phone number ID уже сохранен" : "1234567890"} />
            <Input label="Access token хранится приватно" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder={status.data?.access_token_configured ? "Token уже сохранен. Вставьте новый только для замены." : "EAAG..."} type="password" autoComplete="off" />
            <Input label="WABA ID" value={businessAccountId} onChange={(event) => setBusinessAccountId(event.target.value)} placeholder="Опционально" />
            <Input label="Display phone" value={displayPhoneNumber} onChange={(event) => setDisplayPhoneNumber(event.target.value)} placeholder="+770..." />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Button type="button" disabled={!canManage || (!phoneNumberId.trim() && !accessToken.trim())} isLoading={saveCredentials.isPending} onClick={() => saveCredentials.mutate()}>
              <ShieldCheck size={16} /> {credentialsConfigured ? "Обновить доступ" : "Сохранить доступ"}
            </Button>
            <Button type="button" variant="secondary" disabled={!canManage || !credentialsConfigured} isLoading={testConnection.isPending} onClick={() => testConnection.mutate()}>
              <RefreshCw size={16} /> Проверить
            </Button>
          </div>
        </div>
      ) : null}

      <p className="text-xs font-semibold leading-5 text-slate-500">
        Webhook URL: {status.data?.webhook_url || "/api/integrations/whatsapp/webhook/"}. Verify token и App Secret задаются в production .env.
      </p>
    </div>
  );
}

function InstagramInlineSetup({
  businessId,
  bots,
  canManage,
  channel,
}: {
  businessId: Id;
  bots: Bot[];
  canManage: boolean;
  channel?: BotChannel;
}) {
  const queryClient = useQueryClient();
  const [instagramUserId, setInstagramUserId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [pageId, setPageId] = useState("");
  const [username, setUsername] = useState("");
  const [oauthCode, setOauthCode] = useState("");
  const [oauthState, setOauthState] = useState("");
  const [oauthRedirectUri, setOauthRedirectUri] = useState("");
  const [showManualSetup, setShowManualSetup] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== instagramOAuthCallbackType) return;
      const payload = event.data as InstagramOAuthCallback;
      if (payload.code) setOauthCode(payload.code);
      if (payload.state) setOauthState(payload.state);
      setNotice("Meta вернула доступ Instagram. Завершите подключение.");
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const status = useQuery({
    queryKey: ["instagram-status", channel?.id],
    queryFn: () => instagramChannelApi.status(Number(channel?.id)),
    enabled: Boolean(channel?.id),
  });

  const ensureChannel = useMutation({
    mutationFn: async () => {
      const bot = bots[0] || await botsApi.create({
        business: businessId,
        name: "Instagram bot",
        status: "active",
        default_language: "ru",
        settings_json: {},
      });
      return botChannelsApi.create({
        bot: bot.id,
        channel: "instagram",
        status: "draft",
        external_id: "",
        config_json: { provider_mode: "meta_graph" },
      });
    },
    onSuccess: () => {
      setNotice("Instagram channel создан. Теперь нажмите «Подключить через Meta».");
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
    },
  });

  const saveCredentials = useMutation({
    mutationFn: () => instagramChannelApi.configure({
      channelId: Number(channel?.id),
      providerMode: "meta_graph",
      instagramUserId,
      accessToken,
      pageId,
      username,
    }),
    onSuccess: () => {
      setInstagramUserId("");
      setAccessToken("");
      setPageId("");
      setUsername("");
      setNotice("Доступ Instagram сохранен приватно. Теперь проверьте подключение.");
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const startOAuth = useMutation({
    mutationFn: () => businessConnectorsApi.startInstagramOAuth({
      business: businessId,
      redirectUri: window.location.origin + "/dashboard/integrations?zani_provider=instagram",
    }),
    onSuccess: (data) => {
      setOauthState(data.state);
      setOauthRedirectUri(data.redirect_uri);
      if (!data.app_configured) {
        setNotice("Meta app env не настроен. Проверьте META_APP_ID/META_APP_SECRET.");
        return;
      }
      window.open(data.authorization_url, "zani_instagram_meta_oauth", "width=720,height=820");
    },
  });

  const completeOAuth = useMutation({
    mutationFn: () => businessConnectorsApi.completeInstagramOAuth({
      business: businessId,
      code: oauthCode,
      state: oauthState,
      redirect_uri: oauthRedirectUri || window.location.origin + "/dashboard/integrations?zani_provider=instagram",
      page_id: pageId,
    }),
    onSuccess: () => {
      setOauthCode("");
      setPageId("");
      setNotice("Instagram подключен через Meta.");
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => instagramChannelApi.testConnection(Number(channel?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? "Instagram подключение проверено." : data.reason || "Instagram доступ не прошел проверку.");
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const error = ensureChannel.error || saveCredentials.error || testConnection.error || startOAuth.error || completeOAuth.error || status.error;
  const credentialsConfigured = Boolean(status.data?.instagram_user_id_configured && status.data?.access_token_configured);

  if (!channel) {
    return (
      <div className="w-full space-y-3">
        {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
        {notice ? <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{notice}</div> : null}
        <Button type="button" disabled={!canManage} isLoading={ensureChannel.isPending} onClick={() => ensureChannel.mutate()}>
          <Send size={16} /> Создать Instagram channel
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
      {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
      {notice ? <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{notice}</div> : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Аккаунт</p>
          <p className="mt-1 text-sm font-black text-midnight">{status.data?.instagram_user_id_configured ? "Сохранен" : "Нужен"}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Доступ</p>
          <p className="mt-1 text-sm font-black text-midnight">{status.data?.access_token_configured ? "Сохранен" : "Нужен"}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Сообщения</p>
          <p className="mt-1 text-sm font-black text-midnight">{status.data?.verify_token_configured ? "Готов" : "Env"}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-blue-950">Подключение через Meta</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-blue-800">
              Мерчант входит в Meta, выбирает страницу с Instagram Business account, ZANI сам сохранит доступ.
            </p>
          </div>
          <Button type="button" disabled={!canManage} isLoading={startOAuth.isPending} onClick={() => startOAuth.mutate()}>
            <ExternalLink size={16} /> Подключить через Meta
          </Button>
        </div>
        {oauthCode ? <div className="mt-3 rounded-2xl bg-white/70 p-3 text-sm font-black text-blue-950">Meta вернула данные. Завершите подключение.</div> : null}
        <div className="mt-3">
          <Button type="button" variant="secondary" disabled={!canManage || !oauthCode.trim() || !oauthState.trim()} isLoading={completeOAuth.isPending} onClick={() => completeOAuth.mutate()}>
            <ShieldCheck size={16} /> Завершить подключение
          </Button>
        </div>
      </div>

      <button type="button" className="text-sm font-black text-brand-700" onClick={() => setShowManualSetup((value) => !value)}>
        {showManualSetup ? "Скрыть ручное подключение" : "Ручное подключение для поддержки"}
      </button>
      {showManualSetup ? (
        <div className="space-y-3 rounded-3xl border border-slate-100 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Instagram Business Account ID" value={instagramUserId} onChange={(event) => setInstagramUserId(event.target.value)} placeholder={status.data?.instagram_user_id_configured ? "ID уже сохранен" : "1784..."} />
            <Input label="Access token хранится приватно" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder={status.data?.access_token_configured ? "Token уже сохранен. Вставьте новый только для замены." : "EAAG..."} type="password" autoComplete="off" />
            <Input label="Facebook Page ID" value={pageId} onChange={(event) => setPageId(event.target.value)} placeholder="Опционально" />
            <Input label="Instagram username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="@account" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Button type="button" disabled={!canManage || (!instagramUserId.trim() && !accessToken.trim())} isLoading={saveCredentials.isPending} onClick={() => saveCredentials.mutate()}>
              <ShieldCheck size={16} /> {credentialsConfigured ? "Обновить доступ" : "Сохранить доступ"}
            </Button>
            <Button type="button" variant="secondary" disabled={!canManage || !credentialsConfigured} isLoading={testConnection.isPending} onClick={() => testConnection.mutate()}>
              <RefreshCw size={16} /> Проверить
            </Button>
          </div>
        </div>
      ) : null}

      <p className="text-xs font-semibold leading-5 text-slate-500">
        Webhook URL: {status.data?.webhook_url || "/api/integrations/instagram/webhook/"}. Verify token и App Secret задаются в local/production .env.
      </p>
    </div>
  );
}

function KaspiInlineSetup({
  businessId,
  canManage,
  connector,
}: {
  businessId: Id;
  canManage: boolean;
  connector?: BusinessConnector;
}) {
  const queryClient = useQueryClient();
  const [apiToken, setApiToken] = useState("");
  const [merchantId, setMerchantId] = useState(String(connector?.config_json?.merchant_id || ""));
  const [orderState, setOrderState] = useState(String(connector?.config_json?.order_state || "ARCHIVE"));
  const [syncDays, setSyncDays] = useState(String(connector?.config_json?.sync_days || "14"));
  const [pageSize, setPageSize] = useState(String(connector?.config_json?.page_size || "20"));
  const [showAccessSetup, setShowAccessSetup] = useState(Boolean(connector?.config_json?.api_token_configured));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ["kaspi-status", connector?.id],
    queryFn: () => businessConnectorsApi.kaspiStatus(Number(connector?.id)),
    enabled: Boolean(connector?.id),
  });

  const saveConfig = useMutation({
    mutationFn: () => businessConnectorsApi.configureKaspi({
      business: businessId,
      apiToken,
      merchantId,
      orderState,
      syncDays: Number(syncDays || 14),
      pageSize: Number(pageSize || 20),
    }),
    onSuccess: () => {
      setApiToken("");
      setNotice("Kaspi подключен. Доступ сохранен приватно, можно загрузить заказы.");
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["kaspi-status"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => businessConnectorsApi.kaspiTestConnection(Number(connector?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? "Подключение к Kaspi проверено." : data.reason || "Не удалось проверить доступ Kaspi.");
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["kaspi-status", connector?.id] });
    },
  });

  const syncOrders = useMutation({
    mutationFn: () => businessConnectorsApi.kaspiSyncOrders(Number(connector?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? `Заказы загружены: ${data.events.length} событий.` : data.reason || "Не удалось загрузить заказы.");
      queryClient.invalidateQueries({ queryKey: ["business-events"] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["connector-sync-runs"] });
      queryClient.invalidateQueries({ queryKey: ["kaspi-status", connector?.id] });
    },
  });

  const error = saveConfig.error || testConnection.error || syncOrders.error || status.error;
  const tokenConfigured = Boolean(status.data?.api_token_configured || connector?.config_json?.api_token_configured);

  return (
    <div className="w-full space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
      {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
      {notice ? <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{notice}</div> : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Доступ</p>
          <p className="mt-1 text-sm font-black text-midnight">{tokenConfigured ? "Сохранен" : "Нужен"}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Режим</p>
          <p className="mt-1 text-sm font-black text-midnight">Только чтение</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Заказы</p>
          <p className="mt-1 text-sm font-black text-midnight">{status.data?.last_sync_at ? "Загружались" : "Еще нет"}</p>
        </div>
      </div>

      {!showAccessSetup ? (
        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-black text-blue-950">Подключение Kaspi</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-blue-800">
            Сейчас Kaspi подключается через ключ доступа продавца. Это временный self-service путь до появления официального partner authorization.
          </p>
          <Button type="button" className="mt-3" disabled={!canManage} onClick={() => setShowAccessSetup(true)}>
            <ShieldCheck size={16} /> Ввести ключ доступа
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Input
            label="Ключ доступа Kaspi"
            value={apiToken}
            onChange={(event) => setApiToken(event.target.value)}
            placeholder={tokenConfigured ? "Доступ уже сохранен. Вставьте новый ключ только для замены." : "Вставьте ключ из кабинета продавца Kaspi"}
            type="password"
            autoComplete="off"
          />
        </div>
      )}
      <div className="space-y-3">
        <button type="button" className="text-sm font-black text-brand-700" onClick={() => setShowAdvanced((value) => !value)}>
          {showAdvanced ? "Скрыть дополнительные настройки" : "Дополнительные настройки"}
        </button>
        {showAdvanced ? (
          <div className="grid gap-3 rounded-2xl bg-white p-3 md:grid-cols-2">
            <Input label="ID магазина" value={merchantId} onChange={(event) => setMerchantId(event.target.value)} placeholder="Опционально" />
            <Select
              value={orderState}
              onChange={(event) => setOrderState(event.target.value)}
              options={[
                { value: "ARCHIVE", label: "Архив / завершенные" },
                { value: "NEW", label: "Новые" },
                { value: "KASPI_DELIVERY", label: "Kaspi Delivery" },
                { value: "PICKUP", label: "Самовывоз" },
                { value: "SIGN_REQUIRED", label: "Нужно подписать" },
              ]}
            />
            <Input label="Период загрузки, дней" value={syncDays} onChange={(event) => setSyncDays(event.target.value)} placeholder="14" type="number" />
            <Input label="Лимит заказов за раз" value={pageSize} onChange={(event) => setPageSize(event.target.value)} placeholder="20" type="number" />
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Button type="button" disabled={!canManage || (!apiToken.trim() && !merchantId.trim() && !connector)} isLoading={saveConfig.isPending} onClick={() => saveConfig.mutate()}>
          <ShieldCheck size={16} /> {connector ? "Сохранить доступ" : "Подключить Kaspi"}
        </Button>
        <Button type="button" variant="secondary" disabled={!canManage || !connector || !tokenConfigured} isLoading={testConnection.isPending} onClick={() => testConnection.mutate()}>
          <RefreshCw size={16} /> Проверить
        </Button>
        <Button type="button" variant="secondary" disabled={!canManage || !connector || !tokenConfigured} isLoading={syncOrders.isPending} onClick={() => syncOrders.mutate()}>
          <DatabaseZap size={16} /> Загрузить заказы
        </Button>
      </div>

      <p className="text-xs font-semibold leading-5 text-slate-500">
        ZANI только читает заказы для аналитики. Изменение цен, принятие и отмена заказов в Kaspi здесь отключены.
      </p>
    </div>
  );
}

function KaspiPricingInlineSetup({ businessId, canManage }: { businessId: Id; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  const control = useQuery({
    queryKey: ["kaspi-pricing-control", businessId],
    queryFn: () => kaspiPricingApi.control.current(businessId),
  });
  const rules = useQuery({
    queryKey: ["kaspi-pricing-rules", businessId],
    queryFn: () => kaspiPricingApi.rules.list({ business: businessId }),
  });
  const alerts = useQuery({
    queryKey: ["kaspi-pricing-alerts", businessId],
    queryFn: () => kaspiPricingApi.alerts.list({ business: businessId, status: "open" }),
  });
  const changeLogs = useQuery({
    queryKey: ["kaspi-price-change-logs", businessId],
    queryFn: () => kaspiPricingApi.changeLogs.list({ business: businessId }),
  });

  const emergencyStop = useMutation({
    mutationFn: () => kaspiPricingApi.control.emergencyStop({ business: businessId, reason: "Остановлено из окна интеграции Kaspi Pricing." }),
    onSuccess: () => {
      setNotice("Ценовой агент остановлен. Применение цен заблокировано.");
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-control"] });
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-alerts"] });
    },
  });
  const resumePricing = useMutation({
    mutationFn: () => kaspiPricingApi.control.resume(businessId),
    onSuccess: () => {
      setNotice("Ценовой агент снова активен.");
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-control"] });
      queryClient.invalidateQueries({ queryKey: ["kaspi-pricing-alerts"] });
    },
  });

  const error = control.error || rules.error || alerts.error || changeLogs.error || emergencyStop.error || resumePricing.error;
  const ruleList = rules.data || [];
  const alertList = alerts.data || [];
  const logList = changeLogs.data || [];
  const latestLog = logList[0] as KaspiPriceChangeLog | undefined;
  const autopilotCount = ruleList.filter((rule: KaspiPricingRule) => rule.mode === "autopilot").length;
  const activeCount = ruleList.filter((rule: KaspiPricingRule) => rule.status === "active").length;
  const stopped = Boolean(control.data?.emergency_stop_enabled);

  return (
    <div className="w-full space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
      {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
      {notice ? <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{notice}</div> : null}

      <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-amber-950">Отдельный продукт ZANI для цен</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-amber-800">
              Обычный Kaspi-коннектор только читает заказы и бизнес-данные. Kaspi Pricing управляет правилами цены, порогами, мониторингом конкурентов и автопилотом.
            </p>
          </div>
          <Link to="/dashboard/pricing">
            <Button type="button">
              <TrendingDown size={16} /> Открыть агент
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Правила</p>
          <p className="mt-1 text-sm font-black text-midnight">{ruleList.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Активные</p>
          <p className="mt-1 text-sm font-black text-midnight">{activeCount}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Автопилот</p>
          <p className="mt-1 text-sm font-black text-midnight">{autopilotCount}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Сигналы</p>
          <p className="mt-1 text-sm font-black text-midnight">{alertList.length}</p>
        </div>
      </div>

      <div className={cn("rounded-3xl border p-4", stopped ? "border-red-100 bg-red-50" : "border-emerald-100 bg-emerald-50")}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className={cn("text-sm font-black", stopped ? "text-red-950" : "text-emerald-950")}>{stopped ? "Агент остановлен" : "Агент готов к работе"}</p>
            <p className={cn("mt-1 text-sm font-semibold leading-6", stopped ? "text-red-800" : "text-emerald-800")}>
              {stopped ? control.data?.emergency_stop_reason || "Применение цен заблокировано." : "Emergency stop доступен отдельно от обычной Kaspi-интеграции."}
            </p>
          </div>
          {stopped ? (
            <Button type="button" disabled={!canManage} isLoading={resumePricing.isPending} onClick={() => resumePricing.mutate()}>
              Возобновить
            </Button>
          ) : (
            <Button type="button" variant="danger" disabled={!canManage} isLoading={emergencyStop.isPending} onClick={() => emergencyStop.mutate()}>
              Остановить агент
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black text-midnight">Последнее изменение</p>
          <Link to="/dashboard/pricing">
            <Button type="button" variant="ghost" size="sm">
              История
            </Button>
          </Link>
        </div>
        {latestLog ? (
          <div className="mt-3 rounded-2xl bg-slate-50 p-3">
            <p className="text-sm font-black text-midnight">{latestLog.product_name || latestLog.product_sku}</p>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              {Number(latestLog.old_price).toLocaleString("ru-KZ")} ₸ → {Number(latestLog.new_price).toLocaleString("ru-KZ")} ₸ · {readableStatus(latestLog.status)}
            </p>
            {latestLog.error ? <p className="mt-1 text-xs font-semibold text-red-600">{latestLog.error}</p> : null}
          </div>
        ) : (
          <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-500">Изменений пока нет. Создайте правило и рассчитайте рекомендацию.</p>
        )}
      </div>
    </div>
  );
}

function MoySkladInlineSetup({
  businessId,
  canManage,
  connector,
}: {
  businessId: Id;
  canManage: boolean;
  connector?: BusinessConnector;
}) {
  const queryClient = useQueryClient();
  const [accessToken, setAccessToken] = useState("");
  const [entities, setEntities] = useState<string[]>(Array.isArray(connector?.config_json?.entities) ? connector?.config_json?.entities as string[] : ["products", "stock", "sales", "clients"]);
  const [pageSize, setPageSize] = useState(String(connector?.config_json?.page_size || "50"));
  const [showAccessSetup, setShowAccessSetup] = useState(Boolean(connector?.config_json?.access_token_configured));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ["moysklad-status", connector?.id],
    queryFn: () => businessConnectorsApi.moyskladStatus(Number(connector?.id)),
    enabled: Boolean(connector?.id),
  });

  const saveConfig = useMutation({
    mutationFn: () => businessConnectorsApi.configureMoySklad({
      business: businessId,
      accessToken,
      entities,
      pageSize: Number(pageSize || 50),
    }),
    onSuccess: () => {
      setAccessToken("");
      setNotice("МойСклад подключен. Доступ сохранен приватно, можно проверить подключение.");
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["moysklad-status"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => businessConnectorsApi.moyskladTestConnection(Number(connector?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? "Подключение к МойСклад проверено." : data.reason || "Не удалось проверить доступ МойСклад.");
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["moysklad-status", connector?.id] });
    },
  });

  const syncData = useMutation({
    mutationFn: () => businessConnectorsApi.moyskladSync(Number(connector?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? `Данные загружены: ${data.events.length} событий.` : data.reason || "Не удалось загрузить данные МойСклад.");
      queryClient.invalidateQueries({ queryKey: ["business-events"] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["connector-sync-runs"] });
      queryClient.invalidateQueries({ queryKey: ["moysklad-status", connector?.id] });
    },
  });

  const toggleEntity = (entity: string) => {
    setEntities((current) => current.includes(entity) ? current.filter((item) => item !== entity) : [...current, entity]);
  };

  const error = saveConfig.error || testConnection.error || syncData.error || status.error;
  const tokenConfigured = Boolean(status.data?.access_token_configured || connector?.config_json?.access_token_configured);

  return (
    <div className="w-full space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
      {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
      {notice ? <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{notice}</div> : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Доступ</p>
          <p className="mt-1 text-sm font-black text-midnight">{tokenConfigured ? "Сохранен" : "Нужен"}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Режим</p>
          <p className="mt-1 text-sm font-black text-midnight">Только чтение</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Склад</p>
          <p className="mt-1 text-sm font-black text-midnight">{status.data?.last_sync_at ? "Загружался" : "Еще нет"}</p>
        </div>
      </div>

      {!showAccessSetup ? (
        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-black text-blue-950">Подключение МойСклад</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-blue-800">
            Сейчас МойСклад подключается через ключ доступа. Следующий production-шаг — авторизация через приложение МойСклад без копирования ключа.
          </p>
          <Button type="button" className="mt-3" disabled={!canManage} onClick={() => setShowAccessSetup(true)}>
            <ShieldCheck size={16} /> Ввести ключ доступа
          </Button>
        </div>
      ) : (
        <Input
          label="Ключ доступа МойСклад"
          value={accessToken}
          onChange={(event) => setAccessToken(event.target.value)}
          placeholder={tokenConfigured ? "Доступ уже сохранен. Вставьте новый ключ только для замены." : "Вставьте ключ доступа из МойСклад"}
          type="password"
          autoComplete="off"
        />
      )}

      <button type="button" className="text-sm font-black text-brand-700" onClick={() => setShowAdvanced((value) => !value)}>
        {showAdvanced ? "Скрыть дополнительные настройки" : "Дополнительные настройки"}
      </button>
      {showAdvanced ? (
        <div className="space-y-3 rounded-2xl bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["products", "Товары"],
              ["stock", "Остатки"],
              ["sales", "Продажи"],
              ["clients", "Контрагенты"],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={entities.includes(value)} onChange={() => toggleEntity(value)} />
                {label}
              </label>
            ))}
          </div>
          <Input label="Лимит строк за раз" value={pageSize} onChange={(event) => setPageSize(event.target.value)} placeholder="50" type="number" />
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <Button type="button" disabled={!canManage || (!accessToken.trim() && !connector)} isLoading={saveConfig.isPending} onClick={() => saveConfig.mutate()}>
          <ShieldCheck size={16} /> {connector ? "Сохранить доступ" : "Подключить МойСклад"}
        </Button>
        <Button type="button" variant="secondary" disabled={!canManage || !connector || !tokenConfigured} isLoading={testConnection.isPending} onClick={() => testConnection.mutate()}>
          <RefreshCw size={16} /> Проверить
        </Button>
        <Button type="button" variant="secondary" disabled={!canManage || !connector || !tokenConfigured || !entities.length} isLoading={syncData.isPending} onClick={() => syncData.mutate()}>
          <DatabaseZap size={16} /> Загрузить данные
        </Button>
      </div>

      <p className="text-xs font-semibold leading-5 text-slate-500">
        ZANI только читает товары, остатки, продажи и контрагентов. Изменение документов, цен и остатков в МойСклад здесь отключено.
      </p>
    </div>
  );
}

function WildberriesInlineSetup({
  businessId,
  canManage,
  connector,
}: {
  businessId: Id;
  canManage: boolean;
  connector?: BusinessConnector;
}) {
  const queryClient = useQueryClient();
  const [apiToken, setApiToken] = useState("");
  const [entities, setEntities] = useState<string[]>(Array.isArray(connector?.config_json?.entities) ? connector?.config_json?.entities as string[] : ["orders", "sales"]);
  const [syncDays, setSyncDays] = useState(String(connector?.config_json?.sync_days || "7"));
  const [showAccessSetup, setShowAccessSetup] = useState(Boolean(connector?.config_json?.api_token_configured));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ["wildberries-status", connector?.id],
    queryFn: () => businessConnectorsApi.wildberriesStatus(Number(connector?.id)),
    enabled: Boolean(connector?.id),
  });

  const saveConfig = useMutation({
    mutationFn: () => businessConnectorsApi.configureWildberries({
      business: businessId,
      apiToken,
      entities,
      syncDays: Number(syncDays || 7),
    }),
    onSuccess: () => {
      setApiToken("");
      setNotice("Wildberries подключен. Доступ сохранен приватно, можно проверить подключение.");
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["wildberries-status"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => businessConnectorsApi.wildberriesTestConnection(Number(connector?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? "Подключение к Wildberries проверено." : data.reason || "Не удалось проверить доступ Wildberries.");
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["wildberries-status", connector?.id] });
    },
  });

  const syncData = useMutation({
    mutationFn: () => businessConnectorsApi.wildberriesSync(Number(connector?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? `Данные Wildberries загружены: ${data.events.length} событий.` : data.reason || "Не удалось загрузить данные Wildberries.");
      queryClient.invalidateQueries({ queryKey: ["business-events"] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["connector-sync-runs"] });
      queryClient.invalidateQueries({ queryKey: ["wildberries-status", connector?.id] });
    },
  });

  const toggleEntity = (entity: string) => {
    setEntities((current) => current.includes(entity) ? current.filter((item) => item !== entity) : [...current, entity]);
  };

  const error = saveConfig.error || testConnection.error || syncData.error || status.error;
  const tokenConfigured = Boolean(status.data?.api_token_configured || connector?.config_json?.api_token_configured);

  return (
    <div className="w-full space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
      {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
      {notice ? <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{notice}</div> : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Доступ</p>
          <p className="mt-1 text-sm font-black text-midnight">{tokenConfigured ? "Сохранен" : "Нужен"}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Режим</p>
          <p className="mt-1 text-sm font-black text-midnight">Только чтение</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Обновление WB</p>
          <p className="mt-1 text-sm font-black text-midnight">~30 минут</p>
        </div>
      </div>

      {!showAccessSetup ? (
        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-black text-blue-950">Подключение Wildberries</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-blue-800">
            Сейчас Wildberries подключается через токен статистики продавца. ZANI только читает заказы и продажи для аналитики.
          </p>
          <Button type="button" className="mt-3" disabled={!canManage} onClick={() => setShowAccessSetup(true)}>
            <ShieldCheck size={16} /> Ввести ключ доступа
          </Button>
        </div>
      ) : (
        <Input
          label="Ключ доступа Wildberries"
          value={apiToken}
          onChange={(event) => setApiToken(event.target.value)}
          placeholder={tokenConfigured ? "Доступ уже сохранен. Вставьте новый ключ только для замены." : "Вставьте токен категории Statistics"}
          type="password"
          autoComplete="off"
        />
      )}

      <button type="button" className="text-sm font-black text-brand-700" onClick={() => setShowAdvanced((value) => !value)}>
        {showAdvanced ? "Скрыть дополнительные настройки" : "Дополнительные настройки"}
      </button>
      {showAdvanced ? (
        <div className="space-y-3 rounded-2xl bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["orders", "Заказы"],
              ["sales", "Продажи"],
              ["stocks", "Остатки"],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={entities.includes(value)} onChange={() => toggleEntity(value)} />
                {label}
              </label>
            ))}
          </div>
          <Input label="Период загрузки, дней" value={syncDays} onChange={(event) => setSyncDays(event.target.value)} placeholder="7" type="number" />
          {entities.includes("stocks") ? (
            <div className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800">
              Остатки Wildberries оставлены опционально: статистический endpoint остатков у WB помечен как deprecated, поэтому основной боевой контур — заказы и продажи.
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <Button type="button" disabled={!canManage || (!apiToken.trim() && !connector)} isLoading={saveConfig.isPending} onClick={() => saveConfig.mutate()}>
          <ShieldCheck size={16} /> {connector ? "Сохранить доступ" : "Подключить Wildberries"}
        </Button>
        <Button type="button" variant="secondary" disabled={!canManage || !connector || !tokenConfigured} isLoading={testConnection.isPending} onClick={() => testConnection.mutate()}>
          <RefreshCw size={16} /> Проверить
        </Button>
        <Button type="button" variant="secondary" disabled={!canManage || !connector || !tokenConfigured || !entities.length} isLoading={syncData.isPending} onClick={() => syncData.mutate()}>
          <DatabaseZap size={16} /> Загрузить данные
        </Button>
      </div>

      <p className="text-xs font-semibold leading-5 text-slate-500">
        ZANI не меняет цены, карточки, поставки и заказы Wildberries. Для продавца это источник фактов для dashboard и AI-аналитики.
      </p>
    </div>
  );
}

function OzonInlineSetup({
  businessId,
  canManage,
  connector,
}: {
  businessId: Id;
  canManage: boolean;
  connector?: BusinessConnector;
}) {
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [entities, setEntities] = useState<string[]>(Array.isArray(connector?.config_json?.entities) ? connector?.config_json?.entities as string[] : ["fbs_postings", "fbo_postings", "stocks"]);
  const [syncDays, setSyncDays] = useState(String(connector?.config_json?.sync_days || "7"));
  const [limit, setLimit] = useState(String(connector?.config_json?.limit || "50"));
  const [showAccessSetup, setShowAccessSetup] = useState(Boolean(connector?.config_json?.client_id_configured && connector?.config_json?.api_key_configured));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ["ozon-status", connector?.id],
    queryFn: () => businessConnectorsApi.ozonStatus(Number(connector?.id)),
    enabled: Boolean(connector?.id),
  });

  const saveConfig = useMutation({
    mutationFn: () => businessConnectorsApi.configureOzon({
      business: businessId,
      clientId,
      apiKey,
      entities,
      syncDays: Number(syncDays || 7),
      limit: Number(limit || 50),
    }),
    onSuccess: () => {
      setClientId("");
      setApiKey("");
      setNotice("Ozon подключен. Доступ сохранен приватно, можно проверить подключение.");
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["ozon-status"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => businessConnectorsApi.ozonTestConnection(Number(connector?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? "Подключение к Ozon проверено." : data.reason || "Не удалось проверить доступ Ozon.");
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["ozon-status", connector?.id] });
    },
  });

  const syncData = useMutation({
    mutationFn: () => businessConnectorsApi.ozonSync(Number(connector?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? `Данные Ozon загружены: ${data.events.length} событий.` : data.reason || "Не удалось загрузить данные Ozon.");
      queryClient.invalidateQueries({ queryKey: ["business-events"] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
      queryClient.invalidateQueries({ queryKey: ["connector-sync-runs"] });
      queryClient.invalidateQueries({ queryKey: ["ozon-status", connector?.id] });
    },
  });

  const toggleEntity = (entity: string) => {
    setEntities((current) => current.includes(entity) ? current.filter((item) => item !== entity) : [...current, entity]);
  };

  const error = saveConfig.error || testConnection.error || syncData.error || status.error;
  const accessConfigured = Boolean((status.data?.client_id_configured && status.data?.api_key_configured) || (connector?.config_json?.client_id_configured && connector?.config_json?.api_key_configured));

  return (
    <div className="w-full space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
      {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
      {notice ? <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{notice}</div> : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Доступ</p>
          <p className="mt-1 text-sm font-black text-midnight">{accessConfigured ? "Сохранен" : "Нужен"}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Режим</p>
          <p className="mt-1 text-sm font-black text-midnight">Только чтение</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Данные</p>
          <p className="mt-1 text-sm font-black text-midnight">FBS/FBO/stock</p>
        </div>
      </div>

      {!showAccessSetup ? (
        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-black text-blue-950">Подключение Ozon</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-blue-800">
            Ozon подключается через Client-Id и API key из кабинета продавца. ZANI использует их только для чтения отправлений и остатков.
          </p>
          <Button type="button" className="mt-3" disabled={!canManage} onClick={() => setShowAccessSetup(true)}>
            <ShieldCheck size={16} /> Ввести доступ
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Client-Id Ozon"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            placeholder={accessConfigured ? "Client-Id уже сохранен. Введите новый только для замены." : "Client-Id из Ozon Seller"}
            type="password"
            autoComplete="off"
          />
          <Input
            label="API key Ozon"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={accessConfigured ? "API key уже сохранен. Введите новый только для замены." : "API key из Ozon Seller"}
            type="password"
            autoComplete="off"
          />
        </div>
      )}

      <button type="button" className="text-sm font-black text-brand-700" onClick={() => setShowAdvanced((value) => !value)}>
        {showAdvanced ? "Скрыть дополнительные настройки" : "Дополнительные настройки"}
      </button>
      {showAdvanced ? (
        <div className="space-y-3 rounded-2xl bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["fbs_postings", "FBS"],
              ["fbo_postings", "FBO"],
              ["stocks", "Остатки"],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={entities.includes(value)} onChange={() => toggleEntity(value)} />
                {label}
              </label>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Период загрузки, дней" value={syncDays} onChange={(event) => setSyncDays(event.target.value)} placeholder="7" type="number" />
            <Input label="Лимит записей за раз" value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="50" type="number" />
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <Button type="button" disabled={!canManage || ((!clientId.trim() || !apiKey.trim()) && !connector)} isLoading={saveConfig.isPending} onClick={() => saveConfig.mutate()}>
          <ShieldCheck size={16} /> {connector ? "Сохранить доступ" : "Подключить Ozon"}
        </Button>
        <Button type="button" variant="secondary" disabled={!canManage || !connector || !accessConfigured} isLoading={testConnection.isPending} onClick={() => testConnection.mutate()}>
          <RefreshCw size={16} /> Проверить
        </Button>
        <Button type="button" variant="secondary" disabled={!canManage || !connector || !accessConfigured || !entities.length} isLoading={syncData.isPending} onClick={() => syncData.mutate()}>
          <DatabaseZap size={16} /> Загрузить данные
        </Button>
      </div>

      <p className="text-xs font-semibold leading-5 text-slate-500">
        ZANI не обновляет цены, остатки, карточки, сборку и отмену заказов Ozon. Коннектор только читает факты для dashboard и AI-аналитики.
      </p>
    </div>
  );
}

function ImportPanel({ businessId }: { businessId: Id }) {
  const queryClient = useQueryClient();
  const [entity, setEntity] = useState<ImportEntity>("clients");
  const [file, setFile] = useState<File | null>(null);
  const [activeJob, setActiveJob] = useState<ImportJob | null>(null);

  const jobsQuery = useQuery({
    queryKey: ["import-jobs", businessId],
    queryFn: () => importExportApi.importJobs(businessId),
  });

  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Выберите CSV или XLSX файл.");
      return importExportApi.upload({ business: businessId, entity, file });
    },
    onSuccess: (job) => {
      setActiveJob(job);
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
    },
  });

  const confirm = useMutation({
    mutationFn: (jobId: Id) => importExportApi.confirm(jobId),
    onSuccess: (job) => {
      setActiveJob(job);
      queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });

  const template = useMutation({
    mutationFn: importExportApi.downloadTemplate,
  });

  const jobs = jobsQuery.data || [];
  const selected = activeJob || jobs[0];
  const errors = selected?.errors_json?.rows || [];
  const duplicates = selected?.duplicates_json?.rows || [];
  const previewRows = selected?.preview_json?.rows || [];
  const summary = selected?.summary_json || selected?.preview_json?.import_summary;
  const importError = jobsQuery.error || upload.error || confirm.error || template.error;
  const entityOptions = [
    { value: "clients", label: "Клиенты" },
    { value: "leads", label: "Заявки" },
    { value: "sales", label: "Продажи" },
    { value: "catalog", label: "Каталог" },
  ];

  return (
    <section id="integration-import" className="scroll-mt-24 rounded-[2rem] border border-emerald-100 bg-white/95 p-5 shadow-soft">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Excel / CSV коннектор</p>
          <h2 className="mt-1 text-2xl font-black text-midnight">Загрузка данных из файла</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Выберите тип данных, скачайте шаблон или загрузите готовый CSV/XLSX. ZANI сначала проверит файл и покажет ошибки, импорт запускается только после подтверждения.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-emerald-50 p-2 text-center text-xs font-black text-emerald-900 sm:grid-cols-4">
          <span>Клиенты</span>
          <span>Заявки</span>
          <span>Продажи</span>
          <span>Каталог</span>
        </div>
      </div>

      {importError ? <div className="mt-4"><ErrorState message={getApiErrorMessage(importError)} /></div> : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-[220px_1fr_auto_auto]">
        <Select value={entity} onChange={(event) => setEntity(event.target.value as ImportEntity)} options={entityOptions} />
        <Input type="file" accept=".csv,.xlsx" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        <Button type="button" variant="secondary" isLoading={template.isPending} onClick={() => template.mutate(entity)}>
          <FileSpreadsheet size={16} /> Скачать шаблон
        </Button>
        <Button type="button" disabled={!file} isLoading={upload.isPending} onClick={() => upload.mutate()}>
          <Upload size={16} /> Проверить
        </Button>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-black text-midnight">{selected?.original_filename || "Файл еще не выбран"}</p>
              <p className="mt-1 text-sm text-slate-500">
                {selected ? `${selected.entity_type} · ${selected.total_rows} строк · ${readableStatus(selected.status)}` : "Загрузите файл, чтобы увидеть preview и ошибки."}
              </p>
            </div>
            {selected?.status === "previewed" && !errors.length ? (
              <Button type="button" isLoading={confirm.isPending} onClick={() => confirm.mutate(selected.id)}>
                <CheckCircle2 size={16} /> Импортировать
              </Button>
            ) : null}
          </div>

          {selected ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              <ImportMetric label="Строк" value={summary?.total_rows ?? selected.total_rows} />
              <ImportMetric label="Ошибок" value={summary?.errors ?? errors.length} tone={errors.length ? "danger" : "default"} />
              <ImportMetric label="Дублей" value={summary?.duplicates ?? duplicates.length} />
              <ImportMetric label="Импортировано" value={summary?.imported ?? selected.imported_count} tone={selected.status === "imported" ? "success" : "default"} />
            </div>
          ) : null}

          {errors.length ? (
            <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3">
              <p className="text-sm font-black text-red-800">Нужно исправить файл</p>
              {errors.slice(0, 5).map((item, index) => (
                <p key={`${item.row}-${item.field}-${index}`} className="mt-1 text-xs font-semibold text-red-700">
                  Строка {item.row}, {item.field}: {item.message}
                </p>
              ))}
            </div>
          ) : null}

          {duplicates.length ? (
            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-3">
              <p className="text-sm font-black text-amber-900">Найдены возможные дубли</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">
                ZANI не создаст вторую карточку, если клиент уже найден по телефону или email. Проверьте preview перед подтверждением.
              </p>
            </div>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white">
            {previewRows.slice(0, 5).map((row, index) => (
              <div key={index} className="border-b border-slate-100 px-3 py-2 text-xs text-slate-600 last:border-b-0">
                {Object.entries(row).slice(0, 6).map(([key, value]) => `${key}: ${value || "-"}`).join(" · ")}
              </div>
            ))}
            {!previewRows.length ? <p className="px-3 py-4 text-sm text-slate-500">Preview появится после проверки файла.</p> : null}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-100 bg-white p-4">
          <p className="font-black text-midnight">История импортов</p>
          <div className="mt-3 space-y-2">
            {jobs.slice(0, 8).map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => setActiveJob(job)}
                className="w-full rounded-2xl bg-slate-50 px-3 py-2 text-left text-sm transition hover:bg-slate-100"
              >
                <span className="font-bold text-midnight">#{job.id} {job.entity_type}</span>
                <span className="ml-2 text-slate-500">{job.status} · {job.imported_count}/{job.total_rows}</span>
              </button>
            ))}
            {!jobsQuery.isLoading && !jobs.length ? <p className="text-sm text-slate-500">Импортов пока нет.</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function ImportMetric({ label, value, tone = "default" }: { label: string; value?: number | string; tone?: "default" | "danger" | "success" }) {
  return (
    <div className={cn(
      "rounded-2xl px-3 py-2",
      tone === "danger" ? "bg-red-50 text-red-800" : tone === "success" ? "bg-emerald-50 text-emerald-800" : "bg-white text-slate-700",
    )}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black">{value ?? 0}</p>
    </div>
  );
}

function EventRow({ event }: { event: BusinessEvent }) {
  return (
    <div className="grid gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 lg:grid-cols-[160px_1fr_120px_130px] lg:items-center">
      <div className="flex items-center gap-2">
        <LogoMark logo={providerLogo(event.source)} label={event.source} />
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-midnight">{event.source}</p>
          <p className="text-xs text-slate-500">{formatDate(event.occurred_at)}</p>
        </div>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-midnight">{event.event_type}</p>
        <p className="mt-1 truncate text-xs font-semibold text-slate-500">{compactPayload(event.payload_json)}</p>
      </div>
      <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-black ring-1 ${statusClass(event.status)}`}>
        {readableStatus(event.status)}
      </span>
      <p className="text-xs font-semibold text-slate-500">{event.connector_name || "Без коннектора"}</p>
    </div>
  );
}

function LogRow({ log }: { log: IntegrationEventLog }) {
  return (
    <div className="grid gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 lg:grid-cols-[160px_1fr_110px] lg:items-center">
      <div className="flex items-center gap-2">
        <LogoMark logo={providerLogo(log.provider)} label={log.provider} />
        <div>
          <p className="text-sm font-black text-midnight">{log.provider}</p>
          <p className="text-xs text-slate-500">{formatDate(log.created_at)}</p>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700">{log.direction} · {log.channel || "default"}</p>
        <p className="mt-1 text-xs text-slate-500">{log.error || compactPayload(log.payload_json)}</p>
      </div>
      <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-black ring-1 ${statusClass(log.status)}`}>
        {readableStatus(log.status)}
      </span>
    </div>
  );
}

function SyncRunRow({ run }: { run: ConnectorSyncRun }) {
  return (
    <div className="grid gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 lg:grid-cols-[1fr_120px_130px_100px] lg:items-center">
      <div>
        <p className="text-sm font-black text-midnight">{run.connector_name || `Connector #${run.connector}`}</p>
        <p className="mt-1 text-xs text-slate-500">{run.mode} · {formatDate(run.created_at)}</p>
      </div>
      <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-black ring-1 ${statusClass(run.status)}`}>
        {readableStatus(run.status)}
      </span>
      <p className="text-xs font-semibold text-slate-500">{run.events_processed}/{run.events_received} событий</p>
      <p className="truncate text-xs text-red-600">{run.error}</p>
    </div>
  );
}

export function IntegrationsPage() {
  const { user } = useAuth();
  const { business, isLoading: isBusinessLoading } = useActiveBusiness();
  const canManage = hasPermission(user, business?.id, "integrations", "manage");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<ProviderGroup | "all">("all");

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return;
    const provider = url.searchParams.get("zani_provider");

    const payload = provider === "instagram"
      ? {
          type: instagramOAuthCallbackType,
          code,
          state,
        } satisfies InstagramOAuthCallback
      : {
          type: whatsappEmbeddedSignupCallbackType,
          code,
          state,
          phone_number_id: url.searchParams.get("phone_number_id") || undefined,
          waba_id: url.searchParams.get("waba_id") || undefined,
          display_phone_number: url.searchParams.get("display_phone_number") || undefined,
        } satisfies WhatsAppEmbeddedSignupCallback;

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
      window.close();
      return;
    }

    window.history.replaceState({}, document.title, `${url.pathname}${url.hash}`);
  }, []);

  const capabilities = useQuery({
    queryKey: ["connector-capabilities"],
    queryFn: businessConnectorsApi.capabilities,
  });
  const connectors = useQuery({
    queryKey: ["business-connectors", business?.id],
    queryFn: businessConnectorsApi.list,
    enabled: Boolean(business?.id),
  });
  const channels = useQuery({
    queryKey: ["bot-channels", business?.id],
    queryFn: botChannelsApi.list,
    enabled: Boolean(business?.id),
  });
  const bots = useQuery({
    queryKey: ["bots", business?.id],
    queryFn: botsApi.list,
    enabled: Boolean(business?.id),
  });
  const events = useQuery({
    queryKey: ["business-events", business?.id],
    queryFn: businessEventsApi.list,
    enabled: Boolean(business?.id),
  });
  const logs = useQuery({
    queryKey: ["integration-event-logs", business?.id],
    queryFn: () => integrationEventLogsApi.list(),
    enabled: Boolean(business?.id),
  });
  const syncRuns = useQuery({
    queryKey: ["connector-sync-runs", business?.id],
    queryFn: connectorSyncRunsApi.list,
    enabled: Boolean(business?.id),
  });

  const data = useMemo(() => {
    const capabilityList = capabilities.data || [];
    const connectorList = connectors.data || [];
    const channelList = channels.data || [];
    const normalizedQuery = query.trim().toLowerCase();
    return providerCatalog
      .map((item) => {
        const capability = providerCapability(item.provider, capabilityList);
        const connector = providerConnector(item.provider, connectorList);
        const channel = providerChannel(item.provider, channelList);
        const status = item.provider === "kaspi_pricing" ? "setup_required" : deriveProviderStatus({ capability, channel, connector });
        const label = providerTitle(item.provider, capability);
        return { ...item, capability, channel, connector, label, status };
      })
      .filter((item) => {
        const matchesGroup = group === "all" || item.group === group;
        const matchesQuery = !normalizedQuery || [item.label, item.provider, item.primaryUse].join(" ").toLowerCase().includes(normalizedQuery);
        return matchesGroup && matchesQuery;
      });
  }, [capabilities.data, channels.data, connectors.data, group, query]);

  const summary = useMemo(() => {
    const connectorList = connectors.data || [];
    const eventList = events.data || [];
    const syncList = syncRuns.data || [];
    const connected = data.filter((item) => ["connected", "active"].includes(item.status)).length;
    const attention = data.filter((item) => ["needs_attention", "error", "failed", "expired_credentials"].includes(item.status)).length;
    return {
      connected,
      attention,
      eventsToday: eventList.length,
      failedSyncs: syncList.filter((item) => item.status === "failed").length + connectorList.filter((item) => ["failed", "error"].includes(item.status)).length,
    };
  }, [connectors.data, data, events.data, syncRuns.data]);

  if (isBusinessLoading || capabilities.isLoading || connectors.isLoading || channels.isLoading || bots.isLoading) {
    return <LoadingState label="Загружаем статус интеграций..." />;
  }

  if (!business) {
    return <EmptyState title="Нет бизнеса" description="Создайте бизнес, чтобы подключать каналы, склад, 1C и Kaspi." />;
  }

  const pageError = capabilities.error || connectors.error || channels.error || bots.error || events.error || logs.error || syncRuns.error;

  return (
    <div>
      <PageHeader
        title="Подключения"
        description="Статус-центр интеграций: что подключено, где ошибка, когда была синхронизация и какое действие нужно сделать."
        actions={
          <Link to="/dashboard/ai-assistant">
            <Button type="button" variant="secondary">
              <DatabaseZap size={16} /> Открыть AI-анализ
            </Button>
          </Link>
        }
      />

      {pageError ? <div className="mb-4"><ErrorState message={getApiErrorMessage(pageError)} /></div> : null}

      <section className="mb-5 grid gap-3 md:grid-cols-4">
        <MetricCard icon={<CheckCircle2 size={19} />} label="Подключено" value={summary.connected} tone="bg-emerald-50 text-emerald-700" />
        <MetricCard icon={<AlertTriangle size={19} />} label="Требуют внимания" value={summary.attention} tone="bg-amber-50 text-amber-700" />
        <MetricCard icon={<DatabaseZap size={19} />} label="Бизнес-события" value={summary.eventsToday} tone="bg-blue-50 text-blue-700" />
        <MetricCard icon={<XCircle size={19} />} label="Ошибки sync" value={summary.failedSyncs} tone="bg-red-50 text-red-700" />
      </section>

      <section className="mb-5 rounded-3xl border border-white/80 bg-white/92 p-4 shadow-soft">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
          <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-semibold text-slate-500">
            <Search size={18} />
            <input
              className="min-w-0 flex-1 bg-transparent outline-none"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск: Kaspi, Telegram, 1C..."
            />
          </label>
          <Select
            value={group}
            onChange={(event) => setGroup(event.target.value as ProviderGroup | "all")}
            options={[
              { value: "all", label: "Все группы" },
              { value: "messages", label: groupLabels.messages.title },
              { value: "data", label: groupLabels.data.title },
              { value: "marketplace", label: groupLabels.marketplace.title },
              { value: "system", label: groupLabels.system.title },
            ]}
          />
        </div>
      </section>

      <section className="mb-6 space-y-5">
        {(["messages", "data", "marketplace", "system"] as ProviderGroup[]).map((groupKey) => {
          const items = data.filter((item) => item.group === groupKey);
          if (!items.length) return null;
          return (
            <div key={groupKey}>
              <div className="mb-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">{groupLabels[groupKey].title}</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{groupLabels[groupKey].text}</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {items.map((item) => (
                  <ProviderCard
                    key={item.provider}
                    businessId={business.id}
                    bots={bots.data || []}
                    canManage={canManage}
                    capability={item.capability}
                    channel={item.channel}
                    connector={item.connector}
                    provider={item}
                    onImport={() => document.getElementById("integration-import")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <div className="mb-6">
        <ImportPanel businessId={business.id} />
      </div>

      <section className="mb-6 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white/95 shadow-soft">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-lg font-black text-midnight">Последние бизнес-события</h2>
              <p className="text-sm font-semibold text-slate-500">Эти факты должен читать AI-аналитик.</p>
            </div>
          </div>
          {(events.data || []).slice(0, 10).map((event) => <EventRow key={event.id} event={event} />)}
          {!events.isLoading && !(events.data || []).length ? (
            <div className="p-4">
              <EmptyState title="Событий пока нет" description="Сделайте demo sync или импорт файла, чтобы появились факты для аналитики." />
            </div>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white/95 shadow-soft">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-lg font-black text-midnight">Журнал каналов</h2>
            <p className="text-sm font-semibold text-slate-500">Webhook, входящие и исходящие события.</p>
          </div>
          {(logs.data || []).slice(0, 8).map((log) => <LogRow key={log.id} log={log} />)}
          {!logs.isLoading && !(logs.data || []).length ? (
            <div className="p-4">
              <EmptyState title="Логов пока нет" description="После сообщений ботов или webhook-событий здесь появится журнал." />
            </div>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white/95 shadow-soft">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-black text-midnight">Запуски синхронизации</h2>
          <p className="text-sm font-semibold text-slate-500">Health-check, pull, manual и demo sync.</p>
        </div>
        {(syncRuns.data || []).slice(0, 10).map((run) => <SyncRunRow key={run.id} run={run} />)}
        {!syncRuns.isLoading && !(syncRuns.data || []).length ? (
          <div className="p-4">
            <EmptyState title="Sync run пока нет" description="Нажмите Проверить или Demo sync у нужного подключения." />
          </div>
        ) : null}
      </section>
    </div>
  );
}
