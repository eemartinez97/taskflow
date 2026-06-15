import type { PrismaClient, Project } from "@taskflow/database";
import type { CreateProject, UpdateProject } from "@taskflow/shared";
import {
  createProject,
  deleteProject,
  findProjectById,
  findProjectsByOrg,
  updateProject,
} from "./repo.js";
import { TRPCError } from "../../trpc/init.js";

export async function listProjects(db: PrismaClient, orgId: string): Promise<Project[]> {
  return findProjectsByOrg(db, orgId);
}

export async function getProject(db: PrismaClient, projectId: string): Promise<Project> {
  const project = await findProjectById(db, projectId);

  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });

  return project;
}

export async function createProjectInOrg(
  db: PrismaClient,
  orgId: string,
  data: CreateProject,
): Promise<Project> {
  return createProject(db, orgId, data);
}

export async function updateProjectById(
  db: PrismaClient,
  projectId: string,
  data: UpdateProject,
): Promise<Project> {
  await getProject(db, projectId);
  return updateProject(db, projectId, data);
}

export async function deleteProjectById(
  db: PrismaClient,
  projectId: string,
): Promise<{ success: boolean }> {
  await getProject(db, projectId);
  await deleteProject(db, projectId);
  return { success: true };
}
