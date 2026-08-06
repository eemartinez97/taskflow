import { describe, expect, it } from "vitest";
import { InMemoryEmailSender } from "../src/providers/in-memory";

describe("InMemoryEmailSender", () => {
  it("captures a sent email and reports success", async () => {
    const sender = new InMemoryEmailSender();
    const result = await sender.send({ to: "a@b.com", subject: "Hi", html: "<p>Hi</p>" });
    expect(result.success).toBe(true);
    expect(result.messageId).toBe("memory-1");
  });

  it("findLastEmailTo returns the most recent email sent to that address", async () => {
    const sender = new InMemoryEmailSender();
    await sender.send({ to: "a@b.com", subject: "First", html: "<p>1</p>" });
    await sender.send({ to: "a@b.com", subject: "Second", html: "<p>2</p>" });
    expect(sender.findLastEmailTo("a@b.com")?.subject).toBe("Second");
  });

  it("findLastEmailTo returns null when nothing was captured for that address", () => {
    const sender = new InMemoryEmailSender();
    expect(sender.findLastEmailTo("nobody@b.com")).toBeNull();
  });

  it("clear() empties the captured list", async () => {
    const sender = new InMemoryEmailSender();
    await sender.send({ to: "a@b.com", subject: "Hi", html: "<p>Hi</p>" });
    sender.clear();
    expect(sender.findLastEmailTo("a@b.com")).toBeNull();
  });
});
