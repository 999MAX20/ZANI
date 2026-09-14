import { apiClient, type PaginatedResponse } from "./client";

export type PaymentMethod = "cash" | "card" | "transfer" | "other";
export type Payment = {
  id: number; business: number; client: number; client_name: string;
  kind: "receipt" | "refund"; original: number | null; amount: string;
  currency: string; refunded_amount: string; remaining_amount: string;
  occurred_at: string; method: PaymentMethod; source: string; note: string;
  reason: string; created_at: string; actor_name: string; can_refund: boolean;
  link: { kind: "deal" | "appointment"; id: number } | null;
};
export type PaymentDraft = {
  business: number; submission_id: string; client?: number; deal?: number;
  appointment?: number; original?: number; amount: string; currency?: string;
  occurred_at: string; method: PaymentMethod; note: string; reason?: string;
};
export type PaymentOption = { id: number; label: string; occurred_at?: string | null };
export type PaymentOptionKind = "client" | "deal" | "appointment";

const path = "/api/client-payments/";
export const paymentsApi = {
  list: async (params: { business: number; client?: number; page: number; q: string; kind: string }) => {
    const { data } = await apiClient.get<PaginatedResponse<Payment>>(path, { params });
    return data;
  },
  create: async (payload: PaymentDraft) => {
    const { data } = await apiClient.post<Payment>(path, payload);
    return data;
  },
  options: async (params: { business: number; kind: PaymentOptionKind; client?: number; q: string; page: number }) => {
    const { data } = await apiClient.get<PaginatedResponse<PaymentOption>>(`${path}link-options/`, { params: { ...params, page_size: 5 } });
    return data;
  },
};
