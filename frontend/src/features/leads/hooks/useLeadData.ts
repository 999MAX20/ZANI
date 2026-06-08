import { useEffect } from "react";

import { useEntityData } from "../../../hooks/useEntityData";
import { realtimeIntervals } from "../../../lib/realtime";
import { calculateLeadMetrics } from "../utils/leadMetrics";

/**
 * Хук для получения данных заявок
 * Вынесен из LeadsPage для уменьшения размера компонента
 */
export function useLeadData() {
  const entityData = useEntityData({ leads: true });
  const leads = entityData.leads.data || [];

  // Auto-refresh при видимости страницы
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void entityData.leads.refetch();
      }
    }, realtimeIntervals.leadsPollingMs);
    return () => window.clearInterval(timer);
  }, [entityData.leads]);

  return {
    leads,
    metrics: calculateLeadMetrics(leads),
    loading: entityData.leads.isLoading,
    error: entityData.leads.error,
    refetch: entityData.leads.refetch,
  };
}
