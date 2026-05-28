export type WhatsAppEmbeddedSignupCallback = {
  type: "zani.whatsapp.embedded_signup_callback";
  code?: string;
  state?: string;
  phone_number_id?: string;
  waba_id?: string;
  display_phone_number?: string;
};

export type InstagramOAuthCallback = {
  type: "zani.instagram.oauth_callback";
  code?: string;
  state?: string;
};

export const whatsappEmbeddedSignupCallbackType = "zani.whatsapp.embedded_signup_callback";
export const instagramOAuthCallbackType = "zani.instagram.oauth_callback";

const facebookSdkUrl = "https://connect.facebook.net/en_US/sdk.js";

declare global {
  interface Window {
    FB?: {
      init: (options: { appId: string; autoLogAppEvents?: boolean; xfbml?: boolean; version: string }) => void;
      login: (
        callback: (response: { authResponse?: { code?: string }; status?: string }) => void,
        options: {
          config_id: string;
          response_type: "code";
          override_default_response_type: true;
          extras: { setup: Record<string, never>; featureType: string; sessionInfoVersion: string };
        },
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export function parseWhatsAppEmbeddedSignupMessage(event: MessageEvent): WhatsAppEmbeddedSignupCallback | null {
  if (event.origin === window.location.origin && event.data?.type === whatsappEmbeddedSignupCallbackType) {
    return event.data as WhatsAppEmbeddedSignupCallback;
  }

  if (!["https://www.facebook.com", "https://web.facebook.com"].includes(event.origin)) {
    return null;
  }

  const payload = typeof event.data === "string" ? safeParseJson(event.data) : event.data;
  if (payload?.type !== "WA_EMBEDDED_SIGNUP" || !["FINISH", "FINISH_ONLY_WABA"].includes(payload?.event)) {
    return null;
  }
  return {
    type: whatsappEmbeddedSignupCallbackType,
    phone_number_id: payload.data?.phone_number_id,
    waba_id: payload.data?.waba_id,
    display_phone_number: payload.data?.display_phone_number,
  };
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function loadFacebookSdk({ appId, version }: { appId: string; version: string }) {
  return new Promise<typeof window.FB>((resolve, reject) => {
    if (window.FB) {
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      resolve(window.FB);
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${facebookSdkUrl}"]`);
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      resolve(window.FB);
    };
    if (existingScript) return;

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.src = facebookSdkUrl;
    script.onerror = () => reject(new Error("Facebook SDK не загрузился."));
    document.body.appendChild(script);
  });
}
