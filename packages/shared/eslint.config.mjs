// @ts-check
import baseConfig from "@taskflow/config/eslint/base";
import { defineConfig } from "eslint/config";

export default defineConfig([
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Allow config files at root that are not listed in tsconfig include
          allowDefaultProject: ["vitest.config.ts", "eslint.config.mjs"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]);
