import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import OnboardingForm from "@/app/(auth)/onboarding/_components/onboarding-form";
import { api } from "@/lib/trpc/client";
import { setActiveOrgId } from "@/lib/utils/active-org";
import { deriveSlug } from "@/lib/utils/derive";
import { renderUI } from "../../helpers/render";
import {
  wireCapturableMutation,
  mockMutationError,
  mockMutationState,
} from "../../helpers/mutation";
import { mockApiUtils } from "@/tests/support/trpc";
import { setupRouterMock } from "@/tests/support/render";

// -- Module mocks --

vi.mock("@/lib/utils/active-org", () => ({
  setActiveOrgId: vi.fn<(id: string) => void>(),
  clearActiveOrgId: vi.fn(),
  readActiveOrgId: vi.fn(() => null),
  subscribeActiveOrg: vi.fn(() => () => undefined),
  getServerActiveOrgId: vi.fn(() => null),
  ACTIVE_ORG_COOKIE: "taskflow.activeOrgId",
}));

// -- Fixtures --
const MOCK_NEW_ORG = {
  id: "org-new-uuid",
  name: "Acme Corp",
  slug: "acme-corp",
} as const;

// -- Helpers --

let mockInvalidateOrgsList: ReturnType<typeof vi.fn>;
let createMutation: ReturnType<typeof wireCapturableMutation>;

