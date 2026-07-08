import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/trpc/server", () => ({
  getServerTRPC: vi.fn(),
  getQueryClient: vi.fn(),
  TRPCHydrationBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@dnd-kit/utilities", () => import("@/tests/mocks/dnd-kit-utilities.js"));
vi.mock("next/navigation", () => import("@/tests/mocks/next-navigation.js"));
vi.mock("@/lib/trpc/client", () => import("@/tests/mocks/trpc-api.js"));
vi.mock("@dnd-kit/sortable", () => import("@/tests/mocks/dnd-kit.js"));
vi.mock("@taskflow/ui", () => import("@/tests/mocks/taskflow-ui.js"));
vi.mock("@/lib/auth/session", () => ({ requireSession: vi.fn() }));
vi.mock("@dnd-kit/core", () => import("@/tests/mocks/dnd-kit.js"));

import {
  type ServerTRPCMock,
  buildServerTRPCMock,
  makeBoard,
  makeColumn,
  makeProject,
  makeTask,
  mockAuthorizedUser,
  VALID_COL_A_ID,
  VALID_PROJECT_ID,
} from "@/tests/helpers";
import ProjectBoardPage, { generateMetadata } from "@/app/(dashboard)/projects/[id]/page";
import { notFound } from "@/tests/mocks/next-navigation";
import { requireSession } from "@/lib/auth/session";
import { getServerTRPC } from "@/lib/trpc/server";
import { api } from "@/tests/mocks/trpc-api.js";

// -- Fixtures --

const mockProject = makeProject();
const colA = makeColumn({ id: VALID_COL_A_ID });
const mockBoard = { ...makeBoard(), columns: [colA] };
const task1 = makeTask({ columnId: VALID_COL_A_ID });

// -- Factory helper --

const params = Promise.resolve({ id: VALID_PROJECT_ID });

// -- Setup --

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSession).mockResolvedValue(mockAuthorizedUser);
  vi.mocked(getServerTRPC).mockResolvedValue(
    buildServerTRPCMock({
      projects: { get: vi.fn().mockResolvedValue(mockProject) },
      boards: { getByProject: vi.fn().mockResolvedValue(mockBoard) },
      tasks: { list: vi.fn().mockResolvedValue([task1]) },
    }) as never,
  );
  vi.mocked(api.useQueries).mockReturnValue([{ data: [task1] }] as never);
});

describe("generateMetadata", () => {
  it("returns the project name as the page title", async () => {
    const metadata = await generateMetadata({ params });
    expect(metadata.title).toBe(mockProject.name);
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
        boards: { getByProject: vi.fn().mockResolvedValue(mockBoard) },
        tasks: { list: vi.fn().mockResolvedValue([task1]) },
      }) as never,
    );

    const metadata = await generateMetadata({ params: Promise.resolve({ id: "bad-id" }) });
    expect(metadata.title).toBe("Project");
  });

  it("returns fallback title when getServerTRPC itself throws", async () => {
    vi.mocked(getServerTRPC).mockRejectedValue(new Error("tRPC unavailable"));

    const metadata = await generateMetadata({ params });
    expect(metadata.title).toBe("Project");
  });

  it("does not throw for any input — always returns a Metadata object", async () => {
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

  it("calls requireSession", async () => {
    render(await ProjectBoardPage({ params }));
    expect(requireSession).toHaveBeenCalledOnce();
  });

  it("calls notFound() when project.get throws", async () => {
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

  it("shows no-board message when board is null", async () => {
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

  it("prefetches tasks for each column in parallel", async () => {
    const colB = makeColumn({ id: "col-b", position: 2000 });
    const multiColBoard = { ...mockBoard, columns: [colA, colB] };

    vi.mocked(getServerTRPC).mockResolvedValue(
      buildServerTRPCMock({
        boards: { getByProject: vi.fn().mockResolvedValue(multiColBoard) },
      }) as never,
    );
    vi.mocked(api.useQueries).mockReturnValue([{ data: [task1] }, { data: [] }] as never);

    render(await ProjectBoardPage({ params }));

    const trpc = (await vi.mocked(getServerTRPC).mock.results[0]?.value) as ServerTRPCMock;
    expect(trpc.tasks.list).toHaveBeenCalledTimes(2);
  });
});
