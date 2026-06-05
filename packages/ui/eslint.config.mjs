// @ts-check
import baseConfig from "@taskflow/config/eslint/base";
import { defineConfig } from "eslint/config";

export default defineConfig([
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mjs", "vitest.config.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]);
