import dotenv from "dotenv";
import { PrismaClient } from "../src";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

// dotenv 17 - pass quiet:true to suppress the startup log line
dotenv.config({ quiet: true });

// Seed script instantiates its own client (not the singleton)
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 12;
const SEED_PASSWORD = "admin123";

const SEED_IDS = {
  org: "10000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000001",
  memberUser: "20000000-0000-4000-8000-000000000002",
  membership: "30000000-0000-4000-8000-000000000001",
  memberMembership: "30000000-0000-4000-8000-000000000002",
  project: "40000000-0000-4000-8000-000000000001",
  board: "50000000-0000-4000-8000-000000000001",
  columns: {
    todo: "60000000-0000-4000-8000-000000000001",
    inProgress: "60000000-0000-4000-8000-000000000002",
    inReview: "60000000-0000-4000-8000-000000000003",
    done: "60000000-0000-4000-8000-000000000004",
  },
  labels: {
    bug: "70000000-0000-4000-8000-000000000001",
    feature: "70000000-0000-4000-8000-000000000002",
    improvement: "70000000-0000-4000-8000-000000000003",
  },
} as const;

// Tasks/comments continue SEED_IDS's numbering scheme (prefix 8/9) as plain
// functions instead of a 30-entry object literal - same deterministic UUIDs,
// far less boilerplate for this many rows.
const taskId = (n: number): string => `80000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const commentId = (n: number): string => `90000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

type ColumnKey = keyof typeof SEED_IDS.columns;
type LabelKey = keyof typeof SEED_IDS.labels;
type Assignee = "admin" | "member" | null;

const COLUMN_STATUS: Record<ColumnKey, "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE"> = {
  todo: "TODO",
  inProgress: "IN_PROGRESS",
  inReview: "IN_REVIEW",
  done: "DONE",
};

const DAY_MS = 24 * 60 * 60 * 1000;

interface TaskDef {
  n: number;
  column: ColumnKey;
  title: string;
  description: string;
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assignee: Assignee;
  labels: LabelKey[];
  dueInDays?: number;
  comments?: { n: number; author: "admin" | "member"; body: string }[];
}

