import { apiClient, unwrapList } from "./client";
import { createCrudApi } from "./crud";
import type { AuditLog, Id, LoginHistory, SecurityRiskSummary, SupportAccessGrant } from "../types";

export const securityApi = {
  audit: async (params: { business?: Id; actor?: Id | string; entity_type?: string; action?: string; risk?: string; category?: string }) => {
    const { data } = await apiClient.get<AuditLog[] | { results: AuditLog[] }>("/api/security/audit/", { params });
    return unwrapList(data);
  },
  loginHistory: async (params: { business?: Id; status?: string }) => {
    const { data } = await apiClient.get<LoginHistory[] | { results: LoginHistory[] }>("/api/security/login-history/", { params });
    return unwrapList(data);
  },
  riskSummary: async (business?: Id) => {
    const { data } = await apiClient.get<SecurityRiskSummary>("/api/security/risk-summary/", { params: { business } });
    return data;
  },
  supportGrants: createCrudApi<SupportAccessGrant>("/api/security/support-grants/"),
};
