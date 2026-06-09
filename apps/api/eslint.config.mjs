// @ts-check
import baseConfig from "@taskflow/config/eslint/base";
import { defineConfig } from "eslint/config";

export default defineConfig([
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // tsconfig.json now includes both src/ and tests/ — no allowDefaultProject needed
          allowDefaultProject: ["eslint.config.mjs", "vitest.config.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]);
