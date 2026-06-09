import { describe, expect, vi, it, afterEach } from "vitest";

// Mock env BEFORE importing the module under test - vitest hoists vi.mock() calls
vi.mock("../../../src/config/env.js", async () => {
  const { envMockFactory } = await import("../../mocks/env.js");
  return envMockFactory();
});

// Mock logger to suppress output during tests
vi.mock("../../../src/config/logger.js", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { type AppError, createError, errorHandler } from "../../../src/middleware/error-handler.js";
import { type ErrorBody, makeMockNext, makeMockReq, makeMockRes } from "../../helpers.js";
import { isProduction } from "../../../src/config/env.js";

function call(err: AppError | Error): { status: number; body: ErrorBody } {
  const { res, statusMock } = makeMockRes();
  errorHandler(err, makeMockReq(), res, makeMockNext());

  const status = statusMock.mock.calls[0]?.[0] as number;
  const body = (statusMock.mock.results[0]?.value as { json: ReturnType<typeof vi.fn> }).json.mock
    .calls[0]?.[0] as ErrorBody;

  return { status, body };
}

describe("createError", () => {
  it("creates an Error with statusCode and code", () => {
    const err = createError("Not found", 404, "NOT_FOUND");
    expect(err.message).toBe("Not found");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("creates an Error without code when not provided", () => {
    const err = createError("Server error", 500);
    expect(err.code).toBeUndefined();
  });
});

describe("errorHandler", () => {
  afterEach(() => {
    vi.mocked(isProduction).mockReturnValue(false);
  });

  it("responds with the error statusCode", () => {
    expect(call(createError("Forbidden", 403, "FORBIDDEN")).status).toBe(403);
  });

  it("defaults to 500 when statusCode is not set", () => {
    expect(call(new Error("Boom")).status).toBe(500);
  });

  it("includes the error message in body in development", () => {
    vi.mocked(isProduction).mockReturnValue(false);
    expect(call(createError("Bad input", 400)).body.error.message).toBe("Bad input");
  });

  it("masks 500 message in production", () => {
    vi.mocked(isProduction).mockReturnValue(true);
    expect(call(new Error("Database password exposed")).body.error.message).toBe(
      "Internal server error",
    );
  });

  it("does NOT mask 4xx messages in production", () => {
    vi.mocked(isProduction).mockReturnValue(true);
    expect(call(createError("Invalid input", 422, "VALIDATION_ERROR")).body.error.message).toBe(
      "Invalid input",
    );
  });

  it("includes the error code in the JSON body", () => {
    expect(call(createError("Not found", 404, "NOT_FOUND")).body.error.code).toBe("NOT_FOUND");
  });

  it("defaults code INTERNAL_ERROR when not set", () => {
    expect(call(new Error("Generic")).body.error.code).toBe("INTERNAL_ERROR");
  });
});
