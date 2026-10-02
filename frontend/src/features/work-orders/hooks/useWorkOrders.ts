import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createWorkOrder,
  deleteWorkOrder,
  getWorkOrder,
  patchWorkOrder,
  resendWorkOrder,
  listWorkOrders,
  listRecycleBin,
  permanentlyDeleteWorkOrder,
  restoreWorkOrder,
} from "../../../api/endpoints";
import type {
  MessageResponse,
  WorkOrder,
  WorkOrderCreate,
  WorkOrderListFilters,
  WorkOrderUpdate,
  RecycleBinFilters,
} from "../../../api/types";
import { useToast } from "../../../hooks/useToast";
import { queryKeys } from "../../../lib/queryKeys";

export function useWorkOrdersListQuery(filters: WorkOrderListFilters) {
  return useQuery({
    queryKey: queryKeys.workOrders(filters),
    queryFn: () => listWorkOrders(filters),
  });
}

export function useRecycleBinQuery(filters: RecycleBinFilters, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.recycleBin(filters),
    queryFn: () => listRecycleBin(filters),
    enabled,
  });
}

export function useRestoreWorkOrderMutation(options?: {
  onSuccess?: () => void;
  onError?: (err: unknown) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: number) => restoreWorkOrder(id),
    onSuccess: async (msg) => {
      await qc.invalidateQueries({ queryKey: ["work-order-recycle-bin"] });
      await qc.invalidateQueries({ queryKey: ["work-orders"] });
      toast(msg.detail);
      options?.onSuccess?.();
    },
    onError: options?.onError,
  });
}

export function usePermanentlyDeleteWorkOrderMutation(options?: {
  onSuccess?: () => void;
  onError?: (err: unknown) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: number) => permanentlyDeleteWorkOrder(id),
    onSuccess: async (msg) => {
      await qc.invalidateQueries({ queryKey: ["work-order-recycle-bin"] });
      toast(msg.detail);
      options?.onSuccess?.();
    },
    onError: options?.onError,
  });
}

export function useWorkOrderDetailQuery(id: number) {
  return useQuery({
    queryKey: queryKeys.workOrder(id),
    queryFn: () => getWorkOrder(id),
    enabled: Number.isFinite(id),
  });
}

export function useCreateWorkOrderMutation(onSuccessCallback?: (wo: WorkOrder) => void) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: { payload: WorkOrderCreate; beforePhotos: (File | null)[] }) =>
      createWorkOrder(input.payload, input.beforePhotos),
    onSuccess: (wo) => {
      onSuccessCallback?.(wo);
      void qc.invalidateQueries({ queryKey: ["work-orders"] });
    },
  });
}

export function usePatchWorkOrderMutation(
  id: number,
  options?: {
    onSuccess?: () => void;
    onError?: (err: unknown) => void;
  },
) {
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (payload: WorkOrderUpdate) => patchWorkOrder(id, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.workOrder(id) });
      await qc.invalidateQueries({ queryKey: ["work-orders"] });
      toast("Saved");
      options?.onSuccess?.();
    },
    onError: options?.onError,
  });
}

export function useDeleteWorkOrderMutation(
  options?: {
    onSuccess?: () => void;
    onError?: (err: unknown) => void;
  },
) {
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: number) => deleteWorkOrder(id),
    onSuccess: async (msg) => {
      await qc.invalidateQueries({ queryKey: ["work-orders"] });
      toast(msg.detail || "Work order deleted");
      options?.onSuccess?.();
    },
    onError: options?.onError,
  });
}

export function useResendWorkOrderMutation(
  id: number,
  options?: {
    onSuccess?: (msg: MessageResponse) => void;
    onError?: (err: unknown) => void;
  },
) {
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: () => resendWorkOrder(id),
    onSuccess: async (msg) => {
      await qc.invalidateQueries({ queryKey: queryKeys.workOrder(id) });
      toast(msg.detail);
      options?.onSuccess?.(msg);
    },
    onError: options?.onError,
  });
}
