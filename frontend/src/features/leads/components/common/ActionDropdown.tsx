import { Download, MoreHorizontal, Settings, Share2, Users, Zap } from "lucide-react";

import { Button } from "../../../../components/ui/Button";
import type { Translate } from "../../types";

export function ActionDropdown({
  open,
  onToggle,
  onExportCsv,
  onExportExcel,
  onShare,
  onAiSort,
  onAutoAssign,
  onSettings,
  t,
}: {
  open: boolean;
  onToggle: () => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
  onShare: () => void;
  onAiSort: () => void;
  onAutoAssign: () => void;
  onSettings: () => void;
  t: Translate;
}) {
  const items = [
    { label: t("leads.exportCsv"), icon: Download, action: onExportCsv },
    { label: t("leads.exportExcel"), icon: Download, action: onExportExcel },
    { label: t("leads.shareView"), icon: Share2, action: onShare },
    { label: t("leads.sortByHeat"), icon: Zap, action: onAiSort },
    { label: t("leads.smartAssign"), icon: Users, action: onAutoAssign },
    { label: t("leads.columns"), icon: Settings, action: onSettings, separated: true },
  ];

  return (
    <div className="relative">
      <Button variant="secondary" size="icon" className="h-10 w-10 rounded-lg px-0" onClick={onToggle} aria-label={t("leads.moreActions")}>
        <MoreHorizontal size={18} />
      </Button>
      {open ? (
        <div className="absolute right-0 top-11 z-10 w-56 rounded-lg border border-gray-200 bg-white py-2 shadow-lg">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                className={`flex w-full items-center px-4 py-2 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50 ${item.separated ? "mt-1 border-t border-gray-100 pt-3" : ""}`}
                onClick={item.action}
              >
                <Icon size={16} className="mr-2" />
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
