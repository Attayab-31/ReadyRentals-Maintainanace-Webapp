import { useState } from "react";
import type { WorkerWorkOrder } from "../../api/types";
import { ErrorBanner } from "../../components";
import { hourTarget } from "../../lib/format";
import { AssignedStep } from "./components/AssignedStep";
import { InProgressStep } from "./components/InProgressStep";
import { LiveTicker } from "./components/LiveTicker";
import { RecordStep } from "./components/RecordStep";
import { SignoffStep } from "./components/SignoffStep";
import { WorkerHeader } from "./components/WorkerHeader";

interface WorkerFlowProps {
  token: string;
  wo: WorkerWorkOrder;
}

export function WorkerFlow({ token, wo }: WorkerFlowProps) {
  const [error, setError] = useState<unknown>(null);
  const hasStarted = Boolean(wo.start_time);

  return (
    <main className="page stack">
      <WorkerHeader wo={wo} />
      <ErrorBanner error={error} />

      {wo.status === "in_progress" && hasStarted ? (
        <LiveTicker start={wo.start_time} targetHours={hourTarget(wo.priority)} />
      ) : null}

      {wo.status === "assigned" ? (
        <AssignedStep token={token} wo={wo} onError={setError} />
      ) : null}

      {wo.status === "in_progress" ? (
        <InProgressStep token={token} wo={wo} onError={setError} />
      ) : null}

      {wo.status === "completed_pending_signoff" ? (
        <SignoffStep token={token} wo={wo} onError={setError} />
      ) : null}

      {wo.status === "signed_off" ? (
        <RecordStep token={token} wo={wo} onError={setError} />
      ) : null}
    </main>
  );
}
