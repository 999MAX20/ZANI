import { createCrudApi } from "./crud";
import { apiClient } from "./client";
import type { Bot, BotChannel, BotConversation, BotMessage } from "../types";

export const botsApi = createCrudApi<Bot>("/api/bots/");
export const botChannelsApi = createCrudApi<BotChannel>("/api/bot-channels/");
export const botConversationsApi = createCrudApi<BotConversation>("/api/bot-conversations/");
export const botMessagesApi = createCrudApi<BotMessage>("/api/bot-messages/");

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
  configure: async ({ channelId, botToken, webhookSecret }: { channelId: number; botToken: string; webhookSecret: string }) => {
    const { data } = await apiClient.post<{
      ok: boolean;
      token_configured: boolean;
      webhook_secret_configured: boolean;
      status: string;
    }>(`/api/bot-channels/${channelId}/telegram-config/`, {
      bot_token: botToken,
      webhook_secret: webhookSecret,
    });
    return data;
  },
  setWebhook: async ({ channelId, webhookUrl }: { channelId: number; webhookUrl: string }) => {
    const { data } = await apiClient.post<{ ok: boolean; mock?: boolean; reason?: string }>(
      `/api/bot-channels/${channelId}/set-telegram-webhook/`,
      { webhook_url: webhookUrl },
    );
    return data;
  },
  status: async (channelId: number) => {
    const { data } = await apiClient.get<{
      status: string;
      token_configured: boolean;
      webhook_secret_configured: boolean;
      last_error: string;
    }>(`/api/bot-channels/${channelId}/telegram-status/`);
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
