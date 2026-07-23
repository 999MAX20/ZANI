import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PlugZap, Search } from "lucide-react";

import { botsApi } from "../../api/bots";
import { businessConnectorsApi } from "../../api/connectors";
import { getApiErrorMessage } from "../../api/client";
import {
  WorkbenchLayout,
  WorkbenchMetric,
} from "../../components/layout/WorkbenchLayout";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { Surface } from "../../components/ui/Card";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useI18n } from "../../lib/i18n";
import { hasPermission } from "../../lib/permissions";
import type { BusinessConnector, ConnectorCapability } from "../../types";
import { useAuth } from "../auth/AuthProvider";
import { ProviderCard } from "./components/ProviderCard";
import { groupLabels, providerCatalog, type ProviderGroup, type ProviderKey } from "./config/providerCatalog";

type Translate = ReturnType<typeof useI18n>["t"];
type IntegrationStatusFilter = "all" | "connected" | "setup" | "request" | "planned" | "error";

const agentChannelProviders = new Set<ProviderKey>(["website", "telegram", "whatsapp", "instagram"]);
const providerGroups: ProviderGroup[] = ["data", "marketplace", "system"];
const statusFilters: IntegrationStatusFilter[] = ["all", "connected", "setup", "request", "planned", "error"];

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

function statusFilterFor(status: string): Exclude<IntegrationStatusFilter, "all"> {
  if (["connected", "active", "succeeded", "processed"].includes(status)) return "connected";
  if (["setup_required", "needs_attention", "draft", "syncing", "disabled", "disconnected"].includes(status)) return "setup";
  if (["pending_request", "provider_configuring", "request"].includes(status)) return "request";
  if (["roadmap", "soon"].includes(status)) return "planned";
  return "error";
}

export function IntegrationsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { business, isLoading: isBusinessLoading } = useActiveBusiness();
  const canManage = hasPermission(user, business?.id, "integrations", "manage");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<IntegrationStatusFilter>("all");
  const [groupFilter, setGroupFilter] = useState<ProviderGroup | "all">("all");

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
    return providerCatalog
      .filter((item) => !agentChannelProviders.has(item.provider))
      .map((item) => {
        const capability = providerCapability(item.provider, capabilityList);
        const connector = providerConnector(item.provider, connectorList);
        const status = item.provider === "kaspi_pricing" ? "setup_required" : deriveProviderStatus({ capability, connector });
        const label = providerTitle(item.provider, t, capability);
        const primaryUse = t(item.primaryUseKey);
        return { ...item, capability, connector, label, primaryUse, status };
      });
  }, [capabilities.data, connectors.data, t]);
  const visibleData = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return data.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        item.label.toLowerCase().includes(normalizedQuery) ||
        item.primaryUse.toLowerCase().includes(normalizedQuery);
      const matchesStatus =
        statusFilter === "all" || statusFilterFor(item.status) === statusFilter;
      const matchesGroup = groupFilter === "all" || item.group === groupFilter;
      return matchesQuery && matchesStatus && matchesGroup;
    });
  }, [data, groupFilter, query, statusFilter]);

  const connectedCount = data.filter((item) => statusFilterFor(item.status) === "connected").length;
  const setupCount = data.filter((item) => statusFilterFor(item.status) === "setup").length;
  const requestCount = data.filter((item) => statusFilterFor(item.status) === "request").length;
  const plannedCount = data.filter((item) => statusFilterFor(item.status) === "planned").length;

  if (isBusinessLoading || capabilities.isLoading || connectors.isLoading || bots.isLoading) {
    return <LoadingState label={t("integrations.page.loading")} />;
  }

  if (!business) {
    return <EmptyState title={t("integrations.page.noBusinessTitle")} description={t("integrations.page.noBusinessDescription")} />;
  }

  const pageError = capabilities.error || connectors.error || bots.error;

  return (
    <WorkbenchLayout
      header={
        <PageHeader
          title={t("integrations.page.title")}
          description={t("integrations.page.description")}
          actions={
            <Badge variant="primary" size="lg">
              <PlugZap size={14} /> {t("integrations.page.safeTokenNotice")}
            </Badge>
          }
        />
      }
      metrics={
        <>
          <WorkbenchMetric label={t("integrations.page.connectedTitle")} value={connectedCount} detail={t("integrations.page.connectedText")} tone="success" />
          <WorkbenchMetric label={t("integrations.overview.status.setup")} value={setupCount} detail={t("integrations.page.includedText")} tone="warning" />
          <WorkbenchMetric label={t("integrations.page.requestTitle")} value={requestCount} detail={t("integrations.page.requestText")} tone="ai" />
          <WorkbenchMetric label={t("integrations.page.roadmapTitle")} value={plannedCount} detail={t("integrations.page.roadmapText")} />
        </>
      }
      toolbar={
        <>
          <div className="min-w-0 flex-1">
            <Input
              aria-label={t("integrations.overview.searchPlaceholder")}
              leftIcon={<Search size={16} />}
              placeholder={t("integrations.overview.searchPlaceholder")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            {statusFilters.map((status) => (
              <Button
                key={status}
                type="button"
                size="sm"
                variant={statusFilter === status ? "primary" : "secondary"}
                onClick={() => setStatusFilter(status)}
              >
                {t(`integrations.overview.status.${status}`)}
              </Button>
            ))}
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            {(["all", ...providerGroups] as Array<ProviderGroup | "all">).map((group) => (
              <Button
                key={group}
                type="button"
                size="sm"
                variant={groupFilter === group ? "primary" : "ghost"}
                onClick={() => setGroupFilter(group)}
              >
                {group === "all" ? t("integrations.overview.allGroups") : t(groupLabels[group].titleKey)}
              </Button>
            ))}
            {(query || statusFilter !== "all" || groupFilter !== "all") ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                  setGroupFilter("all");
                }}
              >
                {t("integrations.page.reset")}
              </Button>
            ) : null}
          </div>
        </>
      }
    >
      <div className="space-y-5 p-3 sm:p-4">
        {pageError ? <ErrorState message={getApiErrorMessage(pageError)} /> : null}
        <Surface padding="sm" variant="muted" className="text-sm font-semibold text-zani-subtle">
          {t("integrations.page.resultsMeta", {
            count: visibleData.length,
            total: data.length,
          })}
        </Surface>
        {providerGroups.map((groupKey) => {
          const items = visibleData.filter((item) => item.group === groupKey);
          if (!items.length) return null;
          return (
            <div key={groupKey}>
              <div>
                <div className="mb-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">{t(groupLabels[groupKey].titleKey)}</p>
                  <p className="mt-1 text-sm font-semibold text-zani-subtle">{t(groupLabels[groupKey].textKey)}</p>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
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
            </div>
          );
        })}
        {!visibleData.length ? (
          <EmptyState title={t("integrations.overview.emptyTitle")} description={t("integrations.overview.emptyText")} />
        ) : null}
      </div>
    </WorkbenchLayout>
  );
}
