/**
 * PostCSS config - Tailwind 4.
 *
 * `@tailwindcss/postcss` is a single plugin that replaces the three
 * separate plugins used in Tailwind v3:
 *   tailwindcss + postcss-import + autoprefixer
 *
 * No `tailwind.config.js` - tokens live in globals.css inside `@theme {}`
 */
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
