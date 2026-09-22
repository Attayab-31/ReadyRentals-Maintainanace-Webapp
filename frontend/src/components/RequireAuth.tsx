import { Navigate, Outlet } from "react-router-dom";
import { getStoredToken } from "../api/client";
import { AppNav } from "../components/AppNav/AppNav";

export function RequireAuth() {
  if (!getStoredToken()) return <Navigate to="/login" replace />;
  return (
    <div className="app-shell">
      <AppNav home="/dashboard" showLogout />
      <Outlet />
    </div>
  );
}
