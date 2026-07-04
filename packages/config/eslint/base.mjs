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
    rules: {
      // Forbid `any` in production and test code
      "@typescript-eslint/no-explicit-any": "error",

      // Require explicit return types on exported functions
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

      // Enforce `import type` for type-only imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // Prefer nullish coalescing over || for nullable values
      "@typescript-eslint/prefer-nullish-coalescing": "error",

      // No non-null assertions - use proper narrowing
      "@typescript-eslint/no-non-null-assertion": "error",

      /**
       * Allow intentionally unused variables/parameters prefixed with `_`.
       * Standard TypeScript convention for interface-conforming signatures
       * where the param is required by the type but not needed in the impl.
       *
       * Examples:
       *   function handler(_req: Request, res: Response) { ... }
       *   const { password: _password, ...rest } = user;
       */
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },

  {
    files: ["**/tests/**/*.ts", "**/*.test.ts"],
    rules: {
      /**
       * unbound-method: OFF in tests only.
       *
       * The Vitest pattern `expect(mock.fn).toHaveBeenCalled()` separates the
       * method from its object, triggering this rule as a false positive.
       * Documented by typescript-eslint: https://typescript-eslint.io/rules/unbound-method/
       *
       * Fix: use vi.mocked(mock.fn) for typed mock assertions.
       * All other strict rules remain active in tests.
       */
      "@typescript-eslint/unbound-method": "off",
    },
  },

  // Prettier disables formatting rules that conflict
  prettierConfig,

  // Global ignores
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
