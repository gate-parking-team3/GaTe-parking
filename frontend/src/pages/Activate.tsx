import { type FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { authApi } from "../api/authApi";
import { ApiError } from "../api/client";
import Icon from "../components/Icon";
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
      <div className="auth">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          GaŤe Parking
        </div>
        <div className="auth-card">
          <h1>Account Activation</h1>
          <div className="err" role="alert">
            <p>
              You are currently signed in as <strong>{user.name}</strong> (
              {user.email}). To activate another employee account, please sign
              out first.
            </p>
          </div>
          <button type="button" className="btn btn-block" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // Missing or malformed token: do not show a form or manual entry field.
  if (!isTokenValid) {
    return (
      <div className="auth">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          GaŤe Parking
        </div>
        <div className="auth-card">
          <h1>Account Activation</h1>
          <div className="err" role="alert">
            <p>
              Invalid or missing activation link. The link may be incomplete or
              corrupted. Please contact your administrator for a new invitation.
            </p>
          </div>
          <Link to="/login" className="btn btn-lg btn-block">
            Return to Sign in
          </Link>
        </div>
      </div>
    );
  }

  // Successfully activated: offer link to sign in.
  if (isSuccess) {
    return (
      <div className="auth">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          GaŤe Parking
        </div>
        <div className="auth-card">
          <div className="success">
            <span className="ok">
              <Icon name="check" />
            </span>
            <h1>Account Activated</h1>
            <div className="ok-note" role="status">
              <p>
                Your password has been set and your account is now active. You
                can now sign in with your email and new password.
              </p>
            </div>
          </div>
          <Link to="/login" className="btn btn-primary btn-lg btn-block">
            Go to Sign in
          </Link>
        </div>
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
    <div className="auth">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          P
        </span>
        GaŤe Parking
      </div>
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <div>
          <h1>Set Your Password</h1>
          <p className="muted">
            Please choose a password to activate your employee account.
          </p>
        </div>
        {formError && (
          <div className="err" role="alert">
            {formError}
          </div>
        )}
        <div className="field">
          <label htmlFor="activate-password">New Password</label>
          <input
            id="activate-password"
            className="input"
            type="password"
            autoComplete="new-password"
            required
            aria-describedby="password-requirements"
            aria-invalid={fieldErrors.password ? true : undefined}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) {
                setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }
            }}
          />
          <span id="password-requirements" className="hint">
            Password must be at least 8 characters and at most 72 bytes.
          </span>
          {fieldErrors.password && (
            <span role="alert" className="field-err">
              {fieldErrors.password}
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor="activate-confirm-password">
            Confirm New Password
          </label>
          <input
            id="activate-confirm-password"
            className="input"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={fieldErrors.confirmPassword ? true : undefined}
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
            <span role="alert" className="field-err">
              {fieldErrors.confirmPassword}
            </span>
          )}
        </div>
        <button
          type="submit"
          className="btn btn-primary btn-lg btn-block"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Activating account…" : "Activate account"}
        </button>
      </form>
    </div>
  );
}
