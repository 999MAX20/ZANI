import {
  BarChart3,
  BriefcaseBusiness,
  Bot,
  CalendarDays,
  ChevronLeft,
  Clock,
  KanbanSquare,
  ListChecks,
  Home,
  Inbox,
  MessageSquareText,
  Settings,
  Sparkles,
  Stethoscope,
  Users,
  Workflow,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";
import { useI18n } from "../../lib/i18n";
import { LanguageSelector } from "./LanguageSelector";

const groups = [
  {
    title: "nav.workspace",
    items: [
      { to: "/dashboard", label: "nav.dashboard", icon: Home },
      { to: "/dashboard/leads", label: "nav.leads", icon: Inbox },
      { to: "/dashboard/deals", label: "nav.deals", icon: KanbanSquare },
      { to: "/dashboard/clients", label: "nav.clients", icon: Users },
      { to: "/dashboard/tasks", label: "nav.tasks", icon: ListChecks },
      { to: "/dashboard/calendar", label: "nav.calendar", icon: CalendarDays },
      { to: "/dashboard/conversations", label: "nav.conversations", icon: MessageSquareText },
      { to: "/dashboard/timeline", label: "nav.timeline", icon: Clock },
    ],
  },
  {
    title: "nav.operations",
    items: [
      { to: "/dashboard/appointments", label: "nav.appointments", icon: CalendarDays },
      { to: "/dashboard/services", label: "nav.services", icon: Stethoscope },
      { to: "/dashboard/resources", label: "nav.resources", icon: BriefcaseBusiness },
      { to: "/dashboard/working-hours", label: "nav.workingHours", icon: Clock },
    ],
  },
  {
    title: "nav.intelligence",
    items: [
      { to: "/dashboard/bots", label: "nav.bots", icon: Bot },
      { to: "/dashboard/ai-assistant", label: "nav.aiAssistant", icon: Bot },
      { to: "/dashboard/analytics", label: "nav.analytics", icon: BarChart3 },
      { to: "/dashboard/automations", label: "nav.automations", icon: Workflow },
    ],
  },
  {
    title: "nav.system",
    items: [{ to: "/dashboard/settings", label: "nav.settings", icon: Settings }],
  },
];

export function Sidebar({
  forceVisible = false,
  collapsed = false,
  onToggle,
  onNavigate,
}: {
  forceVisible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();

  return (
    <aside
      className={cn(
        "relative z-20 m-3 shrink-0 rounded-3xl border border-white/70 bg-white/92 shadow-premium backdrop-blur-2xl transition-all duration-300",
        forceVisible && "m-0 h-dvh max-h-dvh rounded-none rounded-r-3xl bg-white/96",
        collapsed ? "w-[88px]" : "w-[280px]",
        !forceVisible && "hidden lg:block",
      )}
    >
      <div className={cn("flex h-full min-h-[calc(100vh-1.5rem)] flex-col p-3", forceVisible && "min-h-dvh overflow-y-auto pb-8")}>
        <div className={cn("flex items-center gap-3 px-3 py-3", collapsed && "justify-center px-0")}>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-ai-gradient text-white shadow-glow">
            <Sparkles size={21} />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-base font-bold tracking-tight text-midnight">{t("sidebar.product")}</p>
              <p className="truncate text-xs font-medium text-slate-500">{t("sidebar.subtitle")}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-2 space-y-5">
          {groups.map((group) => (
            <div key={group.title}>
              {!collapsed ? (
                <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  {t(group.title)}
                </p>
              ) : null}
              <nav className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "group relative flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:text-midnight hover:shadow-soft",
                          forceVisible && "text-slate-800",
                          collapsed && "justify-center px-0",
                          isActive && "bg-white text-midnight shadow-soft ring-1 ring-brand-100",
                        )
                      }
                      title={collapsed ? t(item.label) : undefined}
                    >
                      {({ isActive }) => (
                        <>
                          {isActive ? (
                            <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-ai-gradient shadow-glow" />
                          ) : null}
                          <Icon size={19} className={cn(isActive && "text-brand-600")} />
                          {!collapsed ? <span>{t(item.label)}</span> : null}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {!collapsed ? (
          <div className="mt-auto border-t border-slate-100 pt-4">
            <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Language</p>
            <div className="px-2">
              <LanguageSelector className="w-full justify-between rounded-2xl bg-white" />
            </div>
          </div>
        ) : null}

        {onToggle ? (
          <Button
            variant="secondary"
            className="absolute -right-4 top-8 hidden h-9 w-9 rounded-full px-0 lg:inline-flex"
            onClick={onToggle}
            aria-label="Свернуть меню"
          >
            <ChevronLeft className={cn("transition", collapsed && "rotate-180")} size={16} />
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
