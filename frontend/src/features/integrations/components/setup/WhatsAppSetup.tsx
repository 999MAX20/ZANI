import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, Send, ShieldCheck } from "lucide-react";

import { botChannelsApi, botsApi, whatsappChannelApi } from "../../../../api/bots";
import { businessConnectorsApi } from "../../../../api/connectors";
import { getApiErrorMessage } from "../../../../api/client";
import { Button } from "../../../../components/ui/Button";
import { ErrorState } from "../../../../components/ui/StateViews";
import { Input } from "../../../../components/ui/Input";
import { useNotification } from "../../../../components/notifications/NotificationProvider";
import { useI18n } from "../../../../lib/i18n";
import type { Bot, BotChannel, Id } from "../../../../types";
import { MessengerSetupShell } from "./IntegrationSetupUi";
import { loadFacebookSdk, parseWhatsAppEmbeddedSignupMessage, type WhatsAppEmbeddedSignupCallback } from "./metaCallbacks";

export function WhatsAppInlineSetup({
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
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState("");
  const [showManualSetup, setShowManualSetup] = useState(false);
  const [signupCode, setSignupCode] = useState("");
  const [signupState, setSignupState] = useState("");
  const [signupRedirectUri, setSignupRedirectUri] = useState("");
  const [signupPhoneNumberId, setSignupPhoneNumberId] = useState("");
  const [signupWabaId, setSignupWabaId] = useState("");
  const [signupDisplayPhone, setSignupDisplayPhone] = useState("");
  const metaRedirectUri = `${window.location.origin}${window.location.pathname}?zani_provider=whatsapp`;

  function setNotice(message: string | null, tone: "success" | "info" | "warning" | "danger" = "info") {
    if (!message) return;
    showNotification({ message, tone });
  }

  useEffect(() => {
    const applyCallback = (payload: WhatsAppEmbeddedSignupCallback) => {
      if (payload.code) setSignupCode(payload.code);
      if (payload.state) setSignupState(payload.state);
      if (payload.phone_number_id) setSignupPhoneNumberId(payload.phone_number_id);
      if (payload.waba_id) setSignupWabaId(payload.waba_id);
      if (payload.display_phone_number) setSignupDisplayPhone(payload.display_phone_number);
      setNotice(t("integrations.whatsapp.metaDataReturned"));
    };

    const handleMessage = (event: MessageEvent) => {
      const payload = parseWhatsAppEmbeddedSignupMessage(event);
      if (payload) applyCallback(payload);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [t]);

  const status = useQuery({
    queryKey: ["whatsapp-status", channel?.id],
    queryFn: () => whatsappChannelApi.status(Number(channel?.id)),
    enabled: Boolean(channel?.id),
  });

  const ensureChannel = useMutation({
    mutationFn: async () => {
      const bot = bots[0] || await botsApi.create({
        business: businessId,
        name: "WhatsApp bot",
        status: "active",
        default_language: "ru",
        settings_json: {},
      });
      return botChannelsApi.create({
        bot: bot.id,
        channel: "whatsapp",
        status: "draft",
        external_id: "",
        config_json: { provider_mode: "meta_cloud" },
      });
    },
    onSuccess: () => {
      setNotice(t("integrations.whatsapp.channelCreated"));
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
    },
  });

  const saveCredentials = useMutation({
    mutationFn: () => whatsappChannelApi.configure({
      channelId: Number(channel?.id),
      providerMode: "meta_cloud",
      phoneNumberId,
      accessToken,
      businessAccountId,
      displayPhoneNumber,
    }),
    onSuccess: () => {
      setPhoneNumberId("");
      setAccessToken("");
      setBusinessAccountId("");
      setDisplayPhoneNumber("");
      setNotice(t("integrations.whatsapp.accessSaved"));
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => whatsappChannelApi.testConnection(Number(channel?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? t("integrations.whatsapp.connectionChecked") : data.reason || t("integrations.whatsapp.connectionCheckFailed"));
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

	  const startEmbeddedSignup = useMutation({
	    mutationFn: () => businessConnectorsApi.startWhatsAppEmbeddedSignup({
	      business: businessId,
	      redirectUri: metaRedirectUri,
	    }),
    onSuccess: async (data) => {
      setSignupState(data.state);
      setSignupRedirectUri(data.redirect_uri);
      if (!data.app_configured || !data.config_id_configured) {
        setNotice(t("integrations.whatsapp.metaOpenFailed"));
        return;
      }

      try {
        const sdk = await loadFacebookSdk({ appId: data.app_id, version: data.graph_api_version || "v25.0" });
        sdk?.login(
          (response) => {
            const code = response.authResponse?.code;
            if (!code) {
              setNotice(t("integrations.whatsapp.metaAccessDenied"));
              return;
            }
            setSignupCode(code);
            setNotice(t("integrations.whatsapp.metaConfirmed"));
          },
          {
            config_id: data.config_id,
            response_type: "code",
            override_default_response_type: true,
            extras: {
              setup: {},
              featureType: "whatsapp_business_app_onboarding",
              sessionInfoVersion: "3",
            },
          },
        );
      } catch {
        setNotice(t("integrations.whatsapp.metaFallbackOpened"));
        window.open(data.authorization_url, "zani_whatsapp_meta_signup", "width=720,height=820");
      }
    },
  });

	  const completeEmbeddedSignup = useMutation({
	    mutationFn: () => businessConnectorsApi.completeWhatsAppEmbeddedSignup({
	      business: businessId,
	      code: signupCode,
	      state: signupState,
	      redirect_uri: signupRedirectUri || metaRedirectUri,
	      phone_number_id: signupPhoneNumberId,
      waba_id: signupWabaId,
      display_phone_number: signupDisplayPhone,
    }),
    onSuccess: () => {
      setSignupCode("");
      setSignupPhoneNumberId("");
      setSignupWabaId("");
      setSignupDisplayPhone("");
      setNotice(t("integrations.whatsapp.connectedNotice"));
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status", channel?.id] });
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

  const error = ensureChannel.error || saveCredentials.error || testConnection.error || startEmbeddedSignup.error || completeEmbeddedSignup.error || toggleChannel.error || status.error;
  const credentialsConfigured = Boolean(status.data?.phone_number_id_configured && status.data?.access_token_configured);
  const hasSignupResult = Boolean(signupCode || signupPhoneNumberId);
  const connectionStatus = credentialsConfigured
    ? t("integrations.status.connected")
    : hasSignupResult
      ? t("integrations.whatsapp.finishConnection")
      : t("integrations.status.notConnected");
  const connectionTone = credentialsConfigured ? "success" : hasSignupResult ? "progress" : "neutral";

  if (!channel) {
    return (
      <div className="w-full space-y-3">
        {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
        <Button type="button" disabled={!canManage} isLoading={ensureChannel.isPending} onClick={() => ensureChannel.mutate()}>
          <Send size={16} /> {t("integrations.whatsapp.createChannel")}
        </Button>
      </div>
    );
  }

  return (
    <MessengerSetupShell
      logo="/integrations_logos/whatsapp.png"
      title="WhatsApp"
      description={t("integrations.whatsapp.inlineDescription")}
      status={connectionStatus}
      statusTone={connectionTone}
      error={error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
      canManage={canManage}
      inboxChannel="whatsapp"
      channelToggleVisible={credentialsConfigured}
      channelEnabled={channel.status === "active"}
      channelToggleLoading={toggleChannel.isPending}
      onToggleChannel={(checked) => toggleChannel.mutate(checked ? "active" : "paused")}
      advancedOpen={showManualSetup}
      onToggleAdvanced={() => setShowManualSetup((value) => !value)}
      advanced={
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Input label={t("integrations.whatsapp.phoneNumberId")} value={phoneNumberId} onChange={(event) => setPhoneNumberId(event.target.value)} placeholder={status.data?.phone_number_id_configured ? t("integrations.whatsapp.phoneNumberIdSaved") : "1234567890"} />
            <Input label={t("integrations.card.accessKey")} value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder={status.data?.access_token_configured ? t("integrations.card.accessKeyReplacePlaceholder") : t("integrations.card.accessKeyPlaceholder")} type="password" autoComplete="off" />
            <Input label={t("integrations.whatsapp.businessAccountId")} value={businessAccountId} onChange={(event) => setBusinessAccountId(event.target.value)} placeholder={t("common.optional")} />
            <Input label={t("integrations.whatsapp.customerPhoneNumber")} value={displayPhoneNumber} onChange={(event) => setDisplayPhoneNumber(event.target.value)} placeholder="+770..." />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Button type="button" disabled={!canManage || (!phoneNumberId.trim() && !accessToken.trim())} isLoading={saveCredentials.isPending} onClick={() => saveCredentials.mutate()}>
              <ShieldCheck size={16} /> {credentialsConfigured ? t("integrations.whatsapp.updateAccess") : t("integrations.whatsapp.saveAccess")}
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
              <p className="text-sm font-black text-midnight">{t("integrations.whatsapp.metaConnection")}</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                {t("integrations.whatsapp.metaDescription")}
              </p>
            </div>
            <Button type="button" disabled={!canManage} isLoading={startEmbeddedSignup.isPending} onClick={() => startEmbeddedSignup.mutate()}>
              <ExternalLink size={16} /> {t("integrations.whatsapp.connectWithMeta")}
            </Button>
          </div>
          {hasSignupResult ? (
            <div className="rounded-2xl bg-blue-50 p-3">
              <p className="text-sm font-black text-blue-950">{t("integrations.whatsapp.metaConfirmed")}</p>
            </div>
          ) : null}
          {hasSignupResult ? (
            <Button
              type="button"
              disabled={!canManage || !signupCode.trim() || !signupState.trim() || !signupPhoneNumberId.trim()}
              isLoading={completeEmbeddedSignup.isPending}
              onClick={() => completeEmbeddedSignup.mutate()}
            >
              <ShieldCheck size={16} /> {t("integrations.whatsapp.completeConnection")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </MessengerSetupShell>
  );
}
