import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { CreateProjectDialog } from "@/app/(dashboard)/projects/_components/create-project-dialog";
import { VALID_ORG_ID } from "@/tests/support/fixtures";
import { mockUseMutationResult, setupMutationMock } from "@/tests/support/trpc";

describe("CreateProjectDialog", () => {
  it("auto-derives both key and slug from the name until edited directly", async () => {
    render(<CreateProjectDialog orgId={VALID_ORG_ID} open onClose={vi.fn()} onCreated={vi.fn()} />);
    await userEvent.setup().type(screen.getByLabelText(/^name$/i), "My Web Project");
    expect(screen.getByLabelText(/^key$/i)).toHaveValue("MWP");
    expect(screen.getByLabelText(/^slug$/i)).toHaveValue("my-web-project");
  });

  it("stops deriving the key once the user edits it directly", async () => {
    render(<CreateProjectDialog orgId={VALID_ORG_ID} open onClose={vi.fn()} onCreated={vi.fn()} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^key$/i), "CUSTOM");
    await user.type(screen.getByLabelText(/^name$/i), "Another Name");
    expect(screen.getByLabelText(/^key$/i)).toHaveValue("CUSTOM");
  });

  it("submits create with orgId and { name, key, slug }", async () => {
    const { mutateMock } = setupMutationMock(api.projects.create);
    render(<CreateProjectDialog orgId={VALID_ORG_ID} open onClose={vi.fn()} onCreated={vi.fn()} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^name$/i), "Demo");
    await user.clear(screen.getByLabelText(/^key$/i));
    await user.type(screen.getByLabelText(/^key$/i), "DEMO");
    await user.clear(screen.getByLabelText(/^slug$/i));
    await user.type(screen.getByLabelText(/^slug$/i), "demo");
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    expect(mutateMock).toHaveBeenCalledWith({
      orgId: VALID_ORG_ID,
      data: { name: "Demo", key: "DEMO", slug: "demo" },
    });
  });

  it("shows a success toast, resets the form, calls onCreated then onClose", () => {
    const onCreated = vi.fn();
    const onClose = vi.fn();
    const { triggerSuccess } = setupMutationMock(api.projects.create);
    render(
      <CreateProjectDialog orgId={VALID_ORG_ID} open onClose={onClose} onCreated={onCreated} />,
    );

    act(() => {
      triggerSuccess();
    });

    expect(toast.success).toHaveBeenCalledWith("Project created.");
    expect(onCreated).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders the mutation error inline", () => {
    mockUseMutationResult(api.projects.create, {
      isError: true,
      error: new Error("Key taken."),
    });
    render(<CreateProjectDialog orgId={VALID_ORG_ID} open onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.getByText("Key taken.")).toBeInTheDocument();
  });
});
