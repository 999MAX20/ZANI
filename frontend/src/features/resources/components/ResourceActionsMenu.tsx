import { CirclePower, Eye } from "lucide-react";

import { ActionMenu, type ActionMenuItem } from "../../../components/ui/ActionMenu";
import { useI18n } from "../../../lib/i18n";
import type { Resource } from "../../../types";

export function ResourceActionsMenu({
  resource,
  canManage,
  isPending,
  onOpen,
  onActivate,
  onDeactivate,
}: {
  resource: Resource;
  canManage: boolean;
  isPending: boolean;
  onOpen: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const { t } = useI18n();
  const items: ActionMenuItem[] = [
    {
      key: "open",
      label: t("resources.actionOpen"),
      icon: Eye,
      onSelect: onOpen,
    },
  ];

  if (canManage) {
    items.push({
      key: resource.is_active ? "deactivate" : "activate",
      label: t(resource.is_active ? "resources.actionDeactivate" : "resources.actionActivate"),
      icon: CirclePower,
      onSelect: resource.is_active ? onDeactivate : onActivate,
      tone: resource.is_active ? "warning" : "neutral",
      disabled: isPending,
    });
  }

  return (
    <ActionMenu
      label={t("resources.actionMenuLabel", { name: resource.name })}
      items={items}
      disabled={isPending}
    />
  );
}
