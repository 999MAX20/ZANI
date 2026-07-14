type MonitoringContext = Record<string, unknown>;
type SentryModule = typeof import("@sentry/react");
type PosthogModule = typeof import("posthog-js");

type MonitoringWindow = Window & {
  plausible?: (event: string, options?: { props?: MonitoringContext }) => void;
};

let sentryEnabled = false;
let posthogEnabled = false;
let sentryModule: SentryModule | null = null;
let posthogModule: PosthogModule | null = null;
let sentryPromise: Promise<SentryModule> | null = null;
let posthogPromise: Promise<PosthogModule> | null = null;

export function initFrontendMonitoring() {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  if (sentryDsn && !sentryPromise) {
    sentryPromise = import("@sentry/react").then((module) => {
      module.init({
        dsn: sentryDsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0),
      });
      sentryModule = module;
      sentryEnabled = true;
      return module;
    });
  }

  const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
  if (posthogKey && !posthogPromise) {
    posthogPromise = import("posthog-js").then((module) => {
      module.default.init(posthogKey, {
        api_host: import.meta.env.VITE_POSTHOG_HOST || "https://app.posthog.com",
        capture_pageview: false,
      });
      posthogModule = module;
      posthogEnabled = true;
      return module;
    });
  }

  const plausibleDomain = import.meta.env.VITE_PLAUSIBLE_DOMAIN;
  const monitoringWindow = window as MonitoringWindow;
  if (plausibleDomain && !monitoringWindow.plausible && !document.querySelector("script[data-domain][src*='plausible']")) {
    const script = document.createElement("script");
    script.defer = true;
    script.dataset.domain = plausibleDomain;
    script.src = "https://plausible.io/js/script.js";
    document.head.appendChild(script);
  }
}

export function captureFrontendError(error: unknown, context?: MonitoringContext) {
  if (sentryEnabled && sentryModule) {
    sentryModule.captureException(error, context ? { extra: context } : undefined);
    return;
  }
  if (sentryPromise) {
    void sentryPromise.then((module) => module.captureException(error, context ? { extra: context } : undefined));
    return;
  }
  console.error("Zani frontend error", error, context);
}

export function trackFrontendEvent(event: string, properties?: MonitoringContext) {
  const monitoringWindow = window as MonitoringWindow;
  if (posthogEnabled && posthogModule) posthogModule.default.capture(event, properties);
  else if (posthogPromise) void posthogPromise.then((module) => module.default.capture(event, properties));
  monitoringWindow.plausible?.(event, properties ? { props: properties } : undefined);
}
