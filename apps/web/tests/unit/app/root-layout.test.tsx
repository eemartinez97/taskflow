import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import RootLayout from "@/app/layout";

describe("RootLayout", () => {
  it("renders children inside the html/body shell wrapped by Providers", () => {
    // RootLayout renders <html>/<body> - render() targets a detached
    // container, so we assert on the innerText content instead of role queries.
    const spy = vi.spyOn(console, "error").mockImplementation((msg) => {
      if (String(msg).includes("cannot be a child of")) return;
      console.warn(msg);
    });

    render(<RootLayout>Child</RootLayout>);
    expect(screen.getByText("Child")).toBeInTheDocument();

    spy.mockRestore();
  });
});
