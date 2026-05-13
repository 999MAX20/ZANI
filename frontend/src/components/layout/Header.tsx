import { Bell, Check, LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { notificationsApi } from "../../api/notifications";
import { useAuth } from "../../features/auth/AuthProvider";
import { useI18n } from "../../lib/i18n";
import { formatDateTime } from "../../lib/format";
import { Button } from "../ui/Button";
import { StatusBadge } from "../ui/StatusBadge";
import { GlobalSearch } from "./GlobalSearch";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, userEmail, logout } = useAuth();
  const { t } = useI18n();
  const [showNotifications, setShowNotifications] = useState(false);
  const notifications = useQuery({ queryKey: ["notifications"], queryFn: notificationsApi.list });
  const notificationSummary = useQuery({ queryKey: ["notifications-summary"], queryFn: notificationsApi.summary });
  const markSentMutation = useMutation({
    mutationFn: notificationsApi.markSent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-summary"] });
    },
  });

  const pendingCount = notificationSummary.data?.pending ?? (notifications.data || []).filter((item) => item.status === "pending").length;
  const latestNotifications = (notifications.data || []).slice(0, 5);

  return (
    <header className="sticky top-0 z-10 px-3 pt-3 lg:px-6">
      <div className="glass-panel flex h-16 items-center justify-between rounded-3xl px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Button className="h-10 w-10 rounded-full px-0 lg:hidden" variant="ghost" onClick={onMenuClick} aria-label="Открыть меню">
            <Menu size={20} />
          </Button>
          <GlobalSearch />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              variant="ghost"
              className="relative h-11 w-11 rounded-full px-0"
              aria-label="Уведомления"
              onClick={() => setShowNotifications((current) => !current)}
            >
              <Bell size={42} strokeWidth={2.25} />
              {pendingCount ? (
                <span className="absolute -right-1 -top-1 min-w-6 rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] font-bold text-white ring-2 ring-white">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              ) : null}
            </Button>
            {showNotifications ? (
              <div className="absolute right-0 top-12 w-[22rem] rounded-3xl border border-white/70 bg-white/95 p-4 text-sm shadow-premium backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-midnight">Уведомления</p>
                    <p className="mt-0.5 text-xs text-slate-400">{notificationSummary.data?.due || 0} требуют внимания сейчас</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">{pendingCount} pending</span>
                </div>
                <div className="mt-4 space-y-3">
                  {latestNotifications.map((notification) => (
                    <div key={notification.id} className="rounded-2xl border border-slate-100 bg-white/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="line-clamp-2 font-semibold text-midnight">{notification.text}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDateTime(notification.send_at)}</p>
                        </div>
                        <StatusBadge status={notification.status} />
                      </div>
                      {notification.status === "pending" ? (
                        <Button
                          variant="ghost"
                          className="mt-2 h-9 rounded-full px-3 text-xs"
                          onClick={() => markSentMutation.mutate(notification.id)}
                        >
                          <Check size={15} />
                          Отметить
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {!latestNotifications.length ? (
                    <p className="rounded-2xl bg-slate-50 p-4 leading-6 text-slate-500">
                      Уведомлений пока нет. Напоминания по записям и CRM-события будут появляться здесь.
                    </p>
                  ) : null}
                </div>
                <Link
                  to="/dashboard/tasks"
                  onClick={() => setShowNotifications(false)}
                  className="mt-4 block rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Открыть задачи
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
            className="h-10 rounded-full"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">{t("header.logout")}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
