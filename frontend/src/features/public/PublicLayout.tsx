import { Bot, LogIn, Menu, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/cn";

const navItems = [
  { to: "/crm", label: "CRM" },
  { to: "/bots", label: "AI bots" },
  { to: "/pricing", label: "Pricing" },
  { to: "/contacts", label: "Contacts" },
];

export function PublicLayout() {
  const [open, setOpen] = useState(false);

  return (
    <main className="min-h-screen bg-soft-mesh text-midnight">
      <header className="sticky top-0 z-30 px-3 py-2 sm:px-4 sm:py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-[1.5rem] border border-white/70 bg-white/88 px-3 py-2 shadow-soft backdrop-blur-2xl sm:rounded-3xl sm:px-4 sm:py-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-ai-gradient text-white shadow-glow sm:h-11 sm:w-11">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-base font-bold tracking-tight">Zani</p>
              <p className="text-[11px] font-medium text-slate-500 sm:text-xs">AI Growth OS</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-2xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-midnight",
                    isActive && "bg-midnight text-white hover:bg-midnight hover:text-white",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Link to="/login">
              <Button variant="secondary" className="rounded-full">
                <LogIn size={16} />
                Sign in
              </Button>
            </Link>
            <Link to="/contacts">
              <Button variant="ai" className="rounded-full">
                <Bot size={16} />
                Connect CRM
              </Button>
            </Link>
          </div>

          <Button variant="ghost" className="h-10 w-10 rounded-full px-0 md:hidden" onClick={() => setOpen((value) => !value)} aria-label="Open navigation">
            {open ? <X size={22} /> : <Menu size={22} />}
          </Button>
        </div>

        {open ? (
          <div className="mx-auto mt-2 max-w-7xl rounded-3xl border border-white/70 bg-white/95 p-3 shadow-premium backdrop-blur-2xl md:hidden">
            <nav className="grid gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "rounded-2xl px-4 py-3 text-sm font-semibold text-slate-600",
                      isActive && "bg-midnight text-white",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <Link to="/login" onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 text-sm font-semibold text-brand-700">
                Sign in
              </Link>
            </nav>
          </div>
        ) : null}
      </header>

      <Outlet />
    </main>
  );
}
