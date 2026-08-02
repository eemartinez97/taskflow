import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CursorPointer, shouldFlipCursorLabel } from "@/components/kanban/kanban-cursors";

describe("shouldFlipCursorLabel", () => {
  it("returns false when containerWidth is zero or negative", () => {
    expect(shouldFlipCursorLabel(100, 0)).toBe(false);
    expect(shouldFlipCursorLabel(100, -10)).toBe(false);
  });

  it("returns false when far from the right edge", () => {
    expect(shouldFlipCursorLabel(10, 1000)).toBe(false);
  });

  it("returns true when within the reserved label width of the right edge", () => {
    expect(shouldFlipCursorLabel(950, 1000)).toBe(true);
  });
});

describe("CursorPointer", () => {
  const cursor = { userId: "u1", x: 10, y: 20 };

  it("renders without a label when meta.name is absent", () => {
    render(<CursorPointer cursor={cursor} meta={undefined} />);
    expect(screen.queryByText(/./)).not.toBeInTheDocument();
  });

  it("renders the user's name label with the meta color", () => {
    render(
      <CursorPointer cursor={cursor} meta={{ userId: "u1", name: "Alice", color: "#123456" }} />,
    );
    expect(screen.getByText("Alice")).toHaveStyle({ backgroundColor: "#123456" });
  });

  it("applies the flip class when flip=true", () => {
    render(
      <CursorPointer cursor={cursor} meta={{ userId: "u1", name: "Alice", color: "#123" }} flip />,
    );
    expect(screen.getByText("Alice")).toHaveClass("right-full");
  });

  it("falls back to the default color when meta is absent", () => {
    const { container } = render(<CursorPointer cursor={cursor} meta={undefined} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
