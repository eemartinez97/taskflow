import type {
  Board,
  Column,
  Comment,
  CommentWithAuthor,
  Invitation,
  InvitationWithInviter,
  Label,
  Membership,
  Notification,
  NotificationWithActor,
  Org,
  Project,
  Task,
} from "@taskflow/database";

import {
  FIXED_DATE,
  VALID_BOARD_ID,
  VALID_COLUMN_ID,
  VALID_COMMENT_ID,
  VALID_LABEL_ID,
  VALID_ORG_ID,
  VALID_PROJECT_ID,
  VALID_TASK_ID,
  VALID_USER,
} from "./helpers";

const stamps = { createdAt: FIXED_DATE, updatedAt: FIXED_DATE };

export const buildOrg = (o: Partial<Org> = {}): Org => ({
  id: VALID_ORG_ID,
  name: "Acme",
  slug: "acme",
  ...stamps,
  ...o,
});

export const buildProject = (o: Partial<Project> = {}): Project => ({
  id: VALID_PROJECT_ID,
  orgId: VALID_ORG_ID,
  name: "Website",
  key: "WEB",
  slug: "website",
  description: null,
  ...stamps,
  ...o,
});

export const buildBoard = (o: Partial<Board> = {}): Board => ({
  id: VALID_BOARD_ID,
  projectId: VALID_PROJECT_ID,
  name: "Main Board",
  ...stamps,
  ...o,
});

export const buildColumn = (o: Partial<Column> = {}): Column => ({
  id: VALID_COLUMN_ID,
  boardId: VALID_BOARD_ID,
  name: "To Do",
  position: 1000,
  ...stamps,
  ...o,
});

export const buildBoardWithColumns = (
  o: Partial<Board> = {},
  columns: Column[] = [buildColumn()],
): Board & { columns: Column[] } => ({ ...buildBoard(o), columns });

export const buildTask = (o: Partial<Task> = {}): Task => ({
  id: VALID_TASK_ID,
  columnId: VALID_COLUMN_ID,
  title: "Ship it",
  description: null,
  assigneeId: null,
  creatorId: null,
  priority: "NONE",
  status: "TODO",
  position: 1000,
  dueDate: null,
  ...stamps,
  ...o,
});

export const buildLabel = (o: Partial<Label> = {}): Label => ({
  id: VALID_LABEL_ID,
  orgId: VALID_ORG_ID,
  name: "bug",
  color: "#EF4444",
  ...stamps,
  ...o,
});

export const buildComment = (o: Partial<Comment> = {}): Comment => ({
  id: VALID_COMMENT_ID,
  taskId: VALID_TASK_ID,
  authorId: VALID_USER.id,
  body: "LGTM",
  ...stamps,
  ...o,
});

export const buildCommentWithAuthor = (o: Partial<Comment> = {}): CommentWithAuthor => ({
  ...buildComment(o),
  author: { id: VALID_USER.id, name: VALID_USER.name, email: VALID_USER.email, image: null },
});

export const buildMembership = (o: Partial<Membership> = {}): Membership => ({
  id: "00000009-0000-4000-8000-000000000001",
  orgId: VALID_ORG_ID,
  userId: VALID_USER.id,
  role: "MEMBER",
  cursorsHidden: false,
  ...stamps,
  ...o,
});

export const buildNotification = (o: Partial<Notification> = {}): Notification => ({
  id: "00000008-0000-4000-8000-000000000001",
  userId: VALID_USER.id,
  actorId: null,
  type: "TASK_ASSIGNED",
  message: 'Sofia assigned you to "Ship it"',
  entityId: VALID_TASK_ID,
  entityType: "task",
  read: false,
  ...stamps,
  ...o,
});

export const buildNotificationWithActor = (
  o: Partial<Notification> = {},
): NotificationWithActor => ({
  ...buildNotification(o),
  actor: { id: VALID_USER.id, name: VALID_USER.name, image: null },
});

export const VALID_INVITATION_ID = "0000000a-0000-4000-8000-000000000001";

export const buildInvitation = (o: Partial<Invitation> = {}): Invitation => ({
  id: VALID_INVITATION_ID,
  orgId: VALID_ORG_ID,
  email: "bob@example.com",
  role: "MEMBER",
  status: "PENDING",
  tokenHash: "a".repeat(64),
  invitedById: VALID_USER.id,
  // Relative to the REAL clock (not FIXED_DATE): expiry math in
  // resolveInvitationState/toOrgInvitation reads the real Date.now(), so a
  // FIXED_DATE-relative default would silently start reporting "expired" as
  // real time passes FIXED_DATE.
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  respondedAt: null,
  ...stamps,
  ...o,
});

export const buildInvitationWithInviter = (o: Partial<Invitation> = {}): InvitationWithInviter => ({
  ...buildInvitation(o),
  invitedBy: { id: VALID_USER.id, name: VALID_USER.name, image: null },
});
