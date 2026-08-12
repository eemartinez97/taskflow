import { describe, it, expect } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { api } from "@/lib/trpc/client";
import ForgotPasswordPage from "@/app/(auth)/forgot-password/page";
import { renderUI } from "../../helpers/render";
import {
  wireCapturableMutation,
  mockMutationState,
  mockMutationError,
} from "../../helpers/mutation";
import { VALID_FORGOT_PASSWORD_PAYLOAD } from "../../helpers/mock-data";

describe("ForgotPasswordPage", () => {
  it("renders the heading and email field", () => {
    wireCapturableMutation(api.auth.requestPasswordReset);
    renderUI(<ForgotPasswordPage />);
    expect(screen.getByRole("heading", { name: /forgot your password/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("shows a validation error for an invalid email", async () => {
    const mutation = wireCapturableMutation(api.auth.requestPasswordReset);
    renderUI(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });
    expect(mutation.mutate).not.toHaveBeenCalled();
  });

  it("calls the mutation with the submitted email", async () => {
    const mutation = wireCapturableMutation(api.auth.requestPasswordReset);
    renderUI(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: VALID_FORGOT_PASSWORD_PAYLOAD.email },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    await waitFor(() => {
      expect(mutation.mutate).toHaveBeenCalledWith(VALID_FORGOT_PASSWORD_PAYLOAD);
    });
  });

  it("shows the generic confirmation once the mutation succeeds", () => {
    const mutation = wireCapturableMutation(api.auth.requestPasswordReset);
    mockMutationState(api.auth.requestPasswordReset, mutation, { isSuccess: true });
    renderUI(<ForgotPasswordPage />);
    expect(screen.getByRole("heading", { name: /check your email/i })).toBeInTheDocument();
  });

  it("shows the server error when the mutation is rate limited", () => {
    const mutation = wireCapturableMutation(api.auth.requestPasswordReset);
    mockMutationError(
      api.auth.requestPasswordReset,
      mutation,
      "Too many requests. Please try again later.",
    );
    renderUI(<ForgotPasswordPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(/too many requests/i);
  });

  it("renders a link back to the login page", () => {
    wireCapturableMutation(api.auth.requestPasswordReset);
    renderUI(<ForgotPasswordPage />);
    expect(screen.getByRole("link", { name: /back to sign in/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
