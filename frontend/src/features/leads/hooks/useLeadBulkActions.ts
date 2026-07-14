import type { Id, Lead } from "../../../types";

type LeadActionMutation = {
  mutate: (variables: { action: "assign"; lead: Lead; user_id?: Id }) => void;
};

type BulkContactMutation = {
  mutate: (leads: Lead[]) => void;
};

export function useLeadBulkActions({
  allLeads,
  selectedLeadIds,
  actionMutation,
  bulkContactMutation,
  requestArchiveLeads,
  setSelectedLeadIds,
}: {
  allLeads: Lead[];
  selectedLeadIds: Id[];
  actionMutation: LeadActionMutation;
  bulkContactMutation: BulkContactMutation;
  requestArchiveLeads: (leads: Lead[]) => Promise<void>;
  setSelectedLeadIds: (ids: Id[]) => void;
}) {
  const selectedLeads = allLeads.filter((lead) => selectedLeadIds.includes(lead.id));

  function assignSelected(userId?: Id) {
    selectedLeads.forEach((lead) => actionMutation.mutate({ action: "assign", lead, user_id: userId }));
    setSelectedLeadIds([]);
  }

  function contactSelected() {
    bulkContactMutation.mutate(selectedLeads);
  }

  function archiveSelected() {
    void requestArchiveLeads(selectedLeads);
  }

  function resetSelection() {
    setSelectedLeadIds([]);
  }

  return {
    assignSelected,
    contactSelected,
    archiveSelected,
    resetSelection,
  };
}
