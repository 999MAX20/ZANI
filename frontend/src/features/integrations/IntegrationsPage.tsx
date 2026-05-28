import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DatabaseZap, Search } from "lucide-react";
import { Link } from "react-router-dom";

import { botChannelsApi, botsApi } from "../../api/bots";
import { businessConnectorsApi } from "../../api/connectors";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { hasPermission } from "../../lib/permissions";
import type { BotChannel, BusinessConnector, ConnectorCapability } from "../../types";
import { useAuth } from "../auth/AuthProvider";
import { ProviderCard } from "./components/ProviderCard";
import {
  instagramOAuthCallbackType,
  whatsappEmbeddedSignupCallbackType,
  type InstagramOAuthCallback,
  type WhatsAppEmbeddedSignupCallback,
} from "./components/setup/metaCallbacks";
import { groupLabels, providerCatalog, type ProviderGroup, type ProviderKey } from "./config/providerCatalog";

function providerTitle(provider: ProviderKey, capability?: ConnectorCapability) {
  return capability?.label || providerCatalog.find((item) => item.provider === provider)?.fallbackLabel || provider;
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

  if (isBusinessLoading || capabilities.isLoading || connectors.isLoading || channels.isLoading || bots.isLoading) {
    return <LoadingState label="Загружаем статус интеграций..." />;
  }

  if (!business) {
    return <EmptyState title="Нет бизнеса" description="Создайте бизнес, чтобы подключать каналы, склад, 1C и Kaspi." />;
  }

  const pageError = capabilities.error || connectors.error || channels.error || bots.error;

  return (
    <div>
      <PageHeader
        title="Подключения"
        description="Подключайте каналы и источники данных. Все настройки находятся внутри карточки нужного сервиса."
        actions={
          <Link to="/dashboard/ai-assistant">
            <Button type="button" variant="secondary">
              <DatabaseZap size={16} /> Открыть AI-анализ
            </Button>
          </Link>
        }
      />

      {pageError ? (
        <div className="mb-4">
          <ErrorState message={getApiErrorMessage(pageError)} />
        </div>
      ) : null}

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
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
