import { describe, expect, it, beforeEach, vi } from "vitest";

describe("emailSender selection", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("uses the in-memory sender when ENABLE_TEST_ROUTES=true", async () => {
    vi.stubEnv("ENABLE_TEST_ROUTES", "true");
    const { emailSender, inMemoryEmailSender } = await import("@/lib/mail/sender");
    expect(emailSender).toBe(inMemoryEmailSender);
  });

  it("uses the createEmailSender result when ENABLE_TEST_ROUTES is not set", async () => {
    vi.stubEnv("ENABLE_TEST_ROUTES", "");
    const { emailSender, inMemoryEmailSender } = await import("@/lib/mail/sender");
    expect(emailSender).not.toBe(inMemoryEmailSender);
    expect(typeof emailSender.send).toBe("function");
  });

  it("does NOT use the in-memory sender when ENABLE_TEST_ROUTES=true but DATABASE_URL is not local (a leaked flag must not silently swallow real emails)", async () => {
    vi.stubEnv("ENABLE_TEST_ROUTES", "true");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@db.production-host.example.com:5432/app");
    const { emailSender, inMemoryEmailSender } = await import("@/lib/mail/sender");
    expect(emailSender).not.toBe(inMemoryEmailSender);
    expect(typeof emailSender.send).toBe("function");
  });
});
