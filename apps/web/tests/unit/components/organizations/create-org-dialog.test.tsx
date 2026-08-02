import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/lib/trpc/client";
import { CreateOrgDialog } from "@/components/organizations/create-org-dialog";
import { mockUseMutationResult, setupMutationMock } from "@/tests/support/trpc";

describe("CreateOrgDialog", () => {
  it("renders nothing (null) while closed", () => {
    render(<CreateOrgDialog open={false} onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.queryByText(/create organization/i)).not.toBeInTheDocument();
  });

  it("auto-derives the slug from the name until the user edits it directly", async () => {
    render(<CreateOrgDialog open onClose={vi.fn()} onCreated={vi.fn()} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^name$/i), "Acme Corp");
    expect(screen.getByLabelText(/^slug$/i)).toHaveValue("acme-corp");
  });

  it("submits the form and calls onCreated with the new org id", async () => {
    const onCreated = vi.fn();
    const { mutateMock, triggerSuccess } = setupMutationMock(api.orgs.create);
    render(<CreateOrgDialog open onClose={vi.fn()} onCreated={onCreated} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^name$/i), "Acme Corp");
    await user.clear(screen.getByLabelText(/^slug$/i));
    await user.type(screen.getByLabelText(/^slug$/i), "acme-corp");
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    expect(mutateMock).toHaveBeenCalledWith({ name: "Acme Corp", slug: "acme-corp" });

    act(() => {
      triggerSuccess({ id: "new-org-id" });
    });

    expect(onCreated).toHaveBeenCalled();
  });

  it("resets the form and calls onClose when Cancel is clicked", async () => {
    const onClose = vi.fn();
    render(<CreateOrgDialog open onClose={onClose} onCreated={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders the mutation's error message inline", () => {
    mockUseMutationResult(api.orgs.create, {
      isError: true,
      error: new Error("Slug already taken."),
    });
    render(<CreateOrgDialog open onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.getByText("Slug already taken.")).toBeInTheDocument();
  });
});
