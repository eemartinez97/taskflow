import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isE2ERunMock = vi.fn((): boolean => false);
vi.mock("../../../src/utils/e2e", () => ({ isE2ERun: () => isE2ERunMock() }));

function mockEnvModule(overrides: Record<string, unknown>): void {
  vi.doMock("../../../src/config/env", () => ({
    env: {
      NODE_ENV: "test",
      EMAIL_FROM: "TaskFlow <onboarding@resend.dev>",
      RESEND_API_KEY: undefined,
      ...overrides,
    },
  }));
}

describe("apps/api mail sender", () => {
  beforeEach(() => {
    vi.resetModules();
    isE2ERunMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.doUnmock("../../../src/config/env");
  });

  it("importing the module does not construct a sender - the apps/web-boot-crash regression guard", async () => {
    // A config that WOULD throw if createEmailSenderFromEnv ran at module
    // scope (production + no RESEND_API_KEY). Importing must still succeed.
    mockEnvModule({ NODE_ENV: "production", RESEND_API_KEY: undefined });

    await expect(import("../../../src/mail/sender")).resolves.toBeDefined();
  });

  it("throws only once getEmailSender() is actually called under that same config", async () => {
    mockEnvModule({ NODE_ENV: "production", RESEND_API_KEY: undefined });
    const { getEmailSender } = await import("../../../src/mail/sender");

    expect(() => getEmailSender()).toThrow(/RESEND_API_KEY is required/);
  });

  it("returns the same EmailSender instance on repeated calls (memoized)", async () => {
    mockEnvModule({ RESEND_API_KEY: "re_test_key" });
    const { getEmailSender } = await import("../../../src/mail/sender");

    expect(getEmailSender()).toBe(getEmailSender());
  });

  it("returns the in-memory sender during an E2E run, regardless of RESEND_API_KEY", async () => {
    isE2ERunMock.mockReturnValue(true);
    mockEnvModule({ NODE_ENV: "production", RESEND_API_KEY: undefined });
    const { getEmailSender, inMemoryEmailSender } = await import("../../../src/mail/sender");

    expect(getEmailSender()).toBe(inMemoryEmailSender());
  });

  it("resetEmailSender() clears the memoized production sender", async () => {
    mockEnvModule({ RESEND_API_KEY: "re_test_key" });
    const { getEmailSender, resetEmailSender } = await import("../../../src/mail/sender");

    const first = getEmailSender();
    resetEmailSender();
    const second = getEmailSender();

    expect(second).not.toBe(first);
  });

  it("resetEmailSender() clears the memoized in-memory sender", async () => {
    isE2ERunMock.mockReturnValue(true);
    mockEnvModule({});
    const { inMemoryEmailSender, resetEmailSender } = await import("../../../src/mail/sender");

    const first = inMemoryEmailSender();
    resetEmailSender();
    const second = inMemoryEmailSender();

    expect(second).not.toBe(first);
  });
});
