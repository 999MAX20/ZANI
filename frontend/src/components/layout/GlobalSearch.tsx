import { CalendarCheck, Command, Inbox, KanbanSquare, ListChecks, Search, User, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { formatDateTime } from "../../lib/format";
import { cn } from "../../lib/cn";
import { useEntityData } from "../../hooks/useEntityData";
import { Button } from "../ui/Button";

type SearchItem = {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  to: string;
  icon: typeof Search;
  haystack: string;
};

export function GlobalSearch() {
  const { clients, leads, appointments, services, deals, tasks } = useEntityData();
  const [open, setOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const items = useMemo<SearchItem[]>(() => {
    const clientList = clients.data || [];
    const serviceList = services.data || [];
    const clientName = (id: number | null) => clientList.find((client) => client.id === id)?.full_name || "";
    const serviceName = (id: number | null) => serviceList.find((service) => service.id === id)?.name || "";

    return [
      ...clientList.map((client) => ({
        id: `client-${client.id}`,
        title: client.full_name,
        subtitle: [client.phone, client.email, client.source].filter(Boolean).join(" · "),
        type: "Клиент",
        to: "/clients",
        icon: User,
        haystack: [client.full_name, client.phone, client.email, client.notes, client.source].join(" "),
      })),
      ...(leads.data || []).map((lead) => ({
        id: `lead-${lead.id}`,
        title: clientName(lead.client) || `Lead #${lead.id}`,
        subtitle: [serviceName(lead.service), lead.status, lead.source, lead.message].filter(Boolean).join(" · "),
        type: "Заявка",
        to: "/leads",
        icon: Inbox,
        haystack: [clientName(lead.client), serviceName(lead.service), lead.status, lead.source, lead.message].join(" "),
      })),
      ...(appointments.data || []).map((appointment) => ({
        id: `appointment-${appointment.id}`,
        title: clientName(appointment.client) || `Appointment #${appointment.id}`,
        subtitle: [serviceName(appointment.service), appointment.status, formatDateTime(appointment.start_at), appointment.notes].filter(Boolean).join(" · "),
        type: "Запись",
        to: "/appointments",
        icon: CalendarCheck,
        haystack: [clientName(appointment.client), serviceName(appointment.service), appointment.status, appointment.source, appointment.notes, appointment.start_at].join(" "),
      })),
      ...(deals.data || []).map((deal) => ({
        id: `deal-${deal.id}`,
        title: deal.title,
        subtitle: [clientName(deal.client), deal.status, `${deal.amount} ${deal.currency}`].filter(Boolean).join(" · "),
        type: "Сделка",
        to: "/deals",
        icon: KanbanSquare,
        haystack: [deal.title, clientName(deal.client), deal.status, deal.source, deal.notes, deal.amount].join(" "),
      })),
      ...(tasks.data || []).map((task) => ({
        id: `task-${task.id}`,
        title: task.title,
        subtitle: [clientName(task.client), task.status, task.priority, task.due_at ? formatDateTime(task.due_at) : ""].filter(Boolean).join(" · "),
        type: "Задача",
        to: "/tasks",
        icon: ListChecks,
        haystack: [task.title, task.description, clientName(task.client), task.status, task.priority].join(" "),
      })),
    ];
  }, [appointments.data, clients.data, deals.data, leads.data, services.data, tasks.data]);

  const results = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return items.slice(0, 8);
    return items.filter((item) => item.haystack.toLowerCase().includes(value)).slice(0, 12);
  }, [items, query]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setMobileExpanded(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setMobileExpanded(false);
        inputRef.current?.blur();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function openSearch() {
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function closeSearch() {
    setOpen(false);
    setMobileExpanded(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className={cn("relative", mobileExpanded && "absolute inset-x-16 top-1/2 z-40 -translate-y-1/2 lg:static lg:translate-y-0")}>
      <Button
        className={cn("h-10 w-10 rounded-full px-0 lg:hidden", mobileExpanded && "hidden")}
        variant="ghost"
        aria-label="Поиск"
        onClick={() => {
          setMobileExpanded(true);
          openSearch();
        }}
      >
        <Search size={22} />
      </Button>

      <div
        className={cn(
          "hidden h-11 items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/80 px-3 text-sm shadow-sm",
          "lg:flex lg:min-w-[340px]",
          mobileExpanded && "flex min-w-0",
        )}
      >
        <Search size={21} className="shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-midnight outline-none placeholder:text-slate-400"
          placeholder="Поиск по CRM: клиенты, заявки, записи..."
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
        />
        {query || mobileExpanded ? (
          <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={closeSearch} aria-label="Закрыть поиск">
            <X size={20} />
          </button>
        ) : (
          <span className="ml-auto hidden items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500 lg:inline-flex">
            <Command size={13} /> K
          </span>
        )}
      </div>

      {open ? (
        <div className="absolute left-0 top-full z-40 mt-2 w-[min(92vw,560px)] rounded-3xl border border-white/70 bg-white p-3 shadow-premium">
          <div className="max-h-[420px] space-y-1 overflow-auto">
            {results.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  onClick={closeSearch}
                  className="flex items-start gap-3 rounded-2xl px-3 py-3 transition hover:bg-slate-50"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-midnight">{item.title}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{item.type}</span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-500">{item.subtitle || "Нет дополнительных данных"}</p>
                  </div>
                </Link>
              );
            })}
            {!results.length ? <p className="px-3 py-6 text-center text-sm text-slate-500">Ничего не найдено в данных CRM.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
