import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, Send, ShieldCheck } from "lucide-react";

import { botChannelsApi, botsApi, instagramChannelApi } from "../../../../api/bots";
import { businessConnectorsApi } from "../../../../api/connectors";
import { getApiErrorMessage } from "../../../../api/client";
import { Button } from "../../../../components/ui/Button";
import { ErrorState } from "../../../../components/ui/StateViews";
import { Input } from "../../../../components/ui/Input";
import type { Bot, BotChannel, Id } from "../../../../types";
import { instagramOAuthCallbackType, type InstagramOAuthCallback } from "./metaCallbacks";

export function InstagramInlineSetup({
  businessId,
  bots,
  canManage,
  channel,
}: {
  businessId: Id;
  bots: Bot[];
  canManage: boolean;
  channel?: BotChannel;
}) {
  const queryClient = useQueryClient();
  const [instagramUserId, setInstagramUserId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [pageId, setPageId] = useState("");
  const [username, setUsername] = useState("");
  const [oauthCode, setOauthCode] = useState("");
  const [oauthState, setOauthState] = useState("");
  const [oauthRedirectUri, setOauthRedirectUri] = useState("");
  const [showManualSetup, setShowManualSetup] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== instagramOAuthCallbackType) return;
      const payload = event.data as InstagramOAuthCallback;
      if (payload.code) setOauthCode(payload.code);
      if (payload.state) setOauthState(payload.state);
      setNotice("Meta вернула доступ Instagram. Завершите подключение.");
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const status = useQuery({
    queryKey: ["instagram-status", channel?.id],
    queryFn: () => instagramChannelApi.status(Number(channel?.id)),
    enabled: Boolean(channel?.id),
  });

  const ensureChannel = useMutation({
    mutationFn: async () => {
      const bot = bots[0] || await botsApi.create({
        business: businessId,
        name: "Instagram bot",
        status: "active",
        default_language: "ru",
        settings_json: {},
      });
      return botChannelsApi.create({
        bot: bot.id,
        channel: "instagram",
        status: "draft",
        external_id: "",
        config_json: { provider_mode: "meta_graph" },
      });
    },
    onSuccess: () => {
      setNotice("Instagram channel создан. Теперь нажмите «Подключить через Meta».");
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
    },
  });

  const saveCredentials = useMutation({
    mutationFn: () => instagramChannelApi.configure({
      channelId: Number(channel?.id),
      providerMode: "meta_graph",
      instagramUserId,
      accessToken,
      pageId,
      username,
    }),
    onSuccess: () => {
      setInstagramUserId("");
      setAccessToken("");
      setPageId("");
      setUsername("");
      setNotice("Доступ Instagram сохранен приватно. Теперь проверьте подключение.");
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const startOAuth = useMutation({
    mutationFn: () => businessConnectorsApi.startInstagramOAuth({
      business: businessId,
      redirectUri: window.location.origin + "/dashboard/integrations?zani_provider=instagram",
    }),
    onSuccess: (data) => {
      setOauthState(data.state);
      setOauthRedirectUri(data.redirect_uri);
      if (!data.app_configured) {
        setNotice("Meta app env не настроен. Проверьте META_APP_ID/META_APP_SECRET.");
        return;
      }
      window.open(data.authorization_url, "zani_instagram_meta_oauth", "width=720,height=820");
    },
  });

  const completeOAuth = useMutation({
    mutationFn: () => businessConnectorsApi.completeInstagramOAuth({
      business: businessId,
      code: oauthCode,
      state: oauthState,
      redirect_uri: oauthRedirectUri || window.location.origin + "/dashboard/integrations?zani_provider=instagram",
      page_id: pageId,
    }),
    onSuccess: () => {
      setOauthCode("");
      setPageId("");
      setNotice("Instagram подключен через Meta.");
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => instagramChannelApi.testConnection(Number(channel?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? "Instagram подключение проверено." : data.reason || "Instagram доступ не прошел проверку.");
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const error = ensureChannel.error || saveCredentials.error || testConnection.error || startOAuth.error || completeOAuth.error || status.error;
  const credentialsConfigured = Boolean(status.data?.instagram_user_id_configured && status.data?.access_token_configured);

  if (!channel) {
    return (
      <div className="w-full space-y-3">
        {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
        {notice ? <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{notice}</div> : null}
        <Button type="button" disabled={!canManage} isLoading={ensureChannel.isPending} onClick={() => ensureChannel.mutate()}>
          <Send size={16} /> Создать Instagram channel
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
      {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
      {notice ? <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{notice}</div> : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Аккаунт</p>
          <p className="mt-1 text-sm font-black text-midnight">{status.data?.instagram_user_id_configured ? "Сохранен" : "Нужен"}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Доступ</p>
          <p className="mt-1 text-sm font-black text-midnight">{status.data?.access_token_configured ? "Сохранен" : "Нужен"}</p>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Сообщения</p>
          <p className="mt-1 text-sm font-black text-midnight">{status.data?.verify_token_configured ? "Готов" : "Env"}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-blue-950">Подключение через Meta</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-blue-800">
              Мерчант входит в Meta, выбирает страницу с Instagram Business account, ZANI сам сохранит доступ.
            </p>
          </div>
          <Button type="button" disabled={!canManage} isLoading={startOAuth.isPending} onClick={() => startOAuth.mutate()}>
            <ExternalLink size={16} /> Подключить через Meta
          </Button>
        </div>
        {oauthCode ? <div className="mt-3 rounded-2xl bg-white/70 p-3 text-sm font-black text-blue-950">Meta вернула данные. Завершите подключение.</div> : null}
        <div className="mt-3">
          <Button type="button" variant="secondary" disabled={!canManage || !oauthCode.trim() || !oauthState.trim()} isLoading={completeOAuth.isPending} onClick={() => completeOAuth.mutate()}>
            <ShieldCheck size={16} /> Завершить подключение
          </Button>
        </div>
      </div>

      <button type="button" className="text-sm font-black text-brand-700" onClick={() => setShowManualSetup((value) => !value)}>
        {showManualSetup ? "Скрыть ручное подключение" : "Ручное подключение для поддержки"}
      </button>
      {showManualSetup ? (
        <div className="space-y-3 rounded-3xl border border-slate-100 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Instagram Business Account ID" value={instagramUserId} onChange={(event) => setInstagramUserId(event.target.value)} placeholder={status.data?.instagram_user_id_configured ? "ID уже сохранен" : "1784..."} />
            <Input label="Access token хранится приватно" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder={status.data?.access_token_configured ? "Token уже сохранен. Вставьте новый только для замены." : "EAAG..."} type="password" autoComplete="off" />
            <Input label="Facebook Page ID" value={pageId} onChange={(event) => setPageId(event.target.value)} placeholder="Опционально" />
            <Input label="Instagram username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="@account" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Button type="button" disabled={!canManage || (!instagramUserId.trim() && !accessToken.trim())} isLoading={saveCredentials.isPending} onClick={() => saveCredentials.mutate()}>
              <ShieldCheck size={16} /> {credentialsConfigured ? "Обновить доступ" : "Сохранить доступ"}
            </Button>
            <Button type="button" variant="secondary" disabled={!canManage || !credentialsConfigured} isLoading={testConnection.isPending} onClick={() => testConnection.mutate()}>
              <RefreshCw size={16} /> Проверить
            </Button>
          </div>
        </div>
      ) : null}

      <p className="text-xs font-semibold leading-5 text-slate-500">
        Webhook URL: {status.data?.webhook_url || "/api/integrations/instagram/webhook/"}. Verify token и App Secret задаются в local/production .env.
      </p>
    </div>
  );
}
