import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserAvatar } from "@/components/common/user-avatar";

describe("UserAvatar", () => {
  it("renders initials derived from the user's name", () => {
    render(<UserAvatar user={{ name: "Alice Smith" }} />);
    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  it("sets the title/aria-label to the display name", () => {
    render(<UserAvatar user={{ name: "Alice" }} />);
    expect(screen.getByLabelText("Alice")).toBeInTheDocument();
  });

  it("applies a custom background color when provided", () => {
    render(<UserAvatar user={{ name: "Alice" }} color="#123456" />);
    expect(screen.getByLabelText("Alice")).toHaveStyle({ backgroundColor: "#123456" });
  });

  it("falls back to the default brand tint class with no color prop", () => {
    render(<UserAvatar user={{ name: "Alice" }} />);
    expect(screen.getByLabelText("Alice")).toHaveClass("bg-brand-100");
  });

  it.each(["xs", "sm", "md"] as const)("applies the %s size class", (size) => {
    render(<UserAvatar user={{ name: "Alice" }} size={size} />);
    expect(screen.getByLabelText("Alice")).toBeInTheDocument();
  });
});
