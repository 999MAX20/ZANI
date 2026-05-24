import { apiClient, unwrapList } from "./client";
import type { PaginatedResponse } from "./client";
import type { BusinessInvitation, BusinessMembershipSummary, BusinessRole, Id, RolePermission, TeamDepartment, TeamMember } from "../types";

export type PermissionCatalog = {
  resources: { resource: string; actions: string[] }[];
  scopes: { value: string; label: string }[];
};

export const teamApi = {
  members: async () => {
    const { data } = await apiClient.get<TeamMember[] | PaginatedResponse<TeamMember>>("/api/team/members/");
    return unwrapList(data);
  },
  updateMember: async ({ id, payload }: { id: Id; payload: Partial<TeamMember> }) => {
    const { data } = await apiClient.patch<TeamMember>(`/api/team/members/${id}/`, payload);
    return data;
  },
  invitations: async () => {
    const { data } = await apiClient.get<BusinessInvitation[] | PaginatedResponse<BusinessInvitation>>("/api/team/invitations/");
    return unwrapList(data);
  },
  createInvitation: async (payload: {
    business: Id;
    email: string;
    phone?: string;
    telegram?: string;
    full_name?: string;
    role: BusinessMembershipSummary["role"];
    business_role?: Id | null;
    delivery_channel?: BusinessInvitation["delivery_channel"];
  }) => {
    const { data } = await apiClient.post<BusinessInvitation>("/api/team/invitations/", payload);
    return data;
  },
  revokeInvitation: async (id: Id) => {
    const { data } = await apiClient.post<BusinessInvitation>(`/api/team/invitations/${id}/revoke/`);
    return data;
  },
  previewInvitation: async (token: string) => {
    const { data } = await apiClient.get<Pick<BusinessInvitation, "business_name" | "email" | "full_name" | "role" | "status" | "expires_at">>(
      `/api/team/invitations/preview/${token}/`,
    );
    return data;
  },
  acceptInvitation: async ({ token, password, full_name, phone }: { token: string; password: string; full_name?: string; phone?: string }) => {
    const { data } = await apiClient.post<{ ok: boolean; business: Id; email: string; role: BusinessMembershipSummary["role"] }>("/api/team/invitations/accept/", {
      token,
      password,
      full_name,
      phone,
    });
    return data;
  },
  roles: async () => {
    const { data } = await apiClient.get<BusinessRole[] | PaginatedResponse<BusinessRole>>("/api/team/roles/");
    return unwrapList(data);
  },
  updateRole: async ({ id, payload }: { id: Id; payload: Partial<BusinessRole> }) => {
    const { data } = await apiClient.patch<BusinessRole>(`/api/team/roles/${id}/`, payload);
    return data;
  },
  updatePermission: async ({ id, payload }: { id: Id; payload: Partial<RolePermission> }) => {
    const { data } = await apiClient.patch<RolePermission>(`/api/team/role-permissions/${id}/`, payload);
    return data;
  },
  departments: async () => {
    const { data } = await apiClient.get<TeamDepartment[] | PaginatedResponse<TeamDepartment>>("/api/team/departments/");
    return unwrapList(data);
  },
  createDepartment: async (payload: Pick<TeamDepartment, "business" | "name" | "description">) => {
    const { data } = await apiClient.post<TeamDepartment>("/api/team/departments/", payload);
    return data;
  },
  catalog: async () => {
    const { data } = await apiClient.get<PermissionCatalog>("/api/team/permissions/catalog/");
    return data;
  },
};
