import { type NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";

/**
 * Parses a request's JSON body and validates it against `schema`, returning
 * either the typed data or an already-built 400 NextResponse.
 *
 * Single source of truth for the parse-then-validate boilerplate previously
 * duplicated across every POST /api/auth/* route handler. `preprocess`
 * (e.g. trimming a field) runs on the raw parsed JSON before schema
 * validation, same as each handler did inline before.
 */
export async function parseJsonBody<T>(
  req: NextRequest,
  schema: ZodType<T>,
  preprocess?: (body: unknown) => unknown,
): Promise<{ data: T } | { error: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { error: NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }) };
  }

  const parsed = schema.safeParse(preprocess ? preprocess(body) : body);
  if (!parsed.success) {
    /* v8 ignore start */
    const message = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { error: NextResponse.json({ error: message }, { status: 400 }) };
    /* v8 ignore stop */
  }

  return { data: parsed.data };
}
