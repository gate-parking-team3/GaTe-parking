import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types/auth";

type ProtectedRouteProps = {
  requiredRole?: Role;
};

export default function ProtectedRoute({
  requiredRole,
}: ProtectedRouteProps = {}) {
  const { user, isRestoring, restorationError, retryRestoration } = useAuth();
  const location = useLocation();

  if (isRestoring) {
    return (
      <div className="page">
        <p className="muted" role="status">
          Loading…
        </p>
      </div>
    );
  }

  if (restorationError) {
    return (
      <div className="page">
        <div className="err" role="alert">
          <p>{restorationError}</p>
          <button
            type="button"
            className="btn btn-sm"
            onClick={retryRestoration}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return (
      <div className="page" role="alert">
        <div className="head">
          <div>
            <h1>Access Denied</h1>
            <p>You do not have permission to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
