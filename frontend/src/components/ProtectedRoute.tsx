import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
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

  return <Outlet />;
}
