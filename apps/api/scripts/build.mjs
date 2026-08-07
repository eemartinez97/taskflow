import { build } from "esbuild";

/**
 * moduleResolution:"bundler" (repo-wide) means every @taskflow/* package exports raw
 * .ts with directory imports that plain `node dist/main.js` can't resolve after tsc.
 * esbuild bundles the whole workspace source graph instead, so Node only ever sees
 * one resolved ESM file at runtime.
 */
await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/main.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  sourcemap: true,
  logLevel: "info",
  banner: {
    // Prisma's generated client bundles CJS internals (e.g. requires
    // @prisma/client-runtime-utils) that esbuild can't rewrite to ESM
    // imports; give the bundle a working `require` for those.
    js: 'import { createRequire as __createRequire } from "node:module";\nconst require = __createRequire(import.meta.url);',
  },
  plugins: [
    {
      name: "external-non-workspace",
      setup(pluginBuild) {
        pluginBuild.onResolve({ filter: /^[^./]/ }, (args) => {
          if (args.path.startsWith("@taskflow/")) return undefined;
          return { path: args.path, external: true };
        });
      },
    },
  ],
});
