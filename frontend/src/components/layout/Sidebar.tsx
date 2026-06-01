import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  Bot,
  Home,
  Inbox,
  KanbanSquare,
  ListChecks,
  MessageSquareText,
  PlugZap,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { useAuth } from "../../features/auth/AuthProvider";
import { inboxApi } from "../../api/inbox";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";
import { hasPermission } from "../../lib/permissions";
import { realtimeIntervals, realtimeQueryOptions } from "../../lib/realtime";
import { Button } from "../ui/Button";

type SidebarItem = {
  to: string;
  label: string;
  icon: typeof Home;
  resource?: string;
};

type SidebarSection = {
  id: string;
  titleKey: string;
  items: SidebarItem[];
};

const desktopSections = [
  {
    id: "work",
    titleKey: "nav.workspace",
    items: [
      { to: "/dashboard", label: "nav.dashboard", icon: Home },
      { to: "/dashboard/leads", label: "nav.leads", icon: Inbox, resource: "leads" },
      { to: "/dashboard/deals", label: "nav.deals", icon: KanbanSquare, resource: "deals" },
      { to: "/dashboard/clients", label: "nav.clients", icon: Users, resource: "clients" },
      { to: "/dashboard/conversations", label: "nav.conversations", icon: MessageSquareText, resource: "conversations" },
    ],
  },
  {
    id: "intelligence",
    titleKey: "nav.intelligence",
    items: [
      { to: "/dashboard/ai-agents", label: "nav.aiAgents", icon: Bot, resource: "ai_automation" },
      { to: "/dashboard/integrations", label: "nav.integrations", icon: PlugZap, resource: "integrations" },
    ],
  },
  {
    id: "reports",
    titleKey: "nav.reports",
    items: [
      { to: "/dashboard/analytics", label: "nav.analytics", icon: BarChart3, resource: "analytics" },
    ],
  },
  {
    id: "system",
    titleKey: "nav.system",
    items: [
      { to: "/dashboard/settings", label: "nav.settings", icon: Settings, resource: "settings" },
    ],
  },
] satisfies SidebarSection[];

const mobileDrawerSections = [
  {
    id: "operations",
    titleKey: "nav.operations",
    items: [
      { to: "/dashboard/deals", label: "nav.deals", icon: KanbanSquare, resource: "deals" },
      { to: "/dashboard/tasks", label: "nav.tasks", icon: ListChecks, resource: "tasks" },
      { to: "/dashboard/calendar", label: "nav.calendar", icon: CalendarDays, resource: "appointments" },
    ],
  },
  {
    id: "intelligence",
    titleKey: "nav.intelligence",
    items: [
      { to: "/dashboard/ai-agents", label: "nav.aiAgents", icon: Bot, resource: "ai_automation" },
      { to: "/dashboard/integrations", label: "nav.integrations", icon: PlugZap, resource: "integrations" },
      { to: "/dashboard/analytics", label: "nav.analytics", icon: BarChart3, resource: "analytics" },
    ],
  },
  {
    id: "system",
    titleKey: "nav.system",
    items: [{ to: "/dashboard/settings", label: "nav.settings", icon: Settings, resource: "settings" }],
  },
] satisfies SidebarSection[];

const collapsedSectionStorageKey = "zani_sidebar_collapsed_sections";

function isItemActive(pathname: string, to: string) {
  return pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
}

