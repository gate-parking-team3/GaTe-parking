import { type FormEvent, useEffect, useState } from "react";
import { ApiError } from "../api/client";
import { type DevInvitationResponse, employeeApi } from "../api/employeeApi";
import type { User } from "../types/auth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function Employees() {
  const [employees, setEmployees] = useState<User[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Registration form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invitationSuccess, setInvitationSuccess] = useState<string | null>(
    null,
  );

  // Development helper state (only used when import.meta.env.DEV is true)
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [devInvitation, setDevInvitation] =
    useState<DevInvitationResponse | null>(null);
  const [isFetchingDevLink, setIsFetchingDevLink] = useState(false);
  const [devLinkError, setDevLinkError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    employeeApi.list().then(
      (data) => {
        if (!ignore) {
          setEmployees(data.employees);
          setIsLoadingList(false);
        }
      },
      (err: unknown) => {
        if (!ignore) {
          if (err instanceof ApiError) {
            setListError(err.message);
          } else {
            setListError("Failed to load employees. Please try again.");
          }
          setIsLoadingList(false);
        }
      },
    );
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  function handleRetryList() {
    setListError(null);
    setIsLoadingList(true);
    setReloadKey((k) => k + 1);
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    const errors: { name?: string; email?: string } = {};

    if (trimmedName.length < 2 || trimmedName.length > 150) {
      errors.name = "Name must be between 2 and 150 characters.";
    }

    if (
      !normalizedEmail ||
      normalizedEmail.length > 254 ||
      !EMAIL_PATTERN.test(normalizedEmail)
    ) {
      errors.email = "Please enter a valid email address.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(true);
    setDevInvitation(null);
    setDevLinkError(null);
    setCopyFeedback(null);

    try {
      await employeeApi.register({
        name: trimmedName,
        email: normalizedEmail,
      });

      // Clear input fields and record successful registration
      setName("");
      setEmail("");
      setRegisteredEmail(normalizedEmail);
      setInvitationSuccess(
        `Employee ${trimmedName} registered and awaiting activation.`,
      );

      // Refresh employee list; if list refresh fails, retain invitation success
      try {
        const data = await employeeApi.list();
        setEmployees(data.employees);
      } catch {
        setListError(
          "Failed to refresh employee list. The employee was registered.",
        );
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setFormError("An employee with this email is already registered.");
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError("Failed to register employee. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGetDevLink() {
    if (!registeredEmail || isFetchingDevLink) return;
    setIsFetchingDevLink(true);
    setDevLinkError(null);
    setCopyFeedback(null);

    try {
      const data = await employeeApi.getDevInvitation(registeredEmail);
      setDevInvitation(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setDevLinkError(err.message);
      } else {
        setDevLinkError("Failed to retrieve development invitation link.");
      }
    } finally {
      setIsFetchingDevLink(false);
    }
  }

  async function handleCopyLink() {
    if (!devInvitation) return;
    try {
      await navigator.clipboard.writeText(devInvitation.activationUrl);
      setCopyFeedback("Activation link copied to clipboard!");
    } catch {
      setCopyFeedback(
        "Could not copy automatically. Please copy the URL manually.",
      );
    }
  }

  function renderStatusBadge(status: User["status"]) {
    switch (status) {
      case "pending":
        return (
          <span className="status-badge status-badge--pending">
            Awaiting activation
          </span>
        );
      case "active":
        return (
          <span className="status-badge status-badge--active">Active</span>
        );
      case "disabled":
        return (
          <span className="status-badge status-badge--disabled">Disabled</span>
        );
    }
  }

  return (
    <div className="employees-page">
      <h1 className="page-heading">Employee Management</h1>
      <p className="page-description">
        Register new employees and view registered staff.
      </p>

      {/* Registration / Invitation Form */}
      <section
        aria-labelledby="register-heading"
        style={{ marginTop: "2rem", marginBottom: "2.5rem" }}
      >
        <h2
          id="register-heading"
          style={{ fontSize: "1.25rem", marginBottom: "1rem" }}
        >
          Register Employee
        </h2>

        {invitationSuccess && (
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
            {invitationSuccess}
          </div>
        )}

        {formError && (
          <div
            className="login-form__error"
            role="alert"
            style={{ marginBottom: "1rem" }}
          >
            {formError}
          </div>
        )}

        <form
          className="login-form"
          onSubmit={handleRegister}
          noValidate
          style={{ maxWidth: "32rem" }}
        >
          <div className="login-form__field">
            <label htmlFor="employee-name" className="login-form__label">
              Full Name
            </label>
            <input
              id="employee-name"
              className="login-form__input"
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) {
                  setFieldErrors((prev) => ({ ...prev, name: undefined }));
                }
              }}
            />
            {fieldErrors.name && (
              <span
                role="alert"
                style={{ fontSize: "0.8125rem", color: "#842029" }}
              >
                {fieldErrors.name}
              </span>
            )}
          </div>

          <div className="login-form__field">
            <label htmlFor="employee-email" className="login-form__label">
              Email Address
            </label>
            <input
              id="employee-email"
              className="login-form__input"
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
            />
            {fieldErrors.email && (
              <span
                role="alert"
                style={{ fontSize: "0.8125rem", color: "#842029" }}
              >
                {fieldErrors.email}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="login-form__submit"
            disabled={isSubmitting}
            style={{ alignSelf: "flex-start", marginTop: "0.5rem" }}
          >
            {isSubmitting ? "Registering…" : "Register Employee"}
          </button>
        </form>

        {/* Development-only invitation retrieval helper */}
        {import.meta.env.DEV && registeredEmail && invitationSuccess && (
          <div className="dev-helper" data-testid="dev-invitation-helper">
            <h3 className="dev-helper__title">
              Development Helper (Testing Only)
            </h3>
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--color-text-muted)",
                marginBottom: "0.75rem",
              }}
            >
              Fetch the activation URL from the server test mailbox for{" "}
              <strong>{registeredEmail}</strong>.
            </p>
            <button
              type="button"
              className="session-error__retry"
              onClick={handleGetDevLink}
              disabled={isFetchingDevLink}
            >
              {isFetchingDevLink
                ? "Retrieving link…"
                : "Get development activation link"}
            </button>

            {devLinkError && (
              <p
                role="alert"
                style={{
                  fontSize: "0.875rem",
                  color: "#842029",
                  marginTop: "0.5rem",
                }}
              >
                {devLinkError}
              </p>
            )}

            {devInvitation && (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.75rem",
                  background: "#ffffff",
                  borderRadius: "0.25rem",
                  border: "1px solid var(--color-border)",
                }}
              >
                <p style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                  <strong>Activation URL:</strong>
                </p>
                <p
                  style={{
                    fontSize: "0.8125rem",
                    wordBreak: "break-all",
                    marginBottom: "0.5rem",
                  }}
                >
                  {isSafeUrl(devInvitation.activationUrl) ? (
                    <a
                      href={devInvitation.activationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="not-found__link"
                      style={{ marginTop: 0 }}
                    >
                      {devInvitation.activationUrl}
                    </a>
                  ) : (
                    <code>{devInvitation.activationUrl}</code>
                  )}
                </p>
                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--color-text-muted)",
                    marginBottom: "0.5rem",
                  }}
                >
                  Expires: {new Date(devInvitation.expiresAt).toLocaleString()}
                </p>
                <button
                  type="button"
                  className="session-error__retry"
                  onClick={handleCopyLink}
                >
                  Copy link
                </button>
                {copyFeedback && (
                  <p
                    role="status"
                    style={{
                      fontSize: "0.8125rem",
                      color: "#0f5132",
                      marginTop: "0.5rem",
                    }}
                  >
                    {copyFeedback}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Employee List Table */}
      <section aria-labelledby="employees-list-heading">
        <h2 id="employees-list-heading" style={{ fontSize: "1.25rem" }}>
          Employees
        </h2>

        {isLoadingList ? (
          <p
            role="status"
            className="page-description"
            style={{ marginTop: "1rem" }}
          >
            Loading employees…
          </p>
        ) : listError ? (
          <div
            className="session-error"
            role="alert"
            style={{ marginTop: "1rem" }}
          >
            <p className="session-error__message">{listError}</p>
            <button
              type="button"
              className="session-error__retry"
              onClick={handleRetryList}
            >
              Retry
            </button>
          </div>
        ) : employees.length === 0 ? (
          <p className="page-description" style={{ marginTop: "1rem" }}>
            No employees registered yet.
          </p>
        ) : (
          <table className="employee-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.name}</td>
                  <td>{emp.email}</td>
                  <td>{emp.role === "admin" ? "Administrator" : "User"}</td>
                  <td>{renderStatusBadge(emp.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
