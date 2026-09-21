import { useMutation } from "@tanstack/react-query";
import { downloadWorkerPdf } from "../../../api/endpoints";
import type { WorkerWorkOrder } from "../../../api/types";
import {
  BottomActionBar,
  SignatureDisplayCard,
  SignaturesGrid,
  WorkOrderItemSummary,
} from "../../../components";
import { formatDuration, formatStamp } from "../../../lib/format";

interface RecordStepProps {
  token: string;
  wo: WorkerWorkOrder;
  onError: (e: unknown) => void;
}

export function RecordStep({ token, wo, onError }: RecordStepProps) {
  const pdf = useMutation({
    mutationFn: () => downloadWorkerPdf(token),
    onError,
  });

  return (
    <>
      <div className="card stack">
        <h2>Completion summary</h2>
        <p className="mono">
          Started {formatStamp(wo.start_time)} · Finished {formatStamp(wo.end_time)}
        </p>
        <p>
          Time on site: <span className="mono">{formatDuration(wo.duration_minutes)}</span>
        </p>
        <p>
          Target result:{" "}
          <span className="mono">
            {wo.within_target == null ? "Pending" : wo.within_target ? "On time" : "Over target"}
          </span>
        </p>
      </div>

      {(wo.items || []).map((item) => (
        <WorkOrderItemSummary key={item.id} item={item} />
      ))}

      <div className="card stack">
        <h2>Signatures</h2>
        <SignaturesGrid>
          <SignatureDisplayCard
            label="Tenant"
            name={wo.tenant_signature_name}
            timestamp={wo.tenant_signature_at}
            signatureUrl={wo.tenant_signature_url}
          />
          <SignatureDisplayCard
            label="Technician"
            name={wo.tech_signature_name}
            timestamp={wo.tech_signature_at}
            signatureUrl={wo.tech_signature_url}
          />
        </SignaturesGrid>
      </div>

      <BottomActionBar>
        <button
          type="button"
          className="btn btn-primary"
          disabled={pdf.isPending}
          onClick={() => {
            onError(null);
            pdf.mutate();
          }}
        >
          {pdf.isPending ? "Downloading…" : "Download PDF"}
        </button>
      </BottomActionBar>
    </>
  );
}
