import { baseVitestConfig, mergeConfig, defineConfig } from "@taskflow/config/vitest/base";
import react from "@vitejs/plugin-react";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    plugins: [react()],
    test: {
      environment: "jsdom",
      globals: true,
      include: ["tests/**/*.test.{ts,tsx}"],
      setupFiles: ["./tests/setup.ts"],
      coverage: {
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/index.ts", "src/theme.css"],
        thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
      },
    },
  }),
);
