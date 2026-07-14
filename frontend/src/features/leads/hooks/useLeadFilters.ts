import { useEffect, useState } from "react";

import type { LeadFilter } from "../types";
import { leadFilters } from "../types";

export function useLeadFilters(initial?: { filter?: LeadFilter; source?: string; search?: string }) {
  const [activeTab, setActiveTab] = useState<LeadFilter>(initial?.filter || "all");
  const [sourceFilter, setSourceFilter] = useState(initial?.source || "");
  const [searchQuery, setSearchQuery] = useState(initial?.search || "");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("filter") as LeadFilter | null;
    if (tab && leadFilters.includes(tab)) setActiveTab(tab);
    if (params.has("source")) setSourceFilter(params.get("source") || "");
    if (params.has("search")) setSearchQuery(params.get("search") || "");
  }, []);

  function clearFilters() {
    setActiveTab("all");
    setSourceFilter("");
    setSearchQuery("");
  }

  return {
    activeTab,
    sourceFilter,
    searchQuery,
    setActiveTab,
    setSourceFilter,
    setSearchQuery,
    clearFilters,
  };
}
