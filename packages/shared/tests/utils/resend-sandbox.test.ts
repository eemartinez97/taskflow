import { describe, expect, it } from "vitest";
import { isResendSandboxAddress } from "../../src/utils/resend-sandbox";

describe("isResendSandboxAddress", () => {
  it("returns true for the bare sandbox address", () => {
    expect(isResendSandboxAddress("onboarding@resend.dev")).toBe(true);
  });

  it("returns true for the sandbox address in 'Name <email>' form", () => {
    expect(isResendSandboxAddress("TaskFlow <onboarding@resend.dev>")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isResendSandboxAddress("Onboarding@Resend.Dev")).toBe(true);
  });

  it("returns false for a verified sending domain", () => {
    expect(isResendSandboxAddress("TaskFlow <hello@taskflow.dev>")).toBe(false);
  });
});
