import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { UserAvatar } from "@/components/common/user-avatar";
import { renderUI } from "../../helpers/render";

// -- Tests --

describe("UserAvatar", () => {
  // -- Initials derivation --

  it("renders two uppercase initials from a full name", () => {
    renderUI(<UserAvatar user={{ name: "Alice Smith" }} />);

    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  it("renders a single initial from a one-word name", () => {
    renderUI(<UserAvatar user={{ name: "Alice" }} />);

    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders the first uppercase letter of the email when there is no name", () => {
    renderUI(<UserAvatar user={{ email: "bob@taskflow.dev" }} />);

    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it('renders "??" when both name and email are absent', () => {
    renderUI(<UserAvatar user={{}} />);

    expect(screen.getByText("??")).toBeInTheDocument();
  });

  it('renders "??" when name and email are explicitly null', () => {
    renderUI(<UserAvatar user={{ name: null, email: null }} />);

    expect(screen.getByText("??")).toBeInTheDocument();
  });

  it("renders only the first two initials from a multi-word name", () => {
    renderUI(<UserAvatar user={{ name: "Alice Marie Smith" }} />);

    // userInitials slices to 2 characters max
    expect(screen.getByText("AM")).toBeInTheDocument();
  });

  // -- Accessible label --

  it("sets aria-label to the user's display name", () => {
    renderUI(<UserAvatar user={{ name: "Alice Smith" }} />);

    expect(screen.getByLabelText("Alice Smith")).toBeInTheDocument();
  });

  it("sets aria-label to the email when there is no name", () => {
    renderUI(<UserAvatar user={{ email: "bob@taskflow.dev" }} />);

    expect(screen.getByLabelText("bob@taskflow.dev")).toBeInTheDocument();
  });

  it('sets aria-label to "User" when both name and email are absent', () => {
    renderUI(<UserAvatar user={{}} />);

    expect(screen.getByLabelText("User")).toBeInTheDocument();
  });

  it("sets the title attribute matching aria-label", () => {
    renderUI(<UserAvatar user={{ name: "Alice Smith" }} />);

    expect(screen.getByTitle("Alice Smith")).toBeInTheDocument();
  });

  // -- color prop --

  it("applies an inline backgroundColor style when color is provided", () => {
    renderUI(<UserAvatar user={{ name: "Alice" }} color="#FF0000" />);

    expect(screen.getByLabelText("Alice")).toHaveStyle({ backgroundColor: "#FF0000" });
  });

  it("does not apply an inline style attribute when no color is provided", () => {
    renderUI(<UserAvatar user={{ name: "Alice" }} />);

    expect(screen.getByLabelText("Alice").getAttribute("style")).toBeNull();
  });

  // -- size prop --

  it.each(["xs", "sm", "md"] as const)("renders without error for size='%s'", (size) => {
    renderUI(<UserAvatar user={{ name: "Alice Smith" }} size={size} />);

    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  // -- className prop --

  it("forwards the className prop to the root element", () => {
    renderUI(<UserAvatar user={{ name: "Alice" }} className="ring-2" />);

    expect(screen.getByLabelText("Alice")).toHaveClass("ring-2");
  });
});
