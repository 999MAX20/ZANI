import { CalendarCheck, Command, Inbox, KanbanSquare, ListChecks, MessageCircle, Search, User, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

import { formatDateTime } from "../../lib/format";
import { cn } from "../../lib/cn";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";
import { Button } from "../ui/Button";
import type { Appointment, BotConversation, Client, Deal, Lead, Service, Task } from "../../types";

type SearchItem = {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  to: string;
  icon: typeof Search;
  haystack: string;
};

type SearchScope = "page" | "global";
type SearchContext = {
  id: "clients" | "leads" | "deals" | "conversations" | "calendar" | "tasks" | "integrations" | "timeline" | "default";
  types: string[];
  placeholderKey: string;
};

const contextByPath: Array<{ match: (path: string) => boolean; context: SearchContext }> = [
  { match: (path) => path.includes("/app/clients"), context: { id: "clients", types: ["client"], placeholderKey: "search.placeholder.clients" } },
  { match: (path) => path.includes("/app/leads"), context: { id: "leads", types: ["lead"], placeholderKey: "search.placeholder.leads" } },
  { match: (path) => path.includes("/app/deals"), context: { id: "deals", types: ["deal"], placeholderKey: "search.placeholder.deals" } },
  { match: (path) => path.includes("/app/conversations"), context: { id: "conversations", types: ["conversation"], placeholderKey: "search.placeholder.conversations" } },
  { match: (path) => path.includes("/app/calendar"), context: { id: "calendar", types: ["appointment"], placeholderKey: "search.placeholder.calendar" } },
  { match: (path) => path.includes("/app/tasks"), context: { id: "tasks", types: ["task"], placeholderKey: "search.placeholder.tasks" } },
  { match: (path) => path.includes("/app/integrations"), context: { id: "integrations", types: [], placeholderKey: "search.placeholder.integrations" } },
  { match: (path) => path.includes("/app/timeline"), context: { id: "timeline", types: [], placeholderKey: "search.placeholder.timeline" } },
];

function getSearchContext(pathname: string): SearchContext {
  return contextByPath.find((item) => item.match(pathname))?.context || { id: "default", types: [], placeholderKey: "header.search" };
}

function setSearchParam(searchParams: URLSearchParams, setSearchParams: ReturnType<typeof useSearchParams>[1], value: string) {
  const next = new URLSearchParams(searchParams);
  const clean = value.trim();
  if (clean) next.set("search", clean);
  else next.delete("search");
  setSearchParams(next, { replace: true });
}

export function GlobalSearch() {
  const { t } = useI18n();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [desktopExpanded, setDesktopExpanded] = useState(false);
  const [scope, setScope] = useState<SearchScope>("page");
  const [query, setQuery] = useState(searchParams.get("search") || "");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeContext = useMemo(() => getSearchContext(location.pathname), [location.pathname]);
  const rendersPageSearchInline = scope === "page" && activeContext.id === "tasks";
  const shouldLoadSearchData = open || mobileExpanded;
  const { clients, leads, appointments, services, deals, tasks, botConversations } = useEntityData({
    enabled: shouldLoadSearchData,
    clients: true,
    leads: true,
    appointments: true,
    services: true,
    deals: true,
    tasks: true,
    botConversations: true,
  });

  const items = useMemo<SearchItem[]>(() => {
    const clientList = (clients.data || []) as Client[];
    const serviceList = (services.data || []) as Service[];
    const clientName = (id: number | null) => clientList.find((client) => client.id === id)?.full_name || "";
    const serviceName = (id: number | null) => serviceList.find((service) => service.id === id)?.name || "";

    return [
      ...clientList.map((client) => ({
        id: `client-${client.id}`,
        title: client.full_name,
        subtitle: [client.phone, client.email, client.source].filter(Boolean).join(" · "),
        type: "client",
        to: `/app/clients?client=${client.id}`,
        icon: User,
        haystack: [client.full_name, client.phone, client.email, client.notes, client.source].join(" "),
      })),
      ...((leads.data || []) as Lead[]).map((lead) => ({
        id: `lead-${lead.id}`,
        title: clientName(lead.client) || `Lead #${lead.id}`,
        subtitle: [serviceName(lead.service), lead.status, lead.source, lead.message].filter(Boolean).join(" · "),
        type: "lead",
        to: `/app/leads?lead=${lead.id}`,
        icon: Inbox,
        haystack: [clientName(lead.client), serviceName(lead.service), lead.status, lead.source, lead.message].join(" "),
      })),
      ...((appointments.data || []) as Appointment[]).map((appointment) => ({
        id: `appointment-${appointment.id}`,
        title: clientName(appointment.client) || `Appointment #${appointment.id}`,
        subtitle: [serviceName(appointment.service), appointment.status, formatDateTime(appointment.start_at), appointment.notes].filter(Boolean).join(" · "),
        type: "appointment",
        to: `/app/calendar?appointment=${appointment.id}`,
        icon: CalendarCheck,
        haystack: [clientName(appointment.client), serviceName(appointment.service), appointment.status, appointment.source, appointment.notes, appointment.start_at].join(" "),
      })),
      ...((deals.data || []) as Deal[]).map((deal) => ({
        id: `deal-${deal.id}`,
        title: deal.title,
        subtitle: [clientName(deal.client), deal.status, `${deal.amount} ${deal.currency}`].filter(Boolean).join(" · "),
        type: "deal",
        to: `/app/deals?deal=${deal.id}`,
        icon: KanbanSquare,
        haystack: [deal.title, clientName(deal.client), deal.status, deal.source, deal.notes, deal.amount].join(" "),
      })),
      ...((botConversations.data || []) as BotConversation[]).map((conversation) => ({
        id: `conversation-${conversation.id}`,
        title: conversation.client_name || conversation.external_user_id || `Conversation #${conversation.id}`,
        subtitle: [conversation.channel, conversation.status, conversation.last_message?.text].filter(Boolean).join(" · "),
        type: "conversation",
        to: `/app/conversations?conversation=${conversation.id}`,
        icon: MessageCircle,
        haystack: [conversation.client_name, conversation.client_phone, conversation.external_user_id, conversation.channel, conversation.status, conversation.last_message?.text].join(" "),
      })),
      ...((tasks.data || []) as Task[]).map((task) => ({
        id: `task-${task.id}`,
        title: task.title,
        subtitle: [clientName(task.client), task.status, task.priority, task.due_at ? formatDateTime(task.due_at) : ""].filter(Boolean).join(" · "),
        type: "task",
        to: `/app/tasks?task=${task.id}`,
        icon: ListChecks,
        haystack: [task.title, task.description, clientName(task.client), task.status, task.priority].join(" "),
      })),
    ];
  }, [appointments.data, botConversations.data, clients.data, deals.data, leads.data, services.data, tasks.data]);

  const results = useMemo(() => {
    const value = query.trim().toLowerCase();
    const scopedItems = scope === "page" && activeContext.id !== "default" ? items.filter((item) => activeContext.types.includes(item.type)) : items;
    if (!value) return scopedItems.slice(0, 8);
    return scopedItems.filter((item) => item.haystack.toLowerCase().includes(value)).slice(0, 12);
  }, [activeContext.types, items, query, scope]);

  useEffect(() => {
    setQuery(searchParams.get("search") || "");
  }, [location.pathname, searchParams]);

  useEffect(() => {
    if (scope !== "page" || activeContext.id === "default") return;
    const handle = window.setTimeout(() => setSearchParam(searchParams, setSearchParams, query), 280);
    return () => window.clearTimeout(handle);
  }, [activeContext.id, query, scope, searchParams, setSearchParams]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setMobileExpanded(false);
        if (!query.trim()) setDesktopExpanded(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setMobileExpanded(false);
        if (!query.trim()) setDesktopExpanded(false);
        inputRef.current?.blur();
      }
    }

    function handleOpenSearch() {
      setMobileExpanded(true);
      openSearch();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("zani:open-global-search", handleOpenSearch);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("zani:open-global-search", handleOpenSearch);
    };
  }, [query]);

  function openSearch() {
    setOpen(true);
    setDesktopExpanded(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function closeSearch() {
    setOpen(false);
    setMobileExpanded(false);
    if (!query.trim()) setDesktopExpanded(false);
  }

  function clearSearch() {
    setQuery("");
    if (scope === "page" && activeContext.id !== "default") setSearchParam(searchParams, setSearchParams, "");
  }

  const typeLabels: Record<string, string> = {
    client: t("search.client"),
    lead: t("search.lead"),
    appointment: t("search.booking"),
    deal: t("search.deal"),
    conversation: t("search.conversation"),
    task: t("search.task"),
  };
  const placeholder = scope === "page" ? t(activeContext.placeholderKey) : t("search.placeholder.global");
  const expanded = desktopExpanded || mobileExpanded || Boolean(query.trim());

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative flex w-full justify-center",
        expanded && "lg:block",
        mobileExpanded && "absolute inset-x-[4.35rem] top-1/2 z-[70] -translate-y-1/2 lg:static lg:translate-y-0",
      )}
    >
      <Button
        className={cn("h-[52px] w-[52px] min-h-[52px] min-w-[52px] rounded-full px-0 lg:hidden", mobileExpanded && "hidden")}
        variant="ghost"
        aria-label={t("search.aria")}
        onClick={() => {
          setMobileExpanded(true);
          openSearch();
        }}
      >
        <Search size={24} strokeWidth={2.35} />
      </Button>

      {!expanded ? (
        <Button
          className="hidden h-11 w-11 shrink-0 rounded-xl border border-slate-200 bg-white px-0 text-slate-600 shadow-sm transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 lg:grid"
          variant="ghost"
          aria-label={t("search.aria")}
          onClick={openSearch}
        >
          <Search size={20} strokeWidth={2.3} />
        </Button>
      ) : null}

      <div
        className={cn(
          "hidden h-11 w-full items-center gap-3 rounded-xl border border-slate-200/70 bg-white/90 px-3 text-sm shadow-sm",
          "lg:min-w-0",
          expanded && "lg:flex",
          mobileExpanded && "flex h-[52px] min-w-0 rounded-full",
        )}
      >
        <Search size={21} className="shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-midnight outline-none placeholder:text-slate-400"
          aria-label={t("search.aria")}
          placeholder={placeholder}
          value={query}
          onFocus={() => setOpen(!rendersPageSearchInline)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(!rendersPageSearchInline);
            setDesktopExpanded(true);
          }}
        />
        {query || mobileExpanded || desktopExpanded ? (
          <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={query ? clearSearch : closeSearch} aria-label={t("search.close")}>
            <X size={20} />
          </button>
        ) : (
          <span className="ml-auto hidden items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500 lg:inline-flex">
            <Command size={13} /> K
          </span>
        )}
      </div>

      {open && !rendersPageSearchInline ? (
        <div className="fixed inset-x-3 top-20 z-[70] rounded-xl border border-slate-200 bg-white p-3 shadow-premium lg:absolute lg:inset-x-auto lg:left-1/2 lg:top-full lg:mt-2 lg:w-[min(560px,calc(100vw-8rem))] lg:-translate-x-1/2">
          <div className="mb-3 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
            {(["page", "global"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={cn("h-9 rounded-xl text-xs font-black transition", scope === value ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-800")}
                onClick={() => setScope(value)}
              >
                {value === "page" ? t("search.scopePage") : t("search.scopeGlobal")}
              </button>
            ))}
          </div>
          <div className="max-h-[min(62vh,420px)] space-y-1 overflow-auto">
            {results.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  onClick={closeSearch}
                  className="flex min-h-[62px] items-start gap-3 rounded-2xl px-3 py-3 transition hover:bg-slate-50 active:scale-[0.99]"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-midnight">{item.title}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{typeLabels[item.type] || item.type}</span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-500">{item.subtitle || t("search.noMeta")}</p>
                  </div>
                </Link>
              );
            })}
            {!results.length ? <p className="px-3 py-6 text-center text-sm text-slate-500">{t("search.empty")}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
