import { createCrudApi } from "./crud";
import { apiClient, unwrapList } from "./client";
import type { Bot, BotChannel, BotConversation, BotMessage, IntegrationEventLog } from "../types";

export const botsApi = createCrudApi<Bot>("/api/bots/");
export const botChannelsApi = createCrudApi<BotChannel>("/api/bot-channels/");
export const botConversationsApi = createCrudApi<BotConversation>("/api/bot-conversations/");
export const botMessagesApi = createCrudApi<BotMessage>("/api/bot-messages/");

export const integrationEventLogsApi = {
  list: async (params?: { provider?: string; channel?: string; status?: string; direction?: string }) => {
    const { data } = await apiClient.get<IntegrationEventLog[] | { results: IntegrationEventLog[] }>("/api/integration-event-logs/", { params });
    return unwrapList(data);
  },
};

export type BotSuggestedReplyResponse = {
  suggested_reply: string;
  is_mock: boolean;
  model: string;
  tokens_used: number;
  log_id: number;
  messages_used: number;
};

export const botAiApi = {
  suggestReply: async (conversationId: number) => {
    const { data } = await apiClient.post<BotSuggestedReplyResponse>(`/api/bot-conversations/${conversationId}/suggest-reply/`);
    return data;
  },
};

export const telegramChannelApi = {
  configure: async ({ channelId, botToken, webhookSecret }: { channelId: number; botToken: string; webhookSecret?: string }) => {
    const { data } = await apiClient.post<{
      ok: boolean;
      token_configured: boolean;
      webhook_secret_configured: boolean;
      status: string;
    }>(`/api/bot-channels/${channelId}/telegram-config/`, {
      bot_token: botToken,
      ...(webhookSecret ? { webhook_secret: webhookSecret } : {}),
    });
    return data;
  },
  setWebhook: async ({ channelId, webhookUrl }: { channelId: number; webhookUrl: string }) => {
    const { data } = await apiClient.post<{ ok: boolean; reason?: string; mock?: boolean; webhook_url?: string }>(
      `/api/bot-channels/${channelId}/set-telegram-webhook/`,
      { webhook_url: webhookUrl },
    );
    return data;
  },
  status: async (channelId: number) => {
    const { data } = await apiClient.get<{
      status: string;
      token_configured: boolean;
      token_verified: boolean;
      bot_username: string;
      webhook_secret_configured: boolean;
      webhook_configured: boolean;
      webhook_url: string;
      webhook_public_ready: boolean;
      inbound_backend_ready: boolean;
      inbound_ready: boolean;
      last_error: string;
      last_inbound_status: string;
      last_inbound_at: string | null;
      last_outbound_status: string;
      last_outbound_at: string | null;
    }>(`/api/bot-channels/${channelId}/telegram-status/`);
    return data;
  },
  testConnection: async (channelId: number) => {
    const { data } = await apiClient.post<{
      ok: boolean;
      reason: string;
      status: string;
      token_configured: boolean;
      bot: Record<string, unknown>;
    }>(`/api/bot-channels/${channelId}/telegram-test-connection/`);
    return data;
  },
  syncUpdates: async (channelId: number) => {
    const { data } = await apiClient.post<{
      ok: boolean;
      processed: number;
      updates_count: number;
      reason?: string;
    }>(`/api/bot-channels/${channelId}/sync-telegram-updates/`);
    return data;
  },
};

export type WhatsAppChannelStatus = {
  status: string;
  provider_mode: "mock" | "meta_cloud" | "disabled";
  webhook_url: string;
  phone_number_id_configured: boolean;
  access_token_configured: boolean;
  business_account_id_configured: boolean;
  webhook_secret_configured: boolean;
  verify_token_configured: boolean;
  app_secret_configured: boolean;
  last_error: string;
  last_event_status: string;
  last_event_at: string | null;
};

