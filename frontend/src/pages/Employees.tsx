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
        return <span className="pill amber">Awaiting activation</span>;
      case "active":
        return <span className="pill green">Active</span>;
      case "disabled":
        return <span className="pill gray">Disabled</span>;
    }
  }

  return (
    <div className="page employees-page">
      <div className="head">
        <div>
          <h1>Employee Management</h1>
          <p>Register new employees and view registered staff.</p>
        </div>
      </div>

      {/* Registration / Invitation Form */}
      <section className="form" aria-labelledby="register-heading">
        <h2 id="register-heading" className="section-title">
          Register Employee
        </h2>

        {invitationSuccess && (
          <div className="ok-note" role="status">
            {invitationSuccess}
          </div>
        )}

        {formError && (
          <div className="err" role="alert">
            {formError}
          </div>
        )}

        <form className="form" onSubmit={handleRegister} noValidate>
          <div className="row">
            <div className="field">
              <label htmlFor="employee-name">Full Name</label>
              <input
                id="employee-name"
                className="input"
                type="text"
                required
                aria-invalid={fieldErrors.name ? true : undefined}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) {
                    setFieldErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
              />
              {fieldErrors.name && (
                <span role="alert" className="field-err">
                  {fieldErrors.name}
                </span>
              )}
            </div>

            <div className="field">
              <label htmlFor="employee-email">Email Address</label>
              <input
                id="employee-email"
                className="input"
                type="email"
                required
                aria-invalid={fieldErrors.email ? true : undefined}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
              />
              {fieldErrors.email && (
                <span role="alert" className="field-err">
                  {fieldErrors.email}
                </span>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Registering…" : "Register Employee"}
            </button>
          </div>
        </form>

        {/* Development-only invitation retrieval helper */}
        {import.meta.env.DEV && registeredEmail && invitationSuccess && (
          <div className="note form" data-testid="dev-invitation-helper">
            <h3 className="item-t">Development Helper (Testing Only)</h3>
            <p className="small">
              Fetch the activation URL from the server test mailbox for{" "}
              <strong>{registeredEmail}</strong>.
            </p>
            <div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleGetDevLink}
                disabled={isFetchingDevLink}
              >
                {isFetchingDevLink
                  ? "Retrieving link…"
                  : "Get development activation link"}
              </button>
            </div>

            {devLinkError && (
              <p role="alert" className="field-err">
                {devLinkError}
              </p>
            )}

            {devInvitation && (
              <div className="form">
                <p className="small">
                  <strong>Activation URL:</strong>
                </p>
                <p className="small">
                  {isSafeUrl(devInvitation.activationUrl) ? (
                    <a
                      href={devInvitation.activationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {devInvitation.activationUrl}
                    </a>
                  ) : (
                    <code>{devInvitation.activationUrl}</code>
                  )}
                </p>
                <p className="small muted">
                  Expires: {new Date(devInvitation.expiresAt).toLocaleString()}
                </p>
                <div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleCopyLink}
                  >
                    Copy link
                  </button>
                </div>
                {copyFeedback && (
                  <p role="status" className="small">
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
        <h2 id="employees-list-heading" className="section-title">
          Employees
        </h2>

        {isLoadingList ? (
          <p role="status" className="muted">
            Loading employees…
          </p>
        ) : listError ? (
          <div className="err" role="alert">
            <p>{listError}</p>
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleRetryList}
            >
              Retry
            </button>
          </div>
        ) : employees.length === 0 ? (
          <div className="empty">
            <h3>No employees registered yet.</h3>
          </div>
        ) : (
          <div className="tbl-wrap card">
            <table className="tbl">
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
          </div>
        )}
      </section>
    </div>
  );
}
