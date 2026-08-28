import type { Label, PrismaClient } from "@taskflow/database";
import { type CreateLabel } from "@taskflow/shared";
import { createLabel, deleteLabel, findLabelsByOrg, findLabelById } from "./repo";
import { TRPCError } from "../../trpc/init";
import { appCollectors } from "../../metrics";

export async function listLabels(db: PrismaClient, orgId: string): Promise<Label[]> {
  return findLabelsByOrg(db, orgId);
}

export async function getLabelById(db: PrismaClient, labelId: string): Promise<Label> {
  const label = await findLabelById(db, labelId);

  if (!label) throw new TRPCError({ code: "NOT_FOUND", message: "Label not found." });

  return label;
}

export async function createLabelInOrg(
  db: PrismaClient,
  orgId: string,
  data: CreateLabel,
): Promise<Label> {
  const label = await createLabel(db, orgId, data);
  appCollectors.labelsCreatedTotal.inc();
  return label;
}

export async function deleteLabelById(
  db: PrismaClient,
  labelId: string,
): Promise<{ success: true }> {
  await getLabelById(db, labelId);
  await deleteLabel(db, labelId);
  return { success: true };
}
