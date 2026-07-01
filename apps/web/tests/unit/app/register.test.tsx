import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => import("@/tests/mocks/next-navigation.js"));
vi.mock("@taskflow/ui", () => import("@/tests/mocks/taskflow-ui.js"));
vi.mock("next/link", () => import("@/tests/mocks/next-link.js"));

import {
  type FetchSpy,
  type RouterMock,
  mockFetchResponse,
  setupFetchSpy,
  setupRouterMock,
  teardownFetchSpy,
  validRegisterPayload,
} from "@/tests/helpers.js";
import RegisterPage from "@/app/(auth)/register/page";

// -- Fixtures --

/** Default 201 success response - used as the beforeEach default */
const SUCCESS_RESPONSE = mockFetchResponse(
  {
    user: { id: "1", email: validRegisterPayload.email },
  },
  201,
);

// -- Helpers --

/**
 * Fills all four fields of the register form.
 * Accepts `overrides` for testing specific invalid-input scenarios
 * without repeating the full valid payload in every test.
 */
async function fillRegisterForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<typeof validRegisterPayload> = {},
): Promise<void> {
  const payload = { ...validRegisterPayload, ...overrides };
  await user.type(screen.getByLabelText(/^name/i), payload.name);
  await user.type(screen.getByLabelText(/^email/i), payload.email);
  await user.type(screen.getByLabelText(/^password$/i), payload.password);
  await user.type(screen.getByLabelText(/^confirm password$/i), payload.confirmPassword);
}

describe("RegisterPage", () => {
  let fetchSpy: FetchSpy;
  let routerMock: RouterMock;

  beforeEach(() => {
    vi.clearAllMocks();
    routerMock = setupRouterMock();
    fetchSpy = setupFetchSpy(SUCCESS_RESPONSE);
  });

  afterEach(() => {
    teardownFetchSpy();
  });

  // -- Rendering --

  it("renders the page heading", () => {
    render(<RegisterPage />);
    expect(screen.getByRole("heading", { name: /create your account/i })).toBeInTheDocument();
  });

  it("renders all four form fields", () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^confirm password/i)).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    render(<RegisterPage />);
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("renders a link back to /login", () => {
    render(<RegisterPage />);
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  // -- Successful flow --

  it("calls fetch POST /api/auth/register on valid submission", async () => {
    render(<RegisterPage />);
    const user = userEvent.setup();
    await fillRegisterForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/auth/register",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("redirects to /login?registered=true on success", async () => {
    render(<RegisterPage />);
    const user = userEvent.setup();
    await fillRegisterForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(routerMock.pushMock).toHaveBeenCalledWith("/login?registered=true");
    });
  });

  // -- Server error states --

  it("shows a 409 error when the email is already taken", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockFetchResponse({ error: "An account with that email already exists." }, 409),
    );

    render(<RegisterPage />);
    const user = userEvent.setup();
    await fillRegisterForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/already exists/i);
    });
  });

  it("shows a generic server error on non-ok response", async () => {
    fetchSpy.mockResolvedValueOnce(mockFetchResponse({ error: "Unexpected error." }, 500));

    render(<RegisterPage />);
    const user = userEvent.setup();
    await fillRegisterForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("shows a fallback error message when 500 body has no error field", async () => {
    fetchSpy.mockResolvedValueOnce(mockFetchResponse({}, 500));

    render(<RegisterPage />);
    const user = userEvent.setup();
    await fillRegisterForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);
    });
  });

  // -- Client-side validation --

  it("does NOT call fetch when the form has validation errors", async () => {
    render(<RegisterPage />);
    const user = userEvent.setup();

    // Submit with empty form
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows password mismatch error without calling fetch", async () => {
    render(<RegisterPage />);
    const user = userEvent.setup();
    await fillRegisterForm(user, { confirmPassword: "different-password" });
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // -- Loading state --

  it("disables the submit button while the form is submitting", async () => {
    fetchSpy.mockReturnValue(new Promise(() => undefined)); // hangs forever

    render(<RegisterPage />);
    const user = userEvent.setup();
    await fillRegisterForm(user);

    const button = screen.getByRole("button", { name: /create account/i });
    await user.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
    });
  });

  // -- Error clearing --

  it("clears the server error before each new submission attempt", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        mockFetchResponse({ error: "An account with that email already exists." }, 409),
      )
      .mockResolvedValueOnce(
        mockFetchResponse({ user: { id: "2", email: "new@taskflow.dev" } }, 201),
      );

    render(<RegisterPage />);
    const user = userEvent.setup();

    await fillRegisterForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Clear all fields and try again with a new email
    const fields = [
      screen.getByLabelText(/^name/i),
      screen.getByLabelText(/^email/i),
      screen.getByLabelText(/^password$/i),
      screen.getByLabelText(/^confirm password$/i),
    ];
    for (const field of fields) {
      await user.clear(field);
    }
    await fillRegisterForm(user, { email: "new@taskflow.dev" });
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(routerMock.pushMock).toHaveBeenCalledWith("/login?registered=true");
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
