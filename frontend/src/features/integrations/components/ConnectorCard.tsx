import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Link2, LockKeyhole, PlugZap, Send, ShieldCheck } from "lucide-react";

import { getApiErrorMessage } from "../../../api/client";
import { businessConnectorsApi } from "../../../api/connectors";
import { Button } from "../../../components/ui/Button";
import { ErrorState } from "../../../components/ui/StateViews";
import { useI18n } from "../../../lib/i18n";
import type { BusinessConnector, ConnectorCapability, Id } from "../../../types";

function availabilityLabel(availability: string, t: (key: string) => string) {
  return t(`integrations.availability.${availability}`) || availability;
}

function planLabel(plan: string) {
  const labels: Record<string, string> = {
    basic: "Basic",
    business: "Business",
    pro: "Pro",
  };
  return labels[plan] || plan;
}

function setupStateLabel(state: string, t: (key: string) => string) {
  return t(`integrations.setupState.${state}`) || state;
}

function merchantStatus(connector: BusinessConnector | undefined, capability: ConnectorCapability) {
  if (connector?.status === "connected") return "connected";
  if (connector?.status === "failed" || connector?.status === "error" || connector?.status === "expired_credentials") return "error";
  if (connector?.status === "disabled" || connector?.status === "disconnected") return "disconnected";
  if (connector?.status === "pending_request" || connector?.status === "provider_configuring") return "pending_request";
  if (connector?.status === "setup_required") return "setup_required";
  if (connector?.status === "needs_attention" && capability.action_behavior === "request") return "pending_request";
  if (connector?.status === "needs_attention" || connector?.status === "draft" || connector?.status === "syncing") return "setup_required";
  if (capability.availability === "upgrade") return "unavailable_on_plan";
  if (["soon", "roadmap"].includes(capability.availability) || ["coming_soon", "roadmap"].includes(capability.setup_state)) return "coming_soon";
  return "available";
}

