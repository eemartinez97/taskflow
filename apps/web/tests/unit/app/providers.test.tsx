import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => import("@/tests/mocks/next-auth"));

import { Providers } from "@/app/providers";

describe("Providers", () => {
  it("renders children inside SessionProvider", () => {
    render(
      <Providers>
        <span data-testid="child">hello</span>
      </Providers>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders multiple children", () => {
    render(
      <Providers>
        <span data-testid="first">one</span>
        <span data-testid="second">two</span>
      </Providers>,
    );
    expect(screen.getByTestId("first")).toBeInTheDocument();
    expect(screen.getByTestId("second")).toBeInTheDocument();
  });

  it("renders without crashing when children is a string", () => {
    render(<Providers>plain text</Providers>);
    expect(screen.getByText("plain text")).toBeInTheDocument();
  });
});
