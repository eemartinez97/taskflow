import { baseVitestConfig, mergeConfig, defineConfig } from "@taskflow/config/vitest/base";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "."),
        "server-only": path.resolve(import.meta.dirname, "./tests/mocks/server-only.ts"),
      },
    },
    test: {
      globals: true,
      css: false,
      projects: [
        {
          extends: true,
          test: {
            name: "unit",
            environment: "jsdom",
            include: ["tests/unit/**/*.test.{ts,tsx}"],
            setupFiles: ["./tests/setup/unit.ts"],
          },
        },
        {
          extends: true,
          test: {
            name: "integration-server",
            environment: "node",
            include: ["tests/integration/server/**/*.test.{ts,tsx}"],
            setupFiles: ["./tests/setup/integration.node.ts"],
          },
        },
        {
          extends: true,
          test: {
            name: "integration-ui",
            environment: "jsdom",
            include: ["tests/integration/ui/**/*.test.{ts,tsx}"],
            setupFiles: ["./tests/setup/integration.ui.ts"],
          },
        },
      ],
      coverage: {
        include: [
          "lib/**/*.{ts,tsx}",
          "app/**/*.{ts,tsx}",
          "components/**/*.{ts,tsx}",
          "auth.ts",
          "proxy.ts",
        ],
        exclude: [
          "app/layout.tsx",
          // "app/providers.tsx",
          "app/(dashboard)/layout.tsx",
          "app/(auth)/layout.tsx",
          "app/api/auth/\\[...nextauth\\]/route.ts",
          "types/**",
          "**/*.config.{ts,tsx}",
          ".next/**",
          "next-env.d.ts",
        ],
        thresholds: {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
      },
    },
  }),
);
