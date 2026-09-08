import { Archive, ArchiveRestore, CirclePower, Eye } from "lucide-react";

import { ActionMenu, type ActionMenuItem } from "../../../components/ui/ActionMenu";
import { useI18n } from "../../../lib/i18n";
import type { Service } from "../../../types";

export function ServiceActionsMenu({
  service,
  canManage,
  isPending,
  onOpen,
  onActivate,
  onDeactivate,
  onArchive,
  onRestore,
}: {
  service: Service;
  canManage: boolean;
  isPending: boolean;
  onOpen: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const { t } = useI18n();
  const items: ActionMenuItem[] = [
    {
      key: "open",
      label: t("services.actionOpen"),
      icon: Eye,
      onSelect: onOpen,
    },
  ];

  if (canManage && service.is_archived) {
    items.push({
      key: "restore",
      label: t("services.actionRestore"),
      icon: ArchiveRestore,
      onSelect: onRestore,
      disabled: isPending,
    });
  } else if (canManage) {
    items.push({
      key: service.is_active ? "deactivate" : "activate",
      label: t(service.is_active ? "services.actionDeactivate" : "services.actionActivate"),
      icon: CirclePower,
      onSelect: service.is_active ? onDeactivate : onActivate,
      tone: service.is_active ? "warning" : "neutral",
      disabled: isPending,
    });
    items.push({
      key: "archive",
      label: t("services.actionArchive"),
      icon: Archive,
      onSelect: onArchive,
      tone: "warning",
      disabled: isPending,
    });
  }

  return (
    <ActionMenu
      label={t("services.actionMenuLabel", { name: service.name })}
      items={items}
      disabled={isPending}
    />
  );
}
