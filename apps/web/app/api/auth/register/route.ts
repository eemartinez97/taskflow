import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@taskflow/database";

import { registerSchema } from "@/lib/auth/schemas";
import { hashPassword } from "@/lib/auth/password";

/**
 * Normalizes the email field in an unknown body object before schema validation.
 *
 * WHY pre-normalize:
 * Zod's `z.email()` correctly rejects email with leading/trailing spaces
 * (they are technically invalid). However, browser autofill and password managers
 * sometimes pad fields with whitespaces. We trim email BEFORE Zod so the user
 * gets an seamless experience, and the stored email is always normalized.
 *
 * Only email trimming happens here. Lowercase normalization happens after
 * Zod parses the validated date.
 */
function preprocessBody(body: unknown): unknown {
  if (body === null || typeof body !== "object") return body;

  const raw = body as Record<string, unknown>;
  const email = raw.email;

  if (typeof email !== "string") return body;

  return { ...raw, email: email.trim() };
}

/**
 * POST /api/auth/register
 *
 * Creates a new user account with a hashed password.
 * NextAuth v4 only handles sign-in - registration is a plain Route Handler
 *
 * Response shapes:
 *   201 { user: { id, email, name } } - success
 *   400 { error: string }             - validation failure
 *   409 { error: string }             - email already registered
 *   500 { error: string }             - unexpected server error
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const preprocessed = preprocessBody(body);
  const parsed = registerSchema.safeParse(preprocessed);

  if (!parsed.success) {
    /* v8 ignore start */
    // Zod always provides a message; the ?? fallback is
    // unreachable in practice but kept as a defensive safety net.
    const message = parsed.error.issues[0]?.message ?? "Invalid input.";
    return NextResponse.json({ error: message }, { status: 400 });
    /* v8 ignore stop */
  }

  const { name, email, password } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 },
      );
    }

    const hashed = await hashPassword(password);

    const user = await prisma.user.create({
      data: { name, email: normalizedEmail, password: hashed },
      select: { id: true, email: true, name: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
