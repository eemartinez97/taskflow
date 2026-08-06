import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import RegisterPage from "@/app/(auth)/register/page";
import { validRegisterPayload } from "@/tests/support/fixtures";
import { setupRouterMock } from "@/tests/support/render";
import { mockFetchResponse, setupFetchSpy, teardownFetchSpy } from "@/tests/support/http";

async function fillAndSubmitRegister(): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^name$/i), validRegisterPayload.name);
  await user.type(screen.getByLabelText(/^email$/i), validRegisterPayload.email);
  await user.type(screen.getByLabelText(/^password$/i), validRegisterPayload.password);
  await user.type(
    screen.getByLabelText(/^confirm password$/i),
    validRegisterPayload.confirmPassword,
  );
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

  it("shows a validation error when passwords do not match", async () => {
    setupRouterMock();
    const fetchSpy = setupFetchSpy();
    render(<RegisterPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^name$/i), validRegisterPayload.name);
    await user.type(screen.getByLabelText(/^email$/i), validRegisterPayload.email);
    await user.type(screen.getByLabelText(/^password$/i), validRegisterPayload.password);
    await user.type(screen.getByLabelText(/^confirm password$/i), "Different1!Password");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    teardownFetchSpy();
  });

  it("submits the form and shows the 'check your email' confirmation on success", async () => {
    setupRouterMock();
    const fetchSpy = setupFetchSpy(mockFetchResponse({ message: "Check your email." }, 201));
    render(<RegisterPage />);
    await fillAndSubmitRegister();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /check your email/i })).toBeInTheDocument();
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/auth/register",
      expect.objectContaining({ method: "POST" }),
    );
    // The form itself is replaced by the confirmation - no lingering fields.
    expect(screen.queryByLabelText(/^name$/i)).not.toBeInTheDocument();
    teardownFetchSpy();
  });

  it("shows the 'already exists' error for a fully registered email (409)", async () => {
    setupRouterMock();
    setupFetchSpy(mockFetchResponse({ error: "taken" }, 409));
    render(<RegisterPage />);
    await fillAndSubmitRegister();
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /check your email/i })).not.toBeInTheDocument();
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
});
