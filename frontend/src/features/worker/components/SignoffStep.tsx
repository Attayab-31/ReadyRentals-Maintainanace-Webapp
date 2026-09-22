import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signJob } from "../../../api/endpoints";
import type { WorkerWorkOrder } from "../../../api/types";
import { BottomActionBar } from "../../../components";
import { queryKeys } from "../../../lib/queryKeys";
import { SignBlock } from "./SignBlock";

const TENANT_CONFIRM =
  "I confirm to be satisfied with the repairs and do not know of any outstanding hazardous conditions";

interface SignoffStepProps {
  token: string;
  wo: WorkerWorkOrder;
  onError: (e: unknown) => void;
}

export function SignoffStep({ token, wo, onError }: SignoffStepProps) {
  const qc = useQueryClient();
  const tenantDone = wo.tenant_signed || Boolean(wo.tenant_signature_url);

  const sign = useMutation({
    mutationFn: (payload: { signer: "tenant" | "tech"; name: string; signature_png_base64: string }) =>
      signJob(token, payload),
    onSuccess: (updatedWorkOrder) => {
      qc.setQueryData(queryKeys.worker(token), updatedWorkOrder);
    },
    onError,
  });

  const workerName =
    wo.assigned_to_name ||
    sessionStorage.getItem(`wo:${token}:workerName`) ||
    "Unassigned";

  return (
    <>
      {!tenantDone ? (
        <SignBlock
          key="tenant-sign"
          title="Tenant signature"
          defaultName={wo.tenant_names}
          confirmText={TENANT_CONFIRM}
          pending={sign.isPending && sign.variables?.signer === "tenant"}
          onConfirm={(name, png) => {
            onError(null);
            sign.mutate({ signer: "tenant", name, signature_png_base64: png });
          }}
        />
      ) : (
        <SignBlock
          key="tech-sign"
          title="Technician signature"
          defaultName={workerName}
          disabled={wo.tech_signed}
          pending={sign.isPending && sign.variables?.signer === "tech"}
          onConfirm={(name, png) => {
            onError(null);
            sign.mutate({ signer: "tech", name, signature_png_base64: png });
          }}
        />
      )}
      <BottomActionBar>
        <button type="button" className="btn btn-primary" disabled>
          {wo.status === "signed_off"
            ? "Signed"
            : tenantDone
              ? "Awaiting tech signature"
              : "Awaiting tenant signature"}
        </button>
      </BottomActionBar>
    </>
  );
}
