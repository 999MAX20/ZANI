import { apiClient, unwrapList } from "./client";
import type { Id, ImportJob } from "../types";

export type ImportEntity = "clients" | "leads" | "sales" | "catalog";

export const importExportApi = {
  importJobs: async (business?: Id) => {
    const { data } = await apiClient.get<ImportJob[] | { results: ImportJob[] }>("/api/import-jobs/", {
      params: business ? { business } : undefined,
    });
    return unwrapList(data);
  },
  upload: async ({ business, entity, file }: { business: Id; entity: ImportEntity; file: File }) => {
    const formData = new FormData();
    formData.append("business", String(business));
    formData.append("entity_type", entity);
    formData.append("source_file", file);
    const { data } = await apiClient.post<ImportJob>("/api/import-jobs/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  uploadClients: async ({ business, file }: { business: Id; file: File }) => {
    return importExportApi.upload({ business, entity: "clients", file });
  },
  confirm: async (id: Id) => {
    const { data } = await apiClient.post<ImportJob>(`/api/import-jobs/${id}/confirm/`);
    return data;
  },
  exportEntity: async ({ business, entity }: { business: Id; entity: "clients" | "leads" | "deals" | "sales" | "catalog" }) => {
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
  downloadTemplate: async (entity: ImportEntity) => {
    const { data } = await apiClient.get<Blob>(`/api/import-templates/${entity}/`, {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${entity}_template.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  createManualSale: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post("/api/data/sales/", payload);
    return data;
  },
  createManualCatalogItem: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post("/api/data/catalog-items/", payload);
    return data;
  },
};
