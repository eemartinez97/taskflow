import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { Project } from "@taskflow/database";
import { ProjectList } from "@/app/(dashboard)/projects/_components/project-list";
import { api } from "@/lib/trpc/client";
import { toast } from "@/lib/toast/store";
import { renderUI } from "../../helpers/render";
import { wireCapturableMutation } from "../../helpers/mutation";
import { mockApiUtils, mockUseQuery } from "@/tests/support/trpc";
import { setupRouterMock } from "@/tests/support/render";
import { makeOrg } from "@/tests/support/factories";

// -- Module mocks --

// Stub complex child dialogs - each has its own test file
vi.mock("@/app/(dashboard)/projects/_components/create-project-dialog", () => ({
  CreateProjectDialog: ({
    open,
    onClose,
    onCreated,
  }: {
    open: boolean;
    onClose: () => void;
    onCreated: () => void;
  }) =>
    open ? (
      <div data-testid="create-project-dialog">
        <button
          onClick={() => {
            onCreated();
            onClose();
          }}
        >
          Confirm create
        </button>
        <button onClick={onClose}>Cancel create</button>
      </div>
    ) : null,
}));

vi.mock("@/app/(dashboard)/projects/_components/edit-project-dialog", () => ({
  EditProjectDialog: ({
    project,
    open,
    onClose,
  }: {
    project: { name: string };
    open: boolean;
    onClose: () => void;
  }) =>
    open ? (
      <div data-testid="edit-project-dialog">
        <span>{project.name}</span>
        <button onClick={onClose}>Close edit</button>
      </div>
    ) : null,
}));

vi.mock("@/components/common/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    onClose,
    title,
  }: {
    open: boolean;
    onConfirm: () => void;
    onClose: () => void;
    title: string;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <span>{title}</span>
        <button onClick={onConfirm}>Confirm delete</button>
        <button onClick={onClose}>Cancel delete</button>
      </div>
    ) : null,
}));

