import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { signIn } from "next-auth/react";
import LoginPage, {
  successMessageFor,
  getSuccessMessageServerSnapshot,
} from "@/app/(auth)/login/page";
import { validLoginCredentials } from "@/tests/support/fixtures";
import { setupRouterMock } from "@/tests/support/render";

async function fillAndSubmit(): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/email/i), validLoginCredentials.email);
  await user.type(screen.getByLabelText(/password/i), validLoginCredentials.password);
  await user.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("successMessageFor", () => {
  it("returns the activation message when activated is present", () => {
    expect(successMessageFor(new URLSearchParams("activated=1"))).toMatch(/now active/i);
  });
  it("returns the reset message when reset is present", () => {
    expect(successMessageFor(new URLSearchParams("reset=1"))).toMatch(/password was reset/i);
  });
  it("returns null when neither flag is present", () => {
    expect(successMessageFor(new URLSearchParams(""))).toBeNull();
  });
});

describe("getSuccessMessageServerSnapshot", () => {
  it("always returns null, matching the message-less server-rendered HTML", () => {
    expect(getSuccessMessageServerSnapshot()).toBeNull();
  });
});

describe("LoginPage", () => {
  // -- Rendering --
  it("renders the sign-in heading, fields, and register link", () => {
    setupRouterMock();
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: /sign in to taskflow/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create one/i })).toHaveAttribute("href", "/register");
  });

  // -- Success banners --
  // Read from an effect (not a lazy useState initializer) so the client's
  // first hydration render matches the server-rendered (message-less) HTML
  // - see the docblock above successMessage in login/page.tsx. That means
  // the banner appears one tick after mount, hence waitFor here.
  it("shows the activation success message when ?activated=1 is present", async () => {
    window.history.pushState({}, "", "/login?activated=1");
    setupRouterMock();
    render(<LoginPage />);
    await waitFor(() => {
      expect(screen.getByText(/now active/i)).toBeInTheDocument();
    });
  });

  it("shows the reset success message when ?reset=1 is present", async () => {
    window.history.pushState({}, "", "/login?reset=1");
    setupRouterMock();
    render(<LoginPage />);
    await waitFor(() => {
      expect(screen.getByText(/password was reset/i)).toBeInTheDocument();
    });
  });

  it("shows no success banner when neither flag is present", async () => {
    window.history.pushState({}, "", "/login");
    setupRouterMock();
    render(<LoginPage />);
    await waitFor(() => {
      // Flushes the effect; asserting an absence a second time confirms it
      // stays absent rather than merely "not yet shown".
      expect(screen.queryByRole("heading")).toBeInTheDocument();
    });
    expect(screen.queryByText(/now active/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/password was reset/i)).not.toBeInTheDocument();
  });

  // -- Client-side validation --
  it("shows a validation error and does NOT call signIn when the email is empty", async () => {
    window.history.pushState({}, "", "/login");
    setupRouterMock();
    render(<LoginPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });
    expect(signIn).not.toHaveBeenCalled();
  });

  // -- Successful login + callbackUrl handling --
  it("redirects to /projects by default on successful sign-in", async () => {
    window.history.pushState({}, "", "/login");
    const { pushMock } = setupRouterMock();
    vi.mocked(signIn).mockResolvedValueOnce({ error: null, ok: true, status: 200, url: null });
    render(<LoginPage />);
    await fillAndSubmit();
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/projects");
    });
  });

  it("redirects to a same-origin callbackUrl when present in the query string", async () => {
    window.history.pushState({}, "", "/login?callbackUrl=%2Ftasks");
    const { pushMock } = setupRouterMock();
    vi.mocked(signIn).mockResolvedValueOnce({ error: null, ok: true, status: 200, url: null });
    render(<LoginPage />);
    await fillAndSubmit();
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/tasks");
    });
  });

  it("rejects an open-redirect callbackUrl (//evil.com) and falls back to /projects", async () => {
    window.history.pushState({}, "", "/login?callbackUrl=%2F%2Fevil.com");
    const { pushMock } = setupRouterMock();
    vi.mocked(signIn).mockResolvedValueOnce({ error: null, ok: true, status: 200, url: null });
    render(<LoginPage />);
    await fillAndSubmit();
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/projects");
    });
  });

  it("rejects a callbackUrl using tab-normalization to smuggle //evil.com", async () => {
    window.history.pushState({}, "", "/login?callbackUrl=%2F%09%2Fevil.com");
    const { pushMock } = setupRouterMock();
    vi.mocked(signIn).mockResolvedValueOnce({ error: null, ok: true, status: 200, url: null });
    render(<LoginPage />);
    await fillAndSubmit();
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/projects");
    });
  });

  it("falls back to /projects when callbackUrl is an absolute URL", async () => {
    window.history.pushState({}, "", "/login?callbackUrl=https://evil.com");
    const { pushMock } = setupRouterMock();
    vi.mocked(signIn).mockResolvedValueOnce({ error: null, ok: true, status: 200, url: null });
    render(<LoginPage />);
    await fillAndSubmit();
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/projects");
    });
  });

  // -- Failed login --
  it("shows an inline error on invalid credentials without navigating", async () => {
    window.history.pushState({}, "", "/login");
    const { pushMock } = setupRouterMock();
    vi.mocked(signIn).mockResolvedValueOnce({
      error: "CredentialsSignin",
      ok: false,
      status: 401,
      url: null,
    });
    render(<LoginPage />);
    await fillAndSubmit();
    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("clears the error alert when the user resubmits", async () => {
    window.history.pushState({}, "", "/login");
    setupRouterMock();
    vi.mocked(signIn)
      .mockResolvedValueOnce({ error: "CredentialsSignin", ok: false, status: 401, url: null })
      .mockResolvedValueOnce({ error: null, ok: true, status: 200, url: null });
    render(<LoginPage />);
    await fillAndSubmit();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
