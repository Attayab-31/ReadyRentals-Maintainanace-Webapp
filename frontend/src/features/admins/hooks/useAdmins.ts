import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAdmin, deleteAdmin, listAdmins } from "../../../api/endpoints";
import { friendlyErrorMessage } from "../../../api/client";
import type { AdminCreate } from "../../../api/types";
import { useToast } from "../../../hooks/useToast";
import { queryKeys } from "../../../lib/queryKeys";

export function useAdminsQuery(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.admins,
    queryFn: listAdmins,
    enabled,
  });
}

export function useCreateAdminMutation(onSuccessCallback?: () => void) {
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (payload: AdminCreate) => createAdmin(payload),
    onSuccess: async (newAdmin) => {
      await qc.invalidateQueries({ queryKey: queryKeys.admins });
      toast(`Admin ${newAdmin.name} created successfully`);
      onSuccessCallback?.();
    },
  });
}

export function useDeleteAdminMutation(onSuccessCallback?: () => void) {
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: number) => deleteAdmin(id),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: queryKeys.admins });
      await qc.invalidateQueries({ queryKey: ["work-orders"] });
      toast(res.detail || "Admin deleted");
      onSuccessCallback?.();
    },
    onError: (err) => {
      toast(friendlyErrorMessage(err), "err");
    },
  });
}
