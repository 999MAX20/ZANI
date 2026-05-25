import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  Clock,
  Home,
  Inbox,
  KanbanSquare,
  ListChecks,
  MessageSquareText,
  PlugZap,
  Rocket,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  Workflow,
} from "lucide-react";
import { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { useAuth } from "../../features/auth/AuthProvider";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";
import { hasPermission } from "../../lib/permissions";
import { Button } from "../ui/Button";
import { LanguageSelector } from "./LanguageSelector";

const navigationGroups = [
  {
    id: "control",
    icon: Home,
    titleKey: "nav.group.control",
    descriptionKey: "nav.group.controlHint",
    items: [
      { to: "/dashboard", label: "nav.dashboard", icon: Home },
      { to: "/dashboard/onboarding", label: "nav.onboarding", icon: Rocket, resource: "settings" },
      { to: "/dashboard/pilot-readiness", label: "nav.pilotReadiness", icon: ShieldCheck, resource: "settings" },
    ],
  },
  {
    id: "sales",
    icon: KanbanSquare,
    titleKey: "nav.group.sales",
    descriptionKey: "nav.group.salesHint",
    items: [
      { to: "/dashboard/leads", label: "nav.leads", icon: Inbox, resource: "leads" },
      { to: "/dashboard/deals", label: "nav.deals", icon: KanbanSquare, resource: "deals" },
      { to: "/dashboard/appointments", label: "nav.appointments", icon: CalendarDays, resource: "appointments" },
      { to: "/dashboard/calendar", label: "nav.calendar", icon: CalendarDays, resource: "appointments" },
    ],
  },
  {
    id: "clients",
    icon: Users,
    titleKey: "nav.group.clients",
    descriptionKey: "nav.group.clientsHint",
    items: [
      { to: "/dashboard/clients", label: "nav.clients", icon: Users, resource: "clients" },
      { to: "/dashboard/conversations", label: "nav.conversations", icon: MessageSquareText, resource: "conversations" },
      { to: "/dashboard/timeline", label: "nav.timeline", icon: Clock, resource: "analytics" },
    ],
  },
  {
    id: "team",
    icon: ListChecks,
    titleKey: "nav.group.team",
    descriptionKey: "nav.group.teamHint",
    items: [
      { to: "/dashboard/tasks", label: "nav.tasks", icon: ListChecks, resource: "tasks" },
      { to: "/dashboard/analytics", label: "nav.analytics", icon: BarChart3, resource: "analytics" },
    ],
  },
  {
    id: "operations",
    icon: BriefcaseBusiness,
    titleKey: "nav.group.operations",
    descriptionKey: "nav.group.operationsHint",
    items: [
      { to: "/dashboard/services", label: "nav.services", icon: Stethoscope, resource: "settings" },
      { to: "/dashboard/resources", label: "nav.resources", icon: BriefcaseBusiness, resource: "settings" },
      { to: "/dashboard/working-hours", label: "nav.workingHours", icon: Clock, resource: "settings" },
    ],
  },
  {
    id: "growth",
    icon: Sparkles,
    titleKey: "nav.group.growth",
    descriptionKey: "nav.group.growthHint",
    items: [
      { to: "/dashboard/ai-assistant", label: "nav.aiAssistant", icon: Bot, resource: "conversations" },
      { to: "/dashboard/ai-agents", label: "nav.aiAgents", icon: Sparkles, resource: "settings" },
      { to: "/dashboard/bots", label: "nav.bots", icon: Bot, resource: "integrations" },
      { to: "/dashboard/integrations", label: "nav.integrations", icon: PlugZap, resource: "integrations" },
      { to: "/dashboard/automations", label: "nav.automations", icon: Workflow, resource: "automations" },
    ],
  },
  {
    id: "system",
    icon: Settings,
    titleKey: "nav.group.system",
    descriptionKey: "nav.group.systemHint",
    items: [{ to: "/dashboard/settings", label: "nav.settings", icon: Settings, resource: "settings" }],
  },
];

function isItemActive(pathname: string, to: string) {
  return pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
}

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
  const location = useLocation();
  const { user } = useAuth();
  const { business } = useActiveBusiness();
  const [hovered, setHovered] = useState(false);
  const isExpanded = forceVisible || !collapsed || hovered;

  const visibleGroups = useMemo(
    () =>
      navigationGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !item.resource || hasPermission(user, business?.id, item.resource)),
        }))
        .filter((group) => group.items.length),
    [business?.id, user],
  );

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group/sidebar relative z-20 m-3 shrink-0 rounded-[2rem] border border-white/70 bg-white/84 shadow-premium backdrop-blur-2xl transition-all duration-300",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[2rem] before:bg-sidebar-depth before:opacity-80",
        forceVisible && "m-0 h-dvh max-h-dvh rounded-none rounded-r-[2rem] bg-white/96 shadow-[0_30px_90px_rgba(15,23,42,0.24)] before:rounded-none before:rounded-r-[2rem]",
        isExpanded ? "w-[318px]" : "w-[92px]",
        !forceVisible && "hidden lg:block",
      )}
    >
      <div className={cn("relative flex h-full min-h-[calc(100vh-1.5rem)] flex-col p-4", forceVisible && "min-h-dvh overflow-y-auto pb-8")}>
        <div className={cn("mb-4 flex items-center gap-3", !isExpanded && "justify-center")}>
          <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-3xl bg-ai-gradient text-white shadow-glow">
            <Sparkles size={23} />
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
          </div>
          {isExpanded ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black tracking-tight text-midnight">{t("sidebar.product")}</p>
              <p className="truncate text-xs font-bold text-slate-500">{t("sidebar.subtitle")}</p>
            </div>
          ) : null}
        </div>

        {isExpanded ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/64 px-3 py-2 pr-14 shadow-soft">
            <span className="truncate text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{t("common.language")}</span>
            <LanguageSelector className="h-9 w-[112px] shrink-0 rounded-xl border-slate-100 bg-white px-2.5 shadow-none" />
          </div>
        ) : null}

        {isExpanded ? (
          <div className="mb-4 overflow-hidden rounded-[1.4rem] border border-cyan-100/80 bg-gradient-to-br from-cyan-50 via-white to-violet-50 p-3 shadow-soft">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-midnight text-white shadow-soft">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-sm font-black text-midnight">{t("sidebar.commandCenter")}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{t("sidebar.commandCenterText")}</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 no-scrollbar">
          {visibleGroups.map((group) => {
            const GroupIcon = group.icon;
            const groupActive = group.items.some((item) => isItemActive(location.pathname, item.to));

            if (!isExpanded) {
              return (
                <NavLink
                  key={group.id}
                  to={group.items[0]?.to || "/dashboard"}
                  onClick={onNavigate}
                  title={`${t(group.titleKey)} · ${t(group.descriptionKey)}`}
                  className={cn(
                    "mx-auto grid h-12 w-12 place-items-center rounded-2xl text-slate-500 transition-all duration-200",
                    "hover:-translate-y-0.5 hover:bg-white hover:text-brand-700 hover:shadow-soft",
                    groupActive && "bg-ai-gradient text-white shadow-glow",
                  )}
                >
                  <GroupIcon size={20} strokeWidth={2.25} />
                </NavLink>
              );
            }

            return (
            <section key={group.id}>
              {isExpanded ? (
                <div className="mb-2 px-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{t(group.titleKey)}</p>
                  <p className="mt-0.5 text-[11px] font-semibold leading-4 text-slate-500">{t(group.descriptionKey)}</p>
                </div>
              ) : null}

              <nav className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(location.pathname, item.to);

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/dashboard"}
                      onClick={onNavigate}
                      title={t(item.label)}
                      className={cn(
                        "group relative flex min-h-[58px] items-center gap-3 rounded-2xl px-3 py-3 text-sm font-black text-slate-700 transition-all duration-200 active:scale-[0.99]",
                        "hover:-translate-y-0.5 hover:bg-white hover:text-midnight hover:shadow-soft",
                        active && "bg-white text-midnight shadow-soft ring-1 ring-cyan-100",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-500 transition",
                          active && "bg-ai-gradient text-white shadow-glow",
                          !active && "group-hover:bg-cyan-50 group-hover:text-brand-700",
                        )}
                      >
                        <Icon size={20} strokeWidth={2.25} />
                      </span>
                      <span className="min-w-0 truncate">{t(item.label)}</span>
                      {active ? <span className="ml-auto h-2 w-2 rounded-full bg-brand-500 shadow-glow" /> : null}
                    </NavLink>
                  );
                })}
              </nav>
            </section>
          );})}
        </div>

        {isExpanded ? (
          <div className="mt-4 rounded-[1.4rem] border border-slate-100 bg-white/72 p-3">
            <p className="text-xs font-black text-midnight">{t("sidebar.safeMode")}</p>
            <p className="mt-1 text-[11px] font-semibold leading-4 text-slate-500">{t("sidebar.safeModeText")}</p>
          </div>
        ) : null}

        {onToggle ? (
          <Button
            variant="secondary"
            className="absolute -right-4 top-8 hidden h-9 w-9 rounded-full px-0 lg:inline-flex"
            onClick={onToggle}
            aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          >
            <ChevronLeft className={cn("transition", collapsed && "rotate-180")} size={16} />
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
