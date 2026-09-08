import { Archive } from "lucide-react";

import { Badge } from "../../../components/ui/Badge";
import { useI18n } from "../../../lib/i18n";
import type { Service } from "../../../types";

export function ServiceStatusBadge({ service, size = "md" }: { service: Service; size?: "sm" | "md" | "lg" }) {
  const { t } = useI18n();
  if (service.is_archived) {
    return (
      <Badge variant="neutral" size={size}>
        <Archive aria-hidden="true" size={12} />
        {t("services.statusArchived")}
      </Badge>
    );
  }
  return (
    <Badge variant={service.is_active ? "success" : "warning"} size={size}>
      {t(service.is_active ? "services.statusActive" : "services.statusInactive")}
    </Badge>
  );
}
