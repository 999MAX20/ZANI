import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  Store,
  Target,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../../features/auth/AuthProvider";
import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";

const platformNav = [
  { to: "/platform", label: "Overview", description: "Access and system status", icon: LayoutDashboard, end: true },
  { to: "/platform/merchants", label: "Merchants", description: "Future merchant operations", icon: Store },
  { to: "/platform/prospects", label: "Prospects", description: "Future internal tools boundary", icon: Target },
  { to: "/platform/billing", label: "Billing", description: "Future plans and subscriptions", icon: CreditCard },
  { to: "/platform/analytics", label: "Analytics", description: "Future platform insights", icon: BarChart3 },
  { to: "/platform/settings", label: "Settings", description: "Platform configuration", icon: Settings },
];

export function PlatformLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <main className="min-h-screen bg-soft-mesh p-3 sm:p-4">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1500px] gap-4">
        <aside className="hidden w-[300px] shrink-0 rounded-3xl border border-white/70 bg-midnight p-4 text-white shadow-premium lg:flex lg:flex-col">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-white shadow-soft ring-1 ring-white/10">
              <ShieldCheck size={23} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">NeuroBoost</p>
              <h1 className="text-lg font-semibold tracking-tight">Platform</h1>
            </div>
          </div>

          <nav className="mt-6 space-y-1">
            {platformNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-start gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-white/65 transition hover:bg-white/10 hover:text-white",
                      isActive && "bg-white text-midnight shadow-soft hover:bg-white hover:text-midnight",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={20} className={cn("mt-0.5 shrink-0", isActive ? "text-brand-600" : "text-white/45 group-hover:text-white")} />
                      <span>
                        <span className="block">{item.label}</span>
                        <span className={cn("mt-1 block text-xs font-medium", isActive ? "text-slate-500" : "text-white/35")}>{item.description}</span>
                      </span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-auto rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-semibold">Protected platform zone</p>
            <p className="mt-2 text-xs leading-5 text-white/45">Only platform roles can access these routes.</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass-panel flex flex-col gap-3 rounded-3xl px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-midnight text-white shadow-soft lg:hidden">
                <ShieldCheck size={22} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Platform Admin</p>
                <h2 className="text-xl font-semibold tracking-tight text-midnight">Control center</h2>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="hidden min-w-[260px] items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-400 md:flex">
                <Search size={17} />
                Platform search placeholder
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-midnight">{user?.email}</p>
                <p className="text-xs text-slate-500">{user?.role}</p>
              </div>
              <Button
                variant="secondary"
                className="rounded-full"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
              >
                <LogOut size={16} />
                Выйти
              </Button>
            </div>
          </header>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:hidden">
            {platformNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-2xl border border-white/70 bg-white/70 px-3 py-3 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur-xl",
                      isActive && "bg-midnight text-white",
                    )
                  }
                >
                  <Icon size={17} />
                  {item.label}
                </NavLink>
              );
            })}
          </div>

          <section className="min-w-0 flex-1 py-4">
            <Outlet />
          </section>
        </div>
      </div>
    </main>
  );
}
