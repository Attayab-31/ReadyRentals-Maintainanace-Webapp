import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "../api/endpoints";
import { getStoredToken } from "../api/client";
import { queryKeys } from "../lib/queryKeys";

export function useCurrentUser() {
  const token = getStoredToken();
  return useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: getCurrentUser,
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  });
}
