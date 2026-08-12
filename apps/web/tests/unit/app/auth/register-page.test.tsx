import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import RegisterPage from "@/app/(auth)/register/page";
import { api } from "@/lib/trpc/client";
import { validRegisterPayload } from "@/tests/support/fixtures";

type RegisterMutation = ReturnType<typeof api.auth.register.useMutation>;

/**
 * Builds a minimal register mutation mock and casts it at the mock-library
 * boundary - `trpc-api.tsx`'s hand-rolled mock has no reason to satisfy
 * tRPC v11's full `UseTRPCMutationResult` shape (the real `trpc` metadata
 * field), only the handful of fields this page actually reads.
 */
function mockRegisterMutation(overrides: {
  mutate?: ReturnType<typeof vi.fn>;
  isPending?: boolean;
  isError?: boolean;
  isSuccess?: boolean;
  error?: { message: string } | null;
  data?: { message: string };
}): RegisterMutation {
  return {
    mutate: overrides.mutate ?? vi.fn(),
    mutateAsync: vi.fn(),
    isPending: overrides.isPending ?? false,
    isError: overrides.isError ?? false,
    isSuccess: overrides.isSuccess ?? false,
    error: overrides.error ?? null,
    data: overrides.data,
    reset: vi.fn(),
  } as unknown as RegisterMutation;
}

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
  it("shows client-side validation errors without calling the mutation", async () => {
    const mutate = vi.fn();
    vi.mocked(api.auth.register.useMutation).mockReturnValue(mockRegisterMutation({ mutate }));
    render(<RegisterPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("shows a validation error when passwords do not match", async () => {
    const mutate = vi.fn();
    vi.mocked(api.auth.register.useMutation).mockReturnValue(mockRegisterMutation({ mutate }));
    render(<RegisterPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^name$/i), validRegisterPayload.name);
    await user.type(screen.getByLabelText(/^email$/i), validRegisterPayload.email);
    await user.type(screen.getByLabelText(/^password$/i), validRegisterPayload.password);
    await user.type(screen.getByLabelText(/^confirm password$/i), "Different1!Password");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("calls the mutation with the submitted fields", async () => {
    const mutate = vi.fn();
    vi.mocked(api.auth.register.useMutation).mockReturnValue(mockRegisterMutation({ mutate }));
    render(<RegisterPage />);
    await fillAndSubmitRegister();
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        name: validRegisterPayload.name,
        email: validRegisterPayload.email,
        password: validRegisterPayload.password,
        confirmPassword: validRegisterPayload.confirmPassword,
      });
    });
  });

  it("shows the 'check your email' confirmation once the mutation succeeds", () => {
    vi.mocked(api.auth.register.useMutation).mockReturnValue(
      mockRegisterMutation({ isSuccess: true, data: { message: "Check your email." } }),
    );
    render(<RegisterPage />);
    expect(screen.getByRole("heading", { name: /check your email/i })).toBeInTheDocument();
    // The form itself is replaced by the confirmation - no lingering fields.
    expect(screen.queryByLabelText(/^name$/i)).not.toBeInTheDocument();
  });

  it("shows the server's error message when the mutation fails", () => {
    vi.mocked(api.auth.register.useMutation).mockReturnValue(
      mockRegisterMutation({
        isError: true,
        error: { message: "An account with that email already exists." },
      }),
    );
    render(<RegisterPage />);
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
  });
});
