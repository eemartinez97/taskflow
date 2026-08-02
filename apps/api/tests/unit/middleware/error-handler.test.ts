import { beforeEach, describe, expect, it, vi } from "vitest";

import { isProduction } from "../../../src/config/env";
import { errorHandler, type AppError } from "../../../src/middleware/error-handler";
import { mockLogger } from "../../mocks/logger";
import { errorBody, makeMockNext, makeMockReq, makeMockRes } from "../../helpers";

vi.mock("../../../src/config/env");

function run(err: AppError): ReturnType<typeof makeMockRes> {
  const mock = makeMockRes();
  errorHandler(err, makeMockReq(), mock.res, makeMockNext());
  return mock;
}

describe("errorHandler", () => {
  beforeEach(() => {
    vi.mocked(isProduction).mockReturnValue(false);
  });

  it("defaults to 500 / INTERNAL_ERROR", () => {
    const { statusMock, jsonMock } = run(new Error("boom"));

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(errorBody("boom", "INTERNAL_ERROR"));
  });

  it("honours statusCode and code when provided", () => {
    const err: AppError = Object.assign(new Error("nope"), {
      statusCode: 403,
      code: "FORBIDDEN",
    });

    const { statusMock, jsonMock } = run(err);

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith(errorBody("nope", "FORBIDDEN"));
  });

  it("masks 500 messages in production", () => {
    vi.mocked(isProduction).mockReturnValue(true);

    const { jsonMock } = run(new Error("SELECT * FROM users failed at 10.0.0.4"));

    expect(jsonMock).toHaveBeenCalledWith(errorBody("Internal server error", "INTERNAL_ERROR"));
  });

  it("does NOT mask 4xx messages in production", () => {
    vi.mocked(isProduction).mockReturnValue(true);

    const err: AppError = Object.assign(new Error("Invalid slug"), { statusCode: 400 });
    const { jsonMock } = run(err);

    expect(jsonMock).toHaveBeenCalledWith(errorBody("Invalid slug", "INTERNAL_ERROR"));
  });

  it("logs the stack outside production", () => {
    run(new Error("boom"));

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({ stack: expect.any(String) as unknown }) as unknown,
        statusCode: 500,
      }),
      "Request error",
    );
  });

  it("omits the stack in production", () => {
    vi.mocked(isProduction).mockReturnValue(true);

    run(new Error("boom"));

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.objectContaining({ stack: undefined }) as unknown }),
      "Request error",
    );
  });
});
