import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { signIn } from "next-auth/react";
import LoginPage from "@/app/(auth)/login/page";
import { validLoginCredentials } from "@/tests/support/fixtures";
import { setupRouterMock } from "@/tests/support/render";

async function fillAndSubmit(): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/email/i), validLoginCredentials.email);
  await user.type(screen.getByLabelText(/password/i), validLoginCredentials.password);
  await user.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("LoginPage", () => {
  it("redirects to /projects by default on successful sign-in", async () => {
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

  it("shows an inline error on invalid credentials without navigating", async () => {
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
});
