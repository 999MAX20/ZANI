import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, DatabaseZap, SlidersHorizontal, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { botsApi } from "../../api/bots";
import { businessConnectorsApi } from "../../api/connectors";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { Select } from "../../components/ui/Select";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useI18n } from "../../lib/i18n";
import { hasPermission } from "../../lib/permissions";
import type { BusinessConnector, ConnectorCapability } from "../../types";
import { useAuth } from "../auth/AuthProvider";
import { ProviderCard } from "./components/ProviderCard";
import { groupLabels, providerCatalog, type ProviderGroup, type ProviderKey } from "./config/providerCatalog";

type StatusFilter = "all" | "connected" | "setup" | "request" | "planned" | "error";
type Translate = ReturnType<typeof useI18n>["t"];

const agentChannelProviders = new Set<ProviderKey>(["website", "telegram", "whatsapp", "instagram"]);
const providerGroups: ProviderGroup[] = ["data", "marketplace", "system"];

function providerTitle(provider: ProviderKey, t: Translate, capability?: ConnectorCapability) {
  const catalogItem = providerCatalog.find((item) => item.provider === provider);
  return capability?.label || (catalogItem ? t(catalogItem.fallbackLabelKey) : provider);
}

function providerCapability(provider: ProviderKey, capabilities: ConnectorCapability[]) {
  return capabilities.find((item) => item.provider === provider);
}

function providerConnector(provider: ProviderKey, connectors: BusinessConnector[]) {
  return connectors.find((item) => item.provider === provider);
}

function deriveProviderStatus({
  capability,
  connector,
}: {
  capability?: ConnectorCapability;
  connector?: BusinessConnector;
}) {
  if (connector?.status) return connector.status;
  if (capability?.availability === "roadmap" || capability?.launch_status === "roadmap") return "roadmap";
  if (capability?.availability === "request" || capability?.launch_status === "request") return "request";
  if (capability?.launch_status === "soon") return "soon";
  if (capability?.setup_state === "active" || capability?.availability === "included") return "setup_required";
  return "draft";
}

