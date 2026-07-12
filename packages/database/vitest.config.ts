import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",

    // passWithNoTests lives at root level — not inside individual projects
    passWithNoTests: true,

    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/selects.ts"],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },

    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
        },
      },
    ],
  },
});