const TASKS: TaskDef[] = [
  {
    n: 1,
    column: "todo",
    title: "Set up CI pipeline for staging",
    description:
      "Add a GitHub Actions workflow that deploys the staging environment on every merge to main.",
    priority: "MEDIUM",
    assignee: "admin",
    labels: ["feature"],
    dueInDays: 5,
    comments: [{ n: 1, author: "member", body: "Can we also cache build artifacts between runs?" }],
  },
  {
    n: 2,
    column: "todo",
    title: "Design onboarding email templates",
    description:
      "Draft the welcome and verification email templates to match the new brand guidelines.",
    priority: "LOW",
    assignee: "member",
    labels: ["feature", "improvement"],
  },
  {
    n: 3,
    column: "todo",
    title: "Research rate-limiting libraries",
    description:
      "Compare token-bucket implementations for the Socket.IO presence limiter against our current in-memory one.",
    priority: "LOW",
    assignee: null,
    labels: [],
  },
  {
    n: 4,
    column: "todo",
    title: "Write API docs for invitations module",
    description:
      "Document the create/listForOrg/revoke/resend procedures and their role-guard requirements.",
    priority: "NONE",
    assignee: "admin",
    labels: ["improvement"],
  },
  {
    n: 5,
    column: "todo",
    title: "Plan Q3 roadmap review",
    description:
      "Schedule a session to prioritize the next quarter's initiatives with the team leads.",
    priority: "HIGH",
    assignee: "member",
    labels: [],
    dueInDays: 2,
  },
  {
    n: 6,
    column: "inProgress",
    title: "Implement drag-and-drop for task cards",
    description:
      "Wire up column-to-column dragging with optimistic position updates before the server round trip.",
    priority: "HIGH",
    assignee: null,
    labels: ["feature"],
    comments: [
      { n: 2, author: "admin", body: "Let's use dnd-kit instead of react-beautiful-dnd." },
      { n: 3, author: "member", body: "Agreed, it's more actively maintained." },
    ],
  },
  {
    n: 7,
    column: "inProgress",
    title: "Add dark mode toggle to settings",
    description:
      "Persist the user's theme preference and respect prefers-color-scheme as the default.",
    priority: "LOW",
    assignee: "admin",
    labels: ["feature", "improvement"],
  },
  {
    n: 8,
    column: "inProgress",
    title: "Refactor auth middleware for JWT rotation",
    description:
      "Support rotating the NextAuth secret without invalidating every active session at once.",
    priority: "URGENT",
    assignee: "member",
    labels: ["bug", "improvement"],
    dueInDays: -1,
    comments: [
      { n: 4, author: "member", body: "Blocked on the refresh-token rotation design doc." },
    ],
  },
  {
    n: 9,
    column: "inProgress",
    title: "Build notification center UI",
    description:
      "Add a bell icon with an unread-count badge and a dropdown listing recent notifications.",
    priority: "MEDIUM",
    assignee: null,
    labels: ["feature"],
    comments: [
      { n: 5, author: "admin", body: "Should this support grouping by notification type?" },
    ],
  },
  {
    n: 10,
    column: "inProgress",
    title: "Optimize Postgres query for board load",
    description:
      "The board.get query fans out per-column task fetches; batch them into a single indexed query.",
    priority: "HIGH",
    assignee: "admin",
    labels: ["bug"],
    dueInDays: 3,
  },
  {
    n: 11,
    column: "inReview",
    title: "Fix cursor flicker on board switch",
    description:
      "Live cursors briefly render at (0,0) before the first move event arrives on a newly joined board.",
    priority: "URGENT",
    assignee: "member",
    labels: ["bug"],
    dueInDays: -2,
    comments: [
      { n: 6, author: "admin", body: "Repro steps are in the linked ticket." },
      { n: 7, author: "member", body: "Fixed the flicker, see PR #91." },
    ],
  },
  {
    n: 12,
    column: "inReview",
    title: "Add label filter menu accessibility roles",
    description:
      "The filter popover needs menuitemcheckbox roles on its toggle chips to match the ARIA menu pattern.",
    priority: "MEDIUM",
    assignee: null,
    labels: ["bug", "improvement"],
    comments: [{ n: 8, author: "admin", body: "LGTM, nice catch on aria-checked." }],
  },
  {
    n: 13,
    column: "inReview",
    title: "Update Prisma schema for task attachments",
    description: "Add a fileSize constraint and cascade delete when the parent task is removed.",
    priority: "MEDIUM",
    assignee: "admin",
    labels: ["feature"],
  },
  {
    n: 14,
    column: "inReview",
    title: "Review rate limiter unit tests",
    description:
      "Double-check the sliding-window edge cases around bucket expiry and concurrent inserts.",
    priority: "LOW",
    assignee: "member",
    labels: ["bug"],
  },
  {
    n: 15,
    column: "inReview",
    title: "Polish invitation email copy",
    description:
      "Tighten the wording on the org-invite email so the CTA button reads clearly on mobile clients.",
    priority: "NONE",
    assignee: null,
    labels: ["improvement"],
  },
  {
    n: 16,
    column: "done",
    title: "Migrate to Next.js 16 App Router",
    description: "Move every route to the App Router and replace middleware.ts with proxy.ts.",
    priority: "HIGH",
    assignee: "admin",
    labels: ["feature"],
    comments: [{ n: 9, author: "member", body: "Smooth migration, no regressions found." }],
  },
  {
    n: 17,
    column: "done",
    title: "Set up Prometheus metrics dashboard",
    description:
      "Stand up Prometheus, Grafana and Alertmanager with dashboards for the core business metrics.",
    priority: "MEDIUM",
    assignee: "member",
    labels: ["feature", "improvement"],
  },
  {
    n: 18,
    column: "done",
    title: "Ship per-column task-status mapping",
    description:
      "Let a column optionally auto-set a task's status when it's created in or moved into that column.",
    priority: "HIGH",
    assignee: null,
    labels: ["feature"],
    comments: [{ n: 10, author: "admin", body: "Shipped in #88." }],
  },
  {
    n: 19,
    column: "done",
    title: "Add e2e tests for board switcher",
    description:
      "Cover creating, switching between, and deleting boards within a project end-to-end.",
    priority: "MEDIUM",
    assignee: "admin",
    labels: ["improvement"],
  },
  {
    n: 20,
    column: "done",
    title: "Release password reset flow",
    description:
      "Ship the forgot-password -> emailed link -> reset-password flow backed by hashed AuthToken rows.",
    priority: "URGENT",
    assignee: "member",
    labels: ["bug", "feature"],
  },
];

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

  // Create demo users
  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { id: SEED_IDS.user },
    update: { password: hashedPassword, emailVerified: new Date() },
    create: {
      id: SEED_IDS.user,
      name: "Admin User",
      email: "admin@taskflow.dev",
      password: hashedPassword,
      emailVerified: new Date(),
    },
  });

  const memberUser = await prisma.user.upsert({
    where: { id: SEED_IDS.memberUser },
    update: { password: hashedPassword, emailVerified: new Date() },
    create: {
      id: SEED_IDS.memberUser,
      name: "Jane Member",
      email: "jane@taskflow.dev",
      password: hashedPassword,
      emailVerified: new Date(),
    },
  });

  const ASSIGNEE_IDS: Record<Exclude<Assignee, null>, string> = {
    admin: user.id,
    member: memberUser.id,
  };

  // Add users as org members
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

  await prisma.membership.upsert({
    where: { orgId_userId: { orgId: org.id, userId: memberUser.id } },
    update: {},
    create: {
      id: SEED_IDS.memberMembership,
      orgId: org.id,
      userId: memberUser.id,
      role: "MEMBER",
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
    { key: "todo" as const, id: SEED_IDS.columns.todo, name: "To Do", position: 1000 },
    {
      key: "inProgress" as const,
      id: SEED_IDS.columns.inProgress,
      name: "In Progress",
      position: 2000,
    },
    { key: "inReview" as const, id: SEED_IDS.columns.inReview, name: "In Review", position: 3000 },
    { key: "done" as const, id: SEED_IDS.columns.done, name: "Done", position: 4000 },
  ];

  for (const col of columns) {
    await prisma.column.upsert({
      where: { id: col.id },
      update: {},
      create: {
        id: col.id,
        boardId: board.id,
        name: col.name,
        position: col.position,
      },
    });
  }

  // Create a few demo labels
  const labels = [
    { key: "bug" as const, id: SEED_IDS.labels.bug, name: "Bug", color: "#EF4444" },
    { key: "feature" as const, id: SEED_IDS.labels.feature, name: "Feature", color: "#3B82F6" },
    {
      key: "improvement" as const,
      id: SEED_IDS.labels.improvement,
      name: "Improvement",
      color: "#10B981",
    },
  ];

  for (const label of labels) {
    await prisma.label.upsert({
      where: { orgId_name: { orgId: org.id, name: label.name } },
      update: {},
      create: { id: label.id, orgId: org.id, name: label.name, color: label.color },
    });
  }

  // Create demo tasks, spread across all 4 columns with varied priority,
  // assignee, labels, due dates and comments.
  const positionByColumn: Record<ColumnKey, number> = {
    todo: 0,
    inProgress: 0,
    inReview: 0,
    done: 0,
  };

  for (const def of TASKS) {
    positionByColumn[def.column] += 1000;

    const task = await prisma.task.upsert({
      where: { id: taskId(def.n) },
      update: {},
      create: {
        id: taskId(def.n),
        columnId: SEED_IDS.columns[def.column],
        title: def.title,
        description: def.description,
        priority: def.priority,
        status: COLUMN_STATUS[def.column],
        position: positionByColumn[def.column],
        assigneeId: def.assignee ? ASSIGNEE_IDS[def.assignee] : null,
        creatorId: user.id,
        dueDate: def.dueInDays !== undefined ? new Date(Date.now() + def.dueInDays * DAY_MS) : null,
      },
    });

    for (const labelKey of def.labels) {
      await prisma.taskLabel.upsert({
        where: { taskId_labelId: { taskId: task.id, labelId: SEED_IDS.labels[labelKey] } },
        update: {},
        create: { taskId: task.id, labelId: SEED_IDS.labels[labelKey] },
      });
    }

    for (const comment of def.comments ?? []) {
      await prisma.comment.upsert({
        where: { id: commentId(comment.n) },
        update: {},
        create: {
          id: commentId(comment.n),
          taskId: task.id,
          authorId: ASSIGNEE_IDS[comment.author],
          body: comment.body,
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log(`    Org:     ${org.slug}`);
  console.log(`    User:    ${user.email}`);
  console.log(`    Member:  ${memberUser.email}`);
  console.log(`    Project: ${project.key}`);
  console.log(`    Tasks:   ${String(TASKS.length)}`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
