import { apiClient } from "./client";
import type { BusinessRole, Id, RolePermission, TeamDepartment, TeamMember } from "../types";

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function unwrapList<T>(data: T[] | PaginatedResponse<T>) {
  return Array.isArray(data) ? data : data.results || [];
}

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
