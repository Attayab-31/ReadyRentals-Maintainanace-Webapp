import type { AuditLogStats as AuditLogStatsType } from "../../../api/types";
import { StatCard, StatsGrid } from "../../../components";

interface AuditStatsProps {
  stats?: AuditLogStatsType;
}

export function AuditStats({ stats }: AuditStatsProps) {
  return (
    <StatsGrid>
      <StatCard
        label="Total Audit Events"
        value={stats?.total_events}
        description="Historical records captured"
      />
      <StatCard
        label="Admin Actions Today"
        value={stats?.admin_actions_today}
        description="Operations by admins since 00:00 UTC"
      />
      <StatCard
        label="Work Order Operations"
        value={stats?.work_order_actions}
        description="Created, updated, or resent"
      />
      <StatCard
        label="Active Office Admins"
        value={stats?.unique_active_admins}
        description="Admins with recorded activity"
      />
    </StatsGrid>
  );
}
