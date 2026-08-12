import { describe, it, expect } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/trpc/client";
import { RegisterForm } from "@/app/(auth)/register/_components/register-form";
import { renderUI } from "../../helpers/render";
import {
  wireCapturableMutation,
  mockMutationState,
  mockMutationError,
} from "../../helpers/mutation";
import { validRegisterPayload } from "@/tests/support/fixtures";

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

describe("RegisterForm", () => {
  it("shows client-side validation errors without calling the mutation", async () => {
    const mutation = wireCapturableMutation(api.auth.register);
    renderUI(<RegisterForm inviteToken={null} invitePreview={null} />);
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(mutation.mutate).not.toHaveBeenCalled();
  });

  it("shows a validation error when passwords do not match", async () => {
    const mutation = wireCapturableMutation(api.auth.register);
    renderUI(<RegisterForm inviteToken={null} invitePreview={null} />);
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: validRegisterPayload.name },
    });
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: validRegisterPayload.email },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: validRegisterPayload.password },
    });
    fireEvent.change(screen.getByLabelText(/^confirm password$/i), {
      target: { value: "Different1!Password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
    expect(mutation.mutate).not.toHaveBeenCalled();
  });

  it("calls the mutation with the form's values on submit", async () => {
    const mutation = wireCapturableMutation(api.auth.register);
    renderUI(<RegisterForm inviteToken={null} invitePreview={null} />);
    await fillAndSubmitRegister();
    await waitFor(() => {
      expect(mutation.mutate).toHaveBeenCalledWith(validRegisterPayload);
    });
  });

  it("shows the 'check your email' confirmation once the mutation succeeds", () => {
    const mutation = wireCapturableMutation(api.auth.register);
    mockMutationState(api.auth.register, mutation, { isSuccess: true });
    renderUI(<RegisterForm inviteToken={null} invitePreview={null} />);
    expect(screen.getByRole("heading", { name: /check your email/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^name$/i)).not.toBeInTheDocument();
  });

  it("shows the 'already exists' error for a fully registered email (CONFLICT)", () => {
    const mutation = wireCapturableMutation(api.auth.register);
    mockMutationError(api.auth.register, mutation, "An account with that email already exists.");
    renderUI(<RegisterForm inviteToken={null} invitePreview={null} />);
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /check your email/i })).not.toBeInTheDocument();
  });

  it("shows the server's error message for any other mutation error", () => {
    const mutation = wireCapturableMutation(api.auth.register);
    mockMutationError(api.auth.register, mutation, "Something specific broke.");
    renderUI(<RegisterForm inviteToken={null} invitePreview={null} />);
    expect(screen.getByText("Something specific broke.")).toBeInTheDocument();
  });

  // -- Invite-specific behavior --

  it("renders the invite banner and a readOnly, prefilled email when opened from an invite link", () => {
    wireCapturableMutation(api.auth.register);
    renderUI(
      <RegisterForm
        inviteToken="raw-token"
        invitePreview={{ email: "invitee@example.com", orgName: "Acme", role: "ADMIN" }}
      />,
    );
    expect(screen.getByText(/you've been invited to join/i)).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    const emailInput = screen.getByLabelText(/^email$/i);
    expect(emailInput).toHaveValue("invitee@example.com");
    expect(emailInput).toHaveAttribute("readonly");
  });

  it("does not render the invite banner or readOnly email without an invite", () => {
    wireCapturableMutation(api.auth.register);
    renderUI(<RegisterForm inviteToken={null} invitePreview={null} />);
    expect(screen.queryByText(/you've been invited/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).not.toHaveAttribute("readonly");
  });

  it("shows a 'sign in to accept' link on a CONFLICT error when an invite token is present", () => {
    const mutation = wireCapturableMutation(api.auth.register);
    mockMutationState(api.auth.register, mutation, {
      isError: true,
      error: {
        message: "An account with that email already exists.",
        data: { code: "CONFLICT" },
      } as never,
    });
    renderUI(
      <RegisterForm
        inviteToken="raw-token"
        invitePreview={{ email: "invitee@example.com", orgName: "Acme", role: "ADMIN" }}
      />,
    );
    const link = screen.getByRole("link", { name: /sign in to accept this invitation/i });
    expect(link).toHaveAttribute("href", "/login?callbackUrl=%2Finvitations%2Fraw-token");
  });

  it("does not show the 'sign in to accept' link for a CONFLICT with no invite token", () => {
    const mutation = wireCapturableMutation(api.auth.register);
    mockMutationState(api.auth.register, mutation, {
      isError: true,
      error: {
        message: "An account with that email already exists.",
        data: { code: "CONFLICT" },
      } as never,
    });
    renderUI(<RegisterForm inviteToken={null} invitePreview={null} />);
    expect(
      screen.queryByRole("link", { name: /sign in to accept this invitation/i }),
    ).not.toBeInTheDocument();
  });

  it("does not show the 'sign in to accept' link for a non-CONFLICT error even with an invite token", () => {
    const mutation = wireCapturableMutation(api.auth.register);
    mockMutationError(api.auth.register, mutation, "Something specific broke.");
    renderUI(
      <RegisterForm
        inviteToken="raw-token"
        invitePreview={{ email: "invitee@example.com", orgName: "Acme", role: "ADMIN" }}
      />,
    );
    expect(
      screen.queryByRole("link", { name: /sign in to accept this invitation/i }),
    ).not.toBeInTheDocument();
  });
});
