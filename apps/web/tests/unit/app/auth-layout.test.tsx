import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AuthLayout from "@/app/(auth)/layout";

describe("AuthLayout", () => {
  it("centers children within the layout shell", () => {
    render(
      <AuthLayout>
        <p>Auth content</p>
      </AuthLayout>,
    );
    expect(screen.getByText("Auth content")).toBeInTheDocument();
  });
});
