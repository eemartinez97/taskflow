import type { Label, PrismaClient } from "@taskflow/database";
import { type CreateLabel } from "@taskflow/shared";

export async function findLabelsByOrg(db: PrismaClient, orgId: string): Promise<Label[]> {
  return db.label.findMany({
    where: { orgId },
    orderBy: { name: "asc" },
  });
}

export async function createLabel(
  db: PrismaClient,
  orgId: string,
  data: CreateLabel,
): Promise<Label> {
  return db.label.create({ data: { ...data, orgId } });
}

export async function deleteLabel(db: PrismaClient, labelId: string): Promise<void> {
  await db.label.delete({ where: { id: labelId } });
}
