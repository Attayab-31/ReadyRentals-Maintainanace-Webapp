import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { archiveCategory, createCategory, listCategories } from "../../../api/endpoints";
import { useToast } from "../../../hooks/useToast";
import { queryKeys } from "../../../lib/queryKeys";

export function useCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: listCategories,
  });
}

export function useCreateCategoryMutation() {
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: createCategory,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.categories });
      toast("Category added");
    },
  });
}

export function useArchiveCategoryMutation() {
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: archiveCategory,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.categories });
      toast("Category archived");
    },
  });
}
