import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { Mail } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { renderUI } from "../../helpers/render";

// -- Tests --

describe("EmptyState", () => {
  it("renders the title", () => {
    renderUI(<EmptyState icon={Mail} title="Nothing here yet" />);

    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    renderUI(<EmptyState icon={Mail} title="Nothing here yet" description="Come back later." />);

    expect(screen.getByText("Come back later.")).toBeInTheDocument();
  });

  it("renders no description when omitted", () => {
    renderUI(<EmptyState icon={Mail} title="Nothing here yet" />);

    expect(screen.queryByText("Come back later.")).not.toBeInTheDocument();
  });

  it("renders no action button when action is omitted", () => {
    renderUI(<EmptyState icon={Mail} title="Nothing here yet" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the action button with its label", () => {
    renderUI(
      <EmptyState
        icon={Mail}
        title="Nothing here yet"
        action={{ label: "Do it", onClick: vi.fn() }}
      />,
    );

    expect(screen.getByRole("button", { name: "Do it" })).toBeInTheDocument();
  });

  it("calls the action's onClick when clicked", () => {
    const onClick = vi.fn();
    renderUI(
      <EmptyState icon={Mail} title="Nothing here yet" action={{ label: "Do it", onClick }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Do it" }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
