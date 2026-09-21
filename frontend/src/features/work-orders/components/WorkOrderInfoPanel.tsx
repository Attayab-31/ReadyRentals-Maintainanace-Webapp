import styles from "./WorkOrderInfoPanel.module.css";

interface WorkOrderInfoPanelProps {
  entireUnitInspected?: boolean | null;
  inspectionResults?: string | null;
  incompleteExplanation?: string | null;
}

export function WorkOrderInfoPanel({
  entireUnitInspected,
  inspectionResults,
  incompleteExplanation,
}: WorkOrderInfoPanelProps) {
  const hasContent =
    entireUnitInspected != null || Boolean(inspectionResults) || Boolean(incompleteExplanation);

  if (!hasContent) return null;

  return (
    <div className={styles.panel}>
      {entireUnitInspected != null ? (
        <p>
          <strong>Inspected entire property:</strong> {entireUnitInspected ? "Yes" : "No"}
        </p>
      ) : null}
      {inspectionResults ? (
        <p>
          <strong>Inspection results:</strong> {inspectionResults}
        </p>
      ) : null}
      {incompleteExplanation ? (
        <p>
          <strong>Follow-up note:</strong> {incompleteExplanation}
        </p>
      ) : null}
    </div>
  );
}
