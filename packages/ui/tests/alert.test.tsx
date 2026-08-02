import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alert } from "../src";

describe("Alert", () => {
  it("returns null when message is undefined", () => {
    const { container } = render(<Alert />);
    expect(container).toBeEmptyDOMElement();
  });

  it("returns null when message is null", () => {
    const { container } = render(<Alert message={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("returns null when message is empty string", () => {
    const { container } = render(<Alert message="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the message text", () => {
    render(<Alert message="Something went wrong" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("applies error variant styles by default", () => {
    render(<Alert message="err" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("bg-red-50");
    expect(alert).toHaveClass("text-red-700");
  });

  it("applies success variant styles", () => {
    render(<Alert message="ok" variant="success" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("bg-green-50");
    expect(alert).toHaveClass("text-green-700");
  });

  it("applies warning variant styles", () => {
    render(<Alert message="warn" variant="warning" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("bg-yellow-50");
    expect(alert).toHaveClass("text-yellow-800");
  });

  it("applies error variant styles explicitly", () => {
    render(<Alert message="err" variant="error" />);
    expect(screen.getByRole("alert")).toHaveClass("bg-red-50");
  });

  it("merges custom className", () => {
    render(<Alert message="msg" className="mt-2" />);
    expect(screen.getByRole("alert")).toHaveClass("mt-2");
  });

  it("has role=alert for accessibility", () => {
    render(<Alert message="msg" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders all variants without throwing", () => {
    const variants = ["error", "success", "warning"] as const;
    for (const variant of variants) {
      const { unmount } = render(<Alert message={variant} variant={variant} />);
      expect(screen.getByRole("alert")).toHaveTextContent(variant);
      unmount();
    }
  });
});
