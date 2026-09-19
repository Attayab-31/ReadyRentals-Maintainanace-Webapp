import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getWorkerWorkOrder } from "../api/endpoints";
import { queryKeys } from "../lib/queryKeys";

export function useWorkerQuery(token: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.worker(token),
    queryFn: () => getWorkerWorkOrder(token),
    enabled: Boolean(token),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    const refetch = () => {
      void qc.invalidateQueries({ queryKey: queryKeys.worker(token) });
    };
    const onVis = () => {
      if (document.visibilityState === "visible") refetch();
    };
    window.addEventListener("focus", refetch);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", refetch);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [qc, token]);

  return query;
}
