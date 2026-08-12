// @ts-check
import { defineConfig } from "eslint/config";
import baseConfig from "@taskflow/config/eslint/base";
import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default defineConfig([
  // 1. Shared TypeScript + no-explicit-any rules from packages/config
  ...baseConfig,

  // 2. React - jsx-runtime flat config (React 17+ / React 19)
  {
    ...reactPlugin.configs.flat["jsx-runtime"],
    files: ["**/*.{ts,tsx,js,jsx}"],
  },

  // 3. React Hooks v7.0.1+ - spread configs.flat.recommended directly
  {
    ...reactHooksPlugin.configs.flat["recommended-latest"],
    files: ["**/*.{ts,tsx}"],
  },

  // 4. Next.js rules
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },

  // 5. Project-specific parser options for typed linting
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mjs", "postcss.config.mjs"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      /**
       * Arrow async functions in JSX event attributes.
       *
       * React 19 + react-hook-form pattern:
       *   <form onSubmit={handleSubmit(onSubmit)}>
       *
       * `handleSubmit` wraps an async functions and returns a function that
       * passes it to the DOM's `onSubmit` (typed as void). This is the
       * idiomatic pattern - the promise is handled internally by react-hook-form.
       *
       * Without this override every form submit handler would need an explicit
       * void wrapper like `onSubmit={(...args) => void handleSubmit(onSubmit)(...args)}`
       * which is boilerplate noise for zero safety gain.
       */
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            attributes: false, // JSX event attributes only
          },
        },
      ],
    },
  },

  // 5a. Ban next/navigation's raw useRouter outside its own wrapper -
  // lib/hooks/use-app-router.ts's useAppRouter() is what drives the global
  // nav-progress bar/cursor/content-dim automatically; a call site that
  // imports useRouter directly gets none of that, silently. Found via code
  // review (use-invitation-actions.ts had exactly this bug), enforced here
  // instead of only documented so it can't recur unnoticed.
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["lib/hooks/use-app-router.ts", "tests/**", "**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/navigation",
              importNames: ["useRouter"],
              message:
                "Use useAppRouter() from '@/lib/hooks/use-app-router' instead - it drives the global nav-progress indicator automatically. Only use-app-router.ts itself may import the raw useRouter.",
            },
          ],
        },
      ],
    },
  },

  // 5b. Playwright E2E test files
  {
    files: ["tests/e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },

  // 5c.
  {
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/unbound-method": "off",
    },
  },

  // 5d. Node CLI scripts (e.g. compose-smoke.yml's headless dashboard check)
  // - not browser code, so they need process/console instead of DOM globals.
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
      },
    },
  },

  // 6. Global ignores
  {
    ignores: [".next/**", "coverage/**", "playwright-report/**", "test-results/**"],
  },
]);
