import { useEffect } from "react";

import {
  instagramOAuthCallbackType,
  whatsappEmbeddedSignupCallbackType,
  type InstagramOAuthCallback,
  type WhatsAppEmbeddedSignupCallback,
} from "../integrations/components/setup/metaCallbacks";

export function useMetaOAuthCallbackBridge() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return;
    const provider = url.searchParams.get("zani_provider");

    const payload = provider === "instagram"
      ? {
          type: instagramOAuthCallbackType,
          code,
          state,
        } satisfies InstagramOAuthCallback
      : {
          type: whatsappEmbeddedSignupCallbackType,
          code,
          state,
          phone_number_id: url.searchParams.get("phone_number_id") || undefined,
          waba_id: url.searchParams.get("waba_id") || undefined,
          display_phone_number: url.searchParams.get("display_phone_number") || undefined,
        } satisfies WhatsAppEmbeddedSignupCallback;

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
      window.close();
      return;
    }

    [
      "code",
      "state",
      "zani_provider",
      "phone_number_id",
      "waba_id",
      "display_phone_number",
    ].forEach((parameter) => url.searchParams.delete(parameter));
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  }, []);
}
