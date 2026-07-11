import type { Label, PrismaClient } from "@taskflow/database";
import { type CreateLabel } from "@taskflow/shared";
import { createLabel, deleteLabel, findLabelsByOrg } from "./repo";

export async function listLabels(db: PrismaClient, orgId: string): Promise<Label[]> {
  return findLabelsByOrg(db, orgId);
}

export async function createLabelInOrg(
  db: PrismaClient,
  orgId: string,
  data: CreateLabel,
): Promise<Label> {
  return createLabel(db, orgId, data);
}

export async function deleteLabelById(
  db: PrismaClient,
  labelId: string,
): Promise<{ success: boolean }> {
  await deleteLabel(db, labelId);
  return { success: true };
}