// DropdownMenu simplified: renders item buttons directly to avoid portal/open-state complexity
vi.mock("@/components/common/dropdown-menu", () => ({
  DropdownMenu: ({
    items,
    triggerLabel,
  }: {
    items: { label: string; onClick: () => void; danger?: boolean }[];
    triggerLabel?: string;
  }) => (
    <div data-testid={`menu-${triggerLabel ?? "menu"}`}>
      {items.map((item) => (
        <button key={item.label} onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </div>
  ),
}));

// -- Fixtures --
function makeProject(id: string, name: string, description?: string): Project {
  return {
    id,
    name,
    key: name.replace(/[^A-Z]/g, "").slice(0, 4) || "PROJ",
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    description: description ?? null,
    orgId: "org-1",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };
}

const PROJECT_A = makeProject("proj-1", "Website Revamp", "The main site rebuild.");
const PROJECT_B = makeProject("proj-2", "API Overhaul");
const OWNER_ORG = makeOrg({ role: "OWNER" });

// -- Helpers --

let mockInvalidateProjectsList: ReturnType<typeof vi.fn>;
let deleteMutation: ReturnType<typeof wireCapturableMutation>;

function setupQueryMock(projects: Project[]): void {
  mockUseQuery(api.projects.list, projects);
}

// -- Tests --
describe("ProjectList", () => {
  setupRouterMock();

  beforeEach(() => {
    mockInvalidateProjectsList = vi.fn();
    mockApiUtils({ projects: { list: { invalidate: mockInvalidateProjectsList } } });
    deleteMutation = wireCapturableMutation(api.projects.delete);
    setupQueryMock([PROJECT_A]);
  });

  // -- Rendering --

  it("renders the org name as the section heading", () => {
    renderUI(<ProjectList orgId="org-1" initialOrg={OWNER_ORG} initialProjects={[PROJECT_A]} />);

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("renders a card for each project", () => {
    setupQueryMock([PROJECT_A, PROJECT_B]);
    renderUI(
      <ProjectList orgId="org-1" initialOrg={OWNER_ORG} initialProjects={[PROJECT_A, PROJECT_B]} />,
    );

    expect(screen.getByText("Website Revamp")).toBeInTheDocument();
    expect(screen.getByText("API Overhaul")).toBeInTheDocument();
  });

  it("renders the project description when it exists", () => {
    renderUI(<ProjectList orgId="org-1" initialOrg={OWNER_ORG} initialProjects={[PROJECT_A]} />);

    expect(screen.getByText("The main site rebuild.")).toBeInTheDocument();
  });

  it("does NOT render a description section when the project has none", () => {
    setupQueryMock([PROJECT_B]);
    renderUI(<ProjectList orgId="org-1" initialOrg={OWNER_ORG} initialProjects={[PROJECT_B]} />);

    expect(screen.queryByText(/description/i)).not.toBeInTheDocument();
  });

  it("renders a link to the project board for each project", () => {
    renderUI(<ProjectList orgId="org-1" initialOrg={OWNER_ORG} initialProjects={[PROJECT_A]} />);

    expect(screen.getByRole("link", { name: /website revamp/i })).toHaveAttribute(
      "href",
      `/projects/${PROJECT_A.id}`,
    );
  });

  // -- Empty states --

  it("shows a create-prompt empty state for roles that can create projects", () => {
    setupQueryMock([]);
    renderUI(<ProjectList orgId="org-1" initialOrg={OWNER_ORG} initialProjects={[]} />);

    expect(screen.getByText(/create one to get started/i)).toBeInTheDocument();
  });

  it("shows a plain empty state for roles that cannot create projects", () => {
    const viewerOrg = makeOrg({ role: "VIEWER" });
    setupQueryMock([]);
    renderUI(<ProjectList orgId="org-1" initialOrg={viewerOrg} initialProjects={[]} />);

    expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/create one/i)).not.toBeInTheDocument();
  });

  // -- Role-based buttons --

  it("shows the 'New Project' button for OWNER role", () => {
    renderUI(<ProjectList orgId="org-1" initialOrg={OWNER_ORG} initialProjects={[PROJECT_A]} />);

    expect(screen.getByRole("button", { name: /new project/i })).toBeInTheDocument();
  });

  it("shows the 'New Project' button for MEMBER role", () => {
    const memberOrg = makeOrg({ role: "MEMBER" });
    renderUI(<ProjectList orgId="org-1" initialOrg={memberOrg} initialProjects={[PROJECT_A]} />);

    expect(screen.getByRole("button", { name: /new project/i })).toBeInTheDocument();
  });

  it("does NOT show the 'New Project' button for VIEWER role", () => {
    const viewerOrg = makeOrg({ role: "VIEWER" });
    renderUI(<ProjectList orgId="org-1" initialOrg={viewerOrg} initialProjects={[PROJECT_A]} />);

    expect(screen.queryByRole("button", { name: /new project/i })).not.toBeInTheDocument();
  });

  it("renders the dropdown menu for OWNER role (can admin)", () => {
    renderUI(<ProjectList orgId="org-1" initialOrg={OWNER_ORG} initialProjects={[PROJECT_A]} />);

    // DropdownMenu mock renders "Edit" and "Delete" as buttons
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("does NOT render the dropdown menu for MEMBER role (cannot admin)", () => {
    const memberOrg = makeOrg({ role: "MEMBER" });
    renderUI(<ProjectList orgId="org-1" initialOrg={memberOrg} initialProjects={[PROJECT_A]} />);

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  // -- Create dialog --

  it("opens CreateProjectDialog when 'New Project' is clicked", () => {
    renderUI(<ProjectList orgId="org-1" initialOrg={OWNER_ORG} initialProjects={[PROJECT_A]} />);
    fireEvent.click(screen.getByRole("button", { name: /new project/i }));

    expect(screen.getByTestId("create-project-dialog")).toBeInTheDocument();
  });

  it("closes CreateProjectDialog when its cancel handler fires", () => {
    renderUI(<ProjectList orgId="org-1" initialOrg={OWNER_ORG} initialProjects={[PROJECT_A]} />);
    fireEvent.click(screen.getByRole("button", { name: /new project/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel create" }));

    expect(screen.queryByTestId("create-project-dialog")).not.toBeInTheDocument();
  });

  // -- Edit dialog --

  it("opens EditProjectDialog with the correct project when Edit is clicked", () => {
    renderUI(<ProjectList orgId="org-1" initialOrg={OWNER_ORG} initialProjects={[PROJECT_A]} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByTestId("edit-project-dialog")).toBeInTheDocument();
    expect(
      screen.getByText("Website Revamp", {
        selector: "[data-testid='edit-project-dialog'] span",
      }),
    ).toBeInTheDocument();
  });

  it("closes EditProjectDialog when its close handler fires", () => {
    renderUI(<ProjectList orgId="org-1" initialOrg={OWNER_ORG} initialProjects={[PROJECT_A]} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Close edit" }));

    expect(screen.queryByTestId("edit-project-dialog")).not.toBeInTheDocument();
  });

  // -- Delete flow --

  it("opens ConfirmDialog when Delete is clicked", () => {
    renderUI(<ProjectList orgId="org-1" initialOrg={OWNER_ORG} initialProjects={[PROJECT_A]} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText("Delete project")).toBeInTheDocument();
  });

  it("calls deleteMutation.mutate with orgId and projectId when confirmed", () => {
    renderUI(<ProjectList orgId="org-1" initialOrg={OWNER_ORG} initialProjects={[PROJECT_A]} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(deleteMutation.mutate).toHaveBeenCalledWith({
      orgId: "org-1",
      projectId: PROJECT_A.id,
    });
  });

  it("closes ConfirmDialog without calling mutate when Cancel is clicked", () => {
    renderUI(<ProjectList orgId="org-1" initialOrg={OWNER_ORG} initialProjects={[PROJECT_A]} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel delete" }));

    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();

    expect(deleteMutation.mutate).not.toHaveBeenCalled();
  });

  it("shows a success toast after a successful deletion", () => {
    renderUI(<ProjectList orgId="org-1" initialOrg={OWNER_ORG} initialProjects={[PROJECT_A]} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    act(() => {
      deleteMutation.simulateSuccess();
    });

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Project deleted.");
  });

  it("invalidates projects.list after a successful deletion", () => {
    renderUI(<ProjectList orgId="org-1" initialOrg={OWNER_ORG} initialProjects={[PROJECT_A]} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    act(() => {
      deleteMutation.simulateSuccess();
    });

    expect(mockInvalidateProjectsList).toHaveBeenCalled();
  });

  it("closes ConfirmDialog after a successful deletion", async () => {
    renderUI(<ProjectList orgId="org-1" initialOrg={OWNER_ORG} initialProjects={[PROJECT_A]} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    act(() => {
      deleteMutation.simulateSuccess();
    });

    await waitFor(() => {
      expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
    });
  });
});
