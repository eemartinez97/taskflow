import { describe, expect, it, vi } from "vitest";
import { ConsoleEmailSender } from "../src/providers/console";

describe("ConsoleEmailSender", () => {
  it("resolves with success and a fixed messageId", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const sender = new ConsoleEmailSender();

    const result = await sender.send({ to: "a@b.com", subject: "Hi", html: "<p>Hi</p>" });

    expect(result).toEqual({ success: true, messageId: "console-dev" });
  });

  it("logs the recipient, subject, and html body instead of sending", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const sender = new ConsoleEmailSender();

    await sender.send({ to: "a@b.com", subject: "Hi there", html: "<p>Body</p>" });

    const logged = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).toContain("a@b.com");
    expect(logged).toContain("Hi there");
    expect(logged).toContain("<p>Body</p>");
  });
});
