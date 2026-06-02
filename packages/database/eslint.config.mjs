// @ts-check
import baseConfig from "@taskflow/config/eslint/base";
import { defineConfig } from "eslint/config";

export default defineConfig([
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["vitest.config.ts", "eslint.config.mjs", "prisma.config.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: ["src/generated/**"],
  },
]);
