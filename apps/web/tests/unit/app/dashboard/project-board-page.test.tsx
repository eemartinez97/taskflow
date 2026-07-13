import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/trpc/server", () => ({
  getServerTRPC: vi.fn(),
  getQueryClient: vi.fn(),
  TRPCHydrationBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("next/navigation", () => import("@/tests/mocks/next-navigation"));
vi.mock("@/lib/trpc/client", () => import("@/tests/mocks/trpc-api"));
vi.mock("@dnd-kit/utilities", () => import("@/tests/mocks/dnd-kit"));
vi.mock("@dnd-kit/sortable", () => import("@/tests/mocks/dnd-kit"));
vi.mock("@taskflow/ui", () => import("@/tests/mocks/taskflow-ui"));
vi.mock("@dnd-kit/core", () => import("@/tests/mocks/dnd-kit"));

import {
  buildServerTRPCMock,
  makeBoard,
  makeColumn,
  makeProject,
  makeTask,
  type ServerTRPCMock,
  VALID_COL_A_ID,
  VALID_PROJECT_ID,
} from "@/tests/helpers";
import ProjectBoardPage, { generateMetadata } from "@/app/(dashboard)/projects/[id]/page";
import { notFound } from "@/tests/mocks/next-navigation";
import { getServerTRPC } from "@/lib/trpc/server";
import { api } from "@/tests/mocks/trpc-api";

// -- Shared fixtures (reuse helpers.tsx factories) --

const mockProject = makeProject();
const colA = makeColumn({ id: VALID_COL_A_ID });
const mockBoard = { ...makeBoard(), columns: [colA] };
const task1 = makeTask({ columnId: VALID_COL_A_ID });
const params = Promise.resolve({ id: VALID_PROJECT_ID });

/**
 * Happy-path tRPC mock: project found, board found, one task in colA.
 * Local factory — combines helpers.tsx builders into a scenario-specific shape.
 */
function makeDefaultTRPC() {
  return buildServerTRPCMock({
    projects: { get: vi.fn().mockResolvedValue(mockProject) },
    boards: { getByProject: vi.fn().mockResolvedValue(mockBoard) },
    tasks: { list: vi.fn().mockResolvedValue([task1]) },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerTRPC).mockResolvedValue(makeDefaultTRPC() as never);
  vi.mocked(api.useQueries).mockReturnValue([{ data: [task1] }] as never);
});

describe("generateMetadata", () => {
  it("returns the project name as the page title", async () => {
    const meta = await generateMetadata({ params });
    expect(meta.title).toBe(mockProject.name);
  });

  it("calls getServerTRPC to resolve the project", async () => {
    await generateMetadata({ params });
    expect(getServerTRPC).toHaveBeenCalledOnce();
  });

  it("calls trpc.projects.get with the correct projectId", async () => {
    const mockTRPC = buildServerTRPCMock();
    vi.mocked(getServerTRPC).mockResolvedValue(mockTRPC as never);

    await generateMetadata({ params });

    expect(mockTRPC.projects.get).toHaveBeenCalledWith({ projectId: VALID_PROJECT_ID });
  });

  it("returns fallback title 'Project' when project fetch throws", async () => {
    vi.mocked(getServerTRPC).mockResolvedValue(
      buildServerTRPCMock({
        projects: { get: vi.fn().mockRejectedValue(new Error("NOT_FOUND")) },
      }) as never,
    );

    const meta = await generateMetadata({ params: Promise.resolve({ id: "bad-id" }) });
    expect(meta.title).toBe("Project");
  });

  it("returns fallback title 'Project' when getServerTRPC itself throws", async () => {
    vi.mocked(getServerTRPC).mockRejectedValue(new Error("tRPC unavailable"));

    const meta = await generateMetadata({ params });
    expect(meta.title).toBe("Project");
  });

  it("always resolves — never throws for any input", async () => {
    await expect(generateMetadata({ params })).resolves.toBeDefined();
  });
});

describe("ProjectBoardPage", () => {
  it("renders the project name", async () => {
    render(await ProjectBoardPage({ params }));
    expect(screen.getByText(mockProject.name)).toBeInTheDocument();
  });

  it("renders the board name", async () => {
    render(await ProjectBoardPage({ params }));
    expect(screen.getByText(mockBoard.name)).toBeInTheDocument();
  });

  it("calls notFound() when trpc.projects.get throws", async () => {
    vi.mocked(getServerTRPC).mockResolvedValue(
      buildServerTRPCMock({
        projects: { get: vi.fn().mockRejectedValue(new Error("NOT_FOUND")) },
        boards: { getByProject: vi.fn().mockResolvedValue(mockBoard) },
        tasks: { list: vi.fn().mockResolvedValue([task1]) },
      }) as never,
    );

    await ProjectBoardPage({ params }).catch(() => undefined);
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("renders the no-board message when board is null", async () => {
    vi.mocked(getServerTRPC).mockResolvedValue(
      buildServerTRPCMock({
        boards: { getByProject: vi.fn().mockResolvedValue(null) },
      }) as never,
    );

    render(await ProjectBoardPage({ params }));
    expect(screen.getByText(/no board found/i)).toBeInTheDocument();
  });

  it("renders the Kanban board when board exists", async () => {
    render(await ProjectBoardPage({ params }));
    expect(screen.getByTestId("kanban-board")).toBeInTheDocument();
  });

  it("prefetches tasks for every column in parallel", async () => {
    const colB = makeColumn({ id: "col-b", position: 2000 });
    vi.mocked(getServerTRPC).mockResolvedValue(
      buildServerTRPCMock({
        boards: {
          getByProject: vi.fn().mockResolvedValue({ ...mockBoard, columns: [colA, colB] }),
        },
      }) as never,
    );
    vi.mocked(api.useQueries).mockReturnValue([{ data: [task1] }, { data: [] }] as never);

    render(await ProjectBoardPage({ params }));

    const trpc = (await vi.mocked(getServerTRPC).mock.results[0]?.value) as ServerTRPCMock;
    expect(trpc.tasks.list).toHaveBeenCalledTimes(2);
  });

  it("passes orgId from the project to each tasks.list call", async () => {
    render(await ProjectBoardPage({ params }));

    const trpc = (await vi.mocked(getServerTRPC).mock.results[0]?.value) as ServerTRPCMock;
    expect(trpc.tasks.list).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: mockProject.orgId }),
    );
  });
});
