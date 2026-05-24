import { useQuery } from "@tanstack/react-query";

import { businessesApi } from "../api/businesses";
import { useAuth } from "../features/auth/AuthProvider";

export function useBusinesses() {
  const { businesses, isAuthenticated, isLoading, isMerchantUser } = useAuth();

  return useQuery({
    queryKey: ["businesses"],
    queryFn: businessesApi.list,
    enabled: isAuthenticated && isMerchantUser && !isLoading,
    initialData: businesses.length ? businesses : undefined,
    staleTime: 60_000,
  });
}

export function useActiveBusiness() {
  const query = useBusinesses();
  const { businesses } = useAuth();
  const fallbackBusiness = businesses[0] ?? null;

  return {
    ...query,
    isLoading: query.isLoading && !fallbackBusiness,
    business: query.data?.[0] ?? fallbackBusiness,
  };
}
