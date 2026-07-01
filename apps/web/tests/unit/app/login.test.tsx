import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

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

// -- Helpers --

/** Fills the login form and submits it using userEvent */
async function submitLoginForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<typeof validLoginCredentials> = {},
): Promise<void> {
  const payload = { ...validLoginCredentials, ...overrides };
  await user.type(screen.getByLabelText(/^email/i), payload.email);
  await user.type(screen.getByLabelText(/^password$/i), payload.password);
  await user.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("LoginPage", () => {
  let routerMock: RouterMock;

  beforeEach(() => {
    vi.clearAllMocks();
    routerMock = setupRouterMock();
    vi.mocked(signIn).mockResolvedValue(SUCCESS_RESULT);
  });

  // -- Rendering --

  it("renders the page heading", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders email and password inputs", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders a link to the register page", () => {
    render(<LoginPage />);
    expect(screen.getByRole("link", { name: /create one/i })).toHaveAttribute("href", "/register");
  });

  // -- Successful flow --

  it("calls signIn with credentials on form submission", async () => {
    render(<LoginPage />);
    const user = userEvent.setup();
    await submitLoginForm(user);

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: validLoginCredentials.email,
        password: validLoginCredentials.password,
        redirect: false,
      });
    });
  });

  it("redirects to /dashboard on successful sign-in", async () => {
    render(<LoginPage />);
    const user = userEvent.setup();
    await submitLoginForm(user);

    await waitFor(() => {
      expect(routerMock.pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  // -- Error states --

  it("shows an error message when signIn returns an error", async () => {
    vi.mocked(signIn).mockResolvedValue(FAILURE_RESULT);

    render(<LoginPage />);
    const user = userEvent.setup();
    await submitLoginForm(user, { password: "wrong-password" });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/invalid email or password/i);
    });
  });

  it("show a field-level validation error when email is empty", async () => {
    render(<LoginPage />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    });

    expect(signIn).not.toHaveBeenCalled();
  });

  it("clears the server error before each new submission attempt", async () => {
    vi.mocked(signIn).mockResolvedValueOnce(FAILURE_RESULT).mockResolvedValueOnce(SUCCESS_RESULT);

    render(<LoginPage />);
    const user = userEvent.setup();

    // First attempt fails
    await submitLoginForm(user, { password: "wrong" });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Clear BOTH fields before the second attempt.
    await user.clear(screen.getByLabelText(/^email/i));
    await user.clear(screen.getByLabelText(/^password$/i));

    // Second attempt — correct credentials → should succeed
    await submitLoginForm(user);

    await waitFor(() => {
      expect(routerMock.pushMock).toHaveBeenCalledWith("/dashboard");
    });

    // After the successful redirect the server error must be gone
    expect(screen.queryByText(/invalid email or password/i)).not.toBeInTheDocument();
  });

  // -- Loading state --

  it("disables the submit button while the form is submitting", async () => {
    vi.mocked(signIn).mockReturnValue(new Promise(() => undefined));

    render(<LoginPage />);
    const user = userEvent.setup();
    await submitLoginForm(user);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sign in/i })).toBeDisabled();
    });
  });
});
