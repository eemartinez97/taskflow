import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { signIn } from "next-auth/react";
import RegisterPage from "@/app/(auth)/register/page";
import { validRegisterPayload } from "@/tests/support/fixtures";
import { setupRouterMock } from "@/tests/support/render";
import { mockFetchResponse, setupFetchSpy, teardownFetchSpy } from "@/tests/support/http";

async function fillAndSubmitRegister(): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^name$/i), validRegisterPayload.name);
  await user.type(screen.getByLabelText(/^email$/i), validRegisterPayload.email);
  await user.type(screen.getByLabelText(/^password$/i), validRegisterPayload.password);
  await user.type(screen.getByLabelText(/confirm password/i), validRegisterPayload.confirmPassword);
  await user.click(screen.getByRole("button", { name: /create account/i }));
}

describe("RegisterPage", () => {
  it("shows client-side validation errors without calling fetch", async () => {
    setupRouterMock();
    const fetchSpy = setupFetchSpy();
    render(<RegisterPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    teardownFetchSpy();
  });

  it("submits the form and redirects to /projects on full success", async () => {
    const { pushMock } = setupRouterMock();
    const fetchSpy = setupFetchSpy(mockFetchResponse({ user: { id: "u1" } }, 201));
    vi.mocked(signIn).mockResolvedValueOnce({ error: null, ok: true, status: 200, url: null });

    render(<RegisterPage />);
    await fillAndSubmitRegister();

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/projects");
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/auth/register",
      expect.objectContaining({ method: "POST" }),
    );
    teardownFetchSpy();
  });

  it("proceeds to /projects when signIn resolves without an error field", async () => {
    const { pushMock } = setupRouterMock();
    setupFetchSpy(mockFetchResponse({ user: { id: "u1" } }, 201));
    vi.mocked(signIn).mockResolvedValueOnce(undefined);
    render(<RegisterPage />);
    await fillAndSubmitRegister();
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/projects");
    });
    teardownFetchSpy();
  });

  it("shows an inline error and does not sign in when the email is already registered", async () => {
    setupRouterMock();
    setupFetchSpy(mockFetchResponse({ error: "taken" }, 409));

    render(<RegisterPage />);
    await fillAndSubmitRegister();

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
    teardownFetchSpy();
  });

  it("shows the server's error message for other non-OK responses", async () => {
    setupRouterMock();
    setupFetchSpy(mockFetchResponse({ error: "Something specific broke." }, 400));

    render(<RegisterPage />);
    await fillAndSubmitRegister();

    expect(await screen.findByText("Something specific broke.")).toBeInTheDocument();
    teardownFetchSpy();
  });

  it("falls back to the default error message when the response body has no error field", async () => {
    setupRouterMock();
    setupFetchSpy(mockFetchResponse({}, 500));
    render(<RegisterPage />);
    await fillAndSubmitRegister();
    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
    teardownFetchSpy();
  });

  it("redirects to /login when signIn fails after a successful registration", async () => {
    const { pushMock } = setupRouterMock();
    setupFetchSpy(mockFetchResponse({ user: { id: "u1" } }, 201));
    vi.mocked(signIn).mockResolvedValueOnce({
      error: "CredentialsSignin",
      ok: false,
      status: 401,
      url: null,
    });

    render(<RegisterPage />);
    await fillAndSubmitRegister();

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/login");
    });
    teardownFetchSpy();
  });
});
