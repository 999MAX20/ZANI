import { NavLink } from "react-router";

import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";
import type { BusinessMembershipSummary, CurrentUser } from "../../types";

function getAccountInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return `${parts[0]?.[0] || ""}${parts.at(-1)?.[0] || ""}`.toUpperCase();
  }
  return (parts[0] || "A").slice(0, 2).toUpperCase();
}

export function HeaderAccountLink({
  user,
  membership,
}: {
  user: CurrentUser | null;
  membership?: BusinessMembershipSummary;
}) {
  const { t } = useI18n();
  const accountName = user?.full_name?.trim() || user?.email || t("account.menuProfile");
  const normalizedRole = membership?.role === "doctor" ? "specialist" : membership?.role;
  const roleLabel =
    membership?.business_role_name?.trim() ||
    (normalizedRole ? t(`settings.role.${normalizedRole}`) : t("account.menuProfile"));

  return (
    <NavLink
      to="/app/account"
      aria-label={t("account.menuProfile")}
      title={t("account.menuProfile")}
      data-testid="header-account-link"
      className={({ isActive }) =>
        cn(
          "zani-focus-ring group flex h-10 min-w-10 max-w-[200px] items-center justify-center gap-2 rounded-control px-1 text-left transition-colors hover:bg-surface-muted 2xl:justify-start 2xl:pr-3",
          isActive && "bg-brand-50 ring-1 ring-brand-100",
        )
      }
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800 ring-1 ring-brand-200/70">
        {getAccountInitials(accountName)}
      </span>
      <span className="hidden min-w-0 2xl:block" data-testid="header-account-details">
        <span className="block max-w-[142px] truncate text-xs font-semibold leading-4 text-zani-text">
          {accountName}
        </span>
        <span className="block max-w-[142px] truncate text-[10px] font-medium leading-3.5 text-zani-faint">
          {roleLabel}
        </span>
      </span>
    </NavLink>
  );
}
