import { Bot, CalendarClock, CheckCircle2, ClipboardList, MessageCircle, Search } from "lucide-react";
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
  const grouped = rows.reduce<Record<string, typeof rows>>((acc, event) => {
    const key = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(event.created_at));
    acc[key] = acc[key] || [];
    acc[key].push(event);
    return acc;
  }, {});

  function iconFor(category: string) {
    if (category === "message") return <MessageCircle size={18} />;
    if (category === "appointment") return <CalendarClock size={18} />;
    if (category === "task") return <CheckCircle2 size={18} />;
    if (category === "automation") return <Bot size={18} />;
    return <ClipboardList size={18} />;
  }

  return (
    <>
      <PageHeader title="Timeline" description="Единая история клиента: CRM, сообщения, записи, задачи и автоматизации." />
      <div className="mb-5 flex items-center gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-2">
        <Search size={17} className="text-slate-400" />
        <Input className="border-0 shadow-none" placeholder="Поиск по событиям" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <Card>
        <CardBody>
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, events]) => (
              <section key={date} className="space-y-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{date}</p>
                {events.map((event) => {
                  const client = clients.data?.find((item) => item.id === event.client);
                  return (
                    <div key={event.id} className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-brand-600">
                          {iconFor(event.category)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-midnight">{event.text || event.event_type}</p>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{event.category}</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">{client?.full_name || "Без клиента"} · {formatDateTime(event.created_at)}</p>
                          {event.text && event.text !== event.event_type ? <p className="mt-2 text-sm leading-6 text-slate-700">{event.event_type}</p> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}
            {!rows.length ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white/60 p-6 text-center">
                <p className="font-bold text-midnight">Событий пока нет</p>
                <p className="mt-1 text-sm text-slate-500">Когда клиент оставит заявку, напишет сообщение или получит запись, история появится здесь.</p>
              </div>
            ) : null}
          </div>
        </CardBody>
      </Card>
    </>
  );
}
