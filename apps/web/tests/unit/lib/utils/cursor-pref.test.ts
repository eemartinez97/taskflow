import { afterEach, describe, expect, it } from "vitest";
import {
  CURSORS_PREF_COOKIE,
  getServerCursorsHidden,
  readCursorsHidden,
  setCursorsHidden,
} from "@/lib/utils/cursor-pref";

afterEach(() => {
  document.cookie = `${CURSORS_PREF_COOKIE}=; path=/; max-age=0`;
});

describe("cursor-pref store", () => {
  it("defaults to false when unset", () => {
    expect(readCursorsHidden()).toBe(false);
  });

  it("persists true and reads it back", () => {
    setCursorsHidden(true);
    expect(readCursorsHidden()).toBe(true);
  });

  it("serializes false as cookie deletion", () => {
    setCursorsHidden(true);
    setCursorsHidden(false);
    expect(readCursorsHidden()).toBe(false);
  });

  it("server snapshot is always false", () => {
    expect(getServerCursorsHidden()).toBe(false);
  });
});
