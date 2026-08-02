import { expect, it } from "vitest";
import type { MockFn } from "../mocks/database";

export interface RepoCase {
  /** Test title, e.g. "findTaskById" */
  name: string;
  /** The Prisma delegate expected to be hit, e.g. mockDb.task.findUnique */
  delegate: MockFn;
  /** What the delegate resolves with */
  resolves?: unknown;
  /** Invokes the repo function under test */
  call: () => Promise<unknown>;
  /** Exact single argument the delegate must receive */
  args: unknown;
  /** Expected return value (defaults to `resolves`) */
  returns?: unknown;
}

/**
 * Asserts that each repo function forwards to exactly one Prisma delegate,
 * with the exact query object, and returns its result untouched.
 */
export function itDelegatesToPrisma(cases: readonly RepoCase[]): void {
  it.each(cases.map((c) => [c.name, c] as const))("%s forwards to Prisma", async (_name, c) => {
    c.delegate.mockResolvedValueOnce(c.resolves);

    const result = await c.call();

    expect(c.delegate).toHaveBeenCalledExactlyOnceWith(c.args);
    expect(result).toEqual("returns" in c ? c.returns : c.resolves);
  });
}
