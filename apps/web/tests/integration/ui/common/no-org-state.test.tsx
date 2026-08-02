import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { NoOrgState } from "@/components/common/no-org-state";
import { renderUI } from "../../helpers/render";

// next/link is mocked globally in tests/setup/integration.ui.ts

describe("NoOrgState", () => {
  // -- Rendering --

  it("renders the main heading", () => {
    renderUI(<NoOrgState />);

    expect(
      screen.getByRole("heading", { name: /not part of any organization/i }),
    ).toBeInTheDocument();
  });

  it("renders the 'or create one' link pointing to /onboarding", () => {
    renderUI(<NoOrgState />);

    const link = screen.getByRole("link", { name: /or create one/i });
    expect(link).toHaveAttribute("href", "/onboarding");
  });

  // -- context prop --

  it("renders the context paragraph when the context prop is provided", () => {
    const context = "Projects are grouped inside organizations.";
    renderUI(<NoOrgState context={context} />);

    expect(screen.getByText(context)).toBeInTheDocument();
  });

  it("does NOT render a context paragraph when the context prop is absent", () => {
    renderUI(<NoOrgState />);

    // The only paragraphs present should be the generic invite/create messages
    expect(screen.queryByText(/projects are grouped/i)).not.toBeInTheDocument();
  });

  it.each([
    "Tasks are assigned within projects and organizations.",
    "Team members are managed inside an organization.",
    "Create an organization to manage labels here.",
  ])("renders the custom context: '%s'", (context) => {
    renderUI(<NoOrgState context={context} />);

    expect(screen.getByText(context)).toBeInTheDocument();
  });
});
