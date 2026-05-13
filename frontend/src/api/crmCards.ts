import { apiClient } from "./client";
import type { CrmCardPayload, CrmEntityType, Id } from "../types";

const endpoints: Record<CrmEntityType, string> = {
  client: "/api/clients/",
  lead: "/api/leads/",
  deal: "/api/deals/",
  appointment: "/api/appointments/",
};

export const crmCardsApi = {
  get: async ({ type, id }: { type: CrmEntityType; id: Id }) => {
    const { data } = await apiClient.get<CrmCardPayload>(`${endpoints[type]}${id}/crm-card/`);
    return data;
  },
};
