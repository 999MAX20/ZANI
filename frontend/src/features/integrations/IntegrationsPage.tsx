import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, KeyRound, Link2, PlugZap, RefreshCw, ShieldCheck, Unplug } from "lucide-react";

import { businessConnectorsApi, connectorCredentialsApi } from "../../api/connectors";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { Input } from "../../components/ui/Input";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useAuth } from "../auth/AuthProvider";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { hasPermission } from "../../lib/permissions";
import type { BusinessConnector, ConnectorCapability, Id } from "../../types";

function connectorTitle(capability: ConnectorCapability) {
  const labels: Record<string, string> = {
    communications: "Коммуникации",
    sales: "Продажи",
    calendar: "Календарь",
    finance: "Финансы",
    inventory: "Склад",
    marketing: "Маркетинг",
    custom: "Кастом",
  };
  return labels[capability.capability] || capability.capability;
}

function ConnectorCard({
  capability,
  connector,
  businessId,
  canManage,
}: {
  capability: ConnectorCapability;
  connector?: BusinessConnector;
  businessId: Id;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [secret, setSecret] = useState("");
  const [secretKey, setSecretKey] = useState("access_token");

  const createConnector = useMutation({
    mutationFn: () =>
      businessConnectorsApi.create({
        business: businessId,
        provider: capability.provider,
        name: capability.label,
        capability: capability.capability,
        auth_type: capability.auth_type,
        scopes_json: [],
        config_json: {},
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["business-connectors"] }),
  });

  const saveCredential = useMutation({
    mutationFn: () => {
      if (!connector) throw new Error("Connector is required.");
      return connectorCredentialsApi.create({ connector: connector.id, key: secretKey, value: secret });
    },
    onSuccess: () => {
      setSecret("");
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const healthCheck = useMutation({
    mutationFn: () => {
      if (!connector) throw new Error("Connector is required.");
      return businessConnectorsApi.healthCheck(connector.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["business-connectors"] }),
  });

  const disconnect = useMutation({
    mutationFn: () => {
      if (!connector) throw new Error("Connector is required.");
      return businessConnectorsApi.disconnect(connector.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["business-connectors"] }),
  });

  const error = createConnector.error || saveCredential.error || healthCheck.error || disconnect.error;
  const isConnected = connector?.status === "connected";

  return (
    <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-soft backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-brand-600">
            {isConnected ? <ShieldCheck size={22} /> : <PlugZap size={22} />}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-black text-midnight">{capability.label}</p>
            <p className="mt-1 text-sm text-slate-500">{connectorTitle(capability)} · {capability.auth_type}</p>
          </div>
        </div>
        {connector ? <StatusBadge status={connector.status} /> : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">Не подключен</span>}
      </div>

      {connector?.last_error ? (
        <div className="mt-4 flex gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 shrink-0" size={16} />
          <span>{connector.last_error}</span>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Provider</p>
          <p className="mt-1 font-semibold text-midnight">{capability.provider}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Credentials</p>
          <p className="mt-1 font-semibold text-midnight">{connector?.credentials_count || 0}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Last sync</p>
          <p className="mt-1 font-semibold text-midnight">{connector?.last_sync_at ? new Date(connector.last_sync_at).toLocaleString() : "Нет"}</p>
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Рекомендуемый запуск</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {isConnected
            ? "Коннектор создан. Проверьте health status, затем подключайте события через automation и inbox."
            : "Начните с создания коннектора без секрета. Реальные ключи добавляйте только после проверки прав и источника токена."}
        </p>
      </div>

      {canManage ? (
        <div className="mt-5 space-y-3">
          {!connector ? (
            <Button onClick={() => createConnector.mutate()} isLoading={createConnector.isPending}>
              <Link2 size={16} /> Создать коннектор
            </Button>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
                <Select
                  value={secretKey}
                  onChange={(event) => setSecretKey(event.target.value)}
                  options={[
                    { value: "access_token", label: "Access token" },
                    { value: "webhook_secret", label: "Webhook secret" },
                    { value: "refresh_token", label: "Refresh token" },
                    { value: "api_key", label: "API key" },
                  ]}
                />
                <Input
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  placeholder="Секрет не будет показан после сохранения"
                  type="password"
                />
                <Button onClick={() => saveCredential.mutate()} disabled={!secret} isLoading={saveCredential.isPending}>
                  <KeyRound size={16} /> Сохранить
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => healthCheck.mutate()} isLoading={healthCheck.isPending}>
                  <RefreshCw size={16} /> Health check
                </Button>
                <Button variant="ghost" onClick={() => disconnect.mutate()} isLoading={disconnect.isPending}>
                  <Unplug size={16} /> Отключить
                </Button>
              </div>
            </>
          )}
          {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
        </div>
      ) : (
        <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
          Роль позволяет просматривать интеграции, но не управлять подключениями.
        </p>
      )}
    </div>
  );
}

export function IntegrationsPage() {
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

  const connectorByProvider = useMemo(() => {
    const map = new Map<string, BusinessConnector>();
    (connectors.data || []).forEach((connector) => map.set(connector.provider, connector));
    return map;
  }, [connectors.data]);

  if (isBusinessLoading || capabilities.isLoading || connectors.isLoading) {
    return <LoadingState label="Загружаем интеграции..." />;
  }

  if (!business) {
    return <EmptyState title="Бизнес не выбран" description="Создайте бизнес, чтобы подключать каналы и внешние сервисы." />;
  }

  return (
    <div>
      <PageHeader
        title="Интеграции"
        description="Единая панель подключений: каналы, внешние сервисы, health status и безопасное хранение ключей без показа raw credentials."
        actions={
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="mr-2 inline" size={16} />
            Секреты маскируются в API
          </div>
        }
      />

      {capabilities.error || connectors.error ? <ErrorState message={getApiErrorMessage(capabilities.error || connectors.error)} /> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {(capabilities.data || []).map((capability) => (
          <ConnectorCard
            key={capability.provider}
            capability={capability}
            connector={connectorByProvider.get(capability.provider)}
            businessId={business.id}
            canManage={canManage}
          />
        ))}
      </div>
    </div>
  );
}
