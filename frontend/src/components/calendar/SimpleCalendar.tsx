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
    <div className="overflow-hidden rounded-card border border-zani-border bg-surface-card shadow-card">
      {hours.map((hour) => {
        const items = appointments.filter((appointment) => {
          const appointmentDate = appointment.start_at.slice(0, 10);
          const appointmentHour = new Date(appointment.start_at).getHours();
          return appointmentDate === date && appointmentHour === hour;
        });
        return (
          <div key={hour} className="grid min-h-24 grid-cols-[80px_1fr] border-b border-zani-border last:border-b-0">
            <div className="bg-surface-muted px-4 py-3 text-sm font-semibold text-zani-muted">{String(hour).padStart(2, "0")}:00</div>
            <div className="space-y-2 p-3">
              {items.map((appointment) => {
                const client = clients.find((item) => item.id === appointment.client);
                const service = services.find((item) => item.id === appointment.service);
                const resource = resources.find((item) => item.id === appointment.resource);
                return (
                  <div key={appointment.id} className="rounded-control border border-brand-100 border-l-4 border-l-brand-500 bg-brand-50 px-3 py-2 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-zani-ink">{client?.full_name || t("appointment.client")} · {service?.name || t("appointment.service")}</p>
                      <StatusBadge status={appointment.status} />
                    </div>
                    <p className="mt-1 text-sm text-zani-muted">{resource?.name || t("appointment.noResource")}</p>
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