// -- Tests --
describe("OnboardingForm", () => {
  const { router: mockRouter } = setupRouterMock();

  beforeEach(() => {
    mockInvalidateOrgsList = vi.fn();
    mockApiUtils({ orgs: { list: { invalidate: mockInvalidateOrgsList } } });
    createMutation = wireCapturableMutation(api.orgs.create);
  });

  // -- Rendering --

  it("renders the 'Create your organization' heading", () => {
    renderUI(<OnboardingForm />);

    expect(screen.getByRole("heading", { name: /create your organization/i })).toBeInTheDocument();
  });

  it("renders the sub-heading description text", () => {
    renderUI(<OnboardingForm />);

    expect(screen.getByText(/groups your projects and team members/i)).toBeInTheDocument();
  });

  it("renders empty Name and Slug fields on mount", () => {
    renderUI(<OnboardingForm />);

    expect(screen.getByPlaceholderText("Acme Corp")).toHaveValue("");
    expect(screen.getByPlaceholderText("acme-corp")).toHaveValue("");
  });

  it("renders the 'Create Organization' submit button", () => {
    renderUI(<OnboardingForm />);

    expect(screen.getByRole("button", { name: /create organization/i })).toBeInTheDocument();
  });

  // -- Slug auto-derivation --

  it("auto-derives the slug from the name while the slug field is untouched", () => {
    renderUI(<OnboardingForm />);

    fireEvent.change(screen.getByPlaceholderText("Acme Corp"), {
      target: { value: "Acme Corp" },
    });

    expect(screen.getByPlaceholderText("acme-corp")).toHaveValue(deriveSlug("Acme Corp"));
  });

  it("derives the slug correctly for names with special characters", () => {
    renderUI(<OnboardingForm />);

    fireEvent.change(screen.getByPlaceholderText("Acme Corp"), {
      target: { value: "Café & Co." },
    });

    expect(screen.getByPlaceholderText("acme-corp")).toHaveValue(deriveSlug("Café & Co."));
  });

  it("updates the derived slug when the name changes a second time", () => {
    renderUI(<OnboardingForm />);

    fireEvent.change(screen.getByPlaceholderText("Acme Corp"), {
      target: { value: "First Name" },
    });
    expect(screen.getByPlaceholderText("acme-corp")).toHaveValue(deriveSlug("First Name"));

    fireEvent.change(screen.getByPlaceholderText("Acme Corp"), {
      target: { value: "Second Name" },
    });
    expect(screen.getByPlaceholderText("acme-corp")).toHaveValue(deriveSlug("Second Name"));
  });

  it("stops overwriting the slug after the user edits it directly", () => {
    renderUI(<OnboardingForm />);

    // User manually edits slug -> marks it dirty
    fireEvent.change(screen.getByPlaceholderText("acme-corp"), {
      target: { value: "my-custom-slug" },
    });

    // Typing a new name must NOT change the slug now
    fireEvent.change(screen.getByPlaceholderText("Acme Corp"), {
      target: { value: "Something Completely Different" },
    });

    expect(screen.getByPlaceholderText("acme-corp")).toHaveValue("my-custom-slug");
  });

  it("still derives the slug when the slug field has only been programmatically set (not user-dirty)", () => {
    renderUI(<OnboardingForm />);

    // First name change -> slug auto-derived (programmatic, not user dirty)
    fireEvent.change(screen.getByPlaceholderText("Acme Corp"), {
      target: { value: "Acme Corp" },
    });
    expect(screen.getByPlaceholderText("acme-corp")).toHaveValue(deriveSlug("Acme Corp"));

    // Second name change -> slug should still update (not user-dirty)
    fireEvent.change(screen.getByPlaceholderText("Acme Corp"), {
      target: { value: "Globex" },
    });
    expect(screen.getByPlaceholderText("acme-corp")).toHaveValue(deriveSlug("Globex"));
  });

  // -- Validation --

  it("shows validation errors and does NOT call mutate when fields are empty", async () => {
    renderUI(<OnboardingForm />);
    fireEvent.click(screen.getByRole("button", { name: /create organization/i }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    });
    expect(createMutation.mutate).not.toHaveBeenCalled();
  });

  it("shows a name validation error when the name is too short", async () => {
    renderUI(<OnboardingForm />);

    fireEvent.change(screen.getByPlaceholderText("Acme Corp"), {
      target: { value: "A" },
    });
    fireEvent.change(screen.getByPlaceholderText("acme-corp"), {
      target: { value: "a" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create organization/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(createMutation.mutate).not.toHaveBeenCalled();
  });

  // -- Form submission --

  it("calls mutation.mutate with the name and slug from the form on submit", async () => {
    renderUI(<OnboardingForm />);

    fireEvent.change(screen.getByPlaceholderText("Acme Corp"), {
      target: { value: "Acme Corp" },
    });
    fireEvent.change(screen.getByPlaceholderText("acme-corp"), {
      target: { value: "acme-corp" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create organization/i }));

    await waitFor(() => {
      expect(createMutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Acme Corp", slug: "acme-corp" }),
      );
    });
  });

  it("submits successfully with an auto-derived slug (no manual slug entry required)", async () => {
    renderUI(<OnboardingForm />);

    fireEvent.change(screen.getByPlaceholderText("Acme Corp"), {
      target: { value: "Acme Corp" },
    });
    // Do NOT touch the slug field - let it auto-derive
    fireEvent.click(screen.getByRole("button", { name: /create organization/i }));

    await waitFor(() => {
      expect(createMutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Acme Corp",
          slug: deriveSlug("Acme Corp"),
        }),
      );
    });
  });

  // -- Loading state --

  it("disables the submit button when the mutation is pending", () => {
    mockMutationState(api.orgs.create, createMutation, { isPending: true });
    renderUI(<OnboardingForm />);
    expect(screen.getByRole("button", { name: /create organization/i })).toBeDisabled();
  });

  // -- Success side effects --

  it("calls setActiveOrgId with the new org's id on mutation success", () => {
    renderUI(<OnboardingForm />);
    createMutation.simulateSuccess(MOCK_NEW_ORG);
    expect(vi.mocked(setActiveOrgId)).toHaveBeenCalledWith(MOCK_NEW_ORG.id);
  });

  it("invalidates orgs.list on mutation success", () => {
    renderUI(<OnboardingForm />);
    createMutation.simulateSuccess(MOCK_NEW_ORG);
    expect(mockInvalidateOrgsList).toHaveBeenCalled();
  });

  it("navigates to /projects on mutation success", () => {
    renderUI(<OnboardingForm />);
    createMutation.simulateSuccess(MOCK_NEW_ORG);
    expect(mockRouter.push).toHaveBeenCalledWith("/projects");
  });

  it("calls setActiveOrgId BEFORE invalidating the list so the new org is selected immediately", () => {
    const callOrder: string[] = [];
    vi.mocked(setActiveOrgId).mockImplementation(() => {
      callOrder.push("setActiveOrgId");
    });
    mockInvalidateOrgsList.mockImplementation(() => {
      callOrder.push("invalidate");
    });

    renderUI(<OnboardingForm />);
    createMutation.simulateSuccess(MOCK_NEW_ORG);

    expect(callOrder).toEqual(["setActiveOrgId", "invalidate"]);
  });

  // -- Error display --

  it("shows the inline error alert when the mutation is in error state", () => {
    const errorText = "An organization with that slug already exists.";
    mockMutationError(api.orgs.create, createMutation, errorText);
    renderUI(<OnboardingForm />);
    expect(screen.getByRole("alert")).toHaveTextContent(errorText);
  });

  it("does NOT render an alert when there is no mutation error", () => {
    renderUI(<OnboardingForm />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
