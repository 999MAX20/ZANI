import {
  BarChart3,
  CalendarDays,
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { useAuth } from "../../features/auth/AuthProvider";
import { inboxApi } from "../../api/inbox";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";
import { hasPermission } from "../../lib/permissions";
import { prefetchRouteData } from "../../lib/prefetch";
import { realtimeIntervals, realtimeQueryOptions } from "../../lib/realtime";

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

function isItemActive(pathname: string, to: string) {
  return pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
}

export function Sidebar({
  expanded = false,
  forceVisible = false,
  mobileDrawer = false,
  onDesktopMouseEnter,
  onDesktopMouseLeave,
  onNavigate,
}: {
  expanded?: boolean;
  forceVisible?: boolean;
  mobileDrawer?: boolean;
  onDesktopMouseEnter?: () => void;
  onDesktopMouseLeave?: () => void;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const location = useLocation();
  const { user } = useAuth();
  const { business } = useActiveBusiness();
  const inboxSummary = useQuery({
    queryKey: ["inbox-summary", business?.id],
    queryFn: inboxApi.getSummary,
    enabled: Boolean(user) && Boolean(business?.id) && hasPermission(user, business?.id, "conversations"),
    refetchInterval: realtimeIntervals.inboxConversationsMs,
    ...realtimeQueryOptions,
  });
  const unreadMessages = inboxSummary.data?.unread_messages ?? inboxSummary.data?.unread ?? 0;
  const isExpanded = forceVisible || expanded;

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
  return (
    <aside
      onMouseEnter={forceVisible ? undefined : onDesktopMouseEnter}
      onMouseLeave={forceVisible ? undefined : onDesktopMouseLeave}
      className={cn(
        "relative z-[60] shrink-0 border-r border-slate-200 bg-white transition-[width,box-shadow,background-color,backdrop-filter] duration-200 ease-out",
        forceVisible && "h-dvh max-h-dvh w-[min(390px,94vw)] bg-white/[0.97] shadow-premium backdrop-blur-2xl",
        !forceVisible && cn(
          "hidden bg-white/[0.88] backdrop-blur-2xl lg:fixed lg:inset-y-0 lg:left-0 lg:block",
          isExpanded ? "lg:w-[260px] lg:bg-white/[0.97] lg:shadow-[18px_0_45px_rgba(17,24,39,0.12)] lg:backdrop-blur-2xl" : "lg:w-[72px]",
        ),
        !forceVisible && "hidden lg:block",
      )}
    >
      <div className={cn("flex h-full min-h-0 flex-col", forceVisible && "min-h-dvh overflow-y-auto pb-8")}>
        <div className={cn("py-8", isExpanded ? "px-6" : "px-3")}>
          <div className="flex items-center gap-3">
            <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-gradient text-white shadow-glow">
              <Sparkles size={20} />
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-slate-100 bg-emerald-500" />
            </div>
            <div className={cn("min-w-0 transition-opacity duration-150", isExpanded ? "opacity-100" : "pointer-events-none hidden opacity-0")}>
              <p className="truncate text-xl font-bold leading-6 text-midnight">{t("sidebar.product")}</p>
              <p className="truncate text-sm text-slate-500">{t("sidebar.subtitle")}</p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 no-scrollbar">
          {visibleGroups.map((group) => {
            return (
            <section key={group.id}>
              {mobileDrawer ? <div
                className="mb-1 flex min-h-7 w-full items-center justify-between rounded-lg px-4 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-600"
              >
                <span>{t(group.titleKey)}</span>
              </div> : null}

              <nav className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(location.pathname, item.to);

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/dashboard"}
                      onClick={onNavigate}
                      onMouseEnter={() => prefetchRouteData(item.to, queryClient)}
                      onFocus={() => prefetchRouteData(item.to, queryClient)}
                      title={t(item.label)}
                      className={cn(
                        "group relative flex min-h-[48px] items-center gap-3 border-l-4 border-transparent px-4 py-3 text-sm font-medium text-slate-700 transition-colors duration-150",
                        !isExpanded && "justify-center px-0",
                        "hover:bg-primary-50 hover:text-midnight",
                        active && "border-brand-600 bg-primary-50 font-semibold text-midnight",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-6 w-6 shrink-0 place-items-center text-slate-500 transition-colors",
                          active && "text-brand-600",
                          !active && "group-hover:text-midnight",
                        )}
                      >
                        <Icon size={21} strokeWidth={2.15} />
                      </span>
                      <span className={cn("min-w-0 truncate transition-opacity duration-150", isExpanded ? "opacity-100" : "hidden opacity-0")}>{t(item.label)}</span>
                      {item.to === "/dashboard/conversations" && unreadMessages ? (
                        <span className={cn("min-w-6 rounded-full bg-red-500 px-2 py-1 text-center text-[11px] font-black leading-none text-white shadow-sm", isExpanded ? "ml-auto" : "absolute right-1 top-1 px-1.5")}>
                          {unreadMessages > 99 ? "99+" : unreadMessages}
                        </span>
                      ) : active && isExpanded ? <span className="ml-auto h-2 w-2 rounded-full bg-brand-500" /> : null}
                    </NavLink>
                  );
                })}
              </nav>
            </section>
            );
          })}

        </div>

        <div className={cn("border-t border-slate-200", isExpanded ? "p-4" : "p-3")}>
          <NavLink
            to="/dashboard/account"
            onClick={onNavigate}
            title={t("account.menuProfile")}
            className={({ isActive }) => cn(
              "flex items-center gap-3 rounded-xl transition hover:bg-slate-200/70",
              isExpanded ? "p-2" : "justify-center p-0",
              isActive && "bg-slate-200/80",
            )}
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-100 text-sm font-bold text-brand-700">
              {(user?.full_name || user?.email || "Z").slice(0, 2).toUpperCase()}
            </div>
            <div className={cn("min-w-0 transition-opacity duration-150", isExpanded ? "opacity-100" : "hidden opacity-0")}>
              <p className="truncate text-sm font-bold text-midnight">{user?.full_name || user?.email || t("sidebar.product")}</p>
              <p className="truncate text-xs text-slate-500">{t("account.menuProfile")}</p>
            </div>
          </NavLink>
        </div>
      </div>
    </aside>
  );
}