export function Sidebar({
  forceVisible = false,
  collapsed = false,
  mobileDrawer = false,
  onToggle,
  onNavigate,
}: {
  forceVisible?: boolean;
  collapsed?: boolean;
  mobileDrawer?: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  const location = useLocation();
  const { user } = useAuth();
  const { business } = useActiveBusiness();
  const [hovered, setHovered] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem(collapsedSectionStorageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const isExpanded = forceVisible || !collapsed || hovered;
  const inboxSummary = useQuery({
    queryKey: ["inbox-summary", business?.id],
    queryFn: inboxApi.getSummary,
    enabled: Boolean(user) && Boolean(business?.id) && hasPermission(user, business?.id, "conversations"),
    refetchInterval: realtimeIntervals.inboxConversationsMs,
    ...realtimeQueryOptions,
  });
  const unreadMessages = inboxSummary.data?.unread_messages ?? inboxSummary.data?.unread ?? 0;

  const visibleGroups = useMemo(
    () =>
      (mobileDrawer ? mobileDrawerSections : desktopSections)
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !item.resource || hasPermission(user, business?.id, item.resource)),
        }))
        .filter((group) => group.items.length),
    [business?.id, mobileDrawer, user],
  );
  const visibleItems = useMemo(() => visibleGroups.flatMap((group) => group.items), [visibleGroups]);

  function toggleSection(sectionId: string) {
    setCollapsedSections((current) => {
      const next = current.includes(sectionId) ? current.filter((id) => id !== sectionId) : [...current, sectionId];
      window.localStorage.setItem(collapsedSectionStorageKey, JSON.stringify(next));
      return next;
    });
  }

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group/sidebar relative z-20 m-3 shrink-0 rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300",
        forceVisible && "m-0 h-dvh max-h-dvh rounded-none border-r border-slate-200 bg-white shadow-premium",
        !forceVisible && "lg:fixed lg:bottom-3 lg:left-0 lg:top-3 lg:m-0 lg:ml-3 lg:h-[calc(100vh-1.5rem)]",
        isExpanded ? "w-[318px]" : "w-[92px]",
        !forceVisible && "hidden lg:block",
      )}
    >
      <div className={cn("relative flex h-full min-h-0 flex-col p-4", forceVisible && "min-h-dvh overflow-y-auto pb-8")}>
        <div className={cn("mb-4 flex items-center gap-3", !isExpanded && "justify-center")}>
          <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-midnight text-white shadow-sm">
            <Sparkles size={22} />
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
          </div>
          {isExpanded ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black tracking-tight text-midnight">{t("sidebar.product")}</p>
              <p className="truncate text-xs font-bold text-slate-500">{t("sidebar.subtitle")}</p>
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1 no-scrollbar">
          {!isExpanded ? (
            <nav className="space-y-2">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(location.pathname, item.to);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/dashboard"}
                    onClick={onNavigate}
                    title={t(item.label)}
                    className={cn(
                      "relative mx-auto grid h-12 w-12 place-items-center rounded-xl text-slate-500 transition-colors duration-150",
                      "hover:bg-slate-100 hover:text-midnight",
                      active && "bg-midnight text-white shadow-sm",
                    )}
                    >
                      <Icon size={20} strokeWidth={2.25} />
                      {item.to === "/dashboard/conversations" && unreadMessages ? (
                        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-white ring-2 ring-white">
                          {unreadMessages > 99 ? "99+" : unreadMessages}
                        </span>
                      ) : null}
                    </NavLink>
                );
              })}
            </nav>
          ) : visibleGroups.map((group) => {
            const sectionCollapsed = !mobileDrawer && collapsedSections.includes(group.id);
            return (
            <section key={group.id}>
              <button
                type="button"
                className="mb-2 flex min-h-8 w-full items-center justify-between rounded-lg px-2 text-left text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                onClick={() => {
                  if (!mobileDrawer) toggleSection(group.id);
                }}
              >
                <span>{t(group.titleKey)}</span>
                {!mobileDrawer ? <ChevronDown className={cn("transition", sectionCollapsed && "-rotate-90")} size={15} /> : null}
              </button>

              {!sectionCollapsed ? <nav className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(location.pathname, item.to);

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/dashboard"}
                      onClick={onNavigate}
                      title={t(item.label)}
                      className={cn(
                        "group relative flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-black text-slate-700 transition-colors duration-150",
                        "hover:bg-slate-100 hover:text-midnight",
                        active && "bg-slate-100 text-midnight",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 transition",
                          active && "bg-midnight text-white shadow-sm",
                          !active && "group-hover:bg-white group-hover:text-brand-700",
                        )}
                      >
                        <Icon size={20} strokeWidth={2.25} />
                      </span>
                      <span className="min-w-0 truncate">{t(item.label)}</span>
                      {item.to === "/dashboard/conversations" && unreadMessages ? (
                        <span className="ml-auto min-w-6 rounded-full bg-red-500 px-2 py-1 text-center text-[11px] font-black leading-none text-white shadow-sm">
                          {unreadMessages > 99 ? "99+" : unreadMessages}
                        </span>
                      ) : active ? <span className="ml-auto h-2 w-2 rounded-full bg-brand-500" /> : null}
                    </NavLink>
                  );
                })}
              </nav> : null}
            </section>
            );
          })}

        </div>

        {onToggle ? (
          <Button
            variant="secondary"
            className="absolute -right-4 top-8 hidden h-9 w-9 rounded-full px-0 lg:inline-flex"
            onClick={onToggle}
            aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          >
            <ChevronLeft className={cn("transition", collapsed && "rotate-180")} size={16} />
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
