import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCompletionEmailSettings,
  updateCompletionEmailSettings,
} from "../../../api/endpoints";
import { useToast } from "../../../hooks/useToast";

const queryKey = ["completion-email-settings"];

export function useCompletionEmailSettings(enabled: boolean) {
  return useQuery({
    queryKey,
    queryFn: getCompletionEmailSettings,
    enabled,
  });
}

export function useUpdateCompletionEmailSettings() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: updateCompletionEmailSettings,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast("Completion email CC settings saved");
    },
  });
}
