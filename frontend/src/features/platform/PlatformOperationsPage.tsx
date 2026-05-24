import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, CircleDot, PlugZap, ServerCog, ShieldCheck, Workflow } from "lucide-react";
import { Link } from "react-router-dom";

import { asArray } from "../../api/client";
import { platformApi } from "../../api/platform";
import { Card, CardBody } from "../../components/ui/Card";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { cn } from "../../lib/cn";

function statusTone(status: string) {
  if (["healthy", "ready", "pass"].includes(status)) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (["warning", "warn"].includes(status)) return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-red-50 text-red-700 border-red-100";
}

function StatusPill({ status }: { status: string }) {
  return <span className={cn("rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.12em]", statusTone(status))}>{status}</span>;
}

function EmptyLine({ label }: { label: string }) {
  return <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">{label}</p>;
}

export function PlatformOperationsPage() {
  const health = useQuery({ queryKey: ["platform-operations-health"], queryFn: platformApi.operationsHealth });

  if (health.isLoading) return <LoadingState label="Загружаем operations health..." />;
  if (health.isError || !health.data) return <ErrorState message="Не удалось загрузить operations health." />;

  const data = health.data;
  const productionFailedItems = asArray<typeof data.runtime.production_readiness.failed_items[number]>(data.runtime.production_readiness.failed_items);
  const backupFailedItems = asArray<typeof data.runtime.backup_readiness.failed_items[number]>(data.runtime.backup_readiness.failed_items);
  const providerRolloutItems = asArray<typeof data.runtime.provider_rollout.providers[number]>(data.runtime.provider_rollout.providers);
  const queueNames = asArray<string>(data.runtime.queue.queues);
  const connectorRequests = asArray<typeof data.work_queue.connector_requests[number]>(data.work_queue.connector_requests);
  const failedAutomationRuns = asArray<typeof data.work_queue.failed_automation_runs[number]>(data.work_queue.failed_automation_runs);
  const failedIntegrationEvents = asArray<typeof data.work_queue.failed_integration_events[number]>(data.work_queue.failed_integration_events);
  const failedItems = [
    ...productionFailedItems,
    ...backupFailedItems,
  ].slice(0, 8);

  return (
    <div className="space-y-5">
      <section className="glass-panel rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Support operations</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-midnight sm:text-5xl">Operations health</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
              Единая панель для ответа на вопрос: что сломалось у мерча, где очередь, какой провайдер нельзя включать и что требует саппорта.
            </p>
          </div>
          <StatusPill status={data.status} />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardBody className="p-5">
            <AlertTriangle className="text-red-600" size={22} />
            <p className="mt-4 text-3xl font-black text-midnight">{data.summary.critical}</p>
            <p className="text-sm font-semibold text-slate-500">Critical blockers</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-5">
            <CircleDot className="text-amber-600" size={22} />
            <p className="mt-4 text-3xl font-black text-midnight">{data.summary.warning}</p>
            <p className="text-sm font-semibold text-slate-500">Warnings</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-5">
            <ShieldCheck className="text-brand-600" size={22} />
            <p className="mt-4 text-3xl font-black text-midnight">{data.summary.active_support_grants}</p>
            <p className="text-sm font-semibold text-slate-500">Active support grants</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-5">
            <PlugZap className="text-violet-600" size={22} />
            <p className="mt-4 text-3xl font-black text-midnight">{data.summary.connector_requests}</p>
            <p className="text-sm font-semibold text-slate-500">Connector work items</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardBody className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-midnight">Queue runtime</h2>
                <p className="mt-1 text-sm text-slate-500">Celery/Redis readiness and failed background work.</p>
              </div>
              <StatusPill status={data.runtime.queue.status} />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <ServerCog size={20} className="text-brand-600" />
                <p className="mt-3 text-2xl font-black text-midnight">{data.runtime.queue.automation_runs.pending}</p>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Pending</p>
              </div>
              <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <Workflow size={20} className="text-amber-600" />
                <p className="mt-3 text-2xl font-black text-midnight">{data.runtime.queue.automation_runs.running}</p>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Running</p>
              </div>
              <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <AlertTriangle size={20} className="text-red-600" />
                <p className="mt-3 text-2xl font-black text-midnight">{data.runtime.queue.automation_runs.failed}</p>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Failed</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Broker: {data.runtime.queue.broker_configured ? "configured" : "not configured"} · Inline automations: {String(data.runtime.queue.automation_inline)} · Queues: {queueNames.join(", ") || "none"}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-6">
            <h2 className="text-xl font-black text-midnight">Production gates</h2>
            <p className="mt-1 text-sm text-slate-500">Самые важные блокеры из production readiness и backup readiness.</p>
            <div className="mt-5 space-y-3">
              {failedItems.length ? failedItems.map((item) => (
                <div key={item.key} className="rounded-3xl border border-red-100 bg-red-50/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-red-900">{item.title || item.key}</p>
                    <StatusPill status={item.status} />
                  </div>
                  <p className="mt-2 text-sm text-red-800">{item.detail}</p>
                  <p className="mt-2 text-xs font-semibold text-red-700">{item.action}</p>
                </div>
              )) : <EmptyLine label="Критичных production blockers нет." />}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="p-6">
          <h2 className="text-xl font-black text-midnight">Provider rollout</h2>
          <p className="mt-1 text-sm text-slate-500">Порядок безопасного включения внешних провайдеров.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {providerRolloutItems.map((provider) => (
              <div key={provider.provider} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">#{provider.order} {provider.provider}</p>
                    <h3 className="mt-1 font-black text-midnight">{provider.title}</h3>
                  </div>
                  <StatusPill status={provider.status} />
                </div>
                <p className="mt-3 text-sm text-slate-500">Enabled: {String(provider.enabled)}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardBody className="p-6">
            <h2 className="text-lg font-black text-midnight">Connector queue</h2>
            <div className="mt-4 space-y-3">
              {connectorRequests.length ? connectorRequests.map((item) => (
                <Link key={item.id} to={`/platform/merchants/${item.business_id}`} className="block rounded-3xl border border-slate-100 bg-slate-50 p-4 transition hover:border-brand-200 hover:bg-white">
                  <p className="font-black text-midnight">{item.business_name}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.provider} · {item.status}</p>
                  {item.last_error ? <p className="mt-2 text-xs font-semibold text-red-600">{item.last_error}</p> : null}
                </Link>
              )) : <EmptyLine label="Нет connector requests." />}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-6">
            <h2 className="text-lg font-black text-midnight">Automation failures</h2>
            <div className="mt-4 space-y-3">
              {failedAutomationRuns.length ? failedAutomationRuns.map((item) => (
                <Link key={item.id} to={`/platform/merchants/${item.business_id}`} className="block rounded-3xl border border-slate-100 bg-slate-50 p-4 transition hover:border-brand-200 hover:bg-white">
                  <p className="font-black text-midnight">{item.business_name}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.trigger_type} · attempts {item.attempts}/{item.max_attempts}</p>
                  {item.error ? <p className="mt-2 text-xs font-semibold text-red-600">{item.error}</p> : null}
                </Link>
              )) : <EmptyLine label="Нет failed automation runs." />}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-6">
            <h2 className="text-lg font-black text-midnight">Integration failures</h2>
            <div className="mt-4 space-y-3">
              {failedIntegrationEvents.length ? failedIntegrationEvents.map((item) => (
                <Link key={item.id} to={item.business_id ? `/platform/merchants/${item.business_id}` : "/platform/operations"} className="block rounded-3xl border border-slate-100 bg-slate-50 p-4 transition hover:border-brand-200 hover:bg-white">
                  <p className="font-black text-midnight">{item.business_name || "No business"}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.provider} · {item.direction}</p>
                  {item.error ? <p className="mt-2 text-xs font-semibold text-red-600">{item.error}</p> : null}
                </Link>
              )) : <EmptyLine label="Нет failed integration events." />}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
