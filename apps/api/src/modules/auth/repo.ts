import type { PrismaClient } from "@taskflow/database";
import type { SessionUser, UpdateUser } from "@taskflow/shared";
import { stripUndefined } from "../../utils/prisma";

const userSessionSelect = {
  id: true,
  email: true,
  name: true,
  image: true,
} as const;

/**
 * Finds a user by id for the `me` procedure.
 * Returns only the fields the client needs - never the full user row.
 */
export async function findUserById(db: PrismaClient, userId: string): Promise<SessionUser | null> {
  return db.user.findUnique({
    where: { id: userId },
    select: userSessionSelect,
  });
}

/**
 * Deletes all sessions for a user (server-side sign-out)
 * NextAuth v4 handles session deletion on the web side too,
 * but this lets the API invalidate sessions independently
 */
export async function deleteUserSessions(db: PrismaClient, userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}

export async function updateUser(
  db: PrismaClient,
  userId: string,
  data: UpdateUser,
): Promise<SessionUser> {
  return db.user.update({
    where: { id: userId },
    data: stripUndefined(data),
    select: userSessionSelect,
  });
}

export interface AuthEmailLookupUser {
  id: string;
  name: string | null;
  emailVerified: Date | null;
}

/**
 * Looks up an existing account by (already normalized) email. Shared by
 * registration's resend-vs-conflict branch and password reset's
 * verified-vs-unverified branch - both need exactly this shape.
 */
export async function findUserByEmail(
  db: PrismaClient,
  email: string,
): Promise<AuthEmailLookupUser | null> {
  return db.user.findUnique({
    where: { email },
    select: { id: true, name: true, emailVerified: true },
  });
}

export interface CreatedRegistrationUser {
  id: string;
  name: string | null;
}

/** Creates a brand-new, unverified account. `password` must already be hashed. */
export async function createUnverifiedUser(
  db: PrismaClient,
  data: { name: string; email: string; hashedPassword: string },
): Promise<CreatedRegistrationUser> {
  return db.user.create({
    data: { name: data.name, email: data.email, password: data.hashedPassword },
    select: { id: true, name: true },
  });
}

export interface NotifiableUser {
  email: string;
  name: string | null;
}

/** Looks up the fields needed to send the "account activated" notification. */
export async function findUserForActivationNotice(
  db: PrismaClient,
  userId: string,
): Promise<NotifiableUser | null> {
  return db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
}

export interface CredentialsLookupUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  password: string | null;
  emailVerified: Date | null;
}

/** Looks up everything auth.verifyCredentials needs, including the password hash. */
export async function findUserForCredentials(
  db: PrismaClient,
  email: string,
): Promise<CredentialsLookupUser | null> {
  return db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      password: true,
      emailVerified: true,
    },
  });
}
