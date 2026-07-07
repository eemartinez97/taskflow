import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent, { type UserEvent } from "@testing-library/user-event";

vi.mock("next/navigation", () => import("@/tests/mocks/next-navigation.js"));
vi.mock("next-auth/react", () => import("@/tests/mocks/next-auth.js"));
vi.mock("@taskflow/ui", () => import("@/tests/mocks/taskflow-ui.js"));
vi.mock("next/link", () => import("@/tests/mocks/next-link.js"));

import { signIn } from "next-auth/react";

import { type RouterMock, setupRouterMock, validLoginCredentials } from "@/tests/helpers.js";
import LoginPage from "@/app/(auth)/login/page.js";

// -- Fixtures --
const SUCCESS_RESULT = { error: null, ok: true, status: 200, url: null } as const;
const FAILURE_RESULT = { error: "CredentialsSignin", ok: false, status: 401, url: null } as const;

// -- Shared userEvent instance (created once per test, not per helper call) --
let user: UserEvent;

// -- Helpers --

/**
 * Fills the login form `fill()` (one DOM event per field, not one per character).
 * Use `user.type()` only in tests that need to verify per-keystroke behavior.
 */
function fillLoginForm(overrides: Partial<typeof validLoginCredentials> = {}): void {
  const payload = { ...validLoginCredentials, ...overrides };
  fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: payload.email } });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: payload.password },
  });
}

/** Fills the login form and submits it using userEvent */
async function submitLoginForm(
  overrides: Partial<typeof validLoginCredentials> = {},
): Promise<void> {
  fillLoginForm(overrides);
  await user.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("LoginPage", () => {
  let routerMock: RouterMock;

  beforeEach(() => {
    user = userEvent.setup({ delay: null });
    vi.clearAllMocks();
    routerMock = setupRouterMock();
    vi.mocked(signIn).mockResolvedValue(SUCCESS_RESULT);
  });

  // -- Rendering --

  it("renders the page heading", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders email and password inputs and submit button", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders a link to /register", () => {
    render(<LoginPage />);
    expect(screen.getByRole("link", { name: /create one/i })).toHaveAttribute("href", "/register");
  });

  // -- Successful flow --

  it("calls signIn with credentials on form submission", async () => {
    render(<LoginPage />);
    await submitLoginForm();

    await waitFor(
      () => {
        expect(signIn).toHaveBeenCalledWith("credentials", {
          email: validLoginCredentials.email,
          password: validLoginCredentials.password,
          redirect: false,
        });
      },
      { timeout: 300 },
    );
  });

  it("redirects to /dashboard on successful sign-in", async () => {
    render(<LoginPage />);
    await submitLoginForm();

    await waitFor(
      () => {
        expect(routerMock.pushMock).toHaveBeenCalledWith("/dashboard");
      },
      { timeout: 300 },
    );
  });

  // -- Error states --

  it("shows an error message when signIn returns an error", async () => {
    vi.mocked(signIn).mockResolvedValue(FAILURE_RESULT);

    render(<LoginPage />);
    await submitLoginForm({ password: "wrong-password" });

    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toHaveTextContent(/invalid email or password/i);
      },
      { timeout: 300 },
    );
  });

  it("show validation error and does NOT call signIn when email is empty", async () => {
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(
      () => {
        expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
      },
      { timeout: 300 },
    );
    expect(signIn).not.toHaveBeenCalled();
  });

  it("clears the server error before each new submission attempt", async () => {
    vi.mocked(signIn).mockResolvedValueOnce(FAILURE_RESULT).mockResolvedValueOnce(SUCCESS_RESULT);
    render(<LoginPage />);

    // First attempt fails
    await submitLoginForm({ password: "wrong-password" });
    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      },
      { timeout: 300 },
    );

    // Second attempt - succeeds
    await submitLoginForm();
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(
      () => {
        expect(routerMock.pushMock).toHaveBeenCalledWith("/dashboard");
      },
      { timeout: 300 },
    );
    expect(screen.queryByText(/invalid email or password/i)).not.toBeInTheDocument();
  });

  // -- Loading state --

  it("disables the submit button while the form is submitting", async () => {
    vi.mocked(signIn).mockReturnValue(new Promise(() => undefined));
    render(<LoginPage />);
    await submitLoginForm();

    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /sign in/i })).toBeDisabled();
      },
      { timeout: 300 },
    );
  });
});
