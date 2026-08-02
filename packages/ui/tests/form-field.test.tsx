import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField, Input } from "../src";

describe("FormField", () => {
  it("renders the label text", () => {
    render(
      <FormField label="Email" htmlFor="email">
        <Input id="email" />
      </FormField>,
    );
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("associates label with control via htmlFor", () => {
    render(
      <FormField label="Username" htmlFor="username">
        <Input id="username" />
      </FormField>,
    );
    const label = screen.getByText("Username", { selector: "label" });
    expect(label).toHaveAttribute("for", "username");
  });

  it("renders required asterisk when required is true", () => {
    render(
      <FormField label="Name" htmlFor="name" required>
        <Input id="name" />
      </FormField>,
    );
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("does not render asterisk when required is false", () => {
    render(
      <FormField label="Name" htmlFor="name">
        <Input id="name" />
      </FormField>,
    );
    expect(screen.queryByText("*")).not.toBeInTheDocument();
  });

  it("renders children (form control)", () => {
    render(
      <FormField label="Field" htmlFor="f">
        <Input id="f" placeholder="test-placeholder" />
      </FormField>,
    );
    expect(screen.getByPlaceholderText("test-placeholder")).toBeInTheDocument();
  });

  it("does not render error message when error is undefined", () => {
    render(
      <FormField label="Field" htmlFor="f">
        <Input id="f" />
      </FormField>,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not render error message when error is empty string", () => {
    render(
      <FormField label="Field" htmlFor="f" error="">
        <Input id="f" />
      </FormField>,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders error message with role=alert when error is provided", () => {
    render(
      <FormField label="Field" htmlFor="f" error="This field is required">
        <Input id="f" />
      </FormField>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("This field is required");
    expect(alert).toHaveClass("text-red-600");
  });

  it("merges custom className into the wrapper div", () => {
    render(
      <FormField label="Field" htmlFor="f" className="my-custom">
        <Input id="f" />
      </FormField>,
    );
    const label = screen.getByText("Field", { selector: "label" });
    expect(label.parentElement).toHaveClass("my-custom");
    expect(label.parentElement).toHaveClass("flex");
    expect(label.parentElement).toHaveClass("flex-col");
  });

  it("renders both label and error simultaneously", () => {
    render(
      <FormField label="Email" htmlFor="email" required error="Invalid email">
        <Input id="email" hasError />
      </FormField>,
    );
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid email");
  });
});
