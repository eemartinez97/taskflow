import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/toast/toaster", () => ({ Toaster: () => <div>Toaster</div> }));

import { Providers } from "@/app/providers";

describe("Providers", () => {
  it("renders children wrapped by SessionProvider, TRPCProvider and Toaster", () => {
    render(
      <Providers>
        <p>App content</p>
      </Providers>,
    );
    expect(screen.getByText("App content")).toBeInTheDocument();
    expect(screen.getByText("Toaster")).toBeInTheDocument();
  });
});
