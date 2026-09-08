import { Badge } from "../../../components/ui/Badge";
import { useI18n } from "../../../lib/i18n";
import type { Resource } from "../../../types";

export function ResourceStatusBadge({ resource, size = "md" }: { resource: Resource; size?: "sm" | "md" | "lg" }) {
  const { t } = useI18n();
  return (
    <Badge variant={resource.is_active ? "success" : "warning"} size={size}>
      {t(resource.is_active ? "resources.statusActive" : "resources.statusInactive")}
    </Badge>
  );
}
