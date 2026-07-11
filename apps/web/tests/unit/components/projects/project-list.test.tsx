import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/trpc/client", () => import("@/tests/mocks/trpc-api"));
vi.mock("@taskflow/ui", () => import("@/tests/mocks/taskflow-ui"));
vi.mock("next/link", () => import("@/tests/mocks/next-link"));

import { makeMockQueryResult, setupMutationMock } from "@/tests/helpers";
import { ProjectList } from "@/app/(dashboard)/projects/_components/project-list";
import { makeOrg, makeProject, VALID_ORG_ID } from "@/tests/helpers";
import { api } from "@/tests/mocks/trpc-api";

// -- Fixtures --

const mockOrg = makeOrg();
const mockProject = makeProject({ name: "Alpha", key: "ALP" });
const mockProject2 = makeProject({ id: "p2", name: "Beta", key: "BET", slug: "beta" });

// -- Setup --

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.projects.list.useQuery).mockReturnValue(makeMockQueryResult([mockProject]));
});

//  -- Rendering --

describe("ProjectList - rendering", () => {
  it("renders the org name", () => {
    render(
      <ProjectList orgId={VALID_ORG_ID} initialOrg={mockOrg} initialProjects={[mockProject]} />,
    );
    expect(screen.getByText(mockOrg.name)).toBeInTheDocument();
  });

  it("renders each project name", () => {
    vi.mocked(api.projects.list.useQuery).mockReturnValue(
      makeMockQueryResult([mockProject, mockProject2]),
    );
    render(
      <ProjectList
        orgId={VALID_ORG_ID}
        initialOrg={mockOrg}
        initialProjects={[mockProject, mockProject2]}
      />,
    );
    expect(screen.getByText(mockProject.name)).toBeInTheDocument();
    expect(screen.getByText(mockProject2.name)).toBeInTheDocument();
  });

  it("renders project key badges", () => {
    render(
      <ProjectList orgId={VALID_ORG_ID} initialOrg={mockOrg} initialProjects={[mockProject]} />,
    );
    expect(screen.getByText(mockProject.key)).toBeInTheDocument();
  });

  it("renders project cards as links", () => {
    render(
      <ProjectList orgId={VALID_ORG_ID} initialOrg={mockOrg} initialProjects={[mockProject]} />,
    );
    expect(screen.getByRole("link", { name: new RegExp(mockProject.name, "i") })).toHaveAttribute(
      "href",
      `/dashboard/projects/${mockProject.id}`,
    );
  });

  it("renders project description when present", () => {
    const withDesc = makeProject({ description: "A cool project" });
    vi.mocked(api.projects.list.useQuery).mockReturnValue(makeMockQueryResult([withDesc]));
    render(<ProjectList orgId={VALID_ORG_ID} initialOrg={mockOrg} initialProjects={[withDesc]} />);
    expect(screen.getByText("A cool project")).toBeInTheDocument();
  });

  it("does NOT render description element when description is null", () => {
    const noDesc = makeProject({ description: null });
    vi.mocked(api.projects.list.useQuery).mockReturnValue(makeMockQueryResult([noDesc]));
    render(<ProjectList orgId={VALID_ORG_ID} initialOrg={mockOrg} initialProjects={[noDesc]} />);
    // No <p> with description text - only the project name badge and title are visible
    expect(screen.queryByText(/description/i)).not.toBeInTheDocument();
  });
});

// -- Empty state --

describe("ProjectList - empty state", () => {
  it("shows empty state message for OWNER with no projects", () => {
    vi.mocked(api.projects.list.useQuery).mockReturnValue(makeMockQueryResult([]));
    render(<ProjectList orgId={VALID_ORG_ID} initialOrg={mockOrg} initialProjects={[]} />);
    expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
  });

  it("shows 'Create one to get started' for OWNER with no projects (canCreate branch)", () => {
    vi.mocked(api.projects.list.useQuery).mockReturnValue(makeMockQueryResult([]));
    render(<ProjectList orgId={VALID_ORG_ID} initialOrg={mockOrg} initialProjects={[]} />);
    expect(screen.getByText(/create one to get started/i)).toBeInTheDocument();
  });

  it("does NOT show 'Create one' for VIEWER with no projects (canCreate=false branch)", () => {
    // Covers the `canCreate ? " Create one to get started." : ""` false branch
    const viewerOrg = makeOrg({ memberships: [{ ...mockOrg.memberships[0], role: "VIEWER" }] });
    vi.mocked(api.projects.list.useQuery).mockReturnValue(makeMockQueryResult([]));

    render(<ProjectList orgId={VALID_ORG_ID} initialOrg={viewerOrg} initialProjects={[]} />);

    expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/create one to get started/i)).not.toBeInTheDocument();
  });

  it("defaults to VIEWER role when memberships array is empty", () => {
    // Covers the `memberships[0]?.role ?? "VIEWER"` fallback branch
    const orgNoMembers = makeOrg({ memberships: [] });
    vi.mocked(api.projects.list.useQuery).mockReturnValue(makeMockQueryResult([]));

    render(<ProjectList orgId={VALID_ORG_ID} initialOrg={orgNoMembers} initialProjects={[]} />);

    // VIEWER: no "New Project" button
    expect(screen.queryByRole("button", { name: /new project/i })).not.toBeInTheDocument();
  });
});

