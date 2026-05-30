import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { botChannelsApi } from "../../../api/bots";
import { businessConnectorsApi, type BusinessConnectorPayload } from "../../../api/connectors";
import { getApiErrorMessage } from "../../../api/client";
import { Button } from "../../../components/ui/Button";
import { ErrorState } from "../../../components/ui/StateViews";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { cn } from "../../../lib/cn";
import type { Bot, BotChannel, BusinessConnector, ConnectorCapability, Id } from "../../../types";
import { providerCatalog, type ProviderKey } from "../config/providerCatalog";
import { ImportPanel } from "./ImportPanel";
import { LogoMark, ToggleSwitch } from "./setup/IntegrationSetupUi";
import { TelegramInlineSetup } from "./setup/TelegramSetup";
import { WhatsAppInlineSetup } from "./setup/WhatsAppSetup";
import { InstagramInlineSetup } from "./setup/InstagramSetup";
import { KaspiInlineSetup } from "./setup/KaspiSetup";
import { KaspiPricingInlineSetup } from "./setup/KaspiPricingSetup";
import { MoySkladInlineSetup } from "./setup/MoySkladSetup";
import { WildberriesInlineSetup } from "./setup/WildberriesSetup";
import { OzonInlineSetup } from "./setup/OzonSetup";

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

function readableConnectorError(message: string) {
  if (message.toLowerCase().includes("credentials are missing or expired")) {
    return "Доступ не подключен или истек.";
  }
  return message;
}

export function ProviderCard({
  businessId,
  bots,
  canManage,
  capability,
  channel,
  connector,
  provider,
}: {
  businessId: Id;
  bots: Bot[];
  canManage: boolean;
  capability?: ConnectorCapability;
  channel?: BotChannel;
  connector?: BusinessConnector;
  provider: (typeof providerCatalog)[number];
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

  const isConnected = ["connected", "active"].includes(status);
  const isUnavailable = ["roadmap", "soon"].includes(status);
  const isWebsiteProvider = provider.provider === "website";
  const isChannelProvider = ["website", "telegram", "whatsapp", "instagram"].includes(String(provider.provider));
  const showChannelToggle = Boolean(
    isChannelProvider &&
      isConnected &&
      channel &&
      (provider.provider !== "telegram" || channel.config_json?.webhook_configured),
  );

  const toggleChannel = useMutation({
    mutationFn: (nextStatus: BotChannel["status"]) => {
      if (!channel) throw new Error("Channel is required.");
      return botChannelsApi.update({ id: channel.id, payload: { status: nextStatus } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const error = requestConnector.error || healthCheck.error || saveGenericConfig.error || toggleChannel.error;

  const handlePrimaryAction = () => {
    setConnectOpen(true);
  };

  const renderPrimaryButton = () => (
    <Button
      type="button"
      className="h-9 min-w-[118px] rounded-xl px-4 text-sm"
      disabled={!canManage || isUnavailable}
      onClick={handlePrimaryAction}
    >
      {isConnected ? "Настроить" : "Подключить"}
    </Button>
  );

  const frontContent = (
    <>
      <div className="flex items-start justify-between gap-3">
        <LogoMark logo={provider.logo} label={title} />
        <div className="flex max-w-[70%] shrink-0 items-center justify-end gap-2">
          {renderPrimaryButton()}
          {showChannelToggle && channel ? (
            <ToggleSwitch
              checked={channel.status === "active"}
              disabled={!canManage}
              isLoading={toggleChannel.isPending}
              label={`${title}: ${channel.status === "active" ? "выключить" : "включить"}`}
              onChange={(checked) => toggleChannel.mutate(checked ? "active" : "paused")}
            />
          ) : null}
        </div>
      </div>

      <div className={cn("min-w-0", isChannelProvider ? "mt-3" : "mt-4")}>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className={cn("min-w-0 break-words font-black text-midnight", isChannelProvider ? "text-[17px] leading-6" : "text-lg")}>
            {title}
          </h3>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ring-1 ${statusClass(status)}`}>
            {readableStatus(status, "Не подключен")}
          </span>
        </div>
        <p className={cn("text-sm font-semibold leading-5 text-slate-500", isChannelProvider ? "mt-1" : "mt-2")}>
          {provider.primaryUse}
        </p>
      </div>

      {connector?.last_error && !isChannelProvider ? (
        <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {readableConnectorError(connector.last_error)}
        </div>
      ) : null}

      {error ? <div className="mt-3"><ErrorState message={getApiErrorMessage(error)} /></div> : null}
    </>
  );

  return (
    <article
      className={cn(
        isWebsiteProvider
          ? "group min-h-[128px] rounded-2xl [perspective:1200px]"
          : cn(
              "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft",
              isChannelProvider ? "min-h-[128px]" : "min-h-[132px]",
            ),
        isUnavailable && "opacity-60",
      )}
    >
      {isWebsiteProvider ? (
        <div className="relative min-h-[128px] rounded-2xl transition-transform duration-500 [transform-style:preserve-3d] sm:group-hover:[transform:rotateY(180deg)]">
          <div className="absolute inset-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm [backface-visibility:hidden]">
            {frontContent}
          </div>
          <div className="absolute inset-0 hidden rounded-2xl border border-brand-100 bg-white p-4 shadow-soft [backface-visibility:hidden] [transform:rotateY(180deg)] sm:flex">
            <div className="flex min-h-full w-full flex-col justify-between gap-3">
              <div>
                <p className="text-sm font-black leading-5 text-midnight">
                  Не теряйте заявки с сайта после первого клика.
                </p>
                <p className="mt-2 text-sm font-semibold leading-5 text-slate-600">
                  ZANI принимает заявки с формы и сразу передает их в Inbox.
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
          ) : provider.provider === "excel_csv" ? (
            <ImportPanel businessId={businessId} />
          ) : provider.provider === "whatsapp" ? (
            <WhatsAppInlineSetup businessId={businessId} bots={bots} canManage={canManage} channel={channel} />
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
