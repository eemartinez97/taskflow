import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc/server", () => ({ getServerTRPC: vi.fn() }));
vi.mock("@/lib/utils/org-utils", () => ({ getOrgOrNull: vi.fn() }));
vi.mock("@/components/common/no-org-state", () => ({
  NoOrgState: ({ context }: { context: string }) => <p>NoOrgState: {context}</p>,
}));
vi.mock("@/app/(dashboard)/tasks/_components/tasks-client", () => ({
  TasksClient: ({ initialOpenTaskId }: { initialOpenTaskId: string | null }) => (
    <p>TasksClient: {initialOpenTaskId ?? "none"}</p>
  ),
}));

import { getServerTRPC } from "@/lib/trpc/server";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import TasksPage from "@/app/(dashboard)/tasks/page";
import { makeOrg } from "@/tests/support/factories";
import { mockGetServerTRPC } from "@/tests/support/trpc";

describe("TasksPage (Server Component)", () => {
  it("renders NoOrgState when there is no organization", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(null);
    render(await TasksPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/NoOrgState/)).toBeInTheDocument();
  });

  it("passes null initialOpenTaskId when ?task is absent", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg());
    render(await TasksPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("TasksClient: none")).toBeInTheDocument();
  });

  it("parses the ?task query param as initialOpenTaskId", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg());
    render(await TasksPage({ searchParams: Promise.resolve({ task: "task-42" }) }));
    expect(screen.getByText("TasksClient: task-42")).toBeInTheDocument();
  });

  it("ignores a non-string ?task value (array)", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC));
    vi.mocked(getOrgOrNull).mockResolvedValue(makeOrg());
    render(await TasksPage({ searchParams: Promise.resolve({ task: ["a", "b"] }) }));
    expect(screen.getByText("TasksClient: none")).toBeInTheDocument();
  });
});
