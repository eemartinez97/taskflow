// @ts-check
import baseConfig from "@taskflow/config/eslint/base";
import { defineConfig } from "eslint/config";

export default defineConfig([
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // tsconfig.json now includes both src/ and tests/ - no allowDefaultProject needed
          allowDefaultProject: ["eslint.config.mjs", "vitest.config.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // {
  //   files: ["tests/**/*.ts"],
  //   rules: {
  //     // tRPC caller types are deeply inferred generics that cannot be written by hand
  //     "@typescript-eslint/explicit-module-boundary-types": "off",
  //     // mocks legitimately cast through unknown
  //     "@typescript-eslint/no-unsafe-assignment": "off",
  //     "@typescript-eslint/unbound-method": "off",
  //   },
  // }
]);
