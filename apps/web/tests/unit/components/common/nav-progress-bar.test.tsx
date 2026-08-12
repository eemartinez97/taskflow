import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JSX } from "react";

import { usePathname } from "next/navigation";
import { NavProgressBar } from "@/components/common/nav-progress-bar";
import { endNavProgress, startNavProgress } from "@/lib/utils/nav-progress";

afterEach(() => {
  endNavProgress();
  document.documentElement.classList.remove("tf-nav-loading");
  vi.useRealTimers();
});

/** jsdom doesn't implement real navigation - preventDefault keeps clicking a
 * real <a> in these tests from logging "Not implemented" noise. */
function TestLink(props: React.ComponentProps<"a">): JSX.Element {
  return (
    <a
      {...props}
      onClick={(e) => {
        e.preventDefault();
      }}
    />
  );
}

function clickLink(): void {
  act(() => {
    fireEvent.click(screen.getByRole("link"), { button: 0 });
  });
}

describe("NavProgressBar", () => {
  it("renders nothing and adds no loading class while inactive", () => {
    const { container } = render(<NavProgressBar />);
    expect(container).toBeEmptyDOMElement();
    expect(document.documentElement).not.toHaveClass("tf-nav-loading");
  });

  it("renders the bar and marks <html> as loading once navigation starts", () => {
    render(<NavProgressBar />);

    act(() => {
      startNavProgress();
    });

    expect(document.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    expect(document.documentElement).toHaveClass("tf-nav-loading");
  });

  it("clears progress when the pathname changes", () => {
    vi.mocked(usePathname).mockReturnValue("/projects");
    const { rerender } = render(<NavProgressBar />);
    act(() => {
      startNavProgress();
    });
    expect(document.documentElement).toHaveClass("tf-nav-loading");

    vi.mocked(usePathname).mockReturnValue("/tasks");
    rerender(<NavProgressBar />);
    expect(document.documentElement).not.toHaveClass("tf-nav-loading");
  });

  it("force-clears via the fallback timer if the pathname never changes", () => {
    vi.useFakeTimers();
    render(<NavProgressBar />);
    act(() => {
      startNavProgress();
    });
    expect(document.documentElement).toHaveClass("tf-nav-loading");

    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(document.documentElement).not.toHaveClass("tf-nav-loading");
  });

  it("starts progress when clicking an internal link to a different page", () => {
    render(
      <>
        <NavProgressBar />
        <TestLink href="/tasks">Tasks</TestLink>
      </>,
    );
    clickLink();
    expect(document.documentElement).toHaveClass("tf-nav-loading");
  });

  it("ignores non-left-button clicks", () => {
    render(
      <>
        <NavProgressBar />
        <TestLink href="/tasks">Tasks</TestLink>
      </>,
    );
    act(() => {
      fireEvent.click(screen.getByRole("link"), { button: 1 });
    });
    expect(document.documentElement).not.toHaveClass("tf-nav-loading");
  });

  it("ignores clicks with a modifier key held", () => {
    render(
      <>
        <NavProgressBar />
        <TestLink href="/tasks">Tasks</TestLink>
      </>,
    );
    act(() => {
      fireEvent.click(screen.getByRole("link"), { button: 0, metaKey: true });
    });
    expect(document.documentElement).not.toHaveClass("tf-nav-loading");
  });

  it("ignores clicks that don't land on an anchor", () => {
    render(
      <>
        <NavProgressBar />
        <button type="button">Not a link</button>
      </>,
    );
    act(() => {
      fireEvent.click(screen.getByRole("button"), { button: 0 });
    });
    expect(document.documentElement).not.toHaveClass("tf-nav-loading");
  });

  it("ignores anchors targeting a new tab", () => {
    render(
      <>
        <NavProgressBar />
        <TestLink href="/tasks" target="_blank" rel="noreferrer">
          Tasks
        </TestLink>
      </>,
    );
    clickLink();
    expect(document.documentElement).not.toHaveClass("tf-nav-loading");
  });

  it("ignores anchors with a download attribute", () => {
    render(
      <>
        <NavProgressBar />
        <TestLink href="/file.csv" download>
          Download
        </TestLink>
      </>,
    );
    clickLink();
    expect(document.documentElement).not.toHaveClass("tf-nav-loading");
  });

  it("ignores hash-only anchors", () => {
    render(
      <>
        <NavProgressBar />
        <TestLink href="#section">Jump</TestLink>
      </>,
    );
    clickLink();
    expect(document.documentElement).not.toHaveClass("tf-nav-loading");
  });

  it("ignores anchors with an unparseable href", () => {
    render(
      <>
        <NavProgressBar />
        <TestLink href="http://[">Broken</TestLink>
      </>,
    );
    clickLink();
    expect(document.documentElement).not.toHaveClass("tf-nav-loading");
  });

  it("ignores cross-origin anchors", () => {
    render(
      <>
        <NavProgressBar />
        <TestLink href="https://example.com/foo">External</TestLink>
      </>,
    );
    clickLink();
    expect(document.documentElement).not.toHaveClass("tf-nav-loading");
  });

  it("ignores anchors pointing at the current URL", () => {
    render(
      <>
        <NavProgressBar />
        <TestLink href={window.location.pathname}>Here</TestLink>
      </>,
    );
    clickLink();
    expect(document.documentElement).not.toHaveClass("tf-nav-loading");
  });

  it("ignores clicks on a nested interactive control inside the anchor", () => {
    render(
      <>
        <NavProgressBar />
        <TestLink href="/tasks">
          Tasks
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            Menu
          </button>
        </TestLink>
      </>,
    );
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Menu" }), { button: 0 });
    });
    expect(document.documentElement).not.toHaveClass("tf-nav-loading");
  });

  it("removes the click listener on unmount", () => {
    const { unmount } = render(
      <>
        <NavProgressBar />
        <TestLink href="/tasks">Tasks</TestLink>
      </>,
    );
    const anchor = screen.getByRole("link");
    // React's synthetic onClick (which calls preventDefault) is gone once
    // the component unmounts - add a raw listener so jsdom doesn't also log
    // real-navigation noise for this deliberately-detached click.
    anchor.addEventListener("click", (e) => {
      e.preventDefault();
    });
    unmount();
    act(() => {
      fireEvent.click(anchor, { button: 0 });
    });
    expect(document.documentElement).not.toHaveClass("tf-nav-loading");
  });
});
