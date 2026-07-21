import { useMemo } from "react";

import type { Client, Id, Task } from "../../../types";
import type { ClientKpi, ClientTableRow, ClientTag, Translate } from "../types";

export function useClientRows({
  clients,
  tagsByClient,
  currentUserId,
  totalOverride,
  serverSummary,
  t,
}: {
  clients: Client[];
  tagsByClient: Record<string, ClientTag[]>;
  currentUserId?: Id | null;
  totalOverride?: number;
  t: Translate;
  serverSummary?: {
    total: number;
    active: number;
    no_reply: number;
    repeat: number;
  };
}) {
  const tableRows = useMemo<ClientTableRow[]>(() => {
    return clients.map((client) => {
      const tagsForClient = tagsByClient[String(client.id)] || [];
      const isVip = tagsForClient.some((tag) => String(tag.tag_name || "").toLowerCase().includes("vip"));
      const hasNoReply = Boolean(client.has_no_reply);
      const isActive = Boolean(client.is_active);
      const status: ClientTableRow["status"] = client.is_archived
        ? "archived"
        : client.is_vip || isVip
          ? "vip"
          : hasNoReply
            ? "no_reply"
            : isActive
              ? "active"
              : "new";
      const latestManagerId = client.manager_user_id || null;
      const managerIdNumber = latestManagerId ? Number(latestManagerId) : null;
      const isMine = currentUserId ? managerIdNumber !== null && Number(currentUserId) === managerIdNumber : false;

      return {
        client,
        tags: tagsForClient,
        leads: [],
        deals: [],
        appointments: [],
        tasks: [],
        conversations: [],
        status,
        lastContactAt: client.last_activity_at || client.updated_at || null,
        nextStep: {
          title: client.next_step_title || "",
          date: client.next_step_date || null,
          priority: (client.next_step_priority || "normal") as Task["priority"],
        },
        manager: latestManagerId ? t("clients.managerWithId", { id: latestManagerId }) : "",
        managerUserId: isMine ? currentUserId || null : (latestManagerId ? Number(latestManagerId) : null),
      };
    });
  }, [clients, currentUserId, t, tagsByClient]);

  const rows = useMemo(() => {
    return tableRows;
  }, [tableRows]);

  const kpi = useMemo<ClientKpi>(
    () => ({
      total: serverSummary?.total ?? (typeof totalOverride === "number" ? totalOverride : tableRows.length),
      active: serverSummary?.active ?? tableRows.filter((row) => row.status === "active" || row.status === "vip").length,
      noReply: serverSummary?.no_reply ?? tableRows.filter((row) => row.status === "no_reply").length,
      repeat: serverSummary?.repeat ?? 0,
    }),
    [serverSummary, tableRows, totalOverride],
  );

  return { rows, tableRows, kpi };
}