function merchantStatusUi(status: string, t: (key: string) => string) {
  const classes: Record<string, string> = {
    available: "bg-blue-50 text-blue-700 ring-blue-100",
    connected: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    setup_required: "bg-amber-50 text-amber-700 ring-amber-100",
    pending_request: "bg-violet-50 text-violet-700 ring-violet-100",
    coming_soon: "bg-slate-100 text-slate-700 ring-slate-200",
    unavailable_on_plan: "bg-amber-50 text-amber-700 ring-amber-100",
    error: "bg-red-50 text-red-700 ring-red-100",
    disconnected: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  return { label: t(`integrations.merchantStatus.${status}`) || status, className: classes[status] || classes.coming_soon };
}

function connectorActionHint(capability: ConnectorCapability, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (capability.action_behavior === "self_service") {
    return t("integrations.connectorHint.selfService");
  }
  if (capability.action_behavior === "request") {
    return t("integrations.connectorHint.request");
  }
  if (capability.availability === "upgrade") {
    return t("integrations.connectorHint.upgrade", { plan: planLabel(capability.required_plan) });
  }
  return t("integrations.connectorHint.roadmap");
}

function connectorTitle(capability: ConnectorCapability, t: (key: string) => string) {
  return t(`integrations.capability.${capability.capability}`) || capability.capability;
}

function connectorActionLabel(capability: ConnectorCapability, t: (key: string) => string, connector?: BusinessConnector) {
  if (connector) {
    if (connector.status === "disabled") return t("integrations.action.reconnect");
    if (connector.status === "connected") return t("integrations.action.connected");
    return capability.action_behavior === "request" ? t("integrations.action.requestSent") : t("integrations.action.continueSetup");
  }
  return capability.primary_action_label || capability.cta_label || t("integrations.action.create");
}

function connectorSetupMessage(capability: ConnectorCapability, t: (key: string) => string, connector?: BusinessConnector) {
  if (connector?.status === "connected") {
    return t("integrations.setupMessage.connected");
  }
  if (connector?.status === "needs_attention" || connector?.status === "pending_request" || connector?.status === "setup_required" || connector?.status === "provider_configuring") {
    return t("integrations.setupMessage.needsAttention");
  }
  if (connector?.status === "disabled") {
    return t("integrations.setupMessage.disabled");
  }
  return capability.next_step;
}

export function ConnectorCard({
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
  const { t } = useI18n();

  const createConnector = useMutation({
    mutationFn: () =>
      businessConnectorsApi.create({
        business: businessId,
        provider: capability.provider,
        name: capability.label,
        capability: capability.capability,
        auth_type: capability.auth_type,
        scopes_json: [],
        config_json: {
          requested_from_ui: capability.action_behavior === "request",
          availability: capability.availability,
          required_plan: capability.required_plan,
          setup_state: capability.setup_state,
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["business-connectors"] }),
  });

  const disconnect = useMutation({
    mutationFn: () => {
      if (!connector) throw new Error("Connector is required.");
      return businessConnectorsApi.disconnect(connector.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["business-connectors"] }),
  });

  const error = createConnector.error || disconnect.error;
  const isConnected = connector?.status === "connected";
  const isSelfService = capability.action_behavior === "self_service";
  const isRequestOnly = capability.action_behavior === "request";
  const isRoadmapOnly = !isSelfService && !isRequestOnly;
  const primaryLabel = connectorActionLabel(capability, t, connector);
  const statusUi = merchantStatusUi(merchantStatus(connector, capability), t);

  return (
    <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-soft backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-brand-600">
            {isConnected ? <ShieldCheck size={22} /> : <PlugZap size={22} />}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-black text-midnight">{capability.label}</p>
            <p className="mt-1 text-sm text-slate-500">{connectorTitle(capability, t)}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ring-1 ${statusUi.className}`}>
          {statusUi.label}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600">{capability.description}</p>

      {connector?.last_error ? (
        <div className="mt-4 flex gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 shrink-0" size={16} />
          <span>{connector.last_error}</span>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{t("integrations.card.businessValue")}</p>
          <p className="mt-1 font-semibold text-midnight">{connectorTitle(capability, t)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{t("integrations.card.plan")}</p>
          <p className="mt-1 font-semibold text-midnight">{availabilityLabel(capability.availability, t)} · {planLabel(capability.required_plan)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{t("integrations.card.connection")}</p>
          <p className="mt-1 font-semibold text-midnight">{setupStateLabel(capability.setup_state, t)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{t("integrations.card.ownerAction")}</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{connectorSetupMessage(capability, t, connector)}</p>
        <p className="mt-2 text-xs font-semibold text-slate-500">{connectorActionHint(capability, t)}</p>
        {capability.pilot_note ? <p className="mt-2 text-xs font-semibold text-slate-500">{capability.pilot_note}</p> : null}
      </div>

      {canManage ? (
        <div className="mt-5 space-y-3">
          {!connector ? (
            <div className="space-y-2">
              <Button
                onClick={() => (isSelfService || isRequestOnly) && createConnector.mutate()}
                isLoading={createConnector.isPending}
                disabled={isRoadmapOnly}
                variant={isRequestOnly ? "secondary" : "primary"}
              >
                {isRequestOnly ? <Send size={16} /> : isRoadmapOnly ? <LockKeyhole size={16} /> : <Link2 size={16} />} {primaryLabel}
              </Button>
              {isRequestOnly ? (
                <p className="rounded-2xl bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700">
                  {t("integrations.card.requestNotice")}
                </p>
              ) : null}
              {isRoadmapOnly ? (
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
                  {t("integrations.card.roadmapNotice")}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              {connector.status !== "connected" ? (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  {t("integrations.card.pendingNotice")}
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  {t("integrations.card.connectedNotice")}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" disabled>
                  <CheckCircle2 size={16} /> {primaryLabel}
                </Button>
                <Button variant="ghost" onClick={() => disconnect.mutate()} isLoading={disconnect.isPending}>
                  {t("integrations.action.disconnect")}
                </Button>
              </div>
            </>
          )}
          {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
        </div>
      ) : (
        <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
          {t("integrations.card.readOnly")}
        </p>
      )}
    </div>
  );
}
