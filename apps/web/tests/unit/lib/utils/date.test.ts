import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatDate, formatRelativeTime } from "@/lib/utils/date";

const NOW = new Date("2026-07-25T12:00:00.000Z");

describe("formatDate", () => {
  it("formats a Date pinned to en-US, regardless of the runtime's default locale", () => {
    const date = new Date("2026-08-21T00:00:00.000Z");
    expect(formatDate(date)).toBe(date.toLocaleDateString("en-US"));
  });

  it("accepts an ISO string as well as a Date", () => {
    const iso = "2026-08-21T00:00:00.000Z";
    expect(formatDate(iso)).toBe(new Date(iso).toLocaleDateString("en-US"));
  });
});

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for less than a minute", () => {
    const date = new Date(NOW.getTime() - 30_000);
    expect(formatRelativeTime(date)).toBe("just now");
  });

  it("returns minutes for < 1 hour", () => {
    const date = new Date(NOW.getTime() - 5 * 60_000);
    expect(formatRelativeTime(date)).toBe("5m ago");
  });

  it("returns hours for < 24 hours", () => {
    const date = new Date(NOW.getTime() - 3 * 60 * 60_000);
    expect(formatRelativeTime(date)).toBe("3h ago");
  });

  it("returns days for < 7 days", () => {
    const date = new Date(NOW.getTime() - 2 * 24 * 60 * 60_000);
    expect(formatRelativeTime(date)).toBe("2d ago");
  });

  it("returns a localized date for >= 7 days", () => {
    const date = new Date(NOW.getTime() - 10 * 24 * 60 * 60_000);
    expect(formatRelativeTime(date)).toBe(date.toLocaleDateString("en-US"));
  });

  it("accepts an ISO string as well as a Date", () => {
    const iso = new Date(NOW.getTime() - 30_000).toISOString();
    expect(formatRelativeTime(iso)).toBe("just now");
  });
});
