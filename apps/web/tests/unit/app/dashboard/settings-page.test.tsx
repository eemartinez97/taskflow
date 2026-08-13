import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";
import SettingsPage from "@/app/(dashboard)/settings/page";

describe("SettingsPage (Server Component)", () => {
  it("redirects to /settings/profile", () => {
    vi.mocked(redirect).mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });

    expect(() => {
      render(SettingsPage());
    }).toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/settings/profile");
  });
});
