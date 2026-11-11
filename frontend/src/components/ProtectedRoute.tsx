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
      <p className="page-description" role="status">
        Loading…
      </p>
    );
  }

  if (restorationError) {
    return (
      <div className="session-error" role="alert">
        <p className="session-error__message">{restorationError}</p>
        <button
          type="button"
          className="session-error__retry"
          onClick={retryRestoration}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return (
      <div className="access-denied" role="alert">
        <h1 className="page-heading">Access Denied</h1>
        <p className="page-description">
          You do not have permission to access this page.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
