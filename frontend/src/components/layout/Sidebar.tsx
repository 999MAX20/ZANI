import {
  BarChart3,
  Building2,
  CalendarDays,
  Bot,
  ChevronDown,
  Clock3,
  Home,
  Inbox,
  KanbanSquare,
  ListChecks,
  Megaphone,
  MessageSquareText,
  PlugZap,
  Settings,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
  to?: string;
  label: string;
  icon: typeof Home;
  resource?: string;
  children?: SidebarItem[];
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
      { to: "/app", label: "nav.dashboard", icon: Home },
      { to: "/app/leads", label: "nav.leads", icon: Inbox, resource: "leads" },
      { to: "/app/deals", label: "nav.deals", icon: KanbanSquare, resource: "deals" },
      { to: "/app/clients", label: "nav.clients", icon: Users, resource: "clients" },
      { to: "/app/tasks", label: "nav.tasks", icon: ListChecks, resource: "tasks" },
      { to: "/app/calendar", label: "nav.calendar", icon: CalendarDays, resource: "appointments" },
      { to: "/app/conversations", label: "nav.conversations", icon: MessageSquareText, resource: "conversations" },
      {
        label: "nav.channels",
        icon: PlugZap,
        children: [
          { to: "/app/outreach", label: "nav.outreach", icon: Megaphone, resource: "notifications" },
          { to: "/app/ai-agents", label: "nav.aiAgents", icon: Bot, resource: "ai_automation" },
          { to: "/app/integrations", label: "nav.integrations", icon: PlugZap, resource: "integrations" },
        ],
      },
      {
        label: "nav.business",
        icon: Building2,
        resource: "settings",
        children: [
          { to: "/app/services", label: "nav.services", icon: Wrench, resource: "settings" },
          { to: "/app/resources", label: "nav.resources", icon: Users, resource: "settings" },
          { to: "/app/working-hours", label: "nav.workingHours", icon: Clock3, resource: "settings" },
        ],
      },
      {
        label: "nav.control",
        icon: BarChart3,
        children: [
          { to: "/app/analytics", label: "nav.analytics", icon: BarChart3, resource: "analytics" },
          { to: "/app/timeline", label: "nav.timeline", icon: Clock3, resource: "analytics" },
        ],
      },
      { to: "/app/settings", label: "nav.settings", icon: Settings, resource: "settings" },
    ],
  },
] satisfies SidebarSection[];

const mobileDrawerSections = [
  {
    id: "operations",
    titleKey: "nav.operations",
    items: [
      { to: "/app", label: "nav.dashboard", icon: Home },
      { to: "/app/leads", label: "nav.leads", icon: Inbox, resource: "leads" },
      { to: "/app/deals", label: "nav.deals", icon: KanbanSquare, resource: "deals" },
      { to: "/app/clients", label: "nav.clients", icon: Users, resource: "clients" },
      { to: "/app/tasks", label: "nav.tasks", icon: ListChecks, resource: "tasks" },
      { to: "/app/calendar", label: "nav.calendar", icon: CalendarDays, resource: "appointments" },
      { to: "/app/conversations", label: "nav.conversations", icon: MessageSquareText, resource: "conversations" },
      {
        label: "nav.channels",
        icon: PlugZap,
        children: [
          { to: "/app/outreach", label: "nav.outreach", icon: Megaphone, resource: "notifications" },
          { to: "/app/ai-agents", label: "nav.aiAgents", icon: Bot, resource: "ai_automation" },
          { to: "/app/integrations", label: "nav.integrations", icon: PlugZap, resource: "integrations" },
        ],
      },
      {
        label: "nav.business",
        icon: Building2,
        resource: "settings",
        children: [
          { to: "/app/services", label: "nav.services", icon: Wrench, resource: "settings" },
          { to: "/app/resources", label: "nav.resources", icon: Users, resource: "settings" },
          { to: "/app/working-hours", label: "nav.workingHours", icon: Clock3, resource: "settings" },
        ],
      },
      {
        label: "nav.control",
        icon: BarChart3,
        children: [
          { to: "/app/analytics", label: "nav.analytics", icon: BarChart3, resource: "analytics" },
          { to: "/app/timeline", label: "nav.timeline", icon: Clock3, resource: "analytics" },
        ],
      },
      { to: "/app/settings", label: "nav.settings", icon: Settings, resource: "settings" },
    ],
  },
] satisfies SidebarSection[];

