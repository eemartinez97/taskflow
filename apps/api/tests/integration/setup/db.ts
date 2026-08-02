import { prisma } from "@taskflow/database";

/**
 * TRUNCATE ... CASCADE is far faster than deleting per table and needs no
 * knowledge of FK ordering. Never point this at a non-test database.
 */
export async function resetDb(): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  if (rows.length === 0) return;

  const tables = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;`);
}

export { prisma };
