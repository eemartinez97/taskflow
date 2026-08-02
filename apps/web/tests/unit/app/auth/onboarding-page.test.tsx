import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc/server", () => ({ getServerTRPC: vi.fn() }));

vi.mock("@/app/(auth)/onboarding/_components/onboarding-form", () => ({
  default: () => <p>OnboardingForm</p>,
}));

import { redirect } from "next/navigation";
import { getServerTRPC } from "@/lib/trpc/server";
import OnboardingPage, { OnboardingGate } from "@/app/(auth)/onboarding/page";
import { makeOrg } from "@/tests/support/factories";
import { mockGetServerTRPC } from "@/tests/support/trpc";

describe("OnboardingGate", () => {
  it("renders the OnboardingForm when the user has zero organizations", async () => {
    mockGetServerTRPC(vi.mocked(getServerTRPC), { orgs: { list: vi.fn().mockResolvedValue([]) } });
    render(await OnboardingGate());
    expect(screen.getByText("OnboardingForm")).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("calls redirect('/projects') when the user already belongs to an org", async () => {
    vi.mocked(redirect).mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });
    mockGetServerTRPC(vi.mocked(getServerTRPC), {
      orgs: { list: vi.fn().mockResolvedValue([makeOrg()]) },
    });
    await expect(OnboardingGate()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/projects");
  });
});

describe("OnboardingPage (default export)", () => {
  it("renders the Suspense wrapper without crashing", () => {
    expect(() => OnboardingPage()).not.toThrow();
  });
});
