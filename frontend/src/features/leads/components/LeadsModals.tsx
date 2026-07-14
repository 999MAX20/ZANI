import type { AppointmentCreatePayload } from "../../../api/appointments";
import type { LeadCreatePayload } from "../../../api/leads";
import type { Client, Id, Lead, Resource, Service, TeamMember } from "../../../types";
import { leadTitle } from "../utils/leadFormat";
import type { Translate } from "../types";
import { LeadAppointmentModal } from "./LeadAppointmentModal";
import { LeadCreateModal } from "./LeadCreateModal";
import { LeadLostModal } from "./LeadLostModal";
import { LeadNextActionModal, type LeadNextActionDraft } from "./LeadNextActionModal";
import { LeadShortcutsModal } from "./LeadShortcutsModal";

export function LeadsModals({
  businessId,
  shortcutsOpen,
  createOpen,
  appointmentOpen,
  nextActionOpen,
  lostLead,
  lostReason,
  selected,
  nextActionDraft,
  clientList,
  serviceList,
  resourceList,
  teamList,
  allLeads,
  nextActionPending,
  lostPending,
  t,
  onCloseShortcuts,
  onCloseCreate,
  onCreateLead,
  onOpenClient,
  onCloseAppointment,
  onCreateAppointment,
  onCloseNextAction,
  onNextActionDraftChange,
  onCreateNextAction,
  onCloseLost,
  onLostReasonChange,
  onSubmitLost,
}: {
  businessId: Id;
  shortcutsOpen: boolean;
  createOpen: boolean;
  appointmentOpen: boolean;
  nextActionOpen: boolean;
  lostLead: Lead | null;
  lostReason: string;
  selected: Lead | null;
  nextActionDraft: LeadNextActionDraft;
  clientList: Client[];
  serviceList: Service[];
  resourceList: Resource[];
  teamList: TeamMember[];
  allLeads: Lead[];
  nextActionPending: boolean;
  lostPending: boolean;
  t: Translate;
  onCloseShortcuts: () => void;
  onCloseCreate: () => void;
  onCreateLead: (payload: LeadCreatePayload) => Promise<unknown>;
  onOpenClient: (id: Id) => void;
  onCloseAppointment: () => void;
  onCreateAppointment: (payload: AppointmentCreatePayload) => Promise<unknown>;
  onCloseNextAction: () => void;
  onNextActionDraftChange: (draft: LeadNextActionDraft) => void;
  onCreateNextAction: () => void;
  onCloseLost: () => void;
  onLostReasonChange: (reason: string) => void;
  onSubmitLost: () => void;
}) {
  return (
    <>
      <LeadShortcutsModal
        open={shortcutsOpen}
        title={t("leads.shortcuts")}
        shortcuts={[
          { key: "N", label: t("leads.shortcutNew") },
          { key: "в†‘ / в†“", label: t("leads.shortcutNavigate") },
          { key: "Enter", label: t("leads.shortcutOpen") },
          { key: "C", label: t("leads.shortcutCall") },
          { key: "W", label: t("leads.shortcutWhatsApp") },
          { key: "Esc", label: t("leads.shortcutClose") },
          { key: "?", label: t("leads.shortcutHelp") },
        ]}
        onClose={onCloseShortcuts}
      />

      <LeadCreateModal
        open={createOpen}
        title={t("leads.new")}
        businessId={businessId}
        clients={clientList}
        services={serviceList}
        teamMembers={teamList}
        onClose={onCloseCreate}
        onSubmit={onCreateLead}
        onOpenClient={onOpenClient}
      />

      <LeadAppointmentModal
        open={appointmentOpen}
        title={t("leads.bookFromLead")}
        businessId={businessId}
        clients={clientList}
        services={serviceList}
        resources={resourceList}
        leads={allLeads}
        selectedLead={selected || undefined}
        onClose={onCloseAppointment}
        onSubmit={onCreateAppointment}
      />

      {selected ? (
        <LeadNextActionModal
          open={nextActionOpen}
          title={t("leads.nextActionModal")}
          draft={nextActionDraft}
          teamMembers={teamList}
          isLoading={nextActionPending}
          labels={{
            task: t("leads.task"),
            deadline: t("leads.deadline"),
            responsible: t("leads.responsible"),
            leadResponsible: t("leads.leadResponsible"),
            priority: t("leads.priority"),
            priorityLow: t("leads.priorityLow"),
            priorityNormal: t("leads.priorityNormalLabel"),
            priorityHigh: t("leads.priorityHigh"),
            priorityUrgent: t("leads.priorityUrgent"),
            createTask: t("leads.createTask"),
          }}
          onClose={onCloseNextAction}
          onDraftChange={onNextActionDraftChange}
          onSubmit={onCreateNextAction}
        />
      ) : null}

      <LeadLostModal
        open={Boolean(lostLead)}
        title={t("leads.closeAsLost")}
        leadTitle={lostLead ? leadTitle(lostLead, clientList, t) : ""}
        leadMessage={lostLead?.message || ""}
        reason={lostReason}
        reasons={[
          t("leads.reasonNoAnswer"),
          t("leads.reasonExpensive"),
          t("leads.reasonCompetitor"),
          t("leads.reasonNoBudget"),
          t("leads.reasonDuplicate"),
          t("leads.reasonIrrelevant"),
        ]}
        isLoading={lostPending}
        labels={{
          noComment: t("leads.noComment"),
          reasonType: t("leads.reasonType"),
          selectReason: t("leads.selectReason"),
          comment: t("leads.comment"),
          submit: t("leads.closeAsLost"),
        }}
        onClose={onCloseLost}
        onReasonChange={onLostReasonChange}
        onSubmit={onSubmitLost}
      />
    </>
  );
}
