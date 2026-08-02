import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { useSession } from "next-auth/react";
import { ProfileForm } from "@/app/(dashboard)/settings/_components/profile-form";
import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { mockSession } from "@/tests/mocks/next-auth";
import { renderUI } from "../../helpers/render";
import {
  wireCapturableMutation,
  mockMutationError,
  mockMutationState,
} from "../../helpers/mutation";
import { mockUseQuery } from "@/tests/support/trpc";

// -- Module mocks --

vi.mock("@/components/common/user-avatar", () => ({
  UserAvatar: ({ user }: { user: { name?: string | null } }) => (
    <span data-testid="user-avatar">{user.name ?? "?"}</span>
  ),
}));

// -- Fixtures --
interface MeShape {
  id: string;
  name: string;
  email: string;
  image: string;
}

const MOCK_ME: MeShape = {
  id: mockSession.user.id,
  name: "Alice Smith",
  email: "alice@taskflow.dev",
  image: "https://cdn.example.com/avatar.png",
};

// -- Helpers --
let updateMutation: ReturnType<typeof wireCapturableMutation>;
let mockSessionUpdate: ReturnType<
  typeof vi.fn<(data?: unknown) => Promise<typeof mockSession | null>>
>;

function setupMeQuery(data: typeof MOCK_ME | null = MOCK_ME): void {
  mockUseQuery(api.auth.me, data ?? undefined, {
    isLoading: data === null,
    isPending: data === null,
    isSuccess: data !== null,
  });
}

// -- Tests --
describe("ProfileForm", () => {
  beforeEach(() => {
    mockSessionUpdate = vi.fn().mockResolvedValue(mockSession);
    vi.mocked(useSession).mockReturnValue({
      data: mockSession,
      status: "authenticated",
      update: mockSessionUpdate,
    });

    setupMeQuery();

    updateMutation = wireCapturableMutation(api.auth.updateProfile);
  });

  // -- Rendering --

  it("renders the 'Your profile' heading", () => {
    renderUI(<ProfileForm />);

    expect(screen.getByText("Your profile")).toBeInTheDocument();
  });

  it("renders Name and Avatar URL form fields", () => {
    renderUI(<ProfileForm />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Avatar URL")).toBeInTheDocument();
  });

  it("renders the 'Save profile' submit button", () => {
    renderUI(<ProfileForm />);

    expect(screen.getByRole("button", { name: /save profile/i })).toBeInTheDocument();
  });

  it("renders the UserAvatar component", () => {
    renderUI(<ProfileForm />);

    expect(screen.getByTestId("user-avatar")).toBeInTheDocument();
  });

  it("shows the user email from auth.me query", () => {
    renderUI(<ProfileForm />);

    expect(screen.getByText(MOCK_ME.email)).toBeInTheDocument();
  });

  it("shows '…' instead of email while auth.me is pending", () => {
    setupMeQuery(null);
    renderUI(<ProfileForm />);

    expect(screen.getByText("…")).toBeInTheDocument();
  });

  // -- Form hydration from auth.me --

  it("hydrates the Name field with the resolved auth.me name", () => {
    renderUI(<ProfileForm />);

    expect(screen.getByDisplayValue("Alice Smith")).toBeInTheDocument();
  });

  it("hydrates the Avatar URL field with the resolved auth.me image", () => {
    renderUI(<ProfileForm />);

    expect(screen.getByDisplayValue("https://cdn.example.com/avatar.png")).toBeInTheDocument();
  });

  it("does NOT overwrite user edits when isDirty=true and me re-renders", async () => {
    renderUI(<ProfileForm />);

    // Wait for hydration
    expect(screen.getByDisplayValue("Alice Smith")).toBeInTheDocument();

    // User edits the name -> form becomes dirty
    const nameInput = screen.getByDisplayValue("Alice Smith");
    fireEvent.change(nameInput, { target: { value: "Alice Edited" } });

    // Simulate auth.me returning updated data
    setupMeQuery({ ...MOCK_ME, name: "Alice From Server" });

    // The form must keep the user's edit, NOT reset to server value
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByDisplayValue("Alice Edited")).toBeInTheDocument();
  });

  // -- Form submission --

  it("calls updateProfile mutation with the form data on submit", async () => {
    renderUI(<ProfileForm />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Alice Smith")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue("Alice Smith"), {
      target: { value: "Alice Updated" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));

    await waitFor(() => {
      expect(updateMutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Alice Updated" }),
      );
    });
  });

  // -- Success side effects --

  it("shows a 'Profile updated.' toast on mutation success", () => {
    renderUI(<ProfileForm />);
    updateMutation.simulateSuccess(MOCK_ME);

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Profile updated.");
  });

  it("calls session.update with the new name and image on mutation success", () => {
    renderUI(<ProfileForm />);
    updateMutation.simulateSuccess(MOCK_ME);

    expect(mockSessionUpdate).toHaveBeenCalledWith({
      name: MOCK_ME.name,
      image: MOCK_ME.image,
    });
  });

  it("shows 'Profile saved.' success banner when mutation succeeds and form is not dirty", () => {
    mockMutationState(api.auth.updateProfile, updateMutation, { isSuccess: true });
    renderUI(<ProfileForm />);
    expect(screen.getByText("Profile saved.")).toBeInTheDocument();
  });

  // -- Error display --

  it("shows the inline error alert when the mutation is in error state", () => {
    const errorText = "Name must be at least 2 characters.";
    mockMutationError(api.auth.updateProfile, updateMutation, errorText);

    renderUI(<ProfileForm />);

    expect(screen.getByRole("alert")).toHaveTextContent(errorText);
  });

  it("does NOT render an error alert when there is no mutation error", () => {
    renderUI(<ProfileForm />);

    // The success alert with null message won't render - only check for role="alert"
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
