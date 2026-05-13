import { useQuery } from "@tanstack/react-query";

import { businessesApi } from "../api/businesses";

export function useBusinesses() {
  return useQuery({
    queryKey: ["businesses"],
    queryFn: businessesApi.list,
  });
}

export function useActiveBusiness() {
  const query = useBusinesses();
  return {
    ...query,
    business: query.data?.[0] ?? null,
  };
}
