import { apiClient } from "./client";
import type { ApplyOnboardingTemplateResponse, Business, Id, OnboardingStatus, OnboardingTemplate } from "../types";

export const onboardingApi = {
  templates: async () => {
    const { data } = await apiClient.get<OnboardingTemplate[]>("/api/onboarding/templates/");
    return data;
  },
  status: async (business: Id) => {
    const { data } = await apiClient.get<OnboardingStatus>("/api/onboarding/status/", { params: { business } });
    return data;
  },
  applyTemplate: async ({ business, templateKey }: { business: Id; templateKey: Business["business_type"] }) => {
    const { data } = await apiClient.post<ApplyOnboardingTemplateResponse>("/api/onboarding/apply-template/", {
      business,
      template_key: templateKey,
    });
    return data;
  },
  createDemoData: async (business: Id) => {
    const { data } = await apiClient.post<OnboardingStatus>("/api/onboarding/demo-data/", { business });
    return data;
  },
  setupChannel: async ({ business, channel }: { business: Id; channel: "website" | "telegram" | "whatsapp" }) => {
    const { data } = await apiClient.post<{
      business: Id;
      bot: Id;
      channel: Id;
      channel_type: string;
      connector: Id;
      public_token: string;
      status: OnboardingStatus;
    }>("/api/onboarding/setup-channel/", { business, channel });
    return data;
  },
  createFirstMessage: async (business: Id) => {
    const { data } = await apiClient.post<{
      business: Id;
      conversation: Id;
      message: Id;
      lead: Id;
      client: Id;
      status: OnboardingStatus;
    }>("/api/onboarding/first-message/", { business });
    return data;
  },
};
