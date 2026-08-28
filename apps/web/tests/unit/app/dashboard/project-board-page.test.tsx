import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/trpc/server", () => ({ getServerTRPC: vi.fn() }));
vi.mock("@/lib/utils/org-utils", () => ({ getOrgOrNull: vi.fn() }));

vi.mock("@/app/(dashboard)/projects/[id]/board", () => ({
  BoardPageClient: ({ boardId }: { boardId: string }) => <p>BoardPageClient: {boardId}</p>,
}));

import { notFound } from "next/navigation";
import { getServerTRPC } from "@/lib/trpc/server";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import ProjectBoardPage, { generateMetadata } from "@/app/(dashboard)/projects/[id]/page";
import { VALID_COL_A_ID, VALID_PROJECT_ID } from "@/tests/support/fixtures";
import { makeBoard, makeColumn, makeOrg, makeProject } from "@/tests/support/factories";
import { mockGetServerTRPC } from "@/tests/support/trpc";

function params(id = VALID_PROJECT_ID) {
  return Promise.resolve({ id });
}
function searchParams(query: Record<string, string> = {}) {
  return Promise.resolve(query);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateMetadata", () => {
  it("returns the project's name as title", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC), {
      projects: { get: vi.fn().mockResolvedValue(makeProject({ name: "My Project" })) },
    });
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg());

    const meta = await generateMetadata({ params: params(), searchParams: searchParams() });
    expect(meta.title).toBe("My Project");
  });

  it("falls back to 'Project' when the user has no org", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(null);

    const meta = await generateMetadata({ params: params(), searchParams: searchParams() });
    expect(meta.title).toBe("Project");
  });

  it("falls back to 'Project' when getProjectContext throws", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC), {
      projects: { get: vi.fn().mockRejectedValue(new Error("boom")) },
    });
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg());

    const meta = await generateMetadata({ params: params(), searchParams: searchParams() });
    expect(meta.title).toBe("Project");
  });
});

describe("ProjectBoardPage", () => {
  // Shared fixture: a board that carries its columns (Board type has no `columns`
  // field, so we use a spread to extend the shape without casting).
  const board = { ...makeBoard(), columns: [makeColumn({ id: VALID_COL_A_ID })] };

  it("calls notFound() when the user has no org", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(null);
    vi.mocked(notFound).mockImplementationOnce(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    await expect(
      ProjectBoardPage({ params: params(), searchParams: searchParams() }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("calls notFound() when getProjectContext rejects inside the page body (the .catch(() => null) branch)", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC), {
      projects: { get: vi.fn().mockRejectedValue(new Error("db down")) },
    });
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg());
    vi.mocked(notFound).mockImplementationOnce(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    await expect(
      ProjectBoardPage({ params: params(), searchParams: searchParams() }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("shows the 'no board found' state when the project has zero boards", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC), {
      boards: { list: vi.fn().mockResolvedValue([]) },
    });

    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg());

    render(await ProjectBoardPage({ params: params(), searchParams: searchParams() }));
    expect(screen.getByText(/no board found/i)).toBeInTheDocument();
  });

  it("calls notFound() when the resolved board is null", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC), {
      boards: {
        list: vi.fn().mockResolvedValue([{ ...makeBoard() }]),
        get: vi.fn().mockResolvedValue(null),
      },
    });
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg());
    vi.mocked(notFound).mockImplementationOnce(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    await expect(
      ProjectBoardPage({ params: params(), searchParams: searchParams() }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("picks the first board when ?board= doesn't match any board", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC), {
      boards: {
        list: vi.fn().mockResolvedValue([board]),
        get: vi.fn().mockResolvedValue(board),
      },
      tasks: { list: vi.fn().mockResolvedValue([]) },
    });
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg());

    render(
      await ProjectBoardPage({
        params: params(),
        searchParams: searchParams({ board: "does-not-exist" }),
      }),
    );
    expect(screen.getByText(`BoardPageClient: ${board.id}`)).toBeInTheDocument();
  });

  it("renders the full page when the requested board matches", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC), {
      projects: { get: vi.fn().mockResolvedValue(makeProject()) },
      boards: {
        list: vi.fn().mockResolvedValue([board]),
        get: vi.fn().mockResolvedValue(board),
      },
      tasks: { list: vi.fn().mockResolvedValue([]) },
    });
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg());

    render(
      await ProjectBoardPage({
        params: params(),
        searchParams: searchParams({ board: board.id }),
      }),
    );
    expect(screen.getByText(`BoardPageClient: ${board.id}`)).toBeInTheDocument();
  });

  it("defaults canManage to false when the org has no memberships", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC), {
      boards: { list: vi.fn().mockResolvedValue([board]), get: vi.fn().mockResolvedValue(board) },
      tasks: { list: vi.fn().mockResolvedValue([]) },
    });
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg({ memberships: [] }));
    render(await ProjectBoardPage({ params: params(), searchParams: searchParams() }));
    expect(screen.getByText(`BoardPageClient: ${board.id}`)).toBeInTheDocument();
  });
});
