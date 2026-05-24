import { Home, Inbox, ListChecks, MessageSquareText, MoreHorizontal, X } from "lucide-react";
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
  { to: "/dashboard/conversations", label: "nav.conversations", icon: MessageSquareText, resource: "conversations" },
  { to: "/dashboard/tasks", label: "nav.tasks", icon: ListChecks, resource: "tasks" },
];

export function MobileNav({ open, onOpen, onClose }: { open: boolean; onOpen: () => void; onClose: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { business } = useActiveBusiness();
  const visibleBottomItems = bottomItems.filter((item) => !item.resource || hasPermission(user, business?.id, item.resource));

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden">
          <div className="h-full w-[340px] max-w-[88vw]">
            <div className="absolute right-3 top-3 z-50">
              <Button variant="secondary" className="h-12 w-12 rounded-full px-0" onClick={onClose} aria-label={t("sidebar.collapse")}>
                <X size={26} strokeWidth={2.4} />
              </Button>
            </div>
            <Sidebar forceVisible onNavigate={onClose} />
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-2 bottom-2 z-50 grid grid-cols-5 rounded-[1.7rem] border border-white/70 bg-white/95 p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-premium backdrop-blur-2xl lg:hidden">
        {visibleBottomItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              className={({ isActive }) =>
                cn(
                  "flex min-h-[66px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center text-xs font-black leading-tight text-slate-500 transition active:scale-[0.98]",
                  isActive && "bg-ai-gradient text-white shadow-glow",
                )
              }
            >
              <Icon size={24} strokeWidth={2.3} />
              <span className="line-clamp-1 max-w-full">{t(item.label)}</span>
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "flex min-h-[66px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center text-xs font-black leading-tight text-slate-500 transition hover:bg-slate-50 hover:text-midnight active:scale-[0.98]",
            open && "bg-ai-gradient text-white shadow-glow",
          )}
        >
          <MoreHorizontal size={24} strokeWidth={2.3} />
          <span className="line-clamp-1 max-w-full">{t("mobile.more")}</span>
        </button>
      </nav>
    </>
  );
}
