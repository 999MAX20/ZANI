import { CalendarCheck, CalendarPlus, CheckCircle2, Flame, ListChecks, Plus, UserPlus, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { EmptyState, ErrorState, PageSkeleton } from "../../components/ui/StateViews";
import { formatDateTime, todayISO, tomorrowISO } from "../../lib/format";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";

function Metric({
  label,
  value,
  hint,
  icon: Icon,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Flame;
  tone?: "brand" | "ai" | "green" | "amber" | "slate";
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-700 ring-brand-100",
    ai: "bg-ai-50 text-ai-700 ring-ai-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    slate: "bg-slate-100 text-midnight ring-slate-200",
  };

  return (
    <Card className="group overflow-hidden">
      <CardBody className="relative flex items-start gap-4">
        <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-brand-100/35 blur-3xl transition group-hover:bg-ai-100/50" />
        <div className={`relative grid h-12 w-12 place-items-center rounded-2xl ring-1 ${tones[tone]}`}>
          <Icon size={21} />
        </div>
        <div className="relative min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-midnight">{value}</p>
          {hint ? <p className="mt-1 text-xs font-medium text-slate-400">{hint}</p> : null}
        </div>
      </CardBody>
    </Card>
  );
}

export function DashboardPage() {
  const { business, isLoading: businessLoading } = useActiveBusiness();
  const { clients, leads, appointments, services, tasks } = useEntityData();
  const { t } = useI18n();

  if (businessLoading || clients.isLoading || leads.isLoading || appointments.isLoading || tasks.isLoading) return <PageSkeleton />;
  if (!business) {
    return <ErrorState message="Бизнес ещё не создан. Откройте настройки и добавьте первый бизнес, чтобы начать работу." />;
  }

  const leadList = leads.data || [];
  const appointmentList = appointments.data || [];
  const today = todayISO();
  const tomorrow = tomorrowISO();
  const newLeads = leadList.filter((lead) => lead.status === "new");
  const todayAppointments = appointmentList.filter((item) => item.start_at.slice(0, 10) === today);
  const tomorrowAppointments = appointmentList.filter((item) => item.start_at.slice(0, 10) === tomorrow);
  const createdFromLeads = leadList.filter((lead) => lead.status === "appointment_created").length;
  const conversion = leadList.length ? Math.round((createdFromLeads / leadList.length) * 100) : 0;
  const revenue = appointmentList.filter((item) => item.status === "completed").length * 10000;
  const openTasks = (tasks.data || []).filter((task) => task.status !== "done").length;

  return (
    <>
      <PageHeader
        title={t("dashboard.title")}
        description="Короткий рабочий обзор: новые заявки, ближайшие записи и действия на сегодня."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/dashboard/leads"><Button variant="ai"><Plus size={18} />Заявка</Button></Link>
            <Link to="/dashboard/clients"><Button variant="secondary"><UserPlus size={18} />Клиент</Button></Link>
            <Link to="/dashboard/appointments"><Button variant="secondary"><CalendarPlus size={18} />Запись</Button></Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label={t("dashboard.newLeads")} value={newLeads.length} hint="Нужно обработать" icon={Flame} tone="amber" />
        <Metric label={t("dashboard.appointments")} value={todayAppointments.length} hint="Сегодня" icon={CalendarCheck} tone="brand" />
        <Metric label="Клиенты" value={clients.data?.length || 0} hint="В базе CRM" icon={Users} tone="green" />
        <Metric label={t("dashboard.conversion")} value={`${conversion}%`} hint="Лид → запись" icon={CheckCircle2} tone="ai" />
        <Metric label="Задачи" value={openTasks} hint="Открытые follow-up" icon={ListChecks} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardBody>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-midnight">Что требует внимания</h2>
                <p className="mt-1 text-sm text-slate-500">Минимальный список действий без лишнего шума.</p>
              </div>
            </div>
            <div className="space-y-3">
              <Link to="/dashboard/leads" className="block rounded-2xl border border-slate-100 bg-white/70 p-4 transition hover:bg-slate-50">
                <p className="font-semibold text-midnight">Ответить новым заявкам</p>
                <p className="mt-1 text-sm text-slate-500">{newLeads.length} новых лидов ждут обработки.</p>
              </Link>
              <Link to="/dashboard/appointments" className="block rounded-2xl border border-slate-100 bg-white/70 p-4 transition hover:bg-slate-50">
                <p className="font-semibold text-midnight">Проверить записи на сегодня</p>
                <p className="mt-1 text-sm text-slate-500">{todayAppointments.length} записей в календаре.</p>
              </Link>
              <Link to="/dashboard/tasks" className="block rounded-2xl border border-slate-100 bg-white/70 p-4 transition hover:bg-slate-50">
                <p className="font-semibold text-midnight">Открыть задачи команды</p>
                <p className="mt-1 text-sm text-slate-500">{openTasks} открытых задач по клиентам и follow-up.</p>
              </Link>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold text-midnight">Последние заявки</h2>
            <div className="mt-4 space-y-3">
              {leadList.slice(0, 6).map((lead) => {
                const client = clients.data?.find((item) => item.id === lead.client);
                const service = services.data?.find((item) => item.id === lead.service);
                return (
                  <Link key={lead.id} to="/dashboard/leads" className="block rounded-2xl border border-slate-100 bg-white/70 p-3 transition hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-midnight">{client?.full_name || `Lead #${lead.id}`}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{service?.name || lead.source} · {formatDateTime(lead.created_at)}</p>
                      </div>
                      <StatusBadge status={lead.status} />
                    </div>
                  </Link>
                );
              })}
              {!leadList.length ? (
                <EmptyState
                  title="Заявок пока нет"
                  description="Создайте первую заявку вручную или подключите источник заявок на следующем этапе."
                  action={<Link to="/dashboard/leads"><Button variant="secondary"><Plus size={16} />Перейти к заявкам</Button></Link>}
                />
              ) : null}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold text-midnight">Ближайшие записи</h2>
            <div className="mt-4 space-y-4">
              {appointmentList.slice(0, 6).map((appointment) => {
                const client = clients.data?.find((item) => item.id === appointment.client);
                const service = services.data?.find((item) => item.id === appointment.service);
                return (
                  <div key={appointment.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white/70 p-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                      <CalendarCheck size={17} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-midnight">{client?.full_name || t("dashboard.client")}</p>
                      <p className="mt-1 text-sm text-slate-500">{service?.name || t("common.service")} · {formatDateTime(appointment.start_at)}</p>
                    </div>
                  </div>
                );
              })}
              {!appointmentList.length ? (
                <EmptyState
                  title="Записей пока нет"
                  description="Когда появится первая запись, она будет видна здесь и в календаре."
                  action={<Link to="/dashboard/appointments"><Button variant="secondary"><CalendarPlus size={16} />Создать запись</Button></Link>}
                />
              ) : null}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-midnight">
                <Users size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-midnight">Клиентская база</h2>
                <p className="text-sm text-slate-500">{clients.data?.length || 0} клиентов в CRM.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                <p className="text-sm font-semibold text-midnight">Быстрый старт</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">Добавьте услугу, ресурс и рабочее время, затем создайте первую запись из заявки.</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                <p className="text-sm font-semibold text-midnight">Выручка</p>
                <p className="mt-1 text-2xl font-bold text-midnight">{`${revenue.toLocaleString("ru-RU")} ₸`}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
