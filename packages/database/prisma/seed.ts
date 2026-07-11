import dotenv from "dotenv";
import { PrismaClient } from "../src";
import { PrismaPg } from "@prisma/adapter-pg";

// dotenv 17 - pass quiet:true to suppress the startup log line
dotenv.config({ quiet: true });

// Seed script instantiates its own client (not the singleton)
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({ adapter });

const SEED_IDS = {
  org: "10000000-0000-0000-0000-000000000001",
  user: "20000000-0000-0000-0000-000000000001",
  membership: "30000000-0000-0000-0000-000000000001",
  project: "40000000-0000-0000-0000-000000000001",
  board: "50000000-0000-0000-0000-000000000001",
  columns: {
    todo: "60000000-0000-0000-0000-000000000001",
    inProgress: "60000000-0000-0000-0000-000000000002",
    inReview: "60000000-0000-0000-0000-000000000003",
    done: "60000000-0000-0000-0000-000000000004",
  },
  labels: {
    bug: "70000000-0000-0000-0000-000000000001",
    feature: "70000000-0000-0000-0000-000000000002",
    improvement: "70000000-0000-0000-0000-000000000003",
  },
} as const;

async function main(): Promise<void> {
  console.log("Seeding database...");

  // Create demo org
  const org = await prisma.org.upsert({
    where: { id: SEED_IDS.org },
    update: {},
    create: {
      id: SEED_IDS.org,
      name: "Demo Organization",
      slug: "demo-org",
    },
  });

  // Create demo user
  const user = await prisma.user.upsert({
    where: { id: SEED_IDS.user },
    update: {},
    create: {
      id: SEED_IDS.user,
      name: "Admin User",
      email: "admin@taskflow.dev",
    },
  });

  // Add user as org owner
  await prisma.membership.upsert({
    where: { orgId_userId: { orgId: org.id, userId: user.id } },
    update: {},
    create: {
      id: SEED_IDS.membership,
      orgId: org.id,
      userId: user.id,
      role: "OWNER",
    },
  });

  // Create demo project
  const project = await prisma.project.upsert({
    where: { orgId_key: { orgId: org.id, key: "DEMO" } },
    update: {},
    create: {
      id: SEED_IDS.project,
      orgId: org.id,
      name: "Demo Project",
      key: "DEMO",
      slug: "demo-project",
      description: "A demonstration project for TaskFlow",
    },
  });

  // Create default board with columns
  const board = await prisma.board.upsert({
    where: { id: SEED_IDS.board },
    update: {},
    create: {
      id: SEED_IDS.board,
      projectId: project.id,
      name: "Main Board",
    },
  });

  const columns = [
    { id: SEED_IDS.columns.todo, name: "To Do", position: 1000 },
    { id: SEED_IDS.columns.inProgress, name: "In Progress", position: 2000 },
    { id: SEED_IDS.columns.inReview, name: "In Review", position: 3000 },
    { id: SEED_IDS.columns.done, name: "Done", position: 4000 },
  ];

  for (const col of columns) {
    await prisma.column.upsert({
      where: { id: col.id },
      update: {},
      create: {
        ...col,
        boardId: board.id,
      },
    });
  }

  // Create a few demo labels
  const labels = [
    { id: SEED_IDS.labels.bug, name: "Bug", color: "#EF4444" },
    { id: SEED_IDS.labels.feature, name: "Feature", color: "#3B82F6" },
    { id: SEED_IDS.labels.improvement, name: "Improvement", color: "#10B981" },
  ];

  for (const label of labels) {
    await prisma.label.upsert({
      where: { orgId_name: { orgId: org.id, name: label.name } },
      update: {},
      create: { ...label, orgId: org.id },
    });
  }

  console.log("Seed complete.");
  console.log(`    Org:     ${org.slug}`);
  console.log(`    User:    ${user.email}`);
  console.log(`    Project: ${project.key}`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
