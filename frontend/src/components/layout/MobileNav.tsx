import { Home, Inbox, MessageSquareText, MoreHorizontal, Users, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { NavLink } from "react-router-dom";

import { cn } from "../../lib/cn";
import { inboxApi } from "../../api/inbox";
import { hasPermission } from "../../lib/permissions";
import { useI18n } from "../../lib/i18n";
import { realtimeIntervals, realtimeQueryOptions } from "../../lib/realtime";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useAuth } from "../../features/auth/AuthProvider";
import { Button } from "../ui/Button";
import { Sidebar } from "./Sidebar";

const bottomItems = [
  { to: "/app", label: "mobile.home", icon: Home },
  { to: "/app/leads", label: "nav.leads", icon: Inbox, resource: "leads" },
  { to: "/app/clients", label: "nav.clients", icon: Users, resource: "clients" },
  { to: "/app/conversations", label: "nav.conversations", icon: MessageSquareText, resource: "conversations" },
];

export function MobileNav({ open, onOpen, onClose }: { open: boolean; onOpen: () => void; onClose: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { business } = useActiveBusiness();
  const visibleBottomItems = bottomItems.filter((item) => !item.resource || hasPermission(user, business?.id, item.resource));
  const inboxSummary = useQuery({
    queryKey: ["inbox-summary", business?.id],
    queryFn: inboxApi.getSummary,
    enabled: Boolean(user) && Boolean(business?.id) && hasPermission(user, business?.id, "conversations"),
    refetchInterval: realtimeIntervals.inboxConversationsMs,
    ...realtimeQueryOptions,
  });
  const unreadMessages = inboxSummary.data?.unread_messages ?? inboxSummary.data?.unread ?? 0;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "contain";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [open]);

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-[80] bg-[rgba(23,18,15,0.38)] backdrop-blur-md lg:hidden">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label={t("sidebar.collapse")}
            onClick={onClose}
          />
          <div className="relative h-full w-[min(390px,94vw)]">
            <div className="absolute right-3 top-3 z-[90]">
              <Button variant="secondary" className="h-11 w-11 rounded-full border border-zani-border bg-surface-card px-0 shadow-premium" onClick={onClose} aria-label={t("sidebar.collapse")}>
                <X size={22} strokeWidth={2.2} />
              </Button>
            </div>
            <Sidebar forceVisible mobileDrawer onNavigate={onClose} />
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-2 bottom-2 z-[60] grid grid-cols-5 rounded-card border border-zani-border bg-surface-card/96 p-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-premium backdrop-blur-2xl lg:hidden">
        {visibleBottomItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/app"}
              className={({ isActive }) =>
                cn(
                  "zani-focus-ring flex min-h-14 flex-col items-center justify-center gap-1 rounded-control px-0.5 py-2 text-center text-[10px] font-semibold leading-none text-zani-faint transition active:scale-[0.98]",
                  isActive && "bg-brand-500 text-white shadow-sm",
                )
              }
            >
              <span className="relative">
                <Icon size={26} strokeWidth={2.35} />
                {item.to === "/app/conversations" && unreadMessages ? (
                  <span className="absolute -right-3 -top-2 min-w-5 rounded-full bg-zani-danger px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white ring-2 ring-surface">
                    {unreadMessages > 99 ? "99+" : unreadMessages}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full break-words">{t(item.label)}</span>
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={onOpen}
          aria-label={t("mobile.more")}
          className={cn(
            "zani-focus-ring flex min-h-14 flex-col items-center justify-center gap-1 rounded-control px-0.5 py-2 text-center text-[10px] font-semibold leading-none text-zani-faint transition hover:bg-surface-muted hover:text-zani-text active:scale-[0.98]",
            open && "bg-brand-500 text-white shadow-sm",
          )}
        >
          <MoreHorizontal size={26} strokeWidth={2.35} />
          <span className="max-w-full break-words">{t("mobile.more")}</span>
        </button>
      </nav>
    </>
  );
}
