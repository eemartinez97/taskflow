/**
 * Strips keys whose value is explicitly `undefined` from an object before
 * passing it to Prisma update/create operations.
 *
 * WHY THIS EXISTS:
 * `exactOptionalPropertyTypes: true` in tsconfig makes Zod's `.partial()`
 * produce `{ field?: string | undefined }`, while Prisma's generated update
 * inputs expect `{ field?: string }` (no explicit `undefined` in the union).
 * Passing a Zod partial object to Prisma directly causes a type error even
 * though the runtime behavior is identical.
 *
 * WHY THE TYPE ALIAS (not an inline conditional type):
 * TypeScript evaluates inline conditional mapped types independently in each
 * context, producing "two distinct types with the same name that are not
 * related". Extracting to a named alias `WithoutUndefined<T>` lets TypeScript
 * cache and unify the type correctly — the error disappears.
 *
 * The `as unknown as WithoutUndefined<T>` cast is intentional and safe:
 * this function is only called at post-Zod validated boundaries where
 * undefined values have already been filtered out at runtime.
 */

/** Maps each key of T to the same type but with `undefined` excluded from the value union. */
type WithoutUndefined<T> = {
  [K in keyof T]: Exclude<T[K], undefined>;
};

export function stripUndefined<T extends Record<string, unknown>>(obj: T): WithoutUndefined<T> {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }

  // Post-Zod validated boundary — stripping undefined is safe.
  // `as unknown as` required: exactOptionalPropertyTypes prevents direct
  // assignment of `{ field?: T | undefined }` to `{ field?: T }`.
  return result as unknown as WithoutUndefined<T>;
}
