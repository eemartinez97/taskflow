import type z from "zod";
import type {
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
  inviteMemberSchema,
  labelSchema,
  membershipSchema,
  moveTaskSchema,
  orgSchema,
  presenceCursorSchema,
  presenceUserSchema,
  projectSchema,
  reorderColumnsSchema,
  roleSchema,
  taskPrioritySchema,
  taskSchema,
  taskStatusSchema,
  updateOrgSchema,
  updateProjectSchema,
  updateTaskSchema,
  updateUserSchema,
  userSchema,
} from "../schemas";
import { type paginationSchema } from "../schemas/common";

// User
export type User = z.infer<typeof userSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;

// Org & RBAC
export type Role = z.infer<typeof roleSchema>;
export type Org = z.infer<typeof orgSchema>;
export type CreateOrg = z.infer<typeof createOrgSchema>;
export type UpdateOrg = z.infer<typeof updateOrgSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type InviteMember = z.infer<typeof inviteMemberSchema>;

// Project
export type Project = z.infer<typeof projectSchema>;
export type CreateProject = z.infer<typeof createProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;

// Board & Columns
export type Board = z.infer<typeof boardSchema>;
export type Column = z.infer<typeof columnSchema>;
export type CreateBoard = z.infer<typeof createBoardSchema>;
export type CreateColumn = z.infer<typeof createColumnSchema>;
export type ReorderColumns = z.infer<typeof reorderColumnsSchema>;

// Task
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type Task = z.infer<typeof taskSchema>;
export type CreateTask = z.infer<typeof createTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type MoveTask = z.infer<typeof moveTaskSchema>;

// Comment
export type Comment = z.infer<typeof commentSchema>;
export type CreateComment = z.infer<typeof createCommentSchema>;

// Label
export type Label = z.infer<typeof labelSchema>;
export type CreateLabel = z.infer<typeof createLabelSchema>;

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
