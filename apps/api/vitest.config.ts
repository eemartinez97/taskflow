import { baseVitestConfig, mergeConfig } from "@taskflow/config/vitest/base";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    resolve: {
      alias: {
        "@taskflow/database": fileURLToPath(
          new URL("./tests/mocks/database-mock.ts", import.meta.url),
        ),
      },
    },
    test: {
      environment: "node",
      // Vitest 4: use `projects` pattern for unit / integration split
      // Integration tests are added later (Testcontainers)
      include: ["tests/**/*.test.ts"],
      setupFiles: ["./tests/setup.ts"],
      coverage: {
        include: ["src/**/*.ts"],
        exclude: [
          "src/main.ts", // entry point - only side-effects
          "src/server.ts", // HTTP server bootstrap - integration test territory
        ],
        thresholds: {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
      },
    },
  }),
);
