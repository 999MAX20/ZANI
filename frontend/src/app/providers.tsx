import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";

import { ActionConfirmProvider } from "../components/actions/ActionConfirmProvider";
import { UndoToastProvider } from "../components/actions/UndoToastProvider";
import { NotificationProvider } from "../components/notifications/NotificationProvider";
import { AuthProvider } from "../features/auth/AuthProvider";
import { I18nProvider } from "../lib/i18n";
import { ThemeProvider } from "../lib/theme";

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
        <ThemeProvider>
          <ActionConfirmProvider>
            <NotificationProvider>
              <UndoToastProvider>
                <AuthProvider>{children}</AuthProvider>
              </UndoToastProvider>
            </NotificationProvider>
          </ActionConfirmProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
