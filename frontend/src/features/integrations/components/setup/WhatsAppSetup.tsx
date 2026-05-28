import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, Send, ShieldCheck } from "lucide-react";

import { botChannelsApi, botsApi, whatsappChannelApi } from "../../../../api/bots";
import { businessConnectorsApi } from "../../../../api/connectors";
import { getApiErrorMessage } from "../../../../api/client";
import { Button } from "../../../../components/ui/Button";
import { ErrorState } from "../../../../components/ui/StateViews";
import { Input } from "../../../../components/ui/Input";
import type { Bot, BotChannel, Id } from "../../../../types";
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
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const applyCallback = (payload: WhatsAppEmbeddedSignupCallback) => {
      if (payload.code) setSignupCode(payload.code);
      if (payload.state) setSignupState(payload.state);
      if (payload.phone_number_id) setSignupPhoneNumberId(payload.phone_number_id);
      if (payload.waba_id) setSignupWabaId(payload.waba_id);
      if (payload.display_phone_number) setSignupDisplayPhone(payload.display_phone_number);
      setNotice("Meta вернула данные подключения. Проверьте поля и завершите подключение.");
    };

    const handleMessage = (event: MessageEvent) => {
      const payload = parseWhatsAppEmbeddedSignupMessage(event);
      if (payload) applyCallback(payload);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

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
      setNotice("WhatsApp channel создан. Теперь нажмите «Подключить через Meta».");
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
      setNotice("Доступ WhatsApp сохранен приватно. Теперь проверьте подключение.");
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => whatsappChannelApi.testConnection(Number(channel?.id)),
    onSuccess: (data) => {
      setNotice(data.ok ? "WhatsApp подключение проверено." : data.reason || "WhatsApp доступ не прошел проверку.");
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const startEmbeddedSignup = useMutation({
    mutationFn: () => businessConnectorsApi.startWhatsAppEmbeddedSignup({
      business: businessId,
      redirectUri: window.location.origin + "/dashboard/integrations?zani_provider=whatsapp",
    }),
    onSuccess: async (data) => {
      setSignupState(data.state);
      setSignupRedirectUri(data.redirect_uri);
      if (!data.app_configured || !data.config_id_configured) {
        setNotice("Meta app env не настроен. Проверьте META_APP_ID/META_APP_SECRET/WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID.");
        return;
      }

      try {
        const sdk = await loadFacebookSdk({ appId: data.app_id, version: data.graph_api_version || "v25.0" });
        sdk?.login(
          (response) => {
            const code = response.authResponse?.code;
            if (!code) {
              setNotice("Meta Embedded Signup не вернул code. Проверьте popup и разрешения Meta app.");
              return;
            }
            setSignupCode(code);
            setNotice("Meta вернула code. Дождитесь Phone number ID/WABA ID или заполните их вручную из WhatsApp Manager.");
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
        setNotice("Facebook SDK недоступен, открыт OAuth fallback. После завершения popup вернёт code/state.");
        window.open(data.authorization_url, "zani_whatsapp_meta_signup", "width=720,height=820");
      }
    },
  });

  const completeEmbeddedSignup = useMutation({
    mutationFn: () => businessConnectorsApi.completeWhatsAppEmbeddedSignup({
      business: businessId,
      code: signupCode,
      state: signupState,
      redirect_uri: signupRedirectUri || window.location.origin + "/dashboard/integrations?zani_provider=whatsapp",
      phone_number_id: signupPhoneNumberId,
      waba_id: signupWabaId,
      display_phone_number: signupDisplayPhone,
    }),
    onSuccess: () => {
      setSignupCode("");
      setSignupPhoneNumberId("");
      setSignupWabaId("");
      setSignupDisplayPhone("");
      setNotice("WhatsApp подключен через Meta Embedded Signup.");
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status", channel?.id] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const error = ensureChannel.error || saveCredentials.error || testConnection.error || startEmbeddedSignup.error || completeEmbeddedSignup.error || status.error;
  const credentialsConfigured = Boolean(status.data?.phone_number_id_configured && status.data?.access_token_configured);

  if (!channel) {
    return (
      <div className="w-full space-y-3">
        {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
        {notice ? <div className="rounded-2xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{notice}</div> : null}
        <Button type="button" disabled={!canManage} isLoading={ensureChannel.isPending} onClick={() => ensureChannel.mutate()}>
          <Send size={16} /> Создать WhatsApp channel
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
      {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
      {notice ? <div className="rounded-2xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{notice}</div> : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Номер</p>
          <p className="mt-1 text-sm font-black text-midnight">{status.data?.phone_number_id_configured ? "Сохранен" : "Нужен"}</p>
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

      <div className="rounded-3xl border border-green-100 bg-green-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-green-950">Подключение через Meta</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-green-800">
              Мерчант входит в Meta, выбирает бизнес-аккаунт WhatsApp и номер. ZANI сам сохранит доступ и проверит подключение.
            </p>
          </div>
          <Button type="button" disabled={!canManage} isLoading={startEmbeddedSignup.isPending} onClick={() => startEmbeddedSignup.mutate()}>
            <ExternalLink size={16} /> Подключить через Meta
          </Button>
        </div>
        {signupCode || signupPhoneNumberId ? (
          <div className="mt-4 rounded-2xl bg-white/70 p-3">
            <p className="text-sm font-black text-green-950">Meta вернула данные. Завершите подключение.</p>
          </div>
        ) : null}
        <div className="mt-3">
          <Button
            type="button"
            variant="secondary"
            disabled={!canManage || !signupCode.trim() || !signupState.trim() || !signupPhoneNumberId.trim()}
            isLoading={completeEmbeddedSignup.isPending}
            onClick={() => completeEmbeddedSignup.mutate()}
          >
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
            <Input label="Phone number ID" value={phoneNumberId} onChange={(event) => setPhoneNumberId(event.target.value)} placeholder={status.data?.phone_number_id_configured ? "Phone number ID уже сохранен" : "1234567890"} />
            <Input label="Access token хранится приватно" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder={status.data?.access_token_configured ? "Token уже сохранен. Вставьте новый только для замены." : "EAAG..."} type="password" autoComplete="off" />
            <Input label="WABA ID" value={businessAccountId} onChange={(event) => setBusinessAccountId(event.target.value)} placeholder="Опционально" />
            <Input label="Display phone" value={displayPhoneNumber} onChange={(event) => setDisplayPhoneNumber(event.target.value)} placeholder="+770..." />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Button type="button" disabled={!canManage || (!phoneNumberId.trim() && !accessToken.trim())} isLoading={saveCredentials.isPending} onClick={() => saveCredentials.mutate()}>
              <ShieldCheck size={16} /> {credentialsConfigured ? "Обновить доступ" : "Сохранить доступ"}
            </Button>
            <Button type="button" variant="secondary" disabled={!canManage || !credentialsConfigured} isLoading={testConnection.isPending} onClick={() => testConnection.mutate()}>
              <RefreshCw size={16} /> Проверить
            </Button>
          </div>
        </div>
      ) : null}

      <p className="text-xs font-semibold leading-5 text-slate-500">
        Webhook URL: {status.data?.webhook_url || "/api/integrations/whatsapp/webhook/"}. Verify token и App Secret задаются в production .env.
      </p>
    </div>
  );
}
