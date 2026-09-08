import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useState } from "react";

import type { AppError } from "../api/appError";
import { ActionConfirmProvider } from "../components/actions/ActionConfirmProvider";
import { ConnectivityBanner } from "../components/ui/ConnectivityBanner";
import { UndoToastProvider } from "../components/actions/UndoToastProvider";
import { NotificationProvider } from "../components/notifications/NotificationProvider";
import { AuthProvider } from "../features/auth/AuthProvider";
import { I18nProvider } from "../lib/i18n";

const offlineAppError: AppError = {
  category: "offline",
  code: "network_unavailable",
  fieldErrors: {},
  messageKey: "actions.errorNetwork",
  retryable: true,
  retryPolicy: "user_initiated_only",
  source: "network",
};

function ConnectivityStatus() {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(() => (
    typeof navigator === "undefined" ? true : navigator.onLine
  ));
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    let reconnectTimer: number | undefined;

    function handleOffline() {
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      setIsOnline(false);
      setIsReconnecting(false);
    }

    function handleOnline() {
      setIsOnline(true);
      setIsReconnecting(true);
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(() => setIsReconnecting(false), 1500);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
    };
  }, []);

  if (isOnline && !isReconnecting) return null;

  return (
    <ConnectivityBanner
      error={offlineAppError}
      isReconnecting={isReconnecting}
      onRetry={isOnline ? () => queryClient.refetchQueries({ type: "active" }) : undefined}
    />
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60_000,
            gcTime: 30 * 60_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: (failureCount, error) => {
              if (axios.isAxiosError(error) && error.response?.status && error.response.status < 500) {
                return false;
              }
              return failureCount < 1;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ConnectivityStatus />
        <ActionConfirmProvider>
          <NotificationProvider>
            <UndoToastProvider>
              <AuthProvider>{children}</AuthProvider>
            </UndoToastProvider>
          </NotificationProvider>
        </ActionConfirmProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
