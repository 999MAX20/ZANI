import { Search } from "lucide-react";
import { useState } from "react";

import { Card, CardBody } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { PageHeader } from "../../components/ui/PageHeader";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { formatDateTime } from "../../lib/format";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";

export function TimelinePage() {
  const { business } = useActiveBusiness();
  const { activityEvents, clients } = useEntityData();
  const [search, setSearch] = useState("");

  if (!business) return <ErrorState message="Создайте бизнес в настройках, чтобы открыть timeline." />;
  if (activityEvents.isLoading || clients.isLoading) return <LoadingState />;

  const rows = (activityEvents.data || []).filter((event) => {
    const text = `${event.event_type} ${event.text}`.toLowerCase();
    return !search || text.includes(search.toLowerCase());
  });

  return (
    <>
      <PageHeader title="Timeline" description="Единая история клиента: CRM, сообщения, записи, задачи и автоматизации." />
      <div className="mb-5 flex items-center gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-2">
        <Search size={17} className="text-slate-400" />
        <Input className="border-0 shadow-none" placeholder="Поиск по событиям" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <Card>
        <CardBody>
          <div className="space-y-4">
            {rows.map((event) => {
              const client = clients.data?.find((item) => item.id === event.client);
              return (
                <div key={event.id} className="border-l-2 border-slate-200 pl-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-midnight">{event.event_type}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{event.category}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{client?.full_name || "Без клиента"} · {formatDateTime(event.created_at)}</p>
                  {event.text ? <p className="mt-2 text-sm leading-6 text-slate-700">{event.text}</p> : null}
                </div>
              );
            })}
            {!rows.length ? <p className="text-sm text-slate-500">Событий пока нет.</p> : null}
          </div>
        </CardBody>
      </Card>
    </>
  );
}
