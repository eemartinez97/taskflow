import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { NoOrgState } from "@/components/common/no-org-state";
import { renderUI } from "../../helpers/render";
import { setupRouterMock } from "@/tests/support/render";

// next/link and next/navigation are mocked globally in tests/setup/integration.ui.ts

vi.mock("@/components/organizations/create-org-dialog", () => ({
  CreateOrgDialog: ({
    open,
    onCreated,
  }: {
    open: boolean;
    onCreated: (id: string) => void;
  }) =>
    open ? (
      <div data-testid="create-org-dialog">
        <button
          onClick={() => {
            onCreated("new-org-id");
          }}
        >
          Confirm create
        </button>
      </div>
    ) : null,
}));

describe("NoOrgState", () => {
  // -- Rendering --

  it("renders the main heading", () => {
    setupRouterMock();
    renderUI(<NoOrgState />);

    expect(
      screen.getByRole("heading", { name: /not part of any organization/i }),
    ).toBeInTheDocument();
  });

  it("opens CreateOrgDialog when 'create one' is clicked", () => {
    setupRouterMock();
    renderUI(<NoOrgState />);

    fireEvent.click(screen.getByRole("button", { name: /create one/i }));

    expect(screen.getByTestId("create-org-dialog")).toBeInTheDocument();
  });

  it("refreshes the router once CreateOrgDialog reports a new org", () => {
    const { router } = setupRouterMock();
    renderUI(<NoOrgState />);

    fireEvent.click(screen.getByRole("button", { name: /create one/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm create" }));

    expect(router.refresh).toHaveBeenCalled();
  });

  // -- context prop --

  it("renders the context paragraph when the context prop is provided", () => {
    setupRouterMock();
    const context = "Projects are grouped inside organizations.";
    renderUI(<NoOrgState context={context} />);

    expect(screen.getByText(context)).toBeInTheDocument();
  });

  it("does NOT render a context paragraph when the context prop is absent", () => {
    setupRouterMock();
    renderUI(<NoOrgState />);

    // The only paragraphs present should be the generic invite/create messages
    expect(screen.queryByText(/projects are grouped/i)).not.toBeInTheDocument();
  });

  it.each([
    "Tasks are assigned within projects and organizations.",
    "Team members are managed inside an organization.",
    "Create an organization to manage labels here.",
  ])("renders the custom context: '%s'", (context) => {
    setupRouterMock();
    renderUI(<NoOrgState context={context} />);

    expect(screen.getByText(context)).toBeInTheDocument();
  });
});
