import { type FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { authApi } from "../api/authApi";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

const TOKEN_PATTERN = /^[a-f\d]{64}$/;

function getUtf8ByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

export default function Activate() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const isTokenValid = TOKEN_PATTERN.test(token);

  const { user, isRestoring, logout } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // If the user is currently signed in, do not silently overwrite their session.
  // Explain the situation and provide an explicit logout action while preserving the activation URL.
  if (user && !isRestoring) {
    return (
      <div className="activate-container">
        <h1 className="page-heading">Account Activation</h1>
        <div className="session-error" role="alert">
          <p className="session-error__message">
            You are currently signed in as <strong>{user.name}</strong> (
            {user.email}). To activate another employee account, please sign out
            first.
          </p>
          <button
            type="button"
            className="session-error__retry"
            onClick={logout}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // Missing or malformed token: do not show a form or manual entry field.
  if (!isTokenValid) {
    return (
      <div className="activate-container">
        <h1 className="page-heading">Account Activation</h1>
        <div className="login-form__error" role="alert">
          <p>
            Invalid or missing activation link. The link may be incomplete or
            corrupted. Please contact your administrator for a new invitation.
          </p>
        </div>
        <p className="page-description" style={{ marginTop: "1rem" }}>
          <Link to="/login" className="not-found__link">
            Return to Sign in
          </Link>
        </p>
      </div>
    );
  }

  // Successfully activated: offer link to sign in.
  if (isSuccess) {
    return (
      <div className="activate-container">
        <h1 className="page-heading">Account Activated</h1>
        <div
          className="login-form__success"
          role="status"
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.375rem",
            background: "#d1e7dd",
            color: "#0f5132",
            marginBottom: "1rem",
          }}
        >
          <p>
            Your password has been set and your account is now active. You can
            now sign in with your email and new password.
          </p>
        </div>
        <Link
          to="/login"
          className="login-form__submit"
          style={{ display: "inline-block", textDecoration: "none" }}
        >
          Go to Sign in
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    const errors: { password?: string; confirmPassword?: string } = {};

    // Validate password rules without trimming whitespace
    if (password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    } else if (getUtf8ByteLength(password) > 72) {
      errors.password = "Password cannot exceed 72 bytes.";
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setFormError("");
    setIsSubmitting(true);

    try {
      await authApi.activate({ token, password });
      setPassword("");
      setConfirmPassword("");
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setFormError(
            `${err.message}. Please contact your administrator for a new invitation.`,
          );
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="activate-container">
      <h1 className="page-heading">Set Your Password</h1>
      <p className="page-description">
        Please choose a password to activate your employee account.
      </p>

      {formError && (
        <div
          className="login-form__error"
          role="alert"
          style={{ marginBottom: "1rem", marginTop: "1rem" }}
        >
          {formError}
        </div>
      )}

      <form
        className="login-form"
        onSubmit={handleSubmit}
        noValidate
        style={{ marginTop: "1rem" }}
      >
        <div className="login-form__field">
          <label htmlFor="activate-password" className="login-form__label">
            New Password
          </label>
          <input
            id="activate-password"
            className="login-form__input"
            type="password"
            autoComplete="new-password"
            required
            aria-describedby="password-requirements"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) {
                setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }
            }}
          />
          <small
            id="password-requirements"
            style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}
          >
            Password must be at least 8 characters and at most 72 bytes.
          </small>
          {fieldErrors.password && (
            <span
              role="alert"
              style={{ fontSize: "0.8125rem", color: "#842029" }}
            >
              {fieldErrors.password}
            </span>
          )}
        </div>

        <div className="login-form__field">
          <label
            htmlFor="activate-confirm-password"
            className="login-form__label"
          >
            Confirm New Password
          </label>
          <input
            id="activate-confirm-password"
            className="login-form__input"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (fieldErrors.confirmPassword) {
                setFieldErrors((prev) => ({
                  ...prev,
                  confirmPassword: undefined,
                }));
              }
            }}
          />
          {fieldErrors.confirmPassword && (
            <span
              role="alert"
              style={{ fontSize: "0.8125rem", color: "#842029" }}
            >
              {fieldErrors.confirmPassword}
            </span>
          )}
        </div>

        <button
          type="submit"
          className="login-form__submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Activating account…" : "Activate account"}
        </button>
      </form>
    </div>
  );
}
