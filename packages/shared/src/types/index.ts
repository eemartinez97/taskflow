import type z from "zod";
import type {
  paginationSchema,
  boardSchema,
  columnSchema,
  commentSchema,
  createBoardSchema,
  createColumnSchema,
  createCommentSchema,
  createLabelSchema,
  createOrgSchema,
  createProjectSchema,
  createTaskSchema,
  invitableRoleSchema,
  inviteMemberSchema,
  invitationPreviewSchema,
  invitationPreviewStateSchema,
  invitationRefSchema,
  invitationSchema,
  invitationStatusSchema,
  invitationTokenSchema,
  labelSchema,
  membershipSchema,
  moveTaskSchema,
  myInvitationSchema,
  orgInvitationSchema,
  orgSchema,
  presenceCursorSchema,
  presenceUserSchema,
  projectSchema,
  reorderColumnsSchema,
  roleSchema,
  setColumnStatusSchema,
  taskPrioritySchema,
  taskSchema,
  taskStatusSchema,
  updateBoardSchema,
  updateColumnSchema,
  updateOrgSchema,
  updateProjectSchema,
  updateTaskSchema,
  updateUserSchema,
  userSchema,
  createNotificationSchema,
  markNotificationsReadSchema,
  notificationActorSchema,
  notificationListSchema,
  notificationSchema,
  notificationTypeSchema,
  sessionUserSchema,
  updateCursorPreferenceSchema,
  updateMemberRoleSchema,
} from "../schemas";

// User
export type User = z.infer<typeof userSchema>;
export type SessionUser = z.infer<typeof sessionUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;

// Org & RBAC
export type Role = z.infer<typeof roleSchema>;
export type Org = z.infer<typeof orgSchema>;
export type CreateOrg = z.infer<typeof createOrgSchema>;
export type UpdateOrg = z.infer<typeof updateOrgSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type InvitableRole = z.infer<typeof invitableRoleSchema>;
export type InviteMember = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRole = z.infer<typeof updateMemberRoleSchema>;
export type UpdateCursorPreference = z.infer<typeof updateCursorPreferenceSchema>;

// Invitations
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;
export type Invitation = z.infer<typeof invitationSchema>;
export type OrgInvitation = z.infer<typeof orgInvitationSchema>;
export type MyInvitation = z.infer<typeof myInvitationSchema>;
export type InvitationPreviewState = z.infer<typeof invitationPreviewStateSchema>;
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;
export type InvitationToken = z.infer<typeof invitationTokenSchema>;
export type InvitationRef = z.infer<typeof invitationRefSchema>;

// Project
export type Project = z.infer<typeof projectSchema>;
export type CreateProject = z.infer<typeof createProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;

// Board & Columns
export type Board = z.infer<typeof boardSchema>;
export type Column = z.infer<typeof columnSchema>;
export type CreateBoard = z.infer<typeof createBoardSchema>;
export type UpdateBoard = z.infer<typeof updateBoardSchema>;
export type CreateColumn = z.infer<typeof createColumnSchema>;
export type UpdateColumn = z.infer<typeof updateColumnSchema>;
export type ReorderColumns = z.infer<typeof reorderColumnsSchema>;
export type SetColumnStatus = z.infer<typeof setColumnStatusSchema>;

// Task
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type Task = z.infer<typeof taskSchema>;
export type CreateTask = z.infer<typeof createTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type MoveTask = z.infer<typeof moveTaskSchema>;

// Comment
export type Comment = z.infer<typeof commentSchema>;
export type CommentAuthor = z.infer<typeof sessionUserSchema>;
export type CreateComment = z.infer<typeof createCommentSchema>;

// Label
export type Label = z.infer<typeof labelSchema>;
export type CreateLabel = z.infer<typeof createLabelSchema>;

// Notifications
export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type NotificationActor = z.infer<typeof notificationActorSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type CreateNotification = z.infer<typeof createNotificationSchema>;
export type NotificationList = z.infer<typeof notificationListSchema>;
export type MarkNotificationsRead = z.infer<typeof markNotificationsReadSchema>;

// Presence (Socket.IO)
export type PresenceUser = z.infer<typeof presenceUserSchema>;
export type PresenceCursor = z.infer<typeof presenceCursorSchema>;

// Pagination
export type Pagination = z.infer<typeof paginationSchema>;

// Paginated response wrapper
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Socket event types - shared between apps/api and apps/web
export type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketCursor,
  SocketComment,
  SocketLabel,
  SocketNotification,
  SocketTask,
  SocketPresenceUser,
  SocketBoard,
  SocketColumn,
  SocketMyInvitation,
  SocketInvitationStatus,
} from "./socket-events";
