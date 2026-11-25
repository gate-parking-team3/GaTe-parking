import { type FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

export function getSafeReturnTo(from: unknown): string {
  let target = "";
  if (typeof from === "string") {
    target = from;
  } else if (from && typeof from === "object" && "pathname" in from) {
    const loc = from as {
      pathname?: unknown;
      search?: unknown;
      hash?: unknown;
    };
    if (typeof loc.pathname === "string") {
      target = `${loc.pathname}${typeof loc.search === "string" ? loc.search : ""}${typeof loc.hash === "string" ? loc.hash : ""}`;
    }
  }

  // Reject empty, non-relative, protocol-relative (e.g. //evil.com), or explicit schemes.
  if (
    !target ||
    !target.startsWith("/") ||
    target.startsWith("//") ||
    target.startsWith("/\\") ||
    target.includes("://")
  ) {
    return "/";
  }

  // Prevent redirect loops back to login.
  if (
    target === "/login" ||
    target.startsWith("/login?") ||
    target.startsWith("/login#")
  ) {
    return "/";
  }

  return target;
}

export default function Login() {
  const { user, isRestoring, login, isLoggingIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const returnTo = getSafeReturnTo(
    (location.state as { from?: unknown } | null)?.from,
  );

  // Already authenticated visitor to /login: redirect without loop.
  if (user && !isRestoring) {
    return <Navigate to={returnTo} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isLoggingIn) {
      return;
    }
    if (!email.trim() || !password) {
      setError("Email and password are required");
      return;
    }
    setError("");
    try {
      // Pass the password untouched without trimming; trim the email address.
      await login(email.trim(), password);
      navigate(returnTo, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  }

  return (
    <div className="auth">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          P
        </span>
        GaŤe Parking
      </div>
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <h1>Sign in</h1>
        {error && (
          <div className="err" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="login-email">Work email</label>
          <input
            id="login-email"
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError("");
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError("");
            }}
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary btn-lg btn-block"
          disabled={isLoggingIn}
        >
          {isLoggingIn ? "Signing in…" : "Sign in"}
        </button>
        <p className="faint small auth-foot">
          No account yet? An administrator invites new employees. Open the
          invitation link from your email to activate your account.
        </p>
      </form>
    </div>
  );
}
