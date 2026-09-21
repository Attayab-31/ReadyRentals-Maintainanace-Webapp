import type { WorkerWorkOrder } from "../../../api/types";
import { StatusBadge, Stepper } from "../../../components";
import { hourTarget, stepperIndex } from "../../../lib/format";
import styles from "./WorkerHeader.module.css";

interface WorkerHeaderProps {
  wo: WorkerWorkOrder;
}

export function WorkerHeader({ wo }: WorkerHeaderProps) {
  const targetHours = hourTarget(wo.priority);
  const priorityLabel = wo.priority?.name || "Standard";
  const tenantPhone = wo.tenant_phone?.trim();
  const phoneIsValid = Boolean(tenantPhone && tenantPhone !== wo.tenant_names?.trim());

  return (
    <header className={`card ${styles.header}`}>
      <div className={styles.metaRow}>
        <div>
          <p className={styles.kicker}>Property</p>
          <h1 className={styles.address}>{wo.service_address}</h1>
        </div>
        <StatusBadge status={wo.status} />
      </div>

      <div className={styles.infoGrid}>
        <div>
          <span className={styles.label}>Technician</span>
          <strong>{wo.assigned_to_name || "Unassigned"}</strong>
        </div>
        <div>
          <span className={styles.label}>Work order number</span>
          <strong className="mono">{wo.work_order_number}</strong>
        </div>
        <div>
          <span className={styles.label}>Target time</span>
          <strong>
            {priorityLabel} · {targetHours}h
          </strong>
        </div>
      </div>

      {wo.tenant_names ? (
        <div className={styles.infoGrid}>
          <div>
            <span className={styles.label}>Tenant name</span>
            <strong>{wo.tenant_names}</strong>
          </div>
          {phoneIsValid ? (
            <div>
              <span className={styles.label}>Tenant phone</span>
              <strong>{tenantPhone}</strong>
            </div>
          ) : null}
        </div>
      ) : null}

      <Stepper current={stepperIndex(wo.status)} />
    </header>
  );
}
