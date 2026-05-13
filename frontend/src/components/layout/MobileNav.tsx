import { Bot, CalendarDays, Home, Inbox, KanbanSquare, X } from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";
import { Button } from "../ui/Button";
import { Sidebar } from "./Sidebar";

const bottomItems = [
  { to: "/dashboard", label: "mobile.home", icon: Home },
  { to: "/dashboard/leads", label: "nav.leads", icon: Inbox },
  { to: "/dashboard/deals", label: "nav.deals", icon: KanbanSquare },
  { to: "/dashboard/calendar", label: "nav.calendar", icon: CalendarDays },
  { to: "/dashboard/bots", label: "nav.bots", icon: Bot },
];

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden">
          <div className="h-full w-[340px] max-w-[88vw]">
            <div className="absolute right-3 top-3 z-50">
              <Button variant="secondary" className="h-12 w-12 rounded-full px-0" onClick={onClose} aria-label="Закрыть меню">
                <X size={26} strokeWidth={2.4} />
              </Button>
            </div>
            <Sidebar forceVisible onNavigate={onClose} />
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-3xl border border-white/70 bg-white/85 p-2 shadow-premium backdrop-blur-2xl lg:hidden">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold text-slate-500 transition",
                  isActive && "bg-ai-gradient text-white shadow-glow",
                )
              }
            >
              <Icon size={18} />
              {t(item.label)}
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
