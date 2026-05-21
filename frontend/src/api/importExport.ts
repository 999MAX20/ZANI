import { apiClient } from "./client";
import type { Id, ImportJob } from "../types";

export const importExportApi = {
  importJobs: async () => {
    const { data } = await apiClient.get<ImportJob[] | { results: ImportJob[] }>("/api/import-jobs/");
    return Array.isArray(data) ? data : data.results || [];
  },
  uploadClients: async ({ business, file }: { business: Id; file: File }) => {
    const formData = new FormData();
    formData.append("business", String(business));
    formData.append("entity_type", "clients");
    formData.append("source_file", file);
    const { data } = await apiClient.post<ImportJob>("/api/import-jobs/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  confirm: async (id: Id) => {
    const { data } = await apiClient.post<ImportJob>(`/api/import-jobs/${id}/confirm/`);
    return data;
  },
  exportEntity: async ({ business, entity }: { business: Id; entity: "clients" | "leads" | "deals" }) => {
    const { data } = await apiClient.get<Blob>(`/api/export/${entity}/`, {
      params: { business },
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${entity}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
