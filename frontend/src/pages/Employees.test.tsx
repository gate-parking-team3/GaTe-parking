import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { employeeApi } from "../api/employeeApi";
import Employees from "./Employees";

const mockEmployees = [
  {
    id: "e1",
    name: "Eva Admin",
    email: "eva@gate.cz",
    role: "admin" as const,
    status: "active" as const,
  },
  {
    id: "e2",
    name: "Petr User",
    email: "petr@gate.cz",
    role: "user" as const,
    status: "pending" as const,
  },
  {
    id: "e3",
    name: "Blocked User",
    email: "blocked@gate.cz",
    role: "user" as const,
    status: "disabled" as const,
  },
];

describe("Employees page", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Employee list rendering", () => {
    it("renders loading indicator while fetching employees", () => {
      vi.spyOn(employeeApi, "list").mockImplementation(
        () => new Promise(() => {}),
      );

      render(<Employees />);

      expect(screen.getByRole("status")).toHaveTextContent(
        "Loading employees…",
      );
    });

    it("displays error message and allows retry when employee list fails to load", async () => {
      const user = userEvent.setup();
      const listSpy = vi
        .spyOn(employeeApi, "list")
        .mockRejectedValueOnce(new ApiError("Failed to load", 500))
        .mockResolvedValueOnce({ employees: mockEmployees });

      render(<Employees />);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Failed to load",
      );
      const retryBtn = screen.getByRole("button", { name: "Retry" });
      await user.click(retryBtn);

      expect(listSpy).toHaveBeenCalledTimes(2);
      expect(await screen.findByText("Eva Admin")).toBeInTheDocument();
    });

    it("displays empty state when no employees exist", async () => {
      vi.spyOn(employeeApi, "list").mockResolvedValue({ employees: [] });

      render(<Employees />);

      expect(
        await screen.findByText("No employees registered yet."),
      ).toBeInTheDocument();
    });

    it("renders employees table with correct role labels and status badges", async () => {
      vi.spyOn(employeeApi, "list").mockResolvedValue({
        employees: mockEmployees,
      });

      render(<Employees />);

      expect(await screen.findByText("Eva Admin")).toBeInTheDocument();
      expect(screen.getByText("eva@gate.cz")).toBeInTheDocument();
      expect(screen.getByText("Administrator")).toBeInTheDocument();
      expect(screen.getByText("Active")).toBeInTheDocument();

      expect(screen.getByText("Petr User")).toBeInTheDocument();
      expect(screen.getByText("petr@gate.cz")).toBeInTheDocument();
      expect(screen.getByText("Awaiting activation")).toBeInTheDocument();

      expect(screen.getByText("Blocked User")).toBeInTheDocument();
      expect(screen.getByText("Disabled")).toBeInTheDocument();

      // Ensure no "Approve" button is present anywhere
      expect(screen.queryByText(/Approve/i)).not.toBeInTheDocument();
    });
  });

  describe("Employee registration form", () => {
    it("validates name and email fields before submission", async () => {
      const user = userEvent.setup();
      vi.spyOn(employeeApi, "list").mockResolvedValue({ employees: [] });

      render(<Employees />);

      const submitBtn = screen.getByRole("button", {
        name: "Register Employee",
      });

      // Submit empty
      await user.click(submitBtn);

      expect(
        screen.getByText("Name must be between 2 and 150 characters."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Please enter a valid email address."),
      ).toBeInTheDocument();

      // Fix name, leave bad email
      const nameInput = screen.getByLabelText("Full Name");
      const emailInput = screen.getByLabelText("Email Address");

      await user.type(nameInput, "Jana Novak");
      await user.type(emailInput, "not-an-email");
      await user.click(submitBtn);

      expect(
        screen.queryByText("Name must be between 2 and 150 characters."),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText("Please enter a valid email address."),
      ).toBeInTheDocument();
    });

    it("submits trimmed name and lowercased email, refetches list, and clears form", async () => {
      const user = userEvent.setup();
      const listSpy = vi
        .spyOn(employeeApi, "list")
        .mockResolvedValueOnce({ employees: [] })
        .mockResolvedValueOnce({
          employees: [
            {
              id: "e4",
              name: "Jana Novak",
              email: "jana@gate.cz",
              role: "user",
              status: "pending",
            },
          ],
        });

      const registerSpy = vi.spyOn(employeeApi, "register").mockResolvedValue({
        employee: {
          id: "e4",
          name: "Jana Novak",
          email: "jana@gate.cz",
          role: "user",
          status: "pending",
        },
      });

      render(<Employees />);

      const nameInput = screen.getByLabelText("Full Name");
      const emailInput = screen.getByLabelText("Email Address");
      const submitBtn = screen.getByRole("button", {
        name: "Register Employee",
      });

      await user.type(nameInput, "  Jana Novak  ");
      await user.type(emailInput, "  JANA@GATE.CZ  ");
      await user.click(submitBtn);

      expect(registerSpy).toHaveBeenCalledWith({
        name: "Jana Novak",
        email: "jana@gate.cz",
      });

      expect(
        await screen.findByText(
          "Employee Jana Novak registered and awaiting activation.",
        ),
      ).toBeInTheDocument();

      // Form inputs cleared
      expect(nameInput).toHaveValue("");
      expect(emailInput).toHaveValue("");

      // List was refreshed
      expect(listSpy).toHaveBeenCalledTimes(2);
      expect(screen.getByText("Jana Novak")).toBeInTheDocument();
    });

    it("handles duplicate email 409 conflict gracefully", async () => {
      const user = userEvent.setup();
      vi.spyOn(employeeApi, "list").mockResolvedValue({ employees: [] });
      vi.spyOn(employeeApi, "register").mockRejectedValue(
        new ApiError("Email already registered", 409),
      );

      render(<Employees />);

      await user.type(screen.getByLabelText("Full Name"), "Existing User");
      await user.type(
        screen.getByLabelText("Email Address"),
        "existing@gate.cz",
      );
      await user.click(
        screen.getByRole("button", { name: "Register Employee" }),
      );

      expect(
        await screen.findByText(
          "An employee with this email is already registered.",
        ),
      ).toBeInTheDocument();
    });

    it("retains invitation success if list refresh fails and offers retry for list", async () => {
      const user = userEvent.setup();
      vi.spyOn(employeeApi, "list")
        .mockResolvedValueOnce({ employees: [] })
        .mockRejectedValueOnce(new ApiError("List refresh network fail", 0));

      vi.spyOn(employeeApi, "register").mockResolvedValue({
        employee: {
          id: "e5",
          name: "Karel",
          email: "karel@gate.cz",
          role: "user",
          status: "pending",
        },
      });

      render(<Employees />);

      await user.type(screen.getByLabelText("Full Name"), "Karel");
      await user.type(screen.getByLabelText("Email Address"), "karel@gate.cz");
      await user.click(
        screen.getByRole("button", { name: "Register Employee" }),
      );

      // Invitation success is preserved
      expect(
        await screen.findByText(
          "Employee Karel registered and awaiting activation.",
        ),
      ).toBeInTheDocument();

      // List error shown with retry
      expect(
        screen.getByText(
          "Failed to refresh employee list. The employee was registered.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    });
  });

  describe("Development invitation link helper", () => {
    it("fetches dev link, displays it, and allows copying", async () => {
      const user = userEvent.setup();
      vi.spyOn(employeeApi, "list").mockResolvedValue({ employees: [] });
      vi.spyOn(employeeApi, "register").mockResolvedValue({
        employee: {
          id: "e6",
          name: "Lukas",
          email: "lukas@gate.cz",
          role: "user",
          status: "pending",
        },
      });

      const devSpy = vi
        .spyOn(employeeApi, "getDevInvitation")
        .mockResolvedValue({
          activationUrl:
            "http://localhost:3000/activate?token=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          expiresAt: "2026-11-12T12:00:00.000Z",
        });

      // Mock navigator.clipboard
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true,
      });

      render(<Employees />);

      await user.type(screen.getByLabelText("Full Name"), "Lukas");
      await user.type(screen.getByLabelText("Email Address"), "lukas@gate.cz");
      await user.click(
        screen.getByRole("button", { name: "Register Employee" }),
      );

      // The dev helper is now visible
      const getLinkBtn = await screen.findByRole("button", {
        name: "Get development activation link",
      });
      await user.click(getLinkBtn);

      expect(devSpy).toHaveBeenCalledWith("lukas@gate.cz");

      expect(
        await screen.findByRole("link", {
          name: "http://localhost:3000/activate?token=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        }),
      ).toBeInTheDocument();

      // Copy link
      const copyBtn = screen.getByRole("button", { name: "Copy link" });
      await user.click(copyBtn);

      expect(writeTextMock).toHaveBeenCalledWith(
        "http://localhost:3000/activate?token=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      );
      expect(
        await screen.findByText("Activation link copied to clipboard!"),
      ).toBeInTheDocument();
    });

    it("handles clipboard failure gracefully", async () => {
      const user = userEvent.setup();
      vi.spyOn(employeeApi, "list").mockResolvedValue({ employees: [] });
      vi.spyOn(employeeApi, "register").mockResolvedValue({
        employee: {
          id: "e7",
          name: "Tomas",
          email: "tomas@gate.cz",
          role: "user",
          status: "pending",
        },
      });

      vi.spyOn(employeeApi, "getDevInvitation").mockResolvedValue({
        activationUrl: "http://localhost:3000/activate?token=123",
        expiresAt: "2026-11-12T12:00:00.000Z",
      });

      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: vi
            .fn()
            .mockRejectedValue(new Error("Clipboard permission denied")),
        },
        configurable: true,
        writable: true,
      });

      render(<Employees />);

      await user.type(screen.getByLabelText("Full Name"), "Tomas");
      await user.type(screen.getByLabelText("Email Address"), "tomas@gate.cz");
      await user.click(
        screen.getByRole("button", { name: "Register Employee" }),
      );

      const getLinkBtn = await screen.findByRole("button", {
        name: "Get development activation link",
      });
      await user.click(getLinkBtn);

      const copyBtn = await screen.findByRole("button", { name: "Copy link" });
      await user.click(copyBtn);

      expect(
        await screen.findByText(
          "Could not copy automatically. Please copy the URL manually.",
        ),
      ).toBeInTheDocument();
    });

    it("displays error when dev link retrieval fails without breaking registration success", async () => {
      const user = userEvent.setup();
      vi.spyOn(employeeApi, "list").mockResolvedValue({ employees: [] });
      vi.spyOn(employeeApi, "register").mockResolvedValue({
        employee: {
          id: "e8",
          name: "Martin",
          email: "martin@gate.cz",
          role: "user",
          status: "pending",
        },
      });

      vi.spyOn(employeeApi, "getDevInvitation").mockRejectedValue(
        new ApiError("Invitation not found", 404),
      );

      render(<Employees />);

      await user.type(screen.getByLabelText("Full Name"), "Martin");
      await user.type(screen.getByLabelText("Email Address"), "martin@gate.cz");
      await user.click(
        screen.getByRole("button", { name: "Register Employee" }),
      );

      const getLinkBtn = await screen.findByRole("button", {
        name: "Get development activation link",
      });
      await user.click(getLinkBtn);

      expect(
        await screen.findByText("Invitation not found"),
      ).toBeInTheDocument();

      // Registration success remains visible
      expect(
        screen.getByText("Employee Martin registered and awaiting activation."),
      ).toBeInTheDocument();
    });
  });
});
