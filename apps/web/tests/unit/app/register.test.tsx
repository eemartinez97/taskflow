import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";

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

// -- Shared userEvent instance --
let user: UserEvent;

// -- Helpers --

/**
 * Fills all four fields of the register form.
 * Accepts `overrides` for testing specific invalid-input scenarios
 * without repeating the full valid payload in every test.
 */
function fillRegisterForm(overrides: Partial<typeof validRegisterPayload> = {}): void {
  const payload = { ...validRegisterPayload, ...overrides };
  fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: payload.name } });
  fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: payload.email } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: payload.password } });
  fireEvent.change(screen.getByLabelText(/^confirm password$/i), {
    target: { value: payload.confirmPassword },
  });
}

async function submitRegisterForm(
  overrides: Partial<typeof validRegisterPayload> = {},
): Promise<void> {
  fillRegisterForm(overrides);
  await user.click(screen.getByRole("button", { name: /create account/i }));
}

describe("RegisterPage", () => {
  let fetchSpy: FetchSpy;
  let routerMock: RouterMock;

  beforeEach(() => {
    user = userEvent.setup({ delay: null });
    vi.clearAllMocks();
    routerMock = setupRouterMock();
    fetchSpy = setupFetchSpy(SUCCESS_RESPONSE);
  });

  afterEach(() => {
    teardownFetchSpy();
  });

  // -- Rendering --

  it("renders heading, all four fields, and a submit button", () => {
    render(<RegisterPage />);
    expect(screen.getByRole("heading", { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^confirm password$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("renders a link back to /login", () => {
    render(<RegisterPage />);
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  // -- Successful flow --

  it("calls fetch POST /api/auth/register on valid submission", async () => {
    render(<RegisterPage />);
    await submitRegisterForm();
    await waitFor(
      () => {
        expect(fetchSpy).toHaveBeenCalledWith(
          "/api/auth/register",
          expect.objectContaining({ method: "POST" }),
        );
      },
      { timeout: 300 },
    );
  });

  it("redirects to /login?registered=true on success", async () => {
    render(<RegisterPage />);
    await submitRegisterForm();
    await waitFor(
      () => {
        expect(routerMock.pushMock).toHaveBeenCalledWith("/login?registered=true");
      },
      { timeout: 300 },
    );
  });

  // -- Server error states --

  it("shows a 409 error when the email is already taken", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockFetchResponse({ error: "An account with that email already exists." }, 409),
    );
    render(<RegisterPage />);
    await submitRegisterForm();
    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toHaveTextContent(/already exists/i);
      },
      { timeout: 300 },
    );
  });

  it("shows a generic error on 500 response with error field", async () => {
    fetchSpy.mockResolvedValueOnce(mockFetchResponse({ error: "Unexpected error." }, 500));
    render(<RegisterPage />);
    await submitRegisterForm();
    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      },
      { timeout: 300 },
    );
  });

  it("shows a fallback error message when 500 body has no error field", async () => {
    fetchSpy.mockResolvedValueOnce(mockFetchResponse({}, 500));
    render(<RegisterPage />);
    await submitRegisterForm();
    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);
      },
      { timeout: 300 },
    );
  });

  // -- Client-side validation --

  it("does NOT call fetch when the form has validation errors", async () => {
    render(<RegisterPage />);
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(
      () => {
        expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
      },
      { timeout: 300 },
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows password mismatch error without calling fetch", async () => {
    render(<RegisterPage />);
    await submitRegisterForm({ confirmPassword: "different-password" });
    await waitFor(
      () => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      },
      { timeout: 300 },
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // -- Loading state --

  it("disables the submit button while the form is submitting", async () => {
    fetchSpy.mockReturnValue(new Promise(() => undefined)); // hangs forever
    render(<RegisterPage />);
    await submitRegisterForm();
    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /create account/i })).toBeDisabled();
      },
      { timeout: 300 },
    );
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
    await submitRegisterForm();
    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      },
      { timeout: 300 },
    );

    // Clear all fields and try again with a new email
    const fields = [
      screen.getByLabelText(/^name/i),
      screen.getByLabelText(/^email/i),
      screen.getByLabelText(/^password$/i),
      screen.getByLabelText(/^confirm password$/i),
    ];
    for (const field of fields) {
      await userEvent.clear(field);
    }
    await submitRegisterForm({ email: "new@taskflow.dev" });
    await waitFor(
      () => {
        expect(routerMock.pushMock).toHaveBeenCalledWith("/login?registered=true");
      },
      { timeout: 300 },
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
