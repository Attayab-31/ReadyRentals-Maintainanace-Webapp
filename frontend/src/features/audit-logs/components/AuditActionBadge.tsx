import { Badge } from "../../../components";

export function AuditActionBadge({ action }: { action: string }) {
  switch (action) {
    case "work_order.create":
      return <Badge variant="success">WO Created</Badge>;
    case "work_order.update":
      return <Badge variant="warning">WO Updated</Badge>;
    case "work_order.delete":
      return <Badge variant="danger">WO Deleted</Badge>;
    case "work_order.resend_link":
      return <Badge variant="warning">Link Resent</Badge>;
    case "work_order.regenerate_link":
      return <Badge variant="warning">Link Regenerated</Badge>;
    case "category.create":
      return <Badge variant="success">Category Added</Badge>;
    case "category.archive":
      return <Badge variant="danger">Category Archived</Badge>;
    case "admin.create":
      return <Badge variant="success">Admin Added</Badge>;
    case "admin.delete":
      return <Badge variant="danger">Admin Removed</Badge>;
    case "auth.login":
      return <Badge variant="neutral">Logged In</Badge>;
    case "auth.register_owner":
      return <Badge variant="success">Owner Registered</Badge>;
    default:
      return <Badge variant="neutral">{action}</Badge>;
  }
}
