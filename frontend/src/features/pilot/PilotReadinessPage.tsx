import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CircleDashed, ExternalLink, ListChecks, RefreshCw, Rocket, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { pilotApi, type PilotReadinessItem } from "../../api/pilot";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { cn } from "../../lib/cn";

const statusUi = {
  ready: {
    label: "Готово",
    icon: CheckCircle2,
    className: "border-emerald-100 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  needs_attention: {
    label: "Требует внимания",
    icon: AlertTriangle,
    className: "border-amber-100 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  missing: {
    label: "Не настроено",
    icon: CircleDashed,
    className: "border-slate-100 bg-slate-50 text-slate-600",
    dot: "bg-slate-400",
  },
};

function ReadinessItemCard({ item }: { item: PilotReadinessItem }) {
  const ui = statusUi[item.status] || statusUi.missing;
  const Icon = ui.icon;

  return (
    <Card className="overflow-hidden">
      <CardBody className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("inline-flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-xs font-black", ui.className)}>
            <span className={cn("h-2 w-2 rounded-full", ui.dot)} />
            {ui.label}
          </div>
          <Icon size={20} className={item.is_ready ? "text-emerald-500" : item.status === "needs_attention" ? "text-amber-500" : "text-slate-400"} />
        </div>
        <div className="min-h-[92px]">
          <p className="text-base font-black text-midnight">{item.title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            {typeof item.count === "number" ? `${item.count} шт.` : item.is_ready ? "OK" : "—"}
          </span>
          {item.href ? (
            <Link to={item.href} className="inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:text-brand-900">
              Открыть <ExternalLink size={14} />
            </Link>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

export function PilotReadinessPage() {
  const readinessQuery = useQuery({
    queryKey: ["pilot-readiness"],
    queryFn: pilotApi.readiness,
  });

  if (readinessQuery.isLoading) return <LoadingState label="Проверяем готовность пилота..." />;
  if (readinessQuery.isError) {
    return (
      <ErrorState
        message="Не удалось загрузить чеклист пилота. Проверьте backend и доступ к бизнесу."
        action={<Button variant="secondary" onClick={() => readinessQuery.refetch()}><RefreshCw size={16} />Повторить</Button>}
      />
    );
  }

  const data = readinessQuery.data;
  if (!data) return null;

  const missing = data.items.filter((item) => !item.is_ready);
  const ready = data.items.filter((item) => item.is_ready);
  const scoreTone = data.score >= 80 ? "text-emerald-600" : data.score >= 55 ? "text-amber-600" : "text-red-600";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pilot Readiness"
        description="Контрольная страница перед показом Zani пилотным клиентам: CRM, демо-данные, бот, inbox, billing, AI, импорт и интеграции."
        actions={
          <Button variant="secondary" onClick={() => readinessQuery.refetch()}>
            <RefreshCw size={16} />Обновить чеклист
          </Button>
        }
      />

      <Card className="overflow-hidden border-brand-100/70 bg-gradient-to-br from-white to-brand-50/50">
        <CardBody className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-3xl bg-ai-gradient text-white shadow-glow">
              <Rocket size={26} />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-600">{data.business?.name || "Бизнес не выбран"}</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-midnight">Пилотная готовность: <span className={scoreTone}>{data.score}%</span></h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Готово {data.ready_count} из {data.total_count} пунктов. Эта страница не подключает новые внешние сервисы — она показывает, насколько текущий workspace готов к кликабельному пилоту.
              </p>
            </div>
          </div>
          <div className="rounded-3xl bg-white/80 p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-500">Progress</span>
              <span className={cn("text-2xl font-black", scoreTone)}>{data.score}%</span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-ai-gradient transition-all" style={{ width: `${data.score}%` }} />
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-600">
              <ShieldCheck size={17} className="text-brand-600" />
              Критичных пробелов: {data.critical_missing.length}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <ListChecks size={20} />
            </div>
            <div>
              <p className="text-lg font-black text-midnight">Путь подготовки пилота</p>
              <p className="mt-1 text-sm text-slate-500">Идём от базы бизнеса к живому клиентскому сценарию, без технических экранов для мерчанта.</p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { title: "1. Бизнес и команда", text: "Профиль, владелец, оператор, роли и доступы.", href: "/dashboard/settings" },
            { title: "2. CRM-скелет", text: "Услуги, ресурсы, график, первая заявка и сделка.", href: "/dashboard/onboarding" },
            { title: "3. Клиентский сценарий", text: "Запись, задача, inbox, website chat и AI-черновик.", href: "/dashboard/inbox" },
            { title: "4. Рост и данные", text: "Импорт базы, интеграции, billing и финальная проверка.", href: "/dashboard/integrations" },
          ].map((step) => (
            <Link key={step.title} to={step.href} className="rounded-3xl border border-slate-100 bg-white/75 p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-soft">
              <p className="font-black text-midnight">{step.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{step.text}</p>
              <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-brand-700">Открыть</p>
            </Link>
          ))}
        </CardBody>
      </Card>

      {missing.length ? (
        <Card>
          <CardHeader>
            <p className="text-lg font-black text-midnight">Что добить перед пилотом</p>
          </CardHeader>
          <CardBody className="grid gap-3 md:grid-cols-2">
            {missing.slice(0, 6).map((item) => (
              <div key={item.key} className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                <p className="font-bold text-amber-900">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-amber-800/80">{item.description}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : (
        <Card className="border-emerald-100 bg-emerald-50/50">
          <CardBody>
            <p className="text-lg font-black text-emerald-800">Все базовые пункты пилота готовы</p>
            <p className="mt-2 text-sm text-emerald-700">Можно переходить к end-to-end проверкам widget, inbox и connector statuses.</p>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.items.map((item) => <ReadinessItemCard key={item.key} item={item} />)}
      </div>

      <Card>
        <CardHeader>
          <p className="text-lg font-black text-midnight">Следующий ручной smoke path</p>
        </CardHeader>
        <CardBody>
          <ol className="grid gap-3 text-sm leading-6 text-slate-600 md:grid-cols-2">
            <li>1. Войти как demo-owner и открыть Dashboard.</li>
            <li>2. Проверить Leads, Clients, Deals, Tasks, Calendar.</li>
            <li>3. Открыть Inbox и проверить тестовый диалог.</li>
            <li>4. Открыть Bots и убедиться, что website channel есть.</li>
            <li>5. Открыть AI Assistant и проверить черновик ответа.</li>
            <li>6. Открыть Integrations и убедиться, что нет тупиковых кнопок.</li>
          </ol>
          {data.next_actions.length ? (
            <div className="mt-5 rounded-3xl border border-brand-100 bg-brand-50/70 p-4">
              <p className="text-sm font-black text-midnight">Следующие действия по данным системы</p>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-600 md:grid-cols-2">
                {data.next_actions.map((action) => <li key={action}>• {action}</li>)}
              </ul>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
