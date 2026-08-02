import { describe, expect, it, vi } from "vitest";
import {
  addOnlineUser,
  getOnlineUsers,
  getServerOnlineUsers,
  removeOnlineUser,
  resetOnlineUsers,
  setOnlineUsers,
  subscribe,
} from "@/lib/socket/presence-store";

describe("presence-store", () => {
  it("setOnlineUsers replaces the whole roster and notifies", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    setOnlineUsers(["u1", "u2"]);
    expect(getOnlineUsers()).toEqual(new Set(["u1", "u2"]));
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("addOnlineUser adds a new user and notifies", () => {
    setOnlineUsers([]);
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    addOnlineUser("u3");
    expect(getOnlineUsers().has("u3")).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("addOnlineUser is a no-op (no emit) when the user is already present", () => {
    setOnlineUsers(["u1"]);
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    addOnlineUser("u1");
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("removeOnlineUser removes a present user and notifies", () => {
    setOnlineUsers(["u1"]);
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    removeOnlineUser("u1");
    expect(getOnlineUsers().has("u1")).toBe(false);
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("removeOnlineUser is a no-op when the user is absent", () => {
    setOnlineUsers([]);
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    removeOnlineUser("ghost");
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("resetOnlineUsers clears the roster and notifies only if non-empty", () => {
    setOnlineUsers(["u1"]);
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    resetOnlineUsers();
    expect(getOnlineUsers().size).toBe(0);
    expect(listener).toHaveBeenCalledOnce();
    listener.mockClear();
    resetOnlineUsers(); // already empty -> no-op
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("getServerOnlineUsers always returns an empty set", () => {
    expect(getServerOnlineUsers().size).toBe(0);
  });
});
