import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { signIn } from "next-auth/react";
import LoginPage from "@/app/(auth)/login/page";
import { renderUI } from "../../helpers/render";
import { setupRouterMock } from "@/tests/support/render";

// Helpers

const mockSignIn = vi.mocked(signIn);

/** Fills and submits the login form with the given credentials. */
function fillAndSubmit(email: string, password: string): void {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

// Tests

describe("LoginPage", () => {
  const { router: mockRouter } = setupRouterMock();

  beforeEach(() => {
    mockSignIn.mockReset();
    // Reset URL so getCallbackUrl() reads the correct search string
    window.history.pushState({}, "", "/login");
  });

  // -- Rendering --

  it("renders the sign-in heading", () => {
    renderUI(<LoginPage />);

    expect(screen.getByRole("heading", { name: /sign in to taskflow/i })).toBeInTheDocument();
  });

  it("renders email and password fields", () => {
    renderUI(<LoginPage />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    renderUI(<LoginPage />);

    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders a link to the register page", () => {
    renderUI(<LoginPage />);

    expect(screen.getByRole("link", { name: /create one/i })).toHaveAttribute("href", "/register");
  });

  // -- Client-side validation --

  it("shows a validation error and does NOT call signIn when email is empty", async () => {
    renderUI(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });

    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("shows a validation error when only the password is missing", async () => {
    renderUI(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "alice@taskflow.dev" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });

    expect(mockSignIn).not.toHaveBeenCalled();
  });

  // -- Successful login --

  it("calls signIn('credentials') with the submitted email and password", async () => {
    mockSignIn.mockResolvedValue({ error: null, ok: true, status: 200, url: null });
    renderUI(<LoginPage />);
    fillAndSubmit("alice@taskflow.dev", "Secure@Password1");

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("credentials", {
        email: "alice@taskflow.dev",
        password: "Secure@Password1",
        redirect: false,
      });
    });
  });

  it("redirects to /projects when there is no callbackUrl in the URL", async () => {
    mockSignIn.mockResolvedValue({ error: null, ok: true, status: 200, url: null });
    renderUI(<LoginPage />);
    fillAndSubmit("alice@taskflow.dev", "Secure@Password1");

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/projects");
    });
  });

  it("redirects to a valid relative callbackUrl after successful login", async () => {
    mockSignIn.mockResolvedValue({ error: null, ok: true, status: 200, url: null });
    window.history.pushState({}, "", "/login?callbackUrl=/settings");
    renderUI(<LoginPage />);
    fillAndSubmit("alice@taskflow.dev", "Secure@Password1");

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/settings");
    });
  });

  it("falls back to /projects when callbackUrl starts with '//' (open-redirect guard)", async () => {
    mockSignIn.mockResolvedValue({ error: null, ok: true, status: 200, url: null });
    window.history.pushState({}, "", "/login?callbackUrl=//evil.com/steal");
    renderUI(<LoginPage />);
    fillAndSubmit("alice@taskflow.dev", "Secure@Password1");

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/projects");
    });
  });

  it("falls back to /projects when callbackUrl is an absolute URL", async () => {
    mockSignIn.mockResolvedValue({ error: null, ok: true, status: 200, url: null });
    window.history.pushState({}, "", "/login?callbackUrl=https://evil.com");
    renderUI(<LoginPage />);
    fillAndSubmit("alice@taskflow.dev", "Secure@Password1");

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/projects");
    });
  });

  // -- Failed login --

  it("displays an inline error alert when signIn returns an error", async () => {
    mockSignIn.mockResolvedValue({
      error: "CredentialsSignin",
      ok: false,
      status: 401,
      url: null,
    });
    renderUI(<LoginPage />);
    fillAndSubmit("wrong@taskflow.dev", "BadPass1!");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/invalid email or password/i);
    });

    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("clears the error alert when the user resubmits", async () => {
    mockSignIn
      .mockResolvedValueOnce({ error: "CredentialsSignin", ok: false, status: 401, url: null })
      .mockResolvedValueOnce({ error: null, ok: true, status: 200, url: null });

    renderUI(<LoginPage />);
    fillAndSubmit("alice@taskflow.dev", "Secure@Password1");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Second submit - error should be cleared before the new signIn resolves
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
