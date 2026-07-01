import { baseVitestConfig, mergeConfig } from "@taskflow/config/vitest/base";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "."),
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      include: ["tests/**/*.test.{ts,tsx}"],
      setupFiles: ["./tests/setup.ts"],
      coverage: {
        include: ["lib/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
        exclude: [
          "app/layout.tsx", // Root layout, HTML shell, no logic
          "app/globals.css",
          "**/*.d.ts",
          "app/api/auth/\\[...nextauth\\]/route.ts",
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
