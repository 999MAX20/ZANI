import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";

import { AuthProvider } from "../features/auth/AuthProvider";
import { I18nProvider } from "../lib/i18n";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
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
        <AuthProvider>{children}</AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
