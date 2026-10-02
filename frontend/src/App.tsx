import { Navigate, Route, Routes } from "react-router-dom";
import { AppNav, RequireAuth } from "./components";
import {
  AdminManagementPage,
  AuditLogPage,
  CategoryManagementPage,
  DashboardPage,
  LoginPage,
  NewWorkOrderPage,
  RecycleBinPage,
  WorkerPage,
  WorkOrderDetailPage,
} from "./pages";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings/categories" element={<CategoryManagementPage />} />
        <Route path="/settings/admins" element={<AdminManagementPage />} />
        <Route path="/audit-logs" element={<AuditLogPage />} />
        <Route path="/recycle-bin" element={<RecycleBinPage />} />
        <Route path="/settings/audit-logs" element={<Navigate to="/audit-logs" replace />} />
        <Route path="/work-orders/new" element={<NewWorkOrderPage />} />
        <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />
      </Route>
      <Route
        path="/wo/:token"
        element={
          <div className="app-shell">
            <AppNav home="." />
            <WorkerPage />
          </div>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="*"
        element={
          <main className="page">
            <h1>Not found</h1>
          </main>
        }
      />
    </Routes>
  );
}
