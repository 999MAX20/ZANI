import { apiClient } from "./client";
import type { FileAttachment, Id } from "../types";

type AttachmentListParams = {
  business?: Id;
  entity_type?: string;
  entity_id?: Id | string;
};

export const fileAttachmentsApi = {
  list: async (params: AttachmentListParams = {}) => {
    const { data } = await apiClient.get<FileAttachment[] | { results: FileAttachment[] }>("/api/file-attachments/", { params });
    return Array.isArray(data) ? data : data.results;
  },
  upload: async ({
    business,
    entityType,
    entityId,
    file,
  }: {
    business: Id;
    entityType: string;
    entityId: Id | string;
    file: File;
  }) => {
    const form = new FormData();
    form.append("business", String(business));
    form.append("entity_type", entityType);
    form.append("entity_id", String(entityId));
    form.append("file", file);
    const { data } = await apiClient.post<FileAttachment>("/api/file-attachments/", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  downloadBlob: async (id: Id) => {
    const { data } = await apiClient.get<Blob>(`/api/file-attachments/${id}/download/`, {
      responseType: "blob",
    });
    return data;
  },
  rename: async ({ id, originalName }: { id: Id; originalName: string }) => {
    const { data } = await apiClient.post<FileAttachment>(`/api/file-attachments/${id}/rename/`, {
      original_name: originalName,
    });
    return data;
  },
};