// -- RBAC: Create button visibility --

describe("ProjectList - RBAC", () => {
  it("shows 'New Project' button for OWNER role", () => {
    render(
      <ProjectList orgId={VALID_ORG_ID} initialOrg={mockOrg} initialProjects={[mockProject]} />,
    );
    expect(screen.getByRole("button", { name: /new project/i })).toBeInTheDocument();
  });

  it("shows 'New Project' button for ADMIN role", () => {
    const adminOrg = makeOrg({ memberships: [{ ...mockOrg.memberships[0], role: "ADMIN" }] });
    render(
      <ProjectList orgId={VALID_ORG_ID} initialOrg={adminOrg} initialProjects={[mockProject]} />,
    );
    expect(screen.getByRole("button", { name: /new project/i })).toBeInTheDocument();
  });

  it("shows 'New Project' button for MEMBER role", () => {
    const memberOrg = makeOrg({ memberships: [{ ...mockOrg.memberships[0], role: "MEMBER" }] });
    render(
      <ProjectList orgId={VALID_ORG_ID} initialOrg={memberOrg} initialProjects={[mockProject]} />,
    );
    expect(screen.getByRole("button", { name: /new project/i })).toBeInTheDocument();
  });

  it("hides 'New Project' button for VIEWER role", () => {
    const viewerOrg = makeOrg({ memberships: [{ ...mockOrg.memberships[0], role: "VIEWER" }] });
    vi.mocked(api.projects.list.useQuery).mockReturnValue(makeMockQueryResult([]));

    render(<ProjectList orgId={VALID_ORG_ID} initialOrg={viewerOrg} initialProjects={[]} />);
    expect(screen.queryByRole("button", { name: /new project/i })).not.toBeInTheDocument();
  });
});

// -- Dialog open/close (covers onClose and onCreated arrow functions) --

describe("ProjectList - dialog lifecycle", () => {
  it("opens the create dialog when 'New Project' is clicked", async () => {
    render(
      <ProjectList orgId={VALID_ORG_ID} initialOrg={mockOrg} initialProjects={[mockProject]} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /new project/i }));
    expect(screen.getByRole("heading", { name: /create project/i })).toBeInTheDocument();
  });

  it("onClose arrow fn: closes dialog when Cancel is clicked inside the dialog", async () => {
    render(
      <ProjectList orgId={VALID_ORG_ID} initialOrg={mockOrg} initialProjects={[mockProject]} />,
    );

    // Open dialog
    await userEvent.click(screen.getByRole("button", { name: /new project/i }));
    expect(screen.getByRole("heading", { name: /create project/i })).toBeInTheDocument();

    // Click Cancel inside the dialog (rendered by Dialog mock as a real button)
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    // Dialog should be closed — the onClose arrow fn set dialogOpen to false
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /create project/i })).not.toBeInTheDocument();
    });
  });

  it("onCreated arrow fn: closes dialog after project is successfully created", async () => {
    const { triggerSuccess } = setupMutationMock(api.projects.create);

    render(
      <ProjectList orgId={VALID_ORG_ID} initialOrg={mockOrg} initialProjects={[mockProject]} />,
    );

    // Open dialog — this causes CreateProjectDialog to mount and register its mutation
    await userEvent.click(screen.getByRole("button", { name: /new project/i }));
    expect(screen.getByRole("heading", { name: /create project/i })).toBeInTheDocument();

    // Simulate mutation success -> calls onCreated -> calls setDialogOpen(false)
    act(() => {
      triggerSuccess();
    });

    // Dialog must be closed
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /create project/i })).not.toBeInTheDocument();
    });
  });

  it("dialog remains open if onCreated has not been called yet", async () => {
    setupMutationMock(api.projects.create); // capture but never trigger

    render(
      <ProjectList orgId={VALID_ORG_ID} initialOrg={mockOrg} initialProjects={[mockProject]} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /new project/i }));

    // Dialog is still open — no onCreated call yet
    expect(screen.getByRole("heading", { name: /create project/i })).toBeInTheDocument();
  });

  it("can reopen dialog after it has been closed via Cancel", async () => {
    render(
      <ProjectList orgId={VALID_ORG_ID} initialOrg={mockOrg} initialProjects={[mockProject]} />,
    );

    // Open -> Cancel -> Reopen
    await userEvent.click(screen.getByRole("button", { name: /new project/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /create project/i })).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /new project/i }));
    expect(screen.getByRole("heading", { name: /create project/i })).toBeInTheDocument();
  });
});
