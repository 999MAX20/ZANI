import { Home, Inbox, KanbanSquare, MessageSquareText, MoreHorizontal, X } from "lucide-react";
import { useEffect } from "react";
import { NavLink } from "react-router-dom";

import { cn } from "../../lib/cn";
import { hasPermission } from "../../lib/permissions";
import { useI18n } from "../../lib/i18n";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useAuth } from "../../features/auth/AuthProvider";
import { Button } from "../ui/Button";
import { Sidebar } from "./Sidebar";

const bottomItems = [
  { to: "/dashboard", label: "mobile.home", icon: Home },
  { to: "/dashboard/leads", label: "nav.leads", icon: Inbox, resource: "leads" },
  { to: "/dashboard/deals", label: "nav.deals", icon: KanbanSquare, resource: "deals" },
  { to: "/dashboard/conversations", label: "nav.conversations", icon: MessageSquareText, resource: "conversations" },
];

export function MobileNav({ open, onOpen, onClose }: { open: boolean; onOpen: () => void; onClose: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { business } = useActiveBusiness();
  const visibleBottomItems = bottomItems.filter((item) => !item.resource || hasPermission(user, business?.id, item.resource));

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
        <div className="fixed inset-0 z-[80] bg-slate-950/42 backdrop-blur-md lg:hidden">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label={t("sidebar.collapse")}
            onClick={onClose}
          />
          <div className="relative h-full w-[min(390px,94vw)]">
            <div className="absolute right-3 top-3 z-50">
              <Button variant="secondary" className="h-[52px] w-[52px] rounded-full border border-slate-100 bg-white px-0 shadow-premium" onClick={onClose} aria-label={t("sidebar.collapse")}>
                <X size={30} strokeWidth={2.4} />
              </Button>
            </div>
            <Sidebar forceVisible mobileDrawer onNavigate={onClose} />
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-2 bottom-2 z-[60] grid grid-cols-5 rounded-[1.7rem] border border-white/70 bg-white/96 p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-premium backdrop-blur-2xl lg:hidden">
        {visibleBottomItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              className={({ isActive }) =>
                cn(
                  "flex min-h-[70px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center text-[11px] font-black leading-tight text-slate-500 transition active:scale-[0.98]",
                  isActive && "bg-ai-gradient text-white shadow-glow",
                )
              }
            >
              <Icon size={26} strokeWidth={2.35} />
              <span className="line-clamp-1 max-w-full">{t(item.label)}</span>
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "flex min-h-[70px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center text-[11px] font-black leading-tight text-slate-500 transition hover:bg-slate-50 hover:text-midnight active:scale-[0.98]",
            open && "bg-ai-gradient text-white shadow-glow",
          )}
        >
          <MoreHorizontal size={26} strokeWidth={2.35} />
          <span className="line-clamp-1 max-w-full">{t("mobile.more")}</span>
        </button>
      </nav>
    </>
  );
}
