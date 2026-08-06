import { describe, expect, it, vi } from "vitest";

const sendMock = vi.hoisted(() => vi.fn());
const ResendMock = vi.hoisted(() =>
  vi.fn().mockImplementation(function ResendStub(this: { emails: { send: typeof sendMock } }) {
    this.emails = { send: sendMock };
  }),
);

vi.mock("resend", () => ({ Resend: ResendMock }));

const { ResendEmailSender } = await import("../src/providers/resend");

describe("ResendEmailSender", () => {
  it("constructs the Resend client with the given API key", () => {
    new ResendEmailSender({ apiKey: "re_test_key", from: "TaskFlow <noreply@taskflow.dev>" });

    expect(ResendMock).toHaveBeenCalledWith("re_test_key");
  });

  it("sends with from/to/subject/html and omits text when not provided", async () => {
    sendMock.mockResolvedValueOnce({ data: { id: "msg_1" }, error: null });
    const sender = new ResendEmailSender({
      apiKey: "re_test_key",
      from: "TaskFlow <noreply@taskflow.dev>",
    });

    const result = await sender.send({ to: "a@b.com", subject: "Hi", html: "<p>Hi</p>" });

    expect(result).toEqual({ success: true, messageId: "msg_1" });
    expect(sendMock).toHaveBeenCalledWith({
      from: "TaskFlow <noreply@taskflow.dev>",
      to: ["a@b.com"],
      subject: "Hi",
      html: "<p>Hi</p>",
    });
  });

  it("includes text in the payload when provided", async () => {
    sendMock.mockResolvedValueOnce({ data: { id: "msg_2" }, error: null });
    const sender = new ResendEmailSender({ apiKey: "re_test_key", from: "noreply@taskflow.dev" });

    await sender.send({ to: "a@b.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi" });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Hi", to: ["a@b.com"] }),
    );
  });

  it("returns a failure result when the Resend API returns an error", async () => {
    sendMock.mockResolvedValueOnce({ data: null, error: { message: "invalid API key" } });
    const sender = new ResendEmailSender({ apiKey: "bad_key", from: "noreply@taskflow.dev" });

    const result = await sender.send({ to: "a@b.com", subject: "Hi", html: "<p>Hi</p>" });

    expect(result).toEqual({ success: false, error: "invalid API key" });
  });

  it("returns a generic failure message when a non-Error value is thrown", async () => {
    sendMock.mockRejectedValueOnce("boom");
    const sender = new ResendEmailSender({ apiKey: "re_test_key", from: "noreply@taskflow.dev" });

    const result = await sender.send({ to: "a@b.com", subject: "Hi", html: "<p>Hi</p>" });

    expect(result).toEqual({ success: false, error: "Unknown error" });
  });

  it("returns a failure result instead of hanging forever when the Resend call never settles", async () => {
    vi.useFakeTimers();
    sendMock.mockReturnValueOnce(new Promise(() => {/* never resolves */}));
    const sender = new ResendEmailSender({ apiKey: "re_test_key", from: "noreply@taskflow.dev" });

    const resultPromise = sender.send({ to: "a@b.com", subject: "Hi", html: "<p>Hi</p>" });
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await resultPromise;

    expect(result).toEqual({ success: false, error: "Resend request timed out after 10000ms" });
    vi.useRealTimers();
  });
});