function isItemActive(pathname: string, to?: string) {
  if (!to) return false;
  return pathname === to || (to !== "/app" && pathname.startsWith(to));
}

function isSidebarItemVisible(item: SidebarItem, user: ReturnType<typeof useAuth>["user"], businessId?: number): boolean {
  if (item.resource && !hasPermission(user, businessId, item.resource)) return false;
  if (!item.children?.length) return true;
  return item.children.some((child) => isSidebarItemVisible(child, user, businessId));
}

function filterSidebarItem(item: SidebarItem, user: ReturnType<typeof useAuth>["user"], businessId?: number): SidebarItem | null {
  if (!isSidebarItemVisible(item, user, businessId)) return null;
  if (!item.children?.length) return item;
  const children = item.children.map((child) => filterSidebarItem(child, user, businessId)).filter(Boolean) as SidebarItem[];
  return children.length ? { ...item, children } : null;
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ "nav.channels": true, "nav.business": true, "nav.control": true });

  const visibleGroups = useMemo(
    () =>
      (mobileDrawer ? mobileDrawerSections : desktopSections)
        .map((group) => ({
          ...group,
          items: group.items.map((item) => filterSidebarItem(item, user, business?.id)).filter(Boolean) as SidebarItem[],
        }))
        .filter((group) => group.items.length),
    [business?.id, mobileDrawer, user],
  );
  return (
    <aside
      onMouseEnter={forceVisible ? undefined : onDesktopMouseEnter}
      onMouseLeave={forceVisible ? undefined : onDesktopMouseLeave}
      className={cn(
        "relative z-[60] shrink-0 border-r border-zani-border bg-surface-card transition-[width,box-shadow,background-color,backdrop-filter] duration-200 ease-out",
        forceVisible && "h-dvh max-h-dvh w-[min(360px,94vw)] bg-surface-card shadow-premium backdrop-blur-2xl",
        !forceVisible && cn(
          "hidden bg-surface-card/92 backdrop-blur-2xl lg:fixed lg:inset-y-0 lg:left-0 lg:block",
          isExpanded ? "lg:w-[224px] lg:bg-surface-card lg:shadow-panel lg:backdrop-blur-2xl" : "lg:w-16",
        ),
        !forceVisible && "hidden lg:block",
      )}
    >
      <div className={cn("flex h-full min-h-0 flex-col", forceVisible && "min-h-dvh overflow-y-auto pb-8")}>
        <div className={cn("py-3", isExpanded ? "px-3" : "px-2")}>
          <div className={cn("flex items-center", isExpanded ? "justify-start gap-2" : "justify-center")}>
            <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-control bg-brand-500 text-white shadow-sm">
              <Sparkles size={20} />
            </div>
            <div className={cn("min-w-0 transition-opacity duration-150", isExpanded ? "opacity-100" : "pointer-events-none hidden opacity-0")}>
              <p className="truncate text-sm font-semibold text-zani-text">{t("sidebar.product")}</p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-1.5 no-scrollbar">
          {visibleGroups.map((group) => {
            return (
            <section key={group.id}>
              {mobileDrawer ? <div
                className="mb-1 flex min-h-7 w-full items-center justify-between rounded-control px-3 text-left text-[10px] font-semibold text-zani-faint transition-colors hover:bg-surface-muted hover:text-zani-subtle"
              >
                <span>{t(group.titleKey)}</span>
              </div> : null}

              <nav className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const childActive = item.children?.some((child) => isItemActive(location.pathname, child.to)) || false;
                  const active = isItemActive(location.pathname, item.to) || childActive;
                  const hasChildren = Boolean(item.children?.length);
                  const childrenOpen = Boolean(openGroups[item.label] || childActive);

                  if (hasChildren) {
                    return (
                      <div key={item.label}>
                        <button
                          type="button"
                          onClick={() => setOpenGroups((value) => ({ ...value, [item.label]: !childrenOpen }))}
                          title={t(item.label)}
                          className={cn(
                            "zani-focus-ring group relative flex min-h-10 w-full items-center gap-2 rounded-control border-l-2 border-transparent px-3 py-2 text-xs font-semibold text-zani-subtle transition-colors duration-150",
                            !isExpanded && "justify-center px-0",
                            "hover:bg-brand-50 hover:text-zani-text",
                            active && "border-brand-600 bg-brand-50 text-zani-text",
                          )}
                        >
                          <span
                            className={cn(
                              "grid h-5 w-5 shrink-0 place-items-center text-zani-faint transition-colors",
                              active && "text-brand-600",
                              !active && "group-hover:text-zani-text",
                            )}
                          >
                            <Icon size={18} strokeWidth={2.1} />
                          </span>
                          <span className={cn("min-w-0 truncate text-left transition-opacity duration-150", isExpanded ? "opacity-100" : "hidden opacity-0")}>{t(item.label)}</span>
                          {isExpanded ? <ChevronDown size={16} className={cn("ml-auto text-zani-faint transition-transform", childrenOpen && "rotate-180")} /> : null}
                        </button>
                        {isExpanded && childrenOpen ? (
                          <div className="ml-6 mt-1 space-y-0.5 border-l border-zani-border pl-2">
                            {item.children?.map((child) => {
                              const ChildIcon = child.icon;
                              const childIsActive = isItemActive(location.pathname, child.to);
                              return child.to ? (
                                <NavLink
                                  key={child.to}
                                  to={child.to}
                                  onClick={onNavigate}
                                  onMouseEnter={() => prefetchRouteData(child.to!, queryClient, business?.id)}
                                  onFocus={() => prefetchRouteData(child.to!, queryClient, business?.id)}
                                  title={t(child.label)}
                                  className={cn(
                                    "zani-focus-ring group relative flex min-h-9 items-center gap-2 rounded-control px-2.5 py-1.5 text-xs font-semibold text-zani-subtle transition-colors duration-150",
                                    "hover:bg-brand-50 hover:text-zani-text",
                                    childIsActive && "bg-brand-50 text-zani-text",
                                  )}
                                >
                                  <ChildIcon size={16} strokeWidth={2.1} className={cn("shrink-0 text-zani-faint", childIsActive && "text-brand-600")} />
                                  <span className="min-w-0 truncate">{t(child.label)}</span>
                                </NavLink>
                              ) : null;
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  }

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to!}
                      end={item.to === "/app"}
                      onClick={onNavigate}
                      onMouseEnter={() => prefetchRouteData(item.to!, queryClient, business?.id)}
                      onFocus={() => prefetchRouteData(item.to!, queryClient, business?.id)}
                      title={t(item.label)}
                      className={cn(
                        "zani-focus-ring group relative flex min-h-10 items-center gap-2 rounded-control border-l-2 border-transparent px-3 py-2 text-xs font-semibold text-zani-subtle transition-colors duration-150",
                        !isExpanded && "justify-center px-0",
                        "hover:bg-brand-50 hover:text-zani-text",
                        active && "border-brand-600 bg-brand-50 text-zani-text",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-5 w-5 shrink-0 place-items-center text-zani-faint transition-colors",
                          active && "text-brand-600",
                          !active && "group-hover:text-zani-text",
                        )}
                      >
                        <Icon size={18} strokeWidth={2.1} />
                      </span>
                      <span className={cn("min-w-0 truncate transition-opacity duration-150", isExpanded ? "opacity-100" : "hidden opacity-0")}>{t(item.label)}</span>
                      {item.to === "/app/conversations" && unreadMessages ? (
                        <span className={cn("min-w-5 rounded-full bg-zani-danger px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white shadow-sm", isExpanded ? "ml-auto" : "absolute right-1 top-1 px-1")}>
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

        <div className={cn("border-t border-zani-border", isExpanded ? "p-2" : "p-1.5")}>
          <NavLink
            to="/app/account"
            onClick={onNavigate}
            title={t("account.menuProfile")}
            className={({ isActive }) => cn(
              "zani-focus-ring flex items-center gap-2 rounded-control transition hover:bg-surface-muted",
              isExpanded ? "p-2" : "justify-center p-1",
              isActive && "bg-surface-muted",
            )}
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-100 text-xs font-semibold text-brand-700">
              {(user?.full_name || user?.email || "Z").slice(0, 2).toUpperCase()}
            </div>
            <div className={cn("min-w-0 transition-opacity duration-150", isExpanded ? "opacity-100" : "hidden opacity-0")}>
              <p className="truncate text-xs font-semibold text-midnight">{user?.full_name || user?.email || t("sidebar.product")}</p>
              <p className="truncate text-[11px] text-zani-faint">{t("account.menuProfile")}</p>
            </div>
          </NavLink>
        </div>
      </div>
    </aside>
  );
}
