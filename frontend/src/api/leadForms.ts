import { apiClient } from "./client";
import { createCrudApi } from "./crud";
import type { Id, LeadCaptureForm, LeadFormField, LeadFormSubmission } from "../types";

function unwrapList<T>(data: T[] | { results: T[] }) {
  return Array.isArray(data) ? data : data.results || [];
}

export const leadFormsApi = {
  ...createCrudApi<LeadCaptureForm>("/api/lead-forms/"),
  list: async () => {
    const { data } = await apiClient.get<LeadCaptureForm[] | { results: LeadCaptureForm[] }>("/api/lead-forms/");
    return unwrapList(data);
  },
  createTemplate: async ({ business }: { business: Id }) => {
    const { data } = await apiClient.post<LeadCaptureForm>("/api/lead-forms/create-template/", { business });
    return data;
  },
};

export const leadFormFieldsApi = createCrudApi<LeadFormField>("/api/lead-form-fields/");

export const leadFormSubmissionsApi = {
  list: async () => {
    const { data } = await apiClient.get<LeadFormSubmission[] | { results: LeadFormSubmission[] }>("/api/lead-form-submissions/");
    return unwrapList(data);
  },
};
