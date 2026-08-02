import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { EditProjectDialog } from "@/app/(dashboard)/projects/_components/edit-project-dialog";
import { makeProject } from "@/tests/support/factories";
import { VALID_ORG_ID } from "@/tests/support/fixtures";
import { mockUseMutationResult, setupMutationMock } from "@/tests/support/trpc";

const project = makeProject({ name: "Demo", key: "DEMO", slug: "demo-project" });

describe("EditProjectDialog", () => {
  it("pre-fills name/key/slug from the project", () => {
    render(<EditProjectDialog project={project} orgId={VALID_ORG_ID} open onClose={vi.fn()} />);
    expect(screen.getByLabelText(/^name$/i)).toHaveValue("Demo");
    expect(screen.getByLabelText(/^key$/i)).toHaveValue("DEMO");
    expect(screen.getByLabelText(/^slug$/i)).toHaveValue("demo-project");
  });

  it("re-syncs the form when the dialog reopens with a new project", () => {
    const { rerender } = render(
      <EditProjectDialog project={project} orgId={VALID_ORG_ID} open={false} onClose={vi.fn()} />,
    );
    const other = makeProject({ id: "p2", name: "Other", key: "OTH", slug: "other" });
    rerender(<EditProjectDialog project={other} orgId={VALID_ORG_ID} open onClose={vi.fn()} />);
    expect(screen.getByLabelText(/^name$/i)).toHaveValue("Other");
  });

  it("submits update with orgId, projectId and the edited fields", async () => {
    const { mutateMock } = setupMutationMock(api.projects.update);
    render(<EditProjectDialog project={project} orgId={VALID_ORG_ID} open onClose={vi.fn()} />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText(/^key$/i));
    await user.type(screen.getByLabelText(/^key$/i), "NEWK");
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(mutateMock).toHaveBeenCalledWith({
      orgId: VALID_ORG_ID,
      projectId: project.id,
      data: { name: "Demo", key: "NEWK", slug: "demo-project" },
    });
  });

  it("shows a success toast and closes on success", () => {
    const onClose = vi.fn();
    const { triggerSuccess } = setupMutationMock(api.projects.update);
    render(<EditProjectDialog project={project} orgId={VALID_ORG_ID} open onClose={onClose} />);

    act(() => {
      triggerSuccess();
    });

    expect(toast.success).toHaveBeenCalledWith("Project updated.");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders the mutation error inline", () => {
    mockUseMutationResult(api.projects.update, {
      isError: true,
      error: new Error("Key already taken."),
    });
    render(<EditProjectDialog project={project} orgId={VALID_ORG_ID} open onClose={vi.fn()} />);
    expect(screen.getByText("Key already taken.")).toBeInTheDocument();
  });
});
