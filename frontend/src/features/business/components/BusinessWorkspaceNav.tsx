import { NavLink } from "react-router";

import { cn } from "../../../lib/cn";
import { useI18n } from "../../../lib/i18n";

const businessRoutes = [
  { to: "/app/business/services", labelKey: "nav.services" },
  { to: "/app/business/resources", labelKey: "nav.resources" },
  { to: "/app/business/working-hours", labelKey: "nav.workingHours" },
];

export function BusinessWorkspaceNav() {
  const { t } = useI18n();

  return (
    <nav
      aria-label={t("business.navigationLabel")}
      className="mb-3 shrink-0 overflow-x-auto rounded-card border border-zani-border bg-surface-card p-1 shadow-card no-scrollbar"
    >
      <div className="flex min-w-max gap-1 sm:min-w-0">
        {businessRoutes.map((route) => (
          <NavLink
            key={route.to}
            to={route.to}
            className={({ isActive }) => cn(
              "zani-focus-ring inline-flex min-h-10 shrink-0 items-center justify-center rounded-control px-4 text-sm font-semibold transition sm:flex-1",
              isActive
                ? "bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-100"
                : "text-zani-subtle hover:bg-surface-warm hover:text-zani-text",
            )}
          >
            {t(route.labelKey)}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
