import { describe, it, expect } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { api } from "@/lib/trpc/client";
import { ResetPasswordForm } from "@/app/(auth)/reset-password/_components/reset-password-form";
import { renderUI } from "../../helpers/render";
import { setupRouterMock } from "@/tests/support/render";
import {
  wireCapturableMutation,
  mockMutationState,
  mockMutationError,
} from "../../helpers/mutation";
import { MOCK_RESET_RAW_TOKEN, VALID_RESET_PASSWORD_PAYLOAD } from "../../helpers/mock-data";

function fillForm(password = VALID_RESET_PASSWORD_PAYLOAD.password): void {
  fireEvent.change(screen.getByLabelText("New Password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: password } });
}

describe("ResetPasswordForm", () => {
  const { router: mockRouter } = setupRouterMock();

  it("renders new-password and confirm-password fields", () => {
    wireCapturableMutation(api.auth.resetPassword);
    renderUI(<ResetPasswordForm token={MOCK_RESET_RAW_TOKEN} />);
    expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm New Password")).toBeInTheDocument();
  });

  it("shows a validation error when passwords do not match", async () => {
    const mutation = wireCapturableMutation(api.auth.resetPassword);
    renderUI(<ResetPasswordForm token={MOCK_RESET_RAW_TOKEN} />);
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "Str0ng!Pass1" } });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "Different1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
    await waitFor(() => {
      expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    });
    expect(mutation.mutate).not.toHaveBeenCalled();
  });

  it("calls the mutation with the token and new password", async () => {
    const mutation = wireCapturableMutation(api.auth.resetPassword);
    renderUI(<ResetPasswordForm token={MOCK_RESET_RAW_TOKEN} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
    await waitFor(() => {
      expect(mutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          token: MOCK_RESET_RAW_TOKEN,
          password: VALID_RESET_PASSWORD_PAYLOAD.password,
        }),
      );
    });
  });

  it("redirects to /login?reset=1 once the mutation succeeds", async () => {
    const mutation = wireCapturableMutation(api.auth.resetPassword);
    renderUI(<ResetPasswordForm token={MOCK_RESET_RAW_TOKEN} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      mutation.simulateSuccess({ message: "Password updated." });
    });

    expect(mockRouter.push).toHaveBeenCalledWith("/login?reset=1");
  });

  it("shows the server error when the token is expired", () => {
    const mutation = wireCapturableMutation(api.auth.resetPassword);
    mockMutationError(
      api.auth.resetPassword,
      mutation,
      "This reset link is invalid or has expired.",
    );
    renderUI(<ResetPasswordForm token={MOCK_RESET_RAW_TOKEN} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/invalid or has expired/i);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("disables the submit button while the mutation is pending", () => {
    const mutation = wireCapturableMutation(api.auth.resetPassword);
    mockMutationState(api.auth.resetPassword, mutation, { isPending: true });
    renderUI(<ResetPasswordForm token={MOCK_RESET_RAW_TOKEN} />);
    expect(screen.getByRole("button", { name: /reset password/i })).toBeDisabled();
  });

  it("keeps the submit button enabled when the mutation is not pending", () => {
    wireCapturableMutation(api.auth.resetPassword);
    renderUI(<ResetPasswordForm token={MOCK_RESET_RAW_TOKEN} />);
    expect(screen.getByRole("button", { name: /reset password/i })).not.toBeDisabled();
  });
});
