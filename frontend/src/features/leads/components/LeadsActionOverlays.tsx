import type { Id, Lead, TeamMember } from "../../../types";
import type { Translate } from "../types";
import { LeadContextMenu } from "./LeadContextMenu";
import { LeadsBulkBar } from "./LeadsBulkBar";

type LeadContextMenuState = {
  x: number;
  y: number;
  lead: Lead;
} | null;

export function LeadsActionOverlays({
  contextMenu,
  selectedLeadIds,
  teamList,
  t,
  onCloseContextMenu,
  onOpenLead,
  onCallLead,
  onWhatsAppLead,
  onTakeLead,
  onArchiveLead,
  onAssignSelected,
  onContactSelected,
  onArchiveSelected,
  onResetSelection,
}: {
  contextMenu: LeadContextMenuState;
  selectedLeadIds: Id[];
  teamList: TeamMember[];
  t: Translate;
  onCloseContextMenu: () => void;
  onOpenLead: (lead: Lead) => void;
  onCallLead: (lead: Lead) => void;
  onWhatsAppLead: (lead: Lead) => void;
  onTakeLead: (lead: Lead) => void;
  onArchiveLead: (lead: Lead) => void;
  onAssignSelected: (userId?: Id) => void;
  onContactSelected: () => void;
  onArchiveSelected: () => void;
  onResetSelection: () => void;
}) {
  return (
    <>
      {contextMenu ? (
        <LeadContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          lead={contextMenu.lead}
          labels={{
            open: t("leads.open"),
            call: t("leads.call"),
            whatsApp: "WhatsApp",
            assignToMe: t("leads.assignToMe"),
            archive: t("leads.archive"),
          }}
          onClose={onCloseContextMenu}
          onOpen={onOpenLead}
          onCall={onCallLead}
          onWhatsApp={onWhatsAppLead}
          onTake={onTakeLead}
          onArchive={onArchiveLead}
        />
      ) : null}

      <LeadsBulkBar
        selectedCount={selectedLeadIds.length}
        teamMembers={teamList}
        labels={{
          selected: t("leads.bulkSelected", { count: selectedLeadIds.length }),
          assign: t("leads.bulkAssign"),
          contact: t("leads.bulkContact"),
          archive: t("leads.bulkArchive"),
          reset: t("leads.bulkReset"),
        }}
        onAssign={onAssignSelected}
        onContact={onContactSelected}
        onArchive={onArchiveSelected}
        onReset={onResetSelection}
      />
    </>
  );
}
