import { Bell, Check, LogOut, Menu, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { notificationsApi } from "../../api/notifications";
import { useAuth } from "../../features/auth/AuthProvider";
import { useI18n } from "../../lib/i18n";
import { formatDateTime } from "../../lib/format";
import { realtimeIntervals, realtimeQueryOptions } from "../../lib/realtime";
import { Button } from "../ui/Button";
import { StatusBadge } from "../ui/StatusBadge";
import { GlobalSearch } from "./GlobalSearch";
import { LanguageSelector } from "./LanguageSelector";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, userEmail, logout } = useAuth();
  const { t } = useI18n();
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: notificationsApi.list,
    refetchInterval: realtimeIntervals.notificationsMs,
    ...realtimeQueryOptions,
  });
  const notificationSummary = useQuery({
    queryKey: ["notifications-summary"],
    queryFn: notificationsApi.summary,
    refetchInterval: realtimeIntervals.notificationsMs,
    ...realtimeQueryOptions,
  });
  const markSentMutation = useMutation({
    mutationFn: notificationsApi.markSent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-summary"] });
    },
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

  const unreadCount = notificationSummary.data?.unread ?? (notifications.data || []).filter((item) => !item.read_at).length;
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

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (notificationsRef.current?.contains(event.target as Node)) return;
      setShowNotifications(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setShowNotifications(false);
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

  return (
    <header className="sticky top-0 z-50 px-2 pt-2 sm:px-3 sm:pt-3 lg:px-6">
      <div className="glass-panel flex h-[4.45rem] items-center justify-between rounded-[1.6rem] bg-white/88 px-2.5 sm:h-16 sm:rounded-3xl sm:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button className="h-[52px] w-[52px] min-h-[52px] min-w-[52px] rounded-full px-0 lg:hidden" variant="ghost" onClick={onMenuClick} aria-label={t("sidebar.expand")}>
            <Menu size={28} strokeWidth={2.35} />
          </Button>
          <GlobalSearch />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <LanguageSelector className="hidden md:inline-flex" />
          <div className="relative" ref={notificationsRef}>
            <Button
              variant="ghost"
              className="relative h-[52px] w-[52px] min-h-[52px] min-w-[52px] rounded-full px-0"
              aria-label={t("header.notifications")}
              onClick={() => setShowNotifications((current) => !current)}
            >
              <Bell size={30} strokeWidth={2.35} />
              {unreadCount ? (
                <span className="absolute -right-1 -top-1 min-w-6 rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] font-bold text-white ring-2 ring-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Button>
            {showNotifications ? (
              <div className="fixed inset-x-3 top-20 max-h-[76vh] overflow-y-auto rounded-3xl border border-white/70 bg-white/95 p-4 text-sm shadow-premium backdrop-blur-xl sm:absolute sm:inset-auto sm:right-0 sm:top-12 sm:w-[26rem]">
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
                                  {notification.priority}
                                </span>
                              </div>
                              <p className="line-clamp-2 font-semibold text-midnight">{notification.text}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {notification.recipient_name || notification.recipient_email || t("notification.allBusiness")} · {notification.client_name || "CRM"} · {formatDateTime(notification.send_at)}
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
                                  navigate(notification.action_url);
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
                            {notification.status === "pending" ? (
                              <Button
                                variant="ghost"
                                className="h-9 rounded-full px-3 text-xs"
                                onClick={() => markSentMutation.mutate(notification.id)}
                              >
                                {t("notification.sent")}
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
          <div className="hidden text-right lg:block">
            <p className="text-xs font-semibold text-midnight">{userEmail}</p>
            <p className="text-[11px] text-slate-400">{user?.role || t("header.role")}</p>
          </div>
          <Button
            variant="secondary"
            className="h-[52px] min-h-[52px] rounded-full px-3 sm:h-10 sm:min-h-10"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LogOut size={26} className="sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">{t("header.logout")}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
