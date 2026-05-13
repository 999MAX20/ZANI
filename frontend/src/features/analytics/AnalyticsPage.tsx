import { CalendarCheck, CheckCircle2, Flame, TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardBody } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";

function Stat({ label, value, hint, icon: Icon }: { label: string; value: number | string; hint?: string; icon: typeof Flame }) {
  return (
    <Card>
      <CardBody>
        <div className="mb-4 grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-midnight">
          <Icon size={18} />
        </div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-midnight">{value}</p>
        {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
      </CardBody>
    </Card>
  );
}

export function AnalyticsPage() {
  const { business } = useActiveBusiness();
  const { leads, appointments, services } = useEntityData();

  if (!business) return <ErrorState message="Создайте бизнес в настройках, чтобы видеть аналитику." />;
  if (leads.isLoading || appointments.isLoading || services.isLoading) return <LoadingState />;

  const leadList = leads.data || [];
  const appointmentList = appointments.data || [];
  const completed = appointmentList.filter((item) => item.status === "completed").length;
  const noShow = appointmentList.filter((item) => item.status === "no_show").length;
  const conversion = leadList.length ? Math.round((leadList.filter((lead) => lead.status === "appointment_created").length / leadList.length) * 100) : 0;
  const sourceRows = Object.entries(
    leadList.reduce<Record<string, number>>((acc, lead) => {
      acc[lead.source] = (acc[lead.source] || 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHeader title="Аналитика" description="Ключевые CRM-метрики без перегруженных графиков и декоративных инсайтов." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Stat label="Заявки" value={leadList.length} hint="всего в CRM" icon={Flame} />
        <Stat label="Записи" value={appointmentList.length} hint="всего создано" icon={CalendarCheck} />
        <Stat label="Конверсия" value={`${conversion}%`} hint="заявка -> запись" icon={TrendingUp} />
        <Stat label="No-show" value={noShow} hint="не пришли" icon={TrendingDown} />
        <Stat label="Завершено" value={completed} hint="обслуженные клиенты" icon={CheckCircle2} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold text-midnight">Источники заявок</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {(sourceRows.length ? sourceRows : [["Нет данных", 0]]).map(([source, count]) => (
                <div key={source} className="flex items-center justify-between py-3">
                  <span className="font-medium text-slate-700">{source}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">{count}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold text-midnight">Услуги по записям</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {(services.data || []).map((service) => (
                <div key={service.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-slate-700">{service.name}</p>
                    <p className="text-xs text-slate-400">{service.duration_minutes} мин.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                    {appointmentList.filter((appointment) => appointment.service === service.id).length}
                  </span>
                </div>
              ))}
              {!services.data?.length ? <p className="py-3 text-sm text-slate-500">Услуг пока нет.</p> : null}
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
