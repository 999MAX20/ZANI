import { cloneElement, isValidElement } from "react";

import { useAuth } from "../../features/auth/AuthProvider";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { hasPermission, permissionForbiddenMessage } from "../../lib/permissions";
import { useI18n } from "../../lib/i18n";
import { ForbiddenState } from "../ui/StateViews";

type PermissionGateMode = "hide" | "disable" | "forbidden";

export function PermissionGate({
  resource,
  action = "view",
  mode = "hide",
  fallback = null,
  children,
}: {
  resource: string;
  action?: string;
  mode?: PermissionGateMode;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const { business } = useActiveBusiness();
  const { t } = useI18n();
  const allowed = hasPermission(user, business?.id, resource, action);

  if (allowed) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  if (mode === "forbidden") {
    return <ForbiddenState message={permissionForbiddenMessage(resource, action, t)} />;
  }
  if (mode === "disable" && isValidElement<{ disabled?: boolean; title?: string }>(children)) {
    return cloneElement(children, {
      disabled: true,
      title: permissionForbiddenMessage(resource, action, t),
    });
  }
  return null;
}
