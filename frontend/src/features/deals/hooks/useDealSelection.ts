import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import type { DealRow } from "../types";
import type { Id } from "../../../types";

export function useDealSelection(rows: DealRow[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDealId, setSelectedDealId] = useState<Id | null>(() => Number(searchParams.get("deal")) || null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Id[]>([]);

  useEffect(() => {
    const dealId = Number(searchParams.get("deal") || "");
    if (dealId) setSelectedDealId(dealId);
  }, [searchParams]);

  useEffect(() => {
    if (selectedDealId && rows.some((deal) => deal.id === selectedDealId)) return;
    setSelectedDealId(rows[0]?.id || null);
  }, [rows, selectedDealId]);

  const selectedDeal = rows.find((deal) => deal.id === selectedDealId) || rows[0] || null;

  const openDeal = useCallback(
    (dealId: Id) => {
      const next = new URLSearchParams(searchParams);
      next.set("deal", String(dealId));
      setSearchParams(next, { replace: true });
      setSelectedDealId(dealId);
      setMobileDetailOpen(true);
    },
    [searchParams, setSearchParams],
  );

  function toggleSelected(id: Id) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function selectAll() {
    setSelectedIds((current) => (current.length === rows.length ? [] : rows.map((deal) => deal.id)));
  }

  return { selectedDeal, selectedDealId, openDeal, mobileDetailOpen, setMobileDetailOpen, selectedIds, setSelectedIds, toggleSelected, selectAll };
}
