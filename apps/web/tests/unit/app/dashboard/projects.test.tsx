import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/trpc/server", () => ({
  getServerTRPC: vi.fn(),
  getQueryClient: vi.fn(),
  TRPCHydrationBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/auth/session", () => ({ requireSession: vi.fn().mockResolvedValue({ id: "u1" }) }));
vi.mock("next/navigation", () => import("@/tests/mocks/next-navigation"));
vi.mock("@/lib/trpc/client", () => import("@/tests/mocks/trpc-api"));
vi.mock("next-auth/react", () => import("@/tests/mocks/next-auth"));
vi.mock("@taskflow/ui", () => import("@/tests/mocks/taskflow-ui"));
vi.mock("next/link", () => import("@/tests/mocks/next-link"));

import ProjectsPage from "@/app/(dashboard)/projects/page";
import { buildServerTRPCMock, makeMockQueryResult, makeOrg, makeProject } from "@/tests/helpers";
import { getServerTRPC } from "@/lib/trpc/server";
import { api } from "@/tests/mocks/trpc-api";

const mockOrg = makeOrg();
const mockProject = makeProject();

describe("ProjectsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerTRPC).mockResolvedValue(
      buildServerTRPCMock({
        orgs: { list: vi.fn().mockResolvedValue([mockOrg]) },
        projects: { list: vi.fn().mockResolvedValue([mockProject]) },
      }) as never,
    );
    vi.mocked(api.projects.list.useQuery).mockReturnValue(makeMockQueryResult([mockProject]));
  });

  it("renders a list of projects", async () => {
    const page = await ProjectsPage();
    render(page);
    expect(screen.getByText(mockProject.name)).toBeInTheDocument();
  });

  it("renders the org name as heading", async () => {
    const page = await ProjectsPage();
    render(page);
    expect(screen.getByText(mockOrg.name)).toBeInTheDocument();
  });

  it("shows empty state when no projects exist", async () => {
    vi.mocked(getServerTRPC).mockResolvedValue(
      buildServerTRPCMock({
        orgs: { list: vi.fn().mockResolvedValue([mockOrg]) },
        projects: { list: vi.fn().mockResolvedValue([]) },
      }) as never,
    );
    vi.mocked(api.projects.list.useQuery).mockReturnValue(makeMockQueryResult([]));

    const page = await ProjectsPage();
    render(page);
    expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
  });

  it("shows no-org message when user has no orgs", async () => {
    vi.mocked(getServerTRPC).mockResolvedValue(
      buildServerTRPCMock({
        orgs: { list: vi.fn().mockResolvedValue([]) },
        projects: { list: vi.fn().mockResolvedValue([mockProject]) },
      }) as never,
    );

    const page = await ProjectsPage();
    render(page);
    expect(screen.getByText(/no organization found/i)).toBeInTheDocument();
  });
});
