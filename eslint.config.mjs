// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript strict rules - only for TS source files
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        // Each package sets its own projectService in its local eslint.config.mjs.
        // The root config avoids setting it to prevent cross-package tsconfig confusion.
        projectService: {
          allowDefaultProject: ["*.mjs", "*.ts"],
          defaultProject: "./tsconfig.base.json",
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Forbid `any` in production and test code
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      // Only allow @ts-expect-error with a description, never @ts-ignore
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": true,
          "ts-nocheck": true,
        },
      ],
      // Enforce consistent imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },

  // Root-level Node scripts (scripts/*.mjs) - js.configs.recommended's no-undef
  // needs Node's globals declared explicitly here since this root config
  // (unlike each package's own eslint.config.mjs) has no other source of them.
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
      },
    },
  },

  // Prettier disables formatting rules that conflict
  prettierConfig,

  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/packages/database/src/generated/**",
    ],
  },
]);
