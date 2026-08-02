import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../src";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("applies padding by default", () => {
    render(<Card data-testid="card">Content</Card>);
    expect(screen.getByTestId("card")).toHaveClass("p-4");
  });

  it("removes padding when noPadding is true", () => {
    render(
      <Card data-testid="card" noPadding>
        Content
      </Card>,
    );
    expect(screen.getByTestId("card")).not.toHaveClass("p-4");
  });

  it("renders all sub-components together", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it("applies default spacing with divider to CardHeader", () => {
    render(
      <Card>
        <CardHeader data-testid="header" spacing="default" divider>
          <CardTitle>Title</CardTitle>
        </CardHeader>
      </Card>,
    );
    const header = screen.getByTestId("header");
    expect(header).toHaveClass("pb-5", "mb-5", "border-b", "border-gray-100");
  });

  it("applies default spacing without divider to CardHeader", () => {
    render(
      <Card>
        <CardHeader data-testid="header" spacing="default" divider={false}>
          <CardTitle>Title</CardTitle>
        </CardHeader>
      </Card>,
    );
    const header = screen.getByTestId("header");
    expect(header).toHaveClass("mb-6");
    expect(header).not.toHaveClass("border-b");
  });

  it("applies compact spacing with divider to CardHeader", () => {
    render(
      <Card>
        <CardHeader data-testid="header" spacing="compact" divider>
          <CardTitle>Title</CardTitle>
        </CardHeader>
      </Card>,
    );
    const header = screen.getByTestId("header");
    expect(header).toHaveClass("pb-3", "mb-3", "border-b", "border-gray-100");
  });

  it("applies compact spacing without divider to CardHeader", () => {
    render(
      <Card>
        <CardHeader data-testid="header" spacing="compact" divider={false}>
          <CardTitle>Title</CardTitle>
        </CardHeader>
      </Card>,
    );
    const header = screen.getByTestId("header");
    expect(header).toHaveClass("mb-3");
    expect(header).not.toHaveClass("border-b");
  });
});