export function IntegrationsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { business, isLoading: isBusinessLoading } = useActiveBusiness();
  const canManage = hasPermission(user, business?.id, "integrations", "manage");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<ProviderGroup | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const statusFilterOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: "all", label: t("integrations.overview.status.all") },
    { value: "connected", label: t("integrations.overview.status.connected") },
    { value: "setup", label: t("integrations.overview.status.setup") },
    { value: "request", label: t("integrations.overview.status.request") },
    { value: "planned", label: t("integrations.overview.status.planned") },
    { value: "error", label: t("integrations.overview.status.error") },
  ];

  const capabilities = useQuery({
    queryKey: ["connector-capabilities"],
    queryFn: businessConnectorsApi.capabilities,
  });
  const connectors = useQuery({
    queryKey: ["business-connectors", business?.id],
    queryFn: businessConnectorsApi.list,
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
    const normalizedQuery = query.trim().toLowerCase();
    return providerCatalog
      .filter((item) => !agentChannelProviders.has(item.provider))
      .map((item) => {
        const capability = providerCapability(item.provider, capabilityList);
        const connector = providerConnector(item.provider, connectorList);
        const status = item.provider === "kaspi_pricing" ? "setup_required" : deriveProviderStatus({ capability, connector });
        const label = providerTitle(item.provider, t, capability);
        const primaryUse = t(item.primaryUseKey);
        return { ...item, capability, connector, label, primaryUse, status };
      })
      .filter((item) => {
        const matchesGroup = group === "all" || item.group === group;
        const matchesQuery = !normalizedQuery || [item.label, item.provider, item.primaryUse].join(" ").toLowerCase().includes(normalizedQuery);
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "connected" && ["active", "connected"].includes(item.status)) ||
          (statusFilter === "setup" && ["draft", "setup_required", "provider_configuring", "syncing"].includes(item.status)) ||
          (statusFilter === "request" && ["request", "pending_request"].includes(item.status)) ||
          (statusFilter === "planned" && ["roadmap", "soon"].includes(item.status)) ||
          (statusFilter === "error" && ["error", "failed", "needs_attention", "expired_credentials"].includes(item.status));
        return matchesGroup && matchesQuery && matchesStatus;
      });
  }, [capabilities.data, connectors.data, group, query, statusFilter, t]);

  const connectedCount = data.filter((item) => ["active", "connected"].includes(item.status)).length;
  const setupCount = data.filter((item) => ["draft", "setup_required", "provider_configuring"].includes(item.status)).length;
  const recommended = data.find((item) => !["active", "connected"].includes(item.status)) || data[0];
  const firstBot = (bots.data || [])[0];
  const agentChannelsPath = firstBot ? `/dashboard/ai-agents/${firstBot.id}/channels` : "/dashboard/ai-agents";

  if (isBusinessLoading || capabilities.isLoading || connectors.isLoading || bots.isLoading) {
    return <LoadingState label={t("integrations.page.loading")} />;
  }

  if (!business) {
    return <EmptyState title={t("integrations.page.noBusinessTitle")} description={t("integrations.page.noBusinessDescription")} />;
  }

  const pageError = capabilities.error || connectors.error || bots.error;

  return (
    <div>
      <section className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-midnight md:text-3xl">{t("integrations.overview.title")}</h1>
          <p className="mt-1 max-w-2xl text-base leading-6 text-slate-600">{t("integrations.overview.description")}</p>
        </div>
        <Link to="/dashboard/ai-assistant">
          <Button type="button" variant="secondary">
            <DatabaseZap size={16} /> {t("integrations.overview.openAnalysis")}
          </Button>
        </Link>
      </section>

      <section className="mb-8 rounded-2xl border border-brand-100 bg-white p-5 shadow-[0_4px_20px_rgba(0,47,108,0.04)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <Bot size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-midnight">{t("integrations.overview.agentChannelsTitle")}</h2>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                {t("integrations.overview.agentChannelsText")}
              </p>
            </div>
          </div>
          <Link to={agentChannelsPath} className="shrink-0">
            <Button type="button">
              <Bot size={16} /> {t("integrations.overview.openAgentChannels")}
            </Button>
          </Link>
        </div>
      </section>

      {pageError ? (
        <div className="mb-4">
          <ErrorState message={getApiErrorMessage(pageError)} />
        </div>
      ) : null}

      {recommended ? (
        <section className="mb-8 rounded-2xl border border-blue-200 bg-white p-6 shadow-[0_4px_20px_rgba(0,47,108,0.04)] [background:linear-gradient(120deg,#fff_0%,#fff_55%,#eef2ff_100%)]">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-lg">
                <Sparkles size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-midnight">{t("integrations.overview.recommendedTitle")}</h2>
                <p className="mt-1 max-w-3xl text-base leading-6 text-slate-600">
                  {t("integrations.overview.recommendedText", { provider: recommended.label })}
                </p>
              </div>
            </div>
            <Button
              className="shrink-0"
              disabled={!canManage}
              onClick={() => {
                setQuery(recommended.label);
                setGroup(recommended.group);
                setStatusFilter("all");
              }}
            >
              {t("integrations.overview.connectNow")}
            </Button>
          </div>
        </section>
      ) : null}

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_20px_rgba(0,47,108,0.04)]">
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <Select
            value={group}
            onChange={(event) => setGroup(event.target.value as ProviderGroup | "all")}
            options={[
	              { value: "all", label: t("integrations.overview.allGroups") },
	              { value: "data", label: t(groupLabels.data.titleKey) },
	              { value: "marketplace", label: t(groupLabels.marketplace.titleKey) },
	              { value: "system", label: t(groupLabels.system.titleKey) },
            ]}
          />
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            options={statusFilterOptions}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="mb-6 space-y-5">
          {providerGroups.map((groupKey) => {
            const items = data.filter((item) => item.group === groupKey);
            if (!items.length) return null;
            return (
              <div key={groupKey}>
                <div className="mb-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">{t(groupLabels[groupKey].titleKey)}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{t(groupLabels[groupKey].textKey)}</p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {items.map((item) => (
                    <ProviderCard
                      key={item.provider}
                      businessId={business.id}
                      bots={bots.data || []}
	                      canManage={canManage}
	                      capability={item.capability}
	                      connector={item.connector}
	                      provider={item}
	                    />
                  ))}
                </div>
              </div>
            );
          })}
          {!data.length ? (
            <EmptyState title={t("integrations.overview.emptyTitle")} description={t("integrations.overview.emptyText")} />
          ) : null}
        </section>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
                <SlidersHorizontal size={18} />
              </div>
              <div>
                <p className="font-black text-midnight">{t("integrations.overview.guideTitle")}</p>
                <p className="text-xs font-bold text-slate-500">{t("integrations.overview.guideMeta", { connected: connectedCount, setup: setupCount })}</p>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm font-semibold leading-6 text-slate-600">
              <p>{t("integrations.overview.guideStep1")}</p>
              <p>{t("integrations.overview.guideStep2")}</p>
              <p>{t("integrations.overview.guideStep3")}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-black text-midnight">{t("integrations.overview.simpleTitle")}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              {t("integrations.overview.simpleText")}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
