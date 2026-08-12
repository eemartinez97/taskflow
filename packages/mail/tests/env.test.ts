import { describe, expect, it } from "vitest";
import { z } from "zod";
import { mailEnvShape } from "../src/env";

const schema = z.object(mailEnvShape);

describe("mailEnvShape", () => {
  it("defaults EMAIL_FROM to the Resend sandbox address when omitted", () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.EMAIL_FROM).toBe("TaskFlow <onboarding@resend.dev>");
  });

  it("leaves RESEND_API_KEY undefined when omitted", () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.RESEND_API_KEY).toBeUndefined();
  });

  it("accepts a bare email address for EMAIL_FROM", () => {
    expect(schema.safeParse({ EMAIL_FROM: "hello@taskflow.dev" }).success).toBe(true);
  });

  it("accepts a fully-bracketed 'Name <email>' address for EMAIL_FROM", () => {
    expect(schema.safeParse({ EMAIL_FROM: "TaskFlow <hello@taskflow.dev>" }).success).toBe(true);
  });

  it("rejects a 'Name <email' value missing the closing bracket", () => {
    expect(schema.safeParse({ EMAIL_FROM: "TaskFlow <hello@taskflow.dev" }).success).toBe(false);
  });

  it("rejects a 'Name email>' value missing the opening bracket", () => {
    expect(schema.safeParse({ EMAIL_FROM: "TaskFlow hello@taskflow.dev>" }).success).toBe(false);
  });

  it("rejects an empty RESEND_API_KEY", () => {
    expect(schema.safeParse({ RESEND_API_KEY: "" }).success).toBe(false);
  });

  it("accepts a non-empty RESEND_API_KEY", () => {
    expect(schema.safeParse({ RESEND_API_KEY: "re_test_key" }).success).toBe(true);
  });
});
