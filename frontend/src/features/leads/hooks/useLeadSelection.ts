import { useMemo, useState } from "react";

import type { Id, Lead } from "../../../types";

export function useLeadSelection(leads: Lead[], initialId?: Id | null) {
  const [selectedIds, setSelectedIds] = useState<Id[]>(initialId ? [initialId] : []);

  function selectLead(id: Id) {
    setSelectedIds([id]);
  }

  function deselectLead(id: Id) {
    setSelectedIds((value) => value.filter((item) => item !== id));
  }

  function toggleSelection(id: Id) {
    setSelectedIds((value) => (value.includes(id) ? value.filter((item) => item !== id) : [...value, id]));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  const selectedLead = useMemo(() => leads.find((lead) => lead.id === selectedIds[0]) || null, [leads, selectedIds]);

  return {
    selectedIds,
    selectedLead,
    selectLead,
    deselectLead,
    toggleSelection,
    clearSelection,
  };
}
