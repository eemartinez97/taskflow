import type { PrismaClient, Project } from "@taskflow/database";
import type { CreateProject, UpdateProject } from "@taskflow/shared";
import { stripUndefined } from "../../utils/prisma";

export async function findProjectsByOrg(db: PrismaClient, orgId: string): Promise<Project[]> {
  return db.project.findMany({
    where: { orgId },
    orderBy: { createdAt: "asc" },
  });
}

export async function findProjectById(
  db: PrismaClient,
  projectId: string,
): Promise<Project | null> {
  return db.project.findUnique({ where: { id: projectId } });
}

export async function createProject(
  db: PrismaClient,
  orgId: string,
  data: CreateProject,
): Promise<Project> {
  return db.project.create({ data: stripUndefined({ ...data, orgId }) });
}

export async function updateProject(
  db: PrismaClient,
  projectId: string,
  data: UpdateProject,
): Promise<Project> {
  return db.project.update({ where: { id: projectId }, data: stripUndefined(data) });
}

export async function deleteProject(db: PrismaClient, projectId: string): Promise<void> {
  await db.project.delete({ where: { id: projectId } });
}
