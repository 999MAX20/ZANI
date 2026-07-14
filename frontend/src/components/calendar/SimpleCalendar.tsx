import type { Appointment, Client, Resource, Service } from "../../types";
import { useI18n } from "../../lib/i18n";
import { StatusBadge } from "../ui/StatusBadge";

const hours = Array.from({ length: 11 }, (_, index) => index + 8);

export function SimpleCalendar({
  date,
  appointments,
  clients,
  services,
  resources,
}: {
  date: string;
  appointments: Appointment[];
  clients: Client[];
  services: Service[];
  resources: Resource[];
}) {
  const { t } = useI18n();

  return (
    <div className="overflow-hidden rounded-[8px] border border-slate-200 bg-white">
      {hours.map((hour) => {
        const items = appointments.filter((appointment) => {
          const appointmentDate = appointment.start_at.slice(0, 10);
          const appointmentHour = new Date(appointment.start_at).getHours();
          return appointmentDate === date && appointmentHour === hour;
        });
        return (
          <div key={hour} className="grid min-h-24 grid-cols-[80px_1fr] border-b border-slate-100 last:border-b-0">
            <div className="bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500">{String(hour).padStart(2, "0")}:00</div>
            <div className="space-y-2 p-3">
              {items.map((appointment) => {
                const client = clients.find((item) => item.id === appointment.client);
                const service = services.find((item) => item.id === appointment.service);
                const resource = resources.find((item) => item.id === appointment.resource);
                return (
                  <div key={appointment.id} className="rounded-[8px] border-l-4 border-brand-500 bg-brand-50 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-ink">{client?.full_name || t("appointment.client")} · {service?.name || t("appointment.service")}</p>
                      <StatusBadge status={appointment.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{resource?.name || t("appointment.noResource")}</p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
