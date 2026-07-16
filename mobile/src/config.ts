import { Platform } from "react-native";

export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const MOBILE_DEVICE = {
  platform: Platform.OS === "android" ? "android" as const : "ios" as const,
  appVersion: process.env.EXPO_PUBLIC_APP_VERSION || "0.1.0",
  buildNumber: process.env.EXPO_PUBLIC_BUILD_NUMBER || "1",
};

export const MOBILE_PUSH = {
  easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "",
};

export const MOBILE_OBSERVABILITY = {
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || "",
  environment: process.env.EXPO_PUBLIC_ENVIRONMENT || "local",
  release: process.env.EXPO_PUBLIC_RELEASE || "zani-mobile@0.1.0",
  tracesSampleRate: Number(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || "0.05"),
};
