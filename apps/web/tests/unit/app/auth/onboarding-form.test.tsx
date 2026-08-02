import { render, screen, act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { api } from "@/lib/trpc/client";
import OnboardingForm from "@/app/(auth)/onboarding/_components/onboarding-form";
import userEvent from "@testing-library/user-event";
import { setupRouterMock } from "@/tests/support/render";
import { mockUseMutationResult, setupMutationMock } from "@/tests/support/trpc";

describe("OnboardingForm", () => {
  it("renders correctly", () => {
    render(<OnboardingForm />);
    expect(screen.getByText("Create your organization")).toBeInTheDocument();
  });

  it("submits and redirects on success", async () => {
    const { pushMock } = setupRouterMock();
    const { mutateMock, triggerSuccess } = setupMutationMock(api.orgs.create);

    render(<OnboardingForm />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/name/i), "Acme Corp");
    await user.click(screen.getByRole("button", { name: /create organization/i }));

    expect(mutateMock).toHaveBeenCalledWith({ name: "Acme Corp", slug: "acme-corp" });

    act(() => {
      triggerSuccess({ id: "org-1", name: "Acme Corp", slug: "acme-corp" });
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/projects");
    });
  });

  it("does not override a manually-edited slug when the name changes afterwards", async () => {
    render(<OnboardingForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/slug/i), "custom-slug");
    await user.type(screen.getByLabelText(/^name$/i), "Acme Corp");
    expect(screen.getByLabelText(/slug/i)).toHaveValue("custom-slug");
  });

  it("shows validation errors when submitted empty", async () => {
    render(<OnboardingForm />);
    await userEvent.setup().click(screen.getByRole("button", { name: /create organization/i }));
    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
  });

  it("shows the inline error message when the mutation is in an error state", () => {
    mockUseMutationResult(api.orgs.create, {
      isError: true,
      error: new Error("Slug already taken"),
    });
    render(<OnboardingForm />);
    expect(screen.getByText("Slug already taken")).toBeInTheDocument();
  });
});
