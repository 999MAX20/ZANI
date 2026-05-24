import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Headphones, MessageSquarePlus, RefreshCw, ShieldAlert, Store } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { platformApi } from "../../api/platform";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Textarea } from "../../components/ui/Textarea";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

function statusClass(status?: string | null) {
  if (status === "healthy" || status === "active") return "border-emerald-100 bg-emerald-50 text-emerald-700";
  if (status === "setup" || status === "trial") return "border-violet-100 bg-violet-50 text-violet-700";
  if (status === "attention" || status === "medium") return "border-amber-100 bg-amber-50 text-amber-700";
  if (status === "risk" || status === "high" || status === "blocked") return "border-red-100 bg-red-50 text-red-700";
  return "border-slate-100 bg-slate-50 text-slate-600";
}

export function PlatformMerchantDetailPage() {
  const { t, language } = useI18n();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [actionType, setActionType] = useState("support_note");
  const locale = language === "kk" ? "kk-KZ" : language === "en" ? "en-US" : "ru-RU";
  const actionOptions = [
    { value: "support_note", label: t("platform.merchantDetail.actionSupportNote") },
    { value: "merchant_call", label: t("platform.merchantDetail.actionMerchantCall") },
    { value: "setup_help", label: t("platform.merchantDetail.actionSetupHelp") },
    { value: "risk_review", label: t("platform.merchantDetail.actionRiskReview") },
  ];
  const merchant = useQuery({
    queryKey: ["platform-merchant", id],
    queryFn: () => platformApi.merchant(id || ""),
    enabled: Boolean(id),
  });
  const supportMutation = useMutation({
    mutationFn: () => platformApi.createSupportAction(id || "", { action_type: actionType, note }),
    onSuccess: () => {
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["platform-merchant", id] });
      queryClient.invalidateQueries({ queryKey: ["platform-merchants"] });
      queryClient.invalidateQueries({ queryKey: ["platform-overview"] });
    },
  });

  if (merchant.isLoading) return <LoadingState label={t("platform.merchantDetail.loading")} />;
  if (merchant.isError || !merchant.data) return <ErrorState message={t("platform.merchantDetail.error")} />;

  const data = merchant.data;
  const workflow = data.support_workflow;
  const operations = data.operations;
  const health = data.health;

  return (
    <div className="space-y-5">
      <section className="glass-panel rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link to="/platform/merchants" className="inline-flex items-center gap-2 text-sm font-black text-brand-700 hover:text-brand-900">
              <ArrowLeft size={16} /> {t("platform.nav.merchants")}
            </Link>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{t("platform.merchantDetail.eyebrow")}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-midnight sm:text-5xl">{data.name}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
              {t("platform.merchantDetail.description")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={cn("inline-flex rounded-full border px-4 py-2 text-sm font-black", statusClass(data.status))}>{data.status}</span>
            <span className={cn("inline-flex rounded-full border px-4 py-2 text-sm font-black", statusClass(health?.status))}>
              {health?.status || t("platform.common.unknown")} · {health?.score ?? 0}%
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Store className="text-brand-600" size={21} />
              <p className="text-lg font-black text-midnight">{t("platform.merchantDetail.snapshot")}</p>
            </div>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("platform.merchantDetail.owner")}</p>
              <p className="mt-2 font-bold text-midnight">{data.owner.full_name || t("platform.common.noName")}</p>
              <p className="mt-1 text-sm text-slate-500">{data.owner.email}</p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("platform.merchantDetail.landing")}</p>
              <p className="mt-2 font-bold text-midnight">{data.landing_domain || t("platform.merchantDetail.notConnected")}</p>
              <p className="mt-1 text-sm text-slate-500">{data.landing_id || t("platform.merchantDetail.noLandingId")}</p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("platform.merchantDetail.crmOperations")}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                {t("platform.merchantDetail.leadsLine", { leads: operations?.lead_count ?? 0, new: operations?.new_leads ?? 0 })}<br />
                {t("platform.merchantDetail.clientsLine", { clients: operations?.clients_count ?? 0, tasks: operations?.open_tasks ?? 0 })}<br />
                {t("platform.merchantDetail.inboxLine", { unread: operations?.unread_conversations ?? 0, handoff: operations?.handoff_conversations ?? 0 })}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("platform.merchantDetail.dataSources")}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                {t("platform.merchantDetail.connectorsLine", { ok: operations?.connected_connectors ?? 0, pending: operations?.pending_connectors ?? 0, failed: operations?.failed_connectors ?? 0 })}<br />
                {t("platform.merchantDetail.formsLine", { forms: operations?.lead_forms ?? 0, errors: operations?.form_errors ?? 0 })}<br />
                {t("platform.merchantDetail.salesEventsLine", { events: operations?.sales_events ?? 0 })}
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldAlert className={health?.status === "risk" ? "text-red-600" : "text-amber-600"} size={21} />
              <p className="text-lg font-black text-midnight">{t("platform.merchantDetail.pilotHealth")}</p>
            </div>
          </CardHeader>
          <CardBody>
            <p className="text-sm leading-6 text-slate-600">{health?.next_action || t("platform.merchantDetail.monitorPilot")}</p>
            <div className="mt-4 space-y-2">
              {(health?.blockers || []).map((blocker) => (
                <div key={blocker} className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                  {blocker}
                </div>
              ))}
              {!health?.blockers?.length ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                  {t("platform.merchantDetail.noBlockers")}
                </div>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Headphones className="text-brand-600" size={21} />
              <p className="text-lg font-black text-midnight">{t("platform.merchantDetail.supportWorkflow")}</p>
            </div>
          </CardHeader>
          <CardBody>
            <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase", statusClass(workflow?.priority))}>
              {t("platform.merchantDetail.priority", { priority: workflow?.priority || "low" })}
            </span>
            <p className="mt-4 text-sm leading-6 text-slate-600">{workflow?.summary || t("platform.merchantDetail.emptyWorkflow")}</p>
            <div className="mt-4 space-y-2">
              {(workflow?.next_steps || []).map((step) => (
                <Link key={step.key} to={step.href} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm font-bold text-midnight transition hover:bg-white hover:shadow-soft">
                  {step.label}
                  <CheckCircle2 size={16} className="text-brand-600" />
                </Link>
              ))}
              {!workflow?.next_steps?.length ? <EmptyState title={t("platform.merchantDetail.noNextSteps")} description={t("platform.merchantDetail.noNextStepsText")} /> : null}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <MessageSquarePlus className="text-brand-600" size={21} />
              <p className="text-lg font-black text-midnight">{t("platform.merchantDetail.logSupportAction")}</p>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
              <Select value={actionType} onChange={(event) => setActionType(event.target.value)} options={actionOptions} />
              <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("platform.merchantDetail.notePlaceholder")} />
            </div>
            <Textarea className="mt-3" value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("platform.merchantDetail.noteTextarea")} />
            {supportMutation.isError ? <ErrorState message={getApiErrorMessage(supportMutation.error)} /> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => supportMutation.mutate()} isLoading={supportMutation.isPending} disabled={!note.trim()}>
                <MessageSquarePlus size={16} /> {t("platform.merchantDetail.saveAction")}
              </Button>
              <Button variant="secondary" onClick={() => merchant.refetch()} isLoading={merchant.isFetching}>
                <RefreshCw size={16} /> {t("platform.merchantDetail.refresh")}
              </Button>
            </div>
            <div className="mt-5 space-y-2">
              {(workflow?.recent_actions || []).map((action) => (
                <div key={action.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-midnight">{action.action_type}</p>
                    <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-500">{action.status}</span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{action.note}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-400">{action.actor_email || t("platform.title")} · {new Date(action.created_at).toLocaleString(locale)}</p>
                </div>
              ))}
              {!workflow?.recent_actions?.length ? (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                  {t("platform.merchantDetail.noRecentActions")}
                </p>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
