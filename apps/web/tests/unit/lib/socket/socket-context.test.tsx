import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SocketProvider, useSocketRef } from "@/lib/socket/socket-context";
import { mockSocket } from "@/tests/mocks/socket-io-client";
import type { JSX } from "react";

function Consumer(): JSX.Element {
  const ref = useSocketRef();
  return <p>{ref ? "has-ref" : "no-ref"}</p>;
}

describe("SocketProvider / useSocketRef", () => {
  it("returns null outside of a SocketProvider", () => {
    render(<Consumer />);
    expect(screen.getByText("no-ref")).toBeInTheDocument();
  });

  it("provides the socketRef to descendants inside a SocketProvider", () => {
    render(
      <SocketProvider socketRef={{ current: mockSocket as never }}>
        <Consumer />
      </SocketProvider>,
    );
    expect(screen.getByText("has-ref")).toBeInTheDocument();
  });
});
