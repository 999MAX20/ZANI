import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { leadsApi } from "../../../api/leads";
import { tasksApi } from "../../../api/tasks";
import type { Id, Lead } from "../../../types";
import { LEAD_CACHE_KEY, LEAD_OFFLINE_QUEUE_KEY, type OfflineLeadAction, type Translate } from "../types";
import { loadJson, saveJson } from "../utils/leadStorage";

export function useLeadOfflineQueue({
  businessId,
  onlineLeads,
  t,
  onNotice,
  onWarning,
}: {
  businessId?: Id;
  onlineLeads: Lead[];
  t: Translate;
  onNotice: (message: string | null, tone?: "success" | "info" | "warning" | "danger") => void;
  onWarning: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<OfflineLeadAction[]>(() => loadJson<OfflineLeadAction[]>(LEAD_OFFLINE_QUEUE_KEY, []));
  const [cachedLeads, setCachedLeads] = useState<Lead[]>(() => loadJson<Lead[]>(LEAD_CACHE_KEY, []));
  const [lastSystemNotice, setLastSystemNotice] = useState("");

  useEffect(() => {
    function updateOnlineState() {
      setIsOnline(navigator.onLine);
    }
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (onlineLeads.length) {
      setCachedLeads(onlineLeads);
      saveJson(LEAD_CACHE_KEY, onlineLeads.slice(0, 50));
    }
  }, [onlineLeads]);

  useEffect(() => {
    saveJson(LEAD_OFFLINE_QUEUE_KEY, offlineQueue);
  }, [offlineQueue]);

  useEffect(() => {
    if (!isOnline || !businessId || !offlineQueue.length) return;
    let cancelled = false;
    async function syncOfflineQueue() {
      const synced: string[] = [];
      for (const item of offlineQueue) {
        if (cancelled) return;
        try {
          if (item.type === "note") await leadsApi.addNote({ id: item.leadId, text: item.text });
          if (item.type === "task") {
            const lead = onlineLeads.find((row) => row.id === item.leadId);
            if (!lead) continue;
            await tasksApi.create({
              business: businessId,
              title: item.title,
              description: "",
              client: lead.client,
              lead: lead.id,
              deal: null,
              appointment: null,
              parent_task: null,
              assignee: item.assignee ? Number(item.assignee) : lead.responsible_user || null,
              due_at: new Date(item.due_at).toISOString(),
              reminder_at: null,
              priority: item.priority,
              recurrence_rule: "",
            });
          }
          synced.push(item.id);
        } catch {
          break;
        }
      }
      if (!synced.length) return;
      setOfflineQueue((value) => value.filter((item) => !synced.includes(item.id)));
      onNotice(t("leads.offlineSynced", { count: synced.length }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["activity-events"] }),
      ]);
    }
    syncOfflineQueue();
    return () => {
      cancelled = true;
    };
  }, [businessId, isOnline, offlineQueue, onNotice, onlineLeads, queryClient, t]);

  useEffect(() => {
    const message = !isOnline ? t("leads.offlineMode") : offlineQueue.length ? t("leads.offlinePending", { count: offlineQueue.length }) : "";
    if (!message || lastSystemNotice === message) return;
    setLastSystemNotice(message);
    onWarning(message);
  }, [isOnline, lastSystemNotice, offlineQueue.length, onWarning, t]);

  function enqueueOfflineAction(action: OfflineLeadAction) {
    setOfflineQueue((value) => [...value, action].slice(-40));
    onNotice(t("leads.offlineQueued"));
  }

  return {
    isOnline,
    offlineQueue,
    cachedLeads,
    enqueueOfflineAction,
  };
}
