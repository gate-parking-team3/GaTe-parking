import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authApi } from "../api/authApi";
import { ApiError } from "../api/client";
import { AuthProvider } from "../context/AuthContext";
import Activate from "./Activate";

const VALID_TOKEN = "a1b2c3d4e5f6".repeat(5) + "1234"; // 64 hex chars

function renderActivate(
  initialEntries: string[],
  userState?: { email: string; name: string },
) {
  if (userState) {
    vi.spyOn(authApi, "me").mockResolvedValue({
      user: {
        id: "u1",
        email: userState.email,
        name: userState.name,
        role: "user",
        status: "active",
      },
    });
    localStorage.setItem("gate-parking-token", "mock-token");
  } else {
    localStorage.removeItem("gate-parking-token");
  }

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <Routes>
          <Route path="activate" element={<Activate />} />
          <Route path="login" element={<div>Login Page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("Activate page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe("Token validation & link state", () => {
    it("shows missing/malformed link state when token is missing", () => {
      renderActivate(["/activate"]);

      expect(
        screen.getByRole("heading", { name: "Account Activation" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Invalid or missing activation link/i),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText(/New Password/i)).not.toBeInTheDocument();
    });

    it("shows missing/malformed link state when token is not 64 hex chars", () => {
      renderActivate(["/activate?token=short"]);
      expect(
        screen.getByText(/Invalid or missing activation link/i),
      ).toBeInTheDocument();

      // Uppercase characters are rejected by backend /^[a-f\d]{64}$/
      renderActivate([`/activate?token=${VALID_TOKEN.toUpperCase()}`]);
      expect(
        screen.getAllByText(/Invalid or missing activation link/i)[0],
      ).toBeInTheDocument();
    });

    it("renders password setup form when token is a valid 64-hex string", () => {
      renderActivate([`/activate?token=${VALID_TOKEN}`]);

      expect(
        screen.getByRole("heading", { name: "Set Your Password" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/^New Password/i)).toHaveAttribute(
        "autocomplete",
        "new-password",
      );
      expect(screen.getByLabelText(/^Confirm New Password/i)).toHaveAttribute(
        "autocomplete",
        "new-password",
      );
      // Raw token must never be rendered or shown in inputs
      expect(screen.queryByDisplayValue(VALID_TOKEN)).not.toBeInTheDocument();
    });
  });

  describe("Already authenticated state", () => {
    it("shows signed-in notice with sign out action without silently clearing session", async () => {
      renderActivate([`/activate?token=${VALID_TOKEN}`], {
        email: "existing@gate.cz",
        name: "Existing User",
      });

      expect(
        await screen.findByText(/You are currently signed in as/i),
      ).toBeInTheDocument();
      expect(screen.getByText("Existing User")).toBeInTheDocument();

      const signOutBtn = screen.getByRole("button", { name: "Sign out" });
      await userEvent.click(signOutBtn);

      // After sign out, the activation form is revealed for this token
      expect(
        await screen.findByRole("heading", { name: "Set Your Password" }),
      ).toBeInTheDocument();
    });
  });

  describe("Client-side password validation", () => {
    it("rejects passwords shorter than 8 characters", async () => {
      renderActivate([`/activate?token=${VALID_TOKEN}`]);

      const passwordInput = screen.getByLabelText(/^New Password/i);
      const confirmInput = screen.getByLabelText(/^Confirm New Password/i);
      const submitBtn = screen.getByRole("button", {
        name: "Activate account",
      });

      await userEvent.type(passwordInput, "short");
      await userEvent.type(confirmInput, "short");
      await userEvent.click(submitBtn);

      expect(
        screen.getByText("Password must be at least 8 characters."),
      ).toBeInTheDocument();
    });

    it("rejects passwords exceeding 72 UTF-8 bytes (including multibyte characters)", async () => {
      renderActivate([`/activate?token=${VALID_TOKEN}`]);

      const passwordInput = screen.getByLabelText(/^New Password/i);
      const confirmInput = screen.getByLabelText(/^Confirm New Password/i);
      const submitBtn = screen.getByRole("button", {
        name: "Activate account",
      });

      // Czech character 'č' is 2 bytes in UTF-8; 40 'č' characters = 80 bytes (> 72 bytes)
      const multibyteOver72 = "č".repeat(40);

      await userEvent.type(passwordInput, multibyteOver72);
      await userEvent.type(confirmInput, multibyteOver72);
      await userEvent.click(submitBtn);

      expect(
        screen.getByText("Password cannot exceed 72 bytes."),
      ).toBeInTheDocument();
    });

    it("rejects when passwords do not match", async () => {
      renderActivate([`/activate?token=${VALID_TOKEN}`]);

      const passwordInput = screen.getByLabelText(/^New Password/i);
      const confirmInput = screen.getByLabelText(/^Confirm New Password/i);
      const submitBtn = screen.getByRole("button", {
        name: "Activate account",
      });

      await userEvent.type(passwordInput, "validpassword123");
      await userEvent.type(confirmInput, "differentpassword123");
      await userEvent.click(submitBtn);

      expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    });
  });

  describe("Form submission and response handling", () => {
    it("preserves whitespace and submits unchanged password", async () => {
      const activateSpy = vi.spyOn(authApi, "activate").mockResolvedValue({
        user: {
          id: "u2",
          name: "Jana",
          email: "jana@gate.cz",
          role: "user",
          status: "active",
        },
      });

      renderActivate([`/activate?token=${VALID_TOKEN}`]);

      const passwordWithSpaces = "  password with spaces  ";
      await userEvent.type(
        screen.getByLabelText(/^New Password/i),
        passwordWithSpaces,
      );
      await userEvent.type(
        screen.getByLabelText(/^Confirm New Password/i),
        passwordWithSpaces,
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Activate account" }),
      );

      expect(activateSpy).toHaveBeenCalledWith({
        token: VALID_TOKEN,
        password: passwordWithSpaces,
      });

      // Shows success message and link to sign in
      expect(
        await screen.findByRole("heading", { name: "Account Activated" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Your password has been set and your account is now active/i,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Go to Sign in" }),
      ).toBeInTheDocument();

      // Does not set any token in localStorage
      expect(localStorage.getItem("gate-parking-token")).toBeNull();
    });

    it("prevents duplicate submissions while request is in flight", async () => {
      let resolvePromise: (value: {
        user: {
          id: string;
          name: string;
          email: string;
          role: "user";
          status: "active";
        };
      }) => void;
      const pendingPromise = new Promise<{
        user: {
          id: string;
          name: string;
          email: string;
          role: "user";
          status: "active";
        };
      }>((resolve) => {
        resolvePromise = resolve;
      });
      vi.spyOn(authApi, "activate").mockReturnValue(pendingPromise);

      renderActivate([`/activate?token=${VALID_TOKEN}`]);

      await userEvent.type(
        screen.getByLabelText(/^New Password/i),
        "secret1234",
      );
      await userEvent.type(
        screen.getByLabelText(/^Confirm New Password/i),
        "secret1234",
      );

      const submitBtn = screen.getByRole("button", {
        name: "Activate account",
      });
      await userEvent.click(submitBtn);

      expect(submitBtn).toBeDisabled();
      expect(submitBtn).toHaveTextContent("Activating account…");

      resolvePromise!({
        user: {
          id: "u2",
          name: "Jana",
          email: "jana@gate.cz",
          role: "user",
          status: "active",
        },
      });

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "Account Activated" }),
        ).toBeInTheDocument();
      });
    });

    it("displays backend error when token is invalid or expired", async () => {
      vi.spyOn(authApi, "activate").mockRejectedValue(
        new ApiError(
          "Activation link is invalid, expired or already used",
          400,
        ),
      );

      renderActivate([`/activate?token=${VALID_TOKEN}`]);

      await userEvent.type(
        screen.getByLabelText(/^New Password/i),
        "secret1234",
      );
      await userEvent.type(
        screen.getByLabelText(/^Confirm New Password/i),
        "secret1234",
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Activate account" }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Activation link is invalid, expired or already used. Please contact your administrator for a new invitation.",
      );
    });

    it("handles rate limit 429 and network errors", async () => {
      vi.spyOn(authApi, "activate").mockRejectedValue(
        new ApiError("Too many requests, slow down", 429),
      );

      renderActivate([`/activate?token=${VALID_TOKEN}`]);

      await userEvent.type(
        screen.getByLabelText(/^New Password/i),
        "secret1234",
      );
      await userEvent.type(
        screen.getByLabelText(/^Confirm New Password/i),
        "secret1234",
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Activate account" }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Too many requests, slow down",
      );
    });
  });
});
