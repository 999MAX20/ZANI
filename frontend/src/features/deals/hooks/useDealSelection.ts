import { useCallback, useEffect, useState } from "react";
import type { DealRow } from "../types";
import type { Id } from "../../../types";

export function useDealSelection(rows: DealRow[]) {
  const [selectedDealId, setSelectedDealId] = useState<Id | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Id[]>([]);

  useEffect(() => {
    if (selectedDealId && rows.some((deal) => deal.id === selectedDealId))
      return;
    setSelectedDealId(rows[0]?.id || null);
  }, [rows, selectedDealId]);

  const selectedDeal =
    rows.find((deal) => deal.id === selectedDealId) || rows[0] || null;

  const openDeal = useCallback((dealId: Id) => {
    setSelectedDealId(dealId);
    setMobileDetailOpen(true);
  }, []);

  function toggleSelected(id: Id) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function selectAll() {
    setSelectedIds((current) =>
      current.length === rows.length ? [] : rows.map((deal) => deal.id),
    );
  }

  return {
    selectedDeal,
    selectedDealId,
    openDeal,
    mobileDetailOpen,
    setMobileDetailOpen,
    selectedIds,
    setSelectedIds,
    toggleSelected,
    selectAll,
  };
}
