import { Bell, Check, Menu, MessageSquareText, Moon, SlidersHorizontal, Sparkles, Sun, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { notificationsApi } from "../../api/notifications";
import { inboxApi } from "../../api/inbox";
import { useAuth } from "../../features/auth/AuthProvider";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useI18n } from "../../lib/i18n";
import { formatDateTime } from "../../lib/format";
import { hasPermission } from "../../lib/permissions";
import { realtimeIntervals, realtimeQueryOptions } from "../../lib/realtime";
import { useTheme } from "../../lib/theme";
import { Button } from "../ui/Button";
import { StatusBadge } from "../ui/StatusBadge";
import { GlobalSearch } from "./GlobalSearch";
import type { PageHeaderConfig } from "./PageHeaderContext";

export function Header({ onMenuClick, pageHeader }: { onMenuClick: () => void; pageHeader: PageHeaderConfig | null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { business } = useActiveBusiness();
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [chatToastOpen, setChatToastOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const previousUnreadMessagesRef = useRef<number | null>(null);
  const lastScrollYRef = useRef(0);
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(),
    enabled: Boolean(user) && showNotifications,
    ...realtimeQueryOptions,
  });
  const notificationSummary = useQuery({
    queryKey: ["notifications-summary"],
    queryFn: () => notificationsApi.summary(),
    enabled: Boolean(user),
    refetchInterval: realtimeIntervals.notificationsMs,
    ...realtimeQueryOptions,
  });
  const inboxSummary = useQuery({
    queryKey: ["inbox-summary", business?.id],
    queryFn: inboxApi.getSummary,
    enabled: Boolean(user) && Boolean(business?.id) && hasPermission(user, business?.id, "conversations"),
    refetchInterval: realtimeIntervals.inboxConversationsMs,
    ...realtimeQueryOptions,
  });
  const markReadMutation = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-summary"] });
    },
  });
  const markAllReadMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-summary"] });
    },
  });

  const unreadCount = notificationSummary.data?.unread ?? 0;
  const unreadChatMessages = inboxSummary.data?.unread_messages ?? inboxSummary.data?.unread ?? 0;
  const activeMembership = user?.memberships?.find((membership) => String(membership.business) === String(business?.id) && membership.is_active);
  const receivesChatToasts = Boolean(user && activeMembership?.role !== "owner" && user.role !== "business_owner");
  const currentPageTitle = pageHeader?.title || getPageTitle(location.pathname, t);
  const latestNotifications = [...(notifications.data || [])].sort((a, b) => Number(!b.read_at) - Number(!a.read_at) || new Date(b.send_at).getTime() - new Date(a.send_at).getTime()).slice(0, 7);
  const groupedNotifications = latestNotifications.reduce<Record<string, typeof latestNotifications>>((acc, notification) => {
    const key = notification.category || "system";
    acc[key] = acc[key] || [];
    acc[key].push(notification);
    return acc;
  }, {});
  const categoryLabels: Record<string, string> = {
    sales: t("notification.category.sales"),
    finance: t("notification.category.finance"),
    system: t("notification.category.system"),
    ai_alerts: t("notification.category.aiAlerts"),
    outreach: t("notification.category.outreach"),
    tasks: t("notification.category.tasks"),
  };
  const priorityClass: Record<string, string> = {
    low: "bg-slate-50 text-slate-500",
    normal: "bg-brand-50 text-brand-700",
    high: "bg-amber-50 text-amber-700",
    urgent: "bg-red-50 text-red-700",
  };
  const priorityLabels: Record<string, string> = {
    low: t("notification.priority.low"),
    normal: t("notification.priority.normal"),
    high: t("notification.priority.high"),
    urgent: t("notification.priority.urgent"),
  };
  const legacyNotificationRoutes: Record<string, string> = {
    "/leads": "/app/leads",
    "/clients": "/app/clients",
    "/deals": "/app/deals",
    "/tasks": "/app/tasks",
    "/calendar": "/app/calendar",
    "/appointments": "/app/calendar",
    "/conversations": "/app/conversations",
    "/integrations": "/app/integrations",
    "/settings": "/app/settings",
  };

  function notificationAudienceLabel(notification: (typeof latestNotifications)[number]) {
    if (notification.recipient && notification.recipient === user?.id) return t("notification.toMe");
    if (notification.recipient_name || notification.recipient_email) {
      return t("notification.toUser", { name: notification.recipient_name || notification.recipient_email || "" });
    }
    return t("notification.toTeam");
  }

  function resolveNotificationRoute(url: string) {
    const [path, query = ""] = url.split("?");
    const route = legacyNotificationRoutes[path] || url;
    return query && legacyNotificationRoutes[path] ? `${route}?${query}` : route;
  }

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (notificationsRef.current?.contains(event.target as Node)) return;
      setShowNotifications(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowNotifications(false);
      }
    }

    if (showNotifications) {
      document.addEventListener("pointerdown", handlePointerDown);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showNotifications]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (filtersRef.current?.contains(event.target as Node)) return;
      setShowFilters(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowFilters(false);
      }
    }

    if (showFilters) {
      document.addEventListener("pointerdown", handlePointerDown);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showFilters]);

  useEffect(() => {
    const previous = previousUnreadMessagesRef.current;
    previousUnreadMessagesRef.current = unreadChatMessages;
    if (!receivesChatToasts || previous === null || unreadChatMessages <= previous) return;
    setChatToastOpen(true);
    const timer = window.setTimeout(() => setChatToastOpen(false), 6500);
    return () => window.clearTimeout(timer);
  }, [receivesChatToasts, unreadChatMessages]);

  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setHeaderVisible(true);
      return;
    }

    lastScrollYRef.current = window.scrollY;

    function handleScroll() {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollYRef.current;

      if (currentY < 24 || showNotifications) {
        setHeaderVisible(true);
        lastScrollYRef.current = currentY;
        return;
      }

      if (Math.abs(delta) < 8) return;
      setHeaderVisible(delta < 0 || currentY < 80);
      lastScrollYRef.current = currentY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [showNotifications]);

  return (
    <header className={`zani-app-header fixed left-0 right-0 top-0 z-50 border-b border-slate-200 bg-white/95 shadow-[0_1px_3px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-transform duration-200 ease-out lg:left-[72px] ${headerVisible ? "translate-y-0" : "-translate-y-full"}`}>
      <div className="grid h-16 grid-cols-[auto_1fr_auto] items-center gap-3 px-4 sm:px-6 lg:grid-cols-[260px_minmax(320px,560px)_auto]">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button className="h-10 w-10 min-h-10 min-w-10 px-0 text-midnight lg:hidden" variant="ghost" onClick={onMenuClick} aria-label={t("sidebar.expand")}>
            <Menu size={22} strokeWidth={2.2} />
          </Button>
          <div className="hidden min-w-0 items-center gap-4 lg:flex">
            <span className="zani-header-title whitespace-nowrap rounded-full px-3 py-1.5 text-base font-bold text-midnight">{currentPageTitle}</span>
          </div>
          <div className={pageHeader ? "min-w-0 flex-1 lg:hidden" : "lg:hidden"}>
            <GlobalSearch />
          </div>
        </div>

        <div className="hidden min-w-0 justify-self-center lg:block lg:w-full">
          <GlobalSearch />
        </div>

        <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
          {pageHeader ? (
            <div className="hidden min-w-0 items-center justify-end gap-2 lg:flex">
              {pageHeader.filters ? (
                <div className="relative" ref={filtersRef}>
                  <Button
                    variant={pageHeader.activeFilterCount ? "primary" : "secondary"}
                    className="relative h-10 shrink-0 px-3"
                    onClick={() => setShowFilters((current) => !current)}
                    aria-label={pageHeader.filterLabel || t("calendar.filters")}
                    aria-expanded={showFilters}
                  >
                    <SlidersHorizontal size={17} />
                    <span className="hidden xl:inline">{pageHeader.filterLabel || t("calendar.filters")}</span>
                    {pageHeader.activeFilterCount ? (
                      <span className="grid min-w-5 place-items-center rounded-full bg-white/90 px-1.5 py-0.5 text-[11px] font-black text-brand-700">
                        {pageHeader.activeFilterCount}
                      </span>
                    ) : null}
                  </Button>
                  {showFilters ? (
                    <div className="fixed inset-0 z-[80] bg-slate-950/25 backdrop-blur-[1px]">
                      <button type="button" className="absolute inset-0 cursor-default" aria-label={t("common.close")} onClick={() => setShowFilters(false)} />
                      <aside className="absolute bottom-0 right-0 top-0 flex w-[min(420px,calc(100vw-1rem))] flex-col border-l border-slate-200 bg-white shadow-premium">
                        <div className="flex h-16 items-center justify-between gap-3 border-b border-slate-200 px-5">
                          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                            <SlidersHorizontal size={15} />
                            <span>{pageHeader.filterLabel || t("calendar.filters")}</span>
                          </div>
                          <button
                            type="button"
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                            onClick={() => setShowFilters(false)}
                            aria-label={t("common.close")}
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto p-5">{pageHeader.filters}</div>
                      </aside>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {pageHeader.secondaryActions?.map((action) => {
                const Icon = action.icon;
                return (
                  <Button key={action.label} variant="secondary" size="icon" className="h-10 w-10 shrink-0" onClick={action.onClick} aria-label={action.label}>
                    {Icon ? <Icon size={17} /> : null}
                  </Button>
                );
              })}
              <PrimaryPageAction action={pageHeader.primaryAction} />
            </div>
          ) : null}
          <div className="relative" ref={notificationsRef}>
            <Button
              variant="ghost"
              className="zani-theme-toggle mr-1 h-[30px] min-h-[30px] w-[66px] rounded-full p-0"
              aria-label={theme === "dark" ? t("theme.switchLight") : t("theme.switchDark")}
              title={theme === "dark" ? t("theme.switchLight") : t("theme.switchDark")}
              onClick={toggleTheme}
            >
              <span className="zani-theme-toggle__thumb">
                {theme === "dark" ? <Moon size={12} strokeWidth={2.45} /> : <Sun size={12} strokeWidth={2.45} />}
              </span>
            </Button>
            <Button
              variant="ghost"
              className="zani-header-icon-button relative h-12 w-12 min-h-12 min-w-12 rounded-xl px-0"
              aria-label={t("header.notifications")}
              onClick={() => setShowNotifications((current) => !current)}
            >
              <Bell size={32} strokeWidth={2.4} />
              {unreadCount ? (
                <span className="absolute -right-1 -top-1 min-w-6 rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] font-bold text-white ring-2 ring-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Button>
            {showNotifications ? (
              <div className="fixed inset-x-3 top-20 max-h-[76vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-premium sm:absolute sm:inset-auto sm:right-0 sm:top-12 sm:w-[26rem]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-midnight">{t("header.notifications")}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {t("header.notificationsSummary", {
                        due: notificationSummary.data?.due || 0,
                        urgent: notificationSummary.data?.urgent || 0,
                      })}
                    </p>
                  </div>
                  <Button variant="ghost" className="h-9 rounded-full px-3 text-xs" onClick={() => markAllReadMutation.mutate()} disabled={!unreadCount}>
                    <Check size={14} /> {t("header.markAllRead")}
                  </Button>
                </div>
                <div className="mt-4 space-y-4">
                  {Object.entries(groupedNotifications).map(([category, items]) => (
                    <div key={category} className="space-y-2">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{categoryLabels[category] || category}</p>
                      {items.map((notification) => (
                        <div key={notification.id} className={`rounded-2xl border p-3 ${notification.read_at ? "border-slate-100 bg-white/70" : "border-brand-100 bg-brand-50/45"}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                {!notification.read_at ? <span className="h-2 w-2 rounded-full bg-brand-600" /> : null}
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${priorityClass[notification.priority] || priorityClass.normal}`}>
                                  {priorityLabels[notification.priority] || notification.priority}
                                </span>
                              </div>
                              <p className="line-clamp-2 font-semibold text-midnight">{notification.text}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {notificationAudienceLabel(notification)} · {notification.client_name || "CRM"} · {formatDateTime(notification.send_at)}
                              </p>
                            </div>
                            <StatusBadge status={notification.status} />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {notification.action_url ? (
                              <Button
                                variant="secondary"
                                className="h-9 rounded-full px-3 text-xs"
                                onClick={() => {
                                  markReadMutation.mutate(notification.id);
                                  setShowNotifications(false);
                                  navigate(resolveNotificationRoute(notification.action_url));
                                }}
                              >
                                <Sparkles size={14} />
                                {notification.action_label || t("common.open")}
                              </Button>
                            ) : null}
                            {!notification.read_at ? (
                              <Button variant="ghost" className="h-9 rounded-full px-3 text-xs" onClick={() => markReadMutation.mutate(notification.id)}>
                                <Check size={15} />
                                {t("notification.read")}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  {!latestNotifications.length ? (
                    <p className="rounded-2xl bg-slate-50 p-4 leading-6 text-slate-500">
                      {t("header.noNotifications")}
                    </p>
                  ) : null}
                </div>
                <Link
                  to="/app/tasks"
                  onClick={() => setShowNotifications(false)}
                  className="mt-4 block rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {t("header.openTasks")}
                </Link>
              </div>
            ) : null}
          </div>
          {chatToastOpen ? (
            <div className="fixed right-4 top-24 z-[90] w-[min(360px,calc(100vw-2rem))] rounded-3xl border border-white/80 bg-white p-4 shadow-premium ring-1 ring-red-100">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-600">
                  <MessageSquareText size={21} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-midnight">{t("header.chatToastTitle")}</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">
                    {t("header.chatToastText", { count: unreadChatMessages > 99 ? "99+" : unreadChatMessages })}
                  </p>
                  <button
                    type="button"
                    className="mt-3 rounded-2xl bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-800"
                    onClick={() => {
                      setChatToastOpen(false);
                      navigate("/app/conversations?unread=true");
                    }}
                  >
                    {t("header.openMessages")}
                  </button>
                </div>
                <button
                  type="button"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                  onClick={() => setChatToastOpen(false)}
                  aria-label={t("common.close")}
                >
                  <X size={17} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {pageHeader?.activeFilters ? (
        <div className="border-t border-slate-100 bg-white/95 px-4 py-1.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">{pageHeader.activeFilters}</div>
        </div>
      ) : null}
    </header>
  );
}

function PrimaryPageAction({ action }: { action?: PageHeaderConfig["primaryAction"] }) {
  if (!action) return null;
  const Icon = action.icon;
  return (
    <Button className="h-10 shrink-0 bg-blue-600 px-4 hover:bg-blue-700" onClick={action.onClick}>
      {Icon ? <Icon size={17} /> : null}
      {action.label}
    </Button>
  );
}

function getPageTitle(pathname: string, t: (key: string) => string) {
  const routes: Array<[string, string]> = [
    ["/app/clients", "nav.clients"],
    ["/app/deals", "nav.deals"],
    ["/app/leads", "nav.leads"],
    ["/app/tasks", "nav.tasks"],
    ["/app/calendar", "nav.calendar"],
    ["/app/conversations", "nav.conversations"],
    ["/app/analytics", "nav.analytics"],
    ["/app/ai-agents", "nav.aiAgents"],
    ["/app/integrations", "nav.integrations"],
    ["/app/settings", "nav.settings"],
    ["/app/account", "account.title"],
  ];
  const match = routes.find(([route]) => pathname === route || pathname.startsWith(`${route}/`));
  return match ? t(match[1]) : t("nav.dashboard");
}
