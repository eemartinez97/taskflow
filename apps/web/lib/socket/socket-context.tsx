"use client";

import type { JSX, ReactNode, RefObject } from "react";
import { createContext, useContext } from "react";

import type { AppSocket } from "./client";

const SocketContext = createContext<RefObject<AppSocket | null> | null>(null);

export function SocketProvider({
  socketRef,
  children,
}: {
  socketRef: RefObject<AppSocket | null>;
  children: ReactNode;
}): JSX.Element {
  return <SocketContext.Provider value={socketRef}>{children}</SocketContext.Provider>;
}

/** Returns null outside a board (e.g. the /tasks page) - callers must handle it. */
export function useSocketRef(): RefObject<AppSocket | null> | null {
  return useContext(SocketContext);
}
