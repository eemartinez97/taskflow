import { baseVitestConfig, defineConfig, mergeConfig } from "@taskflow/config/vitest/base";
import { fileURLToPath } from "node:url";

const databaseMockAlias = {
  "@taskflow/database": fileURLToPath(new URL("./tests/mocks/database-mock.ts", import.meta.url)),
};

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          resolve: { alias: databaseMockAlias },
          test: {
            name: "unit",
            environment: "node",
            include: ["tests/unit/**/*.test.ts"],
            setupFiles: ["./tests/setup.ts"],
            clearMocks: false, // handled centrally in tests/support/reset.ts
          },
        },
        {
          extends: true,
          test: {
            name: "integration",
            environment: "node",
            include: ["tests/integration/**/*.test.ts"],
            globalSetup: ["./tests/integration/setup/global-setup.ts"],
            setupFiles: ["./tests/integration/setup/setup.ts"],
            testTimeout: 60_000,
            hookTimeout: 180_000,
            fileParallelism: false,
            pool: "forks",
          },
        },
      ],
      coverage: {
        include: ["src/**/*.ts"],
        exclude: ["src/main.ts", "src/socket/events.ts", "src/config/__mocks__/**"],
        thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
      },
    },
  }),
);
