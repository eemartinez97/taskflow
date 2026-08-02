import { describe, expect, it, vi } from "vitest";

import type * as loggerModule from "../../../src/config/logger";
import { isProduction } from "../../../src/config/env";
import { mockLogger } from "../../mocks/logger";

vi.mock("../../../src/config/env");

const { pinoFactory } = vi.hoisted(() => ({ pinoFactory: vi.fn<(opts?: unknown) => unknown>() }));
vi.mock("pino", () => ({ default: pinoFactory }));

type LoggerModule = typeof loggerModule;

pinoFactory.mockReturnValue(mockLogger);
vi.mocked(isProduction).mockReturnValue(false);

const { buildLoggerOptions } = await vi.importActual<LoggerModule>("../../../src/config/logger");

const [constructorOptions] = pinoFactory.mock.calls[0] ?? [];

describe("buildLoggerOptions", () => {
  it("uses the pino-pretty transport outside production", () => {
    vi.mocked(isProduction).mockReturnValue(false);

    expect(buildLoggerOptions()).toStrictEqual({
      level: "silent",
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
      },
    });
  });

  it("emits raw JSON with no transport in production", () => {
    vi.mocked(isProduction).mockReturnValue(true);

    expect(buildLoggerOptions()).toStrictEqual({ level: "silent" });
  });
});

describe("logger", () => {
  it("is constructed from buildLoggerOptions()", () => {
    vi.mocked(isProduction).mockReturnValue(false);
    // same state as when importing
    expect(constructorOptions).toStrictEqual(buildLoggerOptions());
  });
});
