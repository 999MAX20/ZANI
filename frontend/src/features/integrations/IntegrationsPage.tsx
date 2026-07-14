import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { botsApi } from "../../api/bots";
import { businessConnectorsApi } from "../../api/connectors";
import { getApiErrorMessage } from "../../api/client";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useI18n } from "../../lib/i18n";
import { hasPermission } from "../../lib/permissions";
import type { BusinessConnector, ConnectorCapability } from "../../types";
import { useAuth } from "../auth/AuthProvider";
import { ProviderCard } from "./components/ProviderCard";
import { groupLabels, providerCatalog, type ProviderGroup, type ProviderKey } from "./config/providerCatalog";

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

  if (isBusinessLoading || capabilities.isLoading || connectors.isLoading || bots.isLoading) {
    return <LoadingState label={t("integrations.page.loading")} />;
  }

  if (!business) {
    return <EmptyState title={t("integrations.page.noBusinessTitle")} description={t("integrations.page.noBusinessDescription")} />;
  }

  const pageError = capabilities.error || connectors.error || bots.error;

  return (
    <div>
      {pageError ? (
        <div className="mb-4">
          <ErrorState message={getApiErrorMessage(pageError)} />
        </div>
      ) : null}

      <section className="mb-6 space-y-5">
        {providerGroups.map((groupKey) => {
          const items = data.filter((item) => item.group === groupKey);
          if (!items.length) return null;
          return (
            <div key={groupKey}>
              <div className="mx-auto max-w-[1052px]">
                <div className="mb-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">{t(groupLabels[groupKey].titleKey)}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{t(groupLabels[groupKey].textKey)}</p>
                </div>
                <div className="grid justify-center gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),520px))]">
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
        {!data.length ? (
          <EmptyState title={t("integrations.overview.emptyTitle")} description={t("integrations.overview.emptyText")} />
        ) : null}
      </section>
    </div>
  );
}
