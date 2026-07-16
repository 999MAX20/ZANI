import * as Sentry from "@sentry/react-native";

import { MOBILE_OBSERVABILITY } from "../config";

let initialized = false;

export function initMobileObservability() {
  if (initialized || !MOBILE_OBSERVABILITY.sentryDsn) return;
  initialized = true;
  Sentry.init({
    dsn: MOBILE_OBSERVABILITY.sentryDsn,
    environment: MOBILE_OBSERVABILITY.environment,
    release: MOBILE_OBSERVABILITY.release,
    tracesSampleRate: MOBILE_OBSERVABILITY.tracesSampleRate,
    enableNative: true,
  });
}

export function wrapMobileApp<T>(component: T): T {
  if (!MOBILE_OBSERVABILITY.sentryDsn) return component;
  return Sentry.wrap(component as never) as T;
}
