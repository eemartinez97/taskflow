import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Mail } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState icon={Mail} title="Nothing here yet" />);
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    render(<EmptyState icon={Mail} title="Nothing here yet" description="Come back later." />);
    expect(screen.getByText("Come back later.")).toBeInTheDocument();
  });

  it("renders no description paragraph when omitted", () => {
    render(<EmptyState icon={Mail} title="Nothing here yet" />);
    expect(screen.queryByText("Come back later.")).not.toBeInTheDocument();
  });

  it("renders no action button when action is omitted", () => {
    render(<EmptyState icon={Mail} title="Nothing here yet" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the action button and calls onClick when provided", async () => {
    const onClick = vi.fn();
    render(
      <EmptyState icon={Mail} title="Nothing here yet" action={{ label: "Do it", onClick }} />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Do it" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
