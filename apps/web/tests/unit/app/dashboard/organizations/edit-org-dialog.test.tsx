import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { EditOrgDialog } from "@/app/(dashboard)/organizations/_components/edit-org-dialog";
import { makeOrg } from "@/tests/support/factories";
import { mockUseMutationResult, setupMutationMock } from "@/tests/support/trpc";

const org = makeOrg({ name: "Acme Corp", slug: "acme-corp" });

describe("EditOrgDialog", () => {
  it("renders nothing while closed", () => {
    render(<EditOrgDialog org={org} open={false} onClose={vi.fn()} />);
    expect(screen.queryByText(/edit organization/i)).not.toBeInTheDocument();
  });

  it("pre-fills the form with the org's current name and slug", () => {
    render(<EditOrgDialog org={org} open onClose={vi.fn()} />);
    expect(screen.getByLabelText(/^name$/i)).toHaveValue("Acme Corp");
    expect(screen.getByLabelText(/^slug$/i)).toHaveValue("acme-corp");
  });

  it("resets the form when a different org opens", () => {
    const { rerender } = render(<EditOrgDialog org={org} open onClose={vi.fn()} />);
    const otherOrg = makeOrg({ id: "org-2", name: "Other Org", slug: "other-org" });
    rerender(<EditOrgDialog org={otherOrg} open onClose={vi.fn()} />);
    expect(screen.getByLabelText(/^name$/i)).toHaveValue("Other Org");
  });

  it("submits the update mutation with orgId and the form data", async () => {
    const { mutateMock } = setupMutationMock(api.orgs.update);
    render(<EditOrgDialog org={org} open onClose={vi.fn()} />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText(/^name$/i));
    await user.type(screen.getByLabelText(/^name$/i), "Renamed Org");
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(mutateMock).toHaveBeenCalledWith({
      orgId: org.id,
      data: { name: "Renamed Org", slug: "acme-corp" },
    });
  });

  it("shows a success toast, invalidates the list, and closes on success", () => {
    const onClose = vi.fn();
    const { triggerSuccess } = setupMutationMock(api.orgs.update);
    render(<EditOrgDialog org={org} open onClose={onClose} />);

    act(() => {
      triggerSuccess();
    });

    expect(toast.success).toHaveBeenCalledWith("Organization updated.");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders the mutation error inline", () => {
    mockUseMutationResult(api.orgs.update, {
      isError: true,
      error: new Error("Slug conflict."),
    });
    render(<EditOrgDialog org={org} open onClose={vi.fn()} />);
    expect(screen.getByText("Slug conflict.")).toBeInTheDocument();
  });

  it("Cancel resets the form to the org's values and closes", async () => {
    const onClose = vi.fn();
    render(<EditOrgDialog org={org} open onClose={onClose} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