export const whatsappChannelApi = {
  configure: async ({
    channelId,
    providerMode,
    webhookSecret,
    phoneNumberId,
    accessToken,
    businessAccountId,
    displayPhoneNumber,
  }: {
    channelId: number;
    providerMode: "mock" | "meta_cloud" | "disabled";
    webhookSecret?: string;
    phoneNumberId?: string;
    accessToken?: string;
    businessAccountId?: string;
    displayPhoneNumber?: string;
  }) => {
    const { data } = await apiClient.post<{
      ok: boolean;
      provider_mode: "mock" | "meta_cloud" | "disabled";
      status: string;
      phone_number_id_configured: boolean;
      access_token_configured: boolean;
      webhook_secret_configured: boolean;
    }>(`/api/bot-channels/${channelId}/whatsapp-config/`, {
      provider_mode: providerMode,
      webhook_secret: webhookSecret,
      phone_number_id: phoneNumberId,
      access_token: accessToken,
      business_account_id: businessAccountId,
      display_phone_number: displayPhoneNumber,
    });
    return data;
  },
  testConnection: async (channelId: number) => {
    const { data } = await apiClient.post<{
      ok: boolean;
      mock: boolean;
      reason: string;
      status: string;
      provider_mode: "mock" | "meta_cloud" | "disabled";
      phone_number_id_configured: boolean;
      access_token_configured: boolean;
      phone_number: Record<string, unknown>;
    }>(`/api/bot-channels/${channelId}/whatsapp-test-connection/`);
    return data;
  },
  status: async (channelId: number) => {
    const { data } = await apiClient.get<WhatsAppChannelStatus>(`/api/bot-channels/${channelId}/whatsapp-status/`);
    return data;
  },
};

export type InstagramChannelStatus = {
  status: string;
  provider_mode: "mock" | "meta_graph" | "disabled";
  webhook_url: string;
  instagram_user_id_configured: boolean;
  access_token_configured: boolean;
  page_id_configured: boolean;
  verify_token_configured: boolean;
  app_secret_configured: boolean;
  last_error: string;
  last_event_status: string;
  last_event_at: string | null;
};

export const instagramChannelApi = {
  configure: async ({
    channelId,
    providerMode,
    instagramUserId,
    accessToken,
    pageId,
    username,
  }: {
    channelId: number;
    providerMode: "mock" | "meta_graph" | "disabled";
    instagramUserId?: string;
    accessToken?: string;
    pageId?: string;
    username?: string;
  }) => {
    const { data } = await apiClient.post<{
      ok: boolean;
      provider_mode: "mock" | "meta_graph" | "disabled";
      status: string;
      instagram_user_id_configured: boolean;
      access_token_configured: boolean;
      page_id_configured: boolean;
    }>(`/api/bot-channels/${channelId}/instagram-config/`, {
      provider_mode: providerMode,
      instagram_user_id: instagramUserId,
      access_token: accessToken,
      page_id: pageId,
      username,
    });
    return data;
  },
  testConnection: async (channelId: number) => {
    const { data } = await apiClient.post<{
      ok: boolean;
      mock: boolean;
      reason: string;
      status: string;
      provider_mode: "mock" | "meta_graph" | "disabled";
      instagram_user_id_configured: boolean;
      access_token_configured: boolean;
      instagram_account: Record<string, unknown>;
    }>(`/api/bot-channels/${channelId}/instagram-test-connection/`);
    return data;
  },
  status: async (channelId: number) => {
    const { data } = await apiClient.get<InstagramChannelStatus>(`/api/bot-channels/${channelId}/instagram-status/`);
    return data;
  },
};

export type WebsiteChatConversationPayload = {
  full_name?: string;
  phone?: string;
  email?: string;
  message: string;
  external_user_id?: string;
};

export type WebsiteChatConversationResponse = {
  conversation_id: string;
  message_id: number;
  lead_id: number | null;
  client_id: number | null;
  status: string;
};

export const websiteChatApi = {
  channel: async (publicToken: string) => {
    const { data } = await apiClient.get<{
      bot_name: string;
      channel: string;
      status: string;
      default_language: string;
    }>(`/api/public/website-chat/${publicToken}/`);
    return data;
  },
  createConversation: async ({ publicToken, payload }: { publicToken: string; payload: WebsiteChatConversationPayload }) => {
    const { data } = await apiClient.post<WebsiteChatConversationResponse>(
      `/api/public/website-chat/${publicToken}/conversations/`,
      payload,
    );
    return data;
  },
  sendMessage: async ({ publicToken, conversationId, message }: { publicToken: string; conversationId: string; message: string }) => {
    const { data } = await apiClient.post<{ conversation_id: string; message_id: number; status: string }>(
      `/api/public/website-chat/${publicToken}/conversations/${conversationId}/messages/`,
      { message },
    );
    return data;
  },
};
