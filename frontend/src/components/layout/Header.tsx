import { Bell, Check, KeyRound, LogOut, Menu, MessageSquareText, Settings, Sparkles, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { notificationsApi } from "../../api/notifications";
import { inboxApi } from "../../api/inbox";
import { useAuth } from "../../features/auth/AuthProvider";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useI18n } from "../../lib/i18n";
import { formatDateTime } from "../../lib/format";
import { businessRoleLabel, hasPermission } from "../../lib/permissions";
import { realtimeIntervals, realtimeQueryOptions } from "../../lib/realtime";
import { Button } from "../ui/Button";
import { StatusBadge } from "../ui/StatusBadge";
import { GlobalSearch } from "./GlobalSearch";
import { LanguageSelector } from "./LanguageSelector";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, userEmail, logout } = useAuth();
  const { business } = useActiveBusiness();
  const { t } = useI18n();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [chatToastOpen, setChatToastOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const previousUnreadMessagesRef = useRef<number | null>(null);
  const lastScrollYRef = useRef(0);
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: notificationsApi.list,
    enabled: Boolean(user) && showNotifications,
    ...realtimeQueryOptions,
  });
  const notificationSummary = useQuery({
    queryKey: ["notifications-summary"],
    queryFn: notificationsApi.summary,
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
  const canViewBusinessSettings = hasPermission(user, business?.id, "settings");
  const receivesChatToasts = Boolean(user && activeMembership?.role !== "owner" && user.role !== "business_owner");
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
    "/leads": "/dashboard/leads",
    "/clients": "/dashboard/clients",
    "/deals": "/dashboard/deals",
    "/tasks": "/dashboard/tasks",
    "/calendar": "/dashboard/calendar",
    "/appointments": "/dashboard/appointments",
    "/conversations": "/dashboard/conversations",
    "/integrations": "/dashboard/integrations",
    "/settings": "/dashboard/settings",
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
      if (accountMenuRef.current?.contains(event.target as Node)) return;
      setShowNotifications(false);
      setShowAccountMenu(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowNotifications(false);
        setShowAccountMenu(false);
      }
    }

    if (showNotifications || showAccountMenu) {
      document.addEventListener("pointerdown", handlePointerDown);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showNotifications, showAccountMenu]);

  useEffect(() => {
    const previous = previousUnreadMessagesRef.current;
    previousUnreadMessagesRef.current = unreadChatMessages;
    if (!receivesChatToasts || previous === null || unreadChatMessages <= previous) return;
    setChatToastOpen(true);
    const timer = window.setTimeout(() => setChatToastOpen(false), 6500);
    return () => window.clearTimeout(timer);
  }, [receivesChatToasts, unreadChatMessages]);

  useEffect(() => {
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
    <header className={`fixed left-0 right-0 top-0 z-50 border-b border-slate-200 bg-white/95 shadow-[0_1px_3px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-transform duration-200 ease-out lg:left-[72px] ${headerVisible ? "translate-y-0" : "-translate-y-full"}`}>
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button className="h-10 w-10 min-h-10 min-w-10 px-0 text-midnight lg:hidden" variant="ghost" onClick={onMenuClick} aria-label={t("sidebar.expand")}>
            <Menu size={22} strokeWidth={2.2} />
          </Button>
          <div className="hidden items-center gap-6 lg:flex">
            <span className="whitespace-nowrap border-b-2 border-brand-600 py-1 text-base font-bold text-midnight">{activeMembership ? businessRoleLabel(activeMembership.role, t) : t("header.role")}</span>
            <span className="hidden items-center gap-2 whitespace-nowrap text-base font-medium text-slate-700 2xl:inline-flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {t("header.statusActive")}
            </span>
          </div>
          <div className="lg:hidden">
            <GlobalSearch />
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden lg:block">
            <GlobalSearch />
          </div>
          <LanguageSelector className="hidden md:inline-flex" />
          <div className="relative" ref={notificationsRef}>
            <Button
              variant="ghost"
              className="relative h-12 w-12 min-h-12 min-w-12 rounded-xl px-0"
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
                  to="/dashboard/tasks"
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
                      navigate("/dashboard/conversations?unread=true");
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
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              className="hidden rounded-xl px-3 py-2 text-right transition hover:bg-slate-100 lg:block"
              onClick={() => {
                setShowAccountMenu((current) => !current);
                setShowNotifications(false);
              }}
            >
              <p className="text-xs font-semibold text-midnight">{userEmail}</p>
              <p className="text-[11px] text-slate-400">{activeMembership ? businessRoleLabel(activeMembership.role, t) : user?.role || t("header.role")}</p>
            </button>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-sm font-black text-midnight transition hover:bg-slate-200 lg:hidden"
              onClick={() => {
                setShowAccountMenu((current) => !current);
                setShowNotifications(false);
              }}
              aria-label={t("account.openMenu")}
            >
              {(user?.full_name || user?.email || "ZA").slice(0, 2).toUpperCase()}
            </button>
            {showAccountMenu ? (
              <div className="fixed inset-x-3 top-20 z-[90] rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-premium sm:absolute sm:inset-auto sm:right-0 sm:top-12 sm:w-72">
                <div className="border-b border-slate-100 px-3 py-3">
                  <p className="truncate font-black text-midnight">{user?.full_name || userEmail}</p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{userEmail}</p>
                </div>
                <Link
                  to="/dashboard/account"
                  onClick={() => setShowAccountMenu(false)}
                  className="mt-2 flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-midnight"
                >
                  <UserRound size={18} />
                  {t("account.menuProfile")}
                </Link>
                <Link
                  to="/dashboard/account#notifications"
                  onClick={() => setShowAccountMenu(false)}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-midnight"
                >
                  <Bell size={18} />
                  {t("account.menuNotifications")}
                </Link>
                <Link
                  to="/dashboard/account"
                  onClick={() => setShowAccountMenu(false)}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-midnight"
                >
                  <KeyRound size={18} />
                  {t("account.menuSecurity")}
                </Link>
                {canViewBusinessSettings ? (
                  <Link
                    to="/dashboard/settings"
                    onClick={() => setShowAccountMenu(false)}
                    className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-midnight"
                  >
                    <Settings size={18} />
                    {t("account.menuBusinessSettings")}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
          <Button
            variant="secondary"
            className="h-10 min-h-10 rounded-lg px-3"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">{t("header.logout")}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
