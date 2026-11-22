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
    <>
      <h1 className="page-heading">Sign In</h1>
      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <div className="login-form__field">
          <label htmlFor="login-email" className="login-form__label">
            Email
          </label>
          <input
            id="login-email"
            className="login-form__input"
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
        <div className="login-form__field">
          <label htmlFor="login-password" className="login-form__label">
            Password
          </label>
          <input
            id="login-password"
            className="login-form__input"
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
        {error && (
          <p className="login-form__error" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="login-form__submit"
          disabled={isLoggingIn || !email.trim() || !password}
        >
          {isLoggingIn ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </>
  );
}
