import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, Send, ShieldCheck } from "lucide-react";

import { botChannelsApi, botsApi, instagramChannelApi } from "../../../../api/bots";
import { businessConnectorsApi } from "../../../../api/connectors";
import { getApiErrorMessage } from "../../../../api/client";
import { Button } from "../../../../components/ui/Button";
import { ErrorState } from "../../../../components/ui/StateViews";
import { Input } from "../../../../components/ui/Input";
import { useNotification } from "../../../../components/notifications/NotificationProvider";
import { useI18n } from "../../../../lib/i18n";
import type { Bot, BotChannel, Id } from "../../../../types";
import { MessengerSetupShell } from "./IntegrationSetupUi";
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
  const { t } = useI18n();
  const showNotification = useNotification();
  const queryClient = useQueryClient();
  const [instagramUserId, setInstagramUserId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [pageId, setPageId] = useState("");
  const [username, setUsername] = useState("");
  const [oauthCode, setOauthCode] = useState("");
  const [oauthState, setOauthState] = useState("");
  const [oauthRedirectUri, setOauthRedirectUri] = useState("");
  const [showManualSetup, setShowManualSetup] = useState(false);
  const metaRedirectUri = `${window.location.origin}${window.location.pathname}?zani_provider=instagram`;

  function setNotice(message: string | null, tone: "success" | "info" | "warning" | "danger" = "info") {
    if (!message) return;
    showNotification({ message, tone });
  }

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== instagramOAuthCallbackType) return;
      const payload = event.data as InstagramOAuthCallback;
      if (payload.code) setOauthCode(payload.code);
      if (payload.state) setOauthState(payload.state);
      setNotice(t("integrations.instagram.metaAccessReturned"));
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [t]);

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
      setNotice(t("integrations.instagram.channelCreated"));
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
      setNotice(t("integrations.instagram.accessSaved"));
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

	  const startOAuth = useMutation({
	    mutationFn: () => businessConnectorsApi.startInstagramOAuth({
	      business: businessId,
	      redirectUri: metaRedirectUri,
	    }),
    onSuccess: (data) => {
      setOauthState(data.state);
      setOauthRedirectUri(data.redirect_uri);
      if (!data.app_configured) {
        setNotice(t("integrations.instagram.metaOpenFailed"));
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
	      redirect_uri: oauthRedirectUri || metaRedirectUri,
	      page_id: pageId,
    }),
    onSuccess: () => {
      setOauthCode("");
      setPageId("");
      setNotice(t("integrations.instagram.connectedNotice"));
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => instagramChannelApi.testConnection(Number(channel?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? t("integrations.instagram.connectionChecked") : data.reason || t("integrations.instagram.connectionCheckFailed"));
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });
  const toggleChannel = useMutation({
    mutationFn: (nextStatus: BotChannel["status"]) => {
      if (!channel) throw new Error("Channel is required.");
      return botChannelsApi.update({ id: channel.id, payload: { status: nextStatus } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const error = ensureChannel.error || saveCredentials.error || testConnection.error || startOAuth.error || completeOAuth.error || toggleChannel.error || status.error;
  const credentialsConfigured = Boolean(status.data?.instagram_user_id_configured && status.data?.access_token_configured);
  const hasOAuthResult = Boolean(oauthCode);
  const connectionStatus = credentialsConfigured
    ? t("integrations.status.connected")
    : hasOAuthResult
      ? t("integrations.instagram.finishConnection")
      : t("integrations.status.notConnected");
  const connectionTone = credentialsConfigured ? "success" : hasOAuthResult ? "progress" : "neutral";

  if (!channel) {
    return (
      <div className="w-full space-y-3">
        {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
        <Button type="button" disabled={!canManage} isLoading={ensureChannel.isPending} onClick={() => ensureChannel.mutate()}>
          <Send size={16} /> {t("integrations.instagram.createChannel")}
        </Button>
      </div>
    );
  }

  return (
    <MessengerSetupShell
      logo="/integrations_logos/instagram.png"
      title="Instagram"
      description={t("integrations.instagram.inlineDescription")}
      status={connectionStatus}
      statusTone={connectionTone}
      error={error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
      canManage={canManage}
      inboxChannel="instagram"
      channelToggleVisible={credentialsConfigured}
      channelEnabled={channel.status === "active"}
      channelToggleLoading={toggleChannel.isPending}
      onToggleChannel={(checked) => toggleChannel.mutate(checked ? "active" : "paused")}
      advancedOpen={showManualSetup}
      onToggleAdvanced={() => setShowManualSetup((value) => !value)}
      advanced={
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Input label={t("integrations.instagram.accountId")} value={instagramUserId} onChange={(event) => setInstagramUserId(event.target.value)} placeholder={status.data?.instagram_user_id_configured ? t("integrations.instagram.idSaved") : "1784..."} />
            <Input label={t("integrations.card.accessKey")} value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder={status.data?.access_token_configured ? t("integrations.card.accessKeyReplacePlaceholder") : t("integrations.card.accessKeyPlaceholder")} type="password" autoComplete="off" />
            <Input label={t("integrations.instagram.facebookPageId")} value={pageId} onChange={(event) => setPageId(event.target.value)} placeholder={t("common.optional")} />
            <Input label={t("integrations.instagram.username")} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="@account" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Button type="button" disabled={!canManage || (!instagramUserId.trim() && !accessToken.trim())} isLoading={saveCredentials.isPending} onClick={() => saveCredentials.mutate()}>
              <ShieldCheck size={16} /> {credentialsConfigured ? t("integrations.instagram.updateAccess") : t("integrations.instagram.saveAccess")}
            </Button>
            <Button type="button" variant="secondary" disabled={!canManage || !credentialsConfigured} isLoading={testConnection.isPending} onClick={() => testConnection.mutate()}>
              <RefreshCw size={16} /> {t("integrations.card.check")}
            </Button>
          </div>
        </div>
      }
    >
      {!credentialsConfigured ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black text-midnight">{t("integrations.instagram.metaConnection")}</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                {t("integrations.instagram.metaDescription")}
              </p>
            </div>
            <Button type="button" disabled={!canManage} isLoading={startOAuth.isPending} onClick={() => startOAuth.mutate()}>
              <ExternalLink size={16} /> {t("integrations.instagram.connectWithMeta")}
            </Button>
          </div>
          {hasOAuthResult ? <div className="rounded-2xl bg-blue-50 p-3 text-sm font-black text-blue-950">{t("integrations.instagram.metaConfirmed")}</div> : null}
          {hasOAuthResult ? (
            <Button type="button" variant="secondary" disabled={!canManage || !oauthCode.trim() || !oauthState.trim()} isLoading={completeOAuth.isPending} onClick={() => completeOAuth.mutate()}>
              <ShieldCheck size={16} /> {t("integrations.instagram.completeConnection")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </MessengerSetupShell>
  );
}
