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
import { useI18n } from "../../../lib/i18n";
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

type Translate = ReturnType<typeof useI18n>["t"];

function readableStatus(status: string | undefined, t: Translate, fallback = t("integrations.status.notConnected")) {
  if (!status) return fallback;
  const labels: Record<string, string> = {
    active: "integrations.status.active",
    connected: "integrations.status.connected",
    draft: "integrations.status.draft",
    pending_request: "integrations.status.pendingRequest",
    provider_configuring: "integrations.status.providerConfiguring",
    setup_required: "integrations.status.setupRequired",
    needs_attention: "integrations.status.needsAttention",
    syncing: "integrations.status.syncing",
    disabled: "integrations.status.disabled",
    disconnected: "integrations.status.disconnected",
    error: "integrations.status.error",
    failed: "integrations.status.failed",
    expired_credentials: "integrations.status.expiredCredentials",
    roadmap: "integrations.status.roadmap",
    soon: "integrations.status.soon",
    request: "integrations.status.request",
    received: "integrations.status.received",
    processed: "integrations.status.processed",
    simulated: "integrations.status.simulated",
    applied: "integrations.status.applied",
    blocked: "integrations.status.blocked",
    ignored: "integrations.status.ignored",
    succeeded: "integrations.status.succeeded",
    running: "integrations.status.running",
    queued: "integrations.status.queued",
  };
  return labels[status] ? t(labels[status]) : status;
}

function statusClass(status?: string) {
  return statusTone[status || ""] || "bg-slate-100 text-slate-700 ring-slate-200";
}

function providerTitle(provider: ProviderKey, t: Translate, capability?: ConnectorCapability) {
  const catalogItem = providerCatalog.find((item) => item.provider === provider);
  return capability?.label || (catalogItem ? t(catalogItem.fallbackLabelKey) : provider);
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

function readableConnectorError(message: string, t: Translate) {
  if (message.toLowerCase().includes("credentials are missing or expired")) {
    return t("integrations.card.credentialsExpired");
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
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [connectOpen, setConnectOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [accountId, setAccountId] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const isPricingProvider = provider.provider === "kaspi_pricing";
  const status = isPricingProvider ? "setup_required" : deriveProviderStatus({ capability, channel, connector });
  const title = providerTitle(provider.provider, t, capability);
  const primaryUse = t(provider.primaryUseKey);
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
          comment: "Request created from status center.",
        });
      }
      if (isPricingProvider) {
        throw new Error(t("integrations.card.kaspiPricingSeparateSetup"));
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
        throw new Error(t("integrations.card.kaspiPricingNoGenericConfig"));
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
      setNotice(t("integrations.card.connectionSaved"));
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
      {isConnected ? t("integrations.card.configure") : t("integrations.card.connect")}
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
              label={t(channel.status === "active" ? "integrations.card.disableChannel" : "integrations.card.enableChannel", { title })}
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
            {readableStatus(status, t, t("integrations.status.notConnectedShort"))}
          </span>
        </div>
        <p className={cn("text-sm font-semibold leading-5 text-slate-500", isChannelProvider ? "mt-1" : "mt-2")}>
          {primaryUse}
        </p>
      </div>

      {connector?.last_error && !isChannelProvider ? (
        <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {readableConnectorError(connector.last_error, t)}
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
                  {t("integrations.card.websiteFlipTitle")}
                </p>
                <p className="mt-2 text-sm font-semibold leading-5 text-slate-600">
                  {t("integrations.card.websiteFlipText")}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">{t("integrations.card.websiteFlow")}</span>
                {renderPrimaryButton()}
              </div>
            </div>
          </div>
        </div>
      ) : (
        frontContent
      )}

      <Modal title={t("integrations.card.connectionTitle", { title })} open={connectOpen} onClose={() => setConnectOpen(false)}>
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
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{primaryUse}</p>
              </div>
              {provider.provider === "website" ? (
                <div className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">
                  {t("integrations.card.websiteNoExtraData")}
                </div>
              ) : (
                <>
                  <Input label={t("integrations.card.accountId")} value={accountId} onChange={(event) => setAccountId(event.target.value)} placeholder={t("integrations.card.accountIdPlaceholder")} />
                  <Input label={t("integrations.card.accessKey")} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={t("integrations.card.accessKeyPlaceholder")} type="password" autoComplete="off" />
                  <Input label={t("integrations.card.webhookSecret")} value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} placeholder={t("common.optional")} type="password" autoComplete="off" />
                </>
              )}
              <div className="flex flex-wrap gap-2">
                {provider.provider !== "website" ? (
                  <Button type="button" disabled={!canManage || (!apiKey.trim() && !accountId.trim())} isLoading={saveGenericConfig.isPending} onClick={() => saveGenericConfig.mutate()}>
                    <ShieldCheck size={16} /> {t("common.save")}
                  </Button>
                ) : null}
                {connector ? (
                  <Button type="button" variant="secondary" disabled={!canManage} isLoading={healthCheck.isPending} onClick={() => healthCheck.mutate()}>
                    <RefreshCw size={16} /> {t("integrations.card.check")}
                  </Button>
                ) : null}
                {isRequestProvider && !connector ? (
                  <Button type="button" variant="secondary" disabled={!canManage} isLoading={requestConnector.isPending} onClick={() => requestConnector.mutate()}>
                    <Send size={16} /> {t("integrations.card.requestConnection")}
                  </Button>
                ) : null}
                {["telegram", "whatsapp", "instagram", "website"].includes(String(provider.provider)) ? (
                  <Link to={`/dashboard/conversations?channel=${provider.provider}`}>
                    <Button type="button" variant="ghost">
                      <Link2 size={16} /> {t("nav.conversations")}
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
