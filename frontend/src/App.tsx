import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/RequireAuth";
import { AppNav } from "./components/AppNav/AppNav";
import { DashboardPage } from "./pages/DashboardPage";
import { CategoryManagementPage } from "./pages/CategoryManagementPage";
import { AdminManagementPage } from "./pages/AdminManagementPage";
import { LoginPage } from "./pages/LoginPage";
import { NewWorkOrderPage } from "./pages/NewWorkOrderPage";
import { WorkOrderDetailPage } from "./pages/WorkOrderDetailPage";
import { WorkerPage } from "./pages/WorkerPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings/categories" element={<CategoryManagementPage />} />
        <Route path="/settings/admins" element={<AdminManagementPage />} />
        <Route path="/work-orders/new" element={<NewWorkOrderPage />} />
        <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />
      </Route>
      <Route
        path="/wo/:token"
        element={
          <div className="app-shell">
            <AppNav title="Service ticket" home="." />
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
