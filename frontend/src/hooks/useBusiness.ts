import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { businessesApi } from "../api/businesses";
import { useAuth } from "../features/auth/AuthProvider";
import { setActiveBusinessTimeZone } from "../lib/format";

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
  const business = query.data?.[0] ?? fallbackBusiness;

  useEffect(() => {
    setActiveBusinessTimeZone(business?.timezone);
  }, [business?.timezone]);

  return {
    ...query,
    isLoading: query.isLoading && !fallbackBusiness,
    business,
  };
}
