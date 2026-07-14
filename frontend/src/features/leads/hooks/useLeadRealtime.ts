import { useEffect, useRef } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { captureFrontendError, trackFrontendEvent } from "../../../lib/monitoring";
import { realtimeIntervals } from "../../../lib/realtime";
import type { Id, Lead } from "../../../types";
import type { Translate } from "../types";

type PaginatedLeads = {
  results?: Lead[];
};

export function useLeadRealtime({
  businessReady,
  isOnline,
  leadsQuery,
  t,
  onNotice,
}: {
  businessReady: boolean;
  isOnline: boolean;
  leadsQuery: UseQueryResult<PaginatedLeads>;
  t: Translate;
  onNotice: (message: string | null, tone?: "success" | "info" | "warning" | "danger") => void;
}) {
  const knownLeadIdsRef = useRef<Set<Id> | null>(null);

  useEffect(() => {
    if (!businessReady || !isOnline) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void leadsQuery.refetch().catch((error) => captureFrontendError(error, { feature: "leads", action: "poll" }));
      }
    }, realtimeIntervals.leadsPollingMs);
    return () => window.clearInterval(timer);
  }, [businessReady, isOnline, leadsQuery]);

  useEffect(() => {
    if (!leadsQuery.data?.results) return;
    const currentIds = new Set(leadsQuery.data.results.map((lead) => lead.id));
    const knownIds = knownLeadIdsRef.current;
    if (knownIds) {
      const added = leadsQuery.data.results.filter((lead) => !knownIds.has(lead.id));
      if (added.length) {
        onNotice(t("leads.realtimeNewLeads", { count: added.length }));
        trackFrontendEvent("leads_realtime_added", { count: added.length });
      }
    }
    knownLeadIdsRef.current = currentIds;
  }, [leadsQuery.data, onNotice, t]);
}
