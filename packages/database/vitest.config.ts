import { baseVitestConfig, defineConfig, mergeConfig } from "@taskflow/config/vitest/base";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      environment: "node",
      coverage: {
        include: ["src/**/*.ts"],
        exclude: ["src/generated/**", "src/index.ts"],
      },
    },
  }),
);
