import { useMemo, useState } from "react";
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
import { botChannelsApi, botsApi, integrationEventLogsApi, telegramChannelApi, whatsappChannelApi } from "../../api/bots";
import { importExportApi, type ImportEntity } from "../../api/importExport";
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

type ProviderKey = BusinessConnector["provider"];
type ProviderGroup = "messages" | "data" | "marketplace" | "system";

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
    primaryUse: "Заказы, оплаты, цены и товарные риски",
    requestName: "Kaspi",
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
  const status = deriveProviderStatus({ capability, channel, connector });
  const title = providerTitle(provider.provider, capability);
  const isDataProvider = ["kaspi", "1c", "moysklad", "wildberries"].includes(String(provider.provider));
  const isRequestProvider = ["whatsapp", "instagram", "kaspi", "1c", "moysklad", "wildberries", "google_sheets", "email"].includes(String(provider.provider));

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
      const payload: BusinessConnectorPayload = {
        business: businessId,
        provider: provider.provider,
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
      const payload: BusinessConnectorPayload = {
        business: businessId,
        provider: provider.provider,
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

  return (
    <article className={cn("min-h-[172px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft", isUnavailable && "opacity-60")}>
      <div className="flex items-start justify-between gap-4">
        <LogoMark logo={provider.logo} label={title} />
        <Button
          type="button"
          className="h-10 min-w-[148px] rounded-xl px-5 text-sm"
          disabled={!canManage || isUnavailable}
          onClick={() => {
            if (provider.provider === "excel_csv") {
              onImport();
              return;
            }
            setConnectOpen(true);
          }}
        >
          {isConnected ? "Настроить" : "Подключить"}
        </Button>
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-black tracking-tight text-midnight">{title}</h3>
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

      <Modal title={`Подключение: ${title}`} open={connectOpen} onClose={() => setConnectOpen(false)}>
        <div className="space-y-4">
          {notice ? <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{notice}</div> : null}
          {provider.provider === "telegram" ? (
            <TelegramInlineSetup businessId={businessId} bots={bots} canManage={canManage} channel={channel} />
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

      <div className="grid gap-2 sm:grid-cols-3">
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
      <p className="text-xs font-semibold leading-5 text-slate-500">
        Сейчас локальный адрес не доступен Telegram из интернета. Для теста нажмите «Загрузить сообщения» после отправки сообщения боту. Для production нужен публичный HTTPS URL.
      </p>
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
  const [signupCode, setSignupCode] = useState("");
  const [signupState, setSignupState] = useState("");
  const [signupRedirectUri, setSignupRedirectUri] = useState("");
  const [signupPhoneNumberId, setSignupPhoneNumberId] = useState("");
  const [signupWabaId, setSignupWabaId] = useState("");
  const [signupDisplayPhone, setSignupDisplayPhone] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

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
      setNotice("WhatsApp channel создан. Теперь добавьте Meta Cloud credentials.");
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
      setNotice("WhatsApp credentials сохранены приватно. Теперь проверьте подключение.");
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => whatsappChannelApi.testConnection(Number(channel?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? "WhatsApp credentials проверены." : data.reason || "WhatsApp credentials не прошли проверку.");
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const startEmbeddedSignup = useMutation({
    mutationFn: () => businessConnectorsApi.startWhatsAppEmbeddedSignup({
      business: businessId,
      redirectUri: window.location.origin + "/dashboard/integrations",
    }),
    onSuccess: (data) => {
      setSignupState(data.state);
      setSignupRedirectUri(data.redirect_uri);
      setNotice(data.app_configured ? "Meta Embedded Signup открыт. После завершения вставьте code и phone_number_id ниже." : "Meta app env не настроен. Проверьте META_APP_ID/META_APP_SECRET.");
      window.open(data.authorization_url, "zani_whatsapp_meta_signup", "width=720,height=820");
    },
  });

  const completeEmbeddedSignup = useMutation({
    mutationFn: () => businessConnectorsApi.completeWhatsAppEmbeddedSignup({
      business: businessId,
      code: signupCode,
      state: signupState,
      redirect_uri: signupRedirectUri || window.location.origin + "/dashboard/integrations",
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
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Phone ID</p>
          <p className="mt-1 text-sm font-black text-midnight">{status.data?.phone_number_id_configured ? "Сохранен" : "Нужен"}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Access token</p>
          <p className="mt-1 text-sm font-black text-midnight">{status.data?.access_token_configured ? "Сохранен" : "Нужен"}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Webhook verify</p>
          <p className="mt-1 text-sm font-black text-midnight">{status.data?.verify_token_configured ? "Готов" : "Env"}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-green-100 bg-green-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-green-950">Meta Embedded Signup</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-green-800">
              Основной production-flow: мерчант логинится в Meta, выбирает WABA и номер, ZANI сохраняет доступы.
            </p>
          </div>
          <Button type="button" disabled={!canManage} isLoading={startEmbeddedSignup.isPending} onClick={() => startEmbeddedSignup.mutate()}>
            <ExternalLink size={16} /> Подключить через Meta
          </Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Input label="Meta code" value={signupCode} onChange={(event) => setSignupCode(event.target.value)} placeholder="Code после Embedded Signup" />
          <Input label="Phone number ID" value={signupPhoneNumberId} onChange={(event) => setSignupPhoneNumberId(event.target.value)} placeholder="ID выбранного номера" />
          <Input label="WABA ID" value={signupWabaId} onChange={(event) => setSignupWabaId(event.target.value)} placeholder="Опционально" />
          <Input label="Display phone" value={signupDisplayPhone} onChange={(event) => setSignupDisplayPhone(event.target.value)} placeholder="+770..." />
        </div>
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

      <div className="grid gap-3 md:grid-cols-2">
        <Input label="Phone number ID" value={phoneNumberId} onChange={(event) => setPhoneNumberId(event.target.value)} placeholder={status.data?.phone_number_id_configured ? "Phone number ID уже сохранен" : "1234567890"} />
        <Input label="Access token хранится приватно" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder={status.data?.access_token_configured ? "Token уже сохранен. Вставьте новый только для замены." : "EAAG..."} type="password" autoComplete="off" />
        <Input label="WABA ID" value={businessAccountId} onChange={(event) => setBusinessAccountId(event.target.value)} placeholder="Опционально" />
        <Input label="Display phone" value={displayPhoneNumber} onChange={(event) => setDisplayPhoneNumber(event.target.value)} placeholder="+770..." />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Button
          type="button"
          disabled={!canManage || (!phoneNumberId.trim() && !accessToken.trim())}
          isLoading={saveCredentials.isPending}
          onClick={() => saveCredentials.mutate()}
        >
          <ShieldCheck size={16} /> {credentialsConfigured ? "Обновить credentials" : "Сохранить credentials"}
        </Button>
        <Button type="button" variant="secondary" disabled={!canManage || !credentialsConfigured} isLoading={testConnection.isPending} onClick={() => testConnection.mutate()}>
          <RefreshCw size={16} /> Проверить Meta доступ
        </Button>
      </div>

      <p className="text-xs font-semibold leading-5 text-slate-500">
        Webhook URL: {status.data?.webhook_url || "/api/integrations/whatsapp/webhook/"}. Verify token и App Secret задаются в production .env.
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
    queryFn: importExportApi.importJobs,
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
  const previewRows = selected?.preview_json?.rows || [];
  const importError = jobsQuery.error || upload.error || confirm.error || template.error;

  return (
    <section id="integration-import" className="scroll-mt-24 rounded-3xl border border-emerald-100 bg-white/95 p-5 shadow-soft">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Быстрый импорт</p>
          <h2 className="mt-1 text-2xl font-black text-midnight">Excel / CSV как fallback для MVP</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Пока 1C, Kaspi и склад подключаются по заявке, данные можно загрузить файлом и сразу дать AI-аналитику факты.
          </p>
        </div>
        <Button type="button" variant="secondary" isLoading={template.isPending} onClick={() => template.mutate(entity)}>
          <FileSpreadsheet size={16} /> Шаблон
        </Button>
      </div>

      {importError ? <div className="mt-4"><ErrorState message={getApiErrorMessage(importError)} /></div> : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-[220px_1fr_auto]">
        <Select
          value={entity}
          onChange={(event) => setEntity(event.target.value as ImportEntity)}
          options={[
            { value: "clients", label: "Клиенты" },
            { value: "leads", label: "Заявки" },
            { value: "sales", label: "Продажи" },
            { value: "catalog", label: "Каталог" },
          ]}
        />
        <Input type="file" accept=".csv,.xlsx" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        <Button type="button" disabled={!file} isLoading={upload.isPending} onClick={() => upload.mutate()}>
          <Upload size={16} /> Проверить файл
        </Button>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-black text-midnight">{selected?.original_filename || "Файл еще не выбран"}</p>
              <p className="mt-1 text-sm text-slate-500">
                {selected ? `${selected.entity_type} · ${selected.total_rows} строк · ${readableStatus(selected.status)}` : "Загрузите файл, чтобы увидеть preview и ошибки."}
              </p>
            </div>
            {selected?.status === "previewed" && !errors.length ? (
              <Button type="button" isLoading={confirm.isPending} onClick={() => confirm.mutate(selected.id)}>
                Импортировать
              </Button>
            ) : null}
          </div>

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

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white">
            {previewRows.slice(0, 5).map((row, index) => (
              <div key={index} className="border-b border-slate-100 px-3 py-2 text-xs text-slate-600 last:border-b-0">
                {Object.entries(row).slice(0, 6).map(([key, value]) => `${key}: ${value || "-"}`).join(" · ")}
              </div>
            ))}
            {!previewRows.length ? <p className="px-3 py-4 text-sm text-slate-500">Preview появится после проверки файла.</p> : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-4">
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
        const status = deriveProviderStatus({ capability, channel, connector });
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
