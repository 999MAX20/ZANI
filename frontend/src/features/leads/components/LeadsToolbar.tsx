import { ChevronRight, Columns3, Keyboard, Undo2 } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import type { LeadViewMode, Translate } from "../types";
import { ActionDropdown } from "./common/ActionDropdown";
import { ViewToggle } from "./common/ViewToggle";

export function LeadsToolbar({
  viewMode,
  onViewModeChange,
  selectedCount,
  undoDisabled,
  redoDisabled,
  actionsOpen,
  onActionsToggle,
  onUndo,
  onRedo,
  onShortcuts,
  onColumnMenu,
  onExportCsv,
  onExportExcel,
  onShare,
  onAiSort,
  onAutoAssign,
  t,
}: {
  viewMode: LeadViewMode;
  onViewModeChange: (mode: LeadViewMode) => void;
  selectedCount: number;
  undoDisabled: boolean;
  redoDisabled: boolean;
  actionsOpen: boolean;
  onActionsToggle: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onShortcuts: () => void;
  onColumnMenu: () => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
  onShare: () => void;
  onAiSort: () => void;
  onAutoAssign: () => void;
  t: Translate;
}) {
  return (
    <section className="flex min-h-14 flex-col gap-3 border-b border-gray-200 bg-white py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <ViewToggle value={viewMode} onChange={onViewModeChange} t={t} />
        {selectedCount ? <div className="rounded-lg bg-gray-50 px-4 py-2 text-sm font-bold text-gray-700">{t("leads.bulkSelected", { count: selectedCount })}</div> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="icon" className="h-10 w-10 rounded-lg px-0" aria-label={t("leads.columns")} onClick={onColumnMenu}>
          <Columns3 size={18} />
        </Button>
        <Button variant="secondary" size="icon" className="h-10 w-10 rounded-lg px-0" aria-label={t("leads.undo")} disabled={undoDisabled} onClick={onUndo}>
          <Undo2 size={18} />
        </Button>
        <Button variant="secondary" size="icon" className="h-10 w-10 rounded-lg px-0" aria-label={t("leads.redo")} disabled={redoDisabled} onClick={onRedo}>
          <ChevronRight size={18} />
        </Button>
        <Button variant="secondary" size="icon" className="h-10 w-10 rounded-lg px-0" aria-label={t("leads.shortcuts")} onClick={onShortcuts}>
          <Keyboard size={18} />
        </Button>
        <ActionDropdown
          open={actionsOpen}
          onToggle={onActionsToggle}
          onExportCsv={onExportCsv}
          onExportExcel={onExportExcel}
          onShare={onShare}
          onAiSort={onAiSort}
          onAutoAssign={onAutoAssign}
          onSettings={onColumnMenu}
          t={t}
        />
      </div>
    </section>
  );
}
