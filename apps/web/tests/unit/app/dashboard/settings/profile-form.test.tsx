import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/common/user-avatar", () => ({
  UserAvatar: () => <div data-testid="avatar" />,
}));

import { api } from "@/lib/trpc/client";
import { useSession } from "next-auth/react";
import { ProfileForm } from "@/app/(dashboard)/settings/_components/profile-form";
import { mockUseMutationResult, mockUseQuery, setupMutationMock } from "@/tests/support/trpc";
import { mockAuthorizedUser } from "@/tests/support/fixtures";

describe("ProfileForm", () => {
  it("renders loading state and then populates fields from auth.me", () => {
    mockUseQuery(api.auth.me, mockAuthorizedUser, { isPending: true });
    render(<ProfileForm />);
    expect(screen.getByText("…")).toBeInTheDocument();
  });

  it("submits updated profile and calls session.update on success", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useSession).mockReturnValue({
      data: { user: mockAuthorizedUser },
      status: "authenticated",
      update: updateMock,
    } as never);

    mockUseQuery(api.auth.me, mockAuthorizedUser);
    const { mutateMock, triggerSuccess } = setupMutationMock(api.auth.updateProfile);

    render(<ProfileForm />);
    const user = userEvent.setup();

    const nameInput = screen.getByLabelText(/name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Alice Updated");
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    expect(mutateMock).toHaveBeenCalledWith(expect.objectContaining({ name: "Alice Updated" }));

    // Simulate server success
    await waitFor(() => {
      triggerSuccess({ id: "u1", name: "Alice Updated", image: null });
    });

    expect(updateMock).toHaveBeenCalledWith({ name: "Alice Updated", image: null });
  });

  it("falls back to an empty object and empty email when auth.me has no data", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: mockAuthorizedUser },
      status: "authenticated",
      update: vi.fn(),
    } as never);
    mockUseQuery(api.auth.me, undefined);
    render(<ProfileForm />);
    expect(screen.getByLabelText(/name/i)).toHaveValue("");
  });

  it("shows the inline error alert when the mutation is in an error state", () => {
    mockUseQuery(api.auth.me, mockAuthorizedUser);
    mockUseMutationResult(api.auth.updateProfile, {
      isError: true,
      error: new Error("Update failed"),
    });
    render(<ProfileForm />);
    expect(screen.getByText("Update failed")).toBeInTheDocument();
  });

  it("does not reset the form when the user is mid-edit (isDirty) and auth.me updates", async () => {
    mockUseQuery(api.auth.me, mockAuthorizedUser);
    const { rerender } = render(<ProfileForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/name/i), " Extra");
    mockUseQuery(api.auth.me, {
      ...mockAuthorizedUser,
      name: "Server Updated",
    });
    rerender(<ProfileForm />);
    expect(screen.getByLabelText(/name/i)).toHaveValue(`${mockAuthorizedUser.name} Extra`);
  });

  it("falls back to an empty string when auth.me's name is null", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: mockAuthorizedUser },
      status: "authenticated",
      update: vi.fn(),
    } as never);
    mockUseQuery(api.auth.me, { ...mockAuthorizedUser, name: null });
    render(<ProfileForm />);
    expect(screen.getByLabelText(/name/i)).toHaveValue("");
  });
});
