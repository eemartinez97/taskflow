import { type Server } from "socket.io";
import { authRouter } from "../modules/auth/router";
import { boardsRouter } from "../modules/boards/router";
import { labelsRouter } from "../modules/labels/router";
import { notificationsRouter } from "../modules/notifications/router";
import { orgsRouter } from "../modules/orgs/router";
import { projectsRouter } from "../modules/projects/router";
import { createTasksRouter } from "../modules/tasks/router";
import { createTRPCRouter } from "./init";
import { createCommentsRouter } from "../modules/comments/router";

// Re-export for consumers (apps/web imports these via @taskflow/api/trpc)
export { createCallerFactory } from "./init";
export type { TRPCContext } from "./init";

/**
 * Private builder — captures the full inferred AppRouter type.
 * See tasks/router.ts for the full explanation of this pattern.
 */
const _buildAppRouter = (io: Server) =>
  createTRPCRouter({
    auth: authRouter,
    orgs: orgsRouter,
    projects: projectsRouter,
    boards: boardsRouter,
    tasks: createTasksRouter(io),
    comments: createCommentsRouter(io),
    labels: labelsRouter,
    notifications: notificationsRouter,
  });

/** Inferred type from the router factory - built once at startup with the real io instance. */
export type AppRouter = ReturnType<typeof _buildAppRouter>;

/**
 * Root tRPC application router factory.
 *
 * Accepts the Socket.IO server so task and comment mutations
 * can emit real-time events without importing a global singleton.
 */
export function createAppRouter(io: Server): AppRouter {
  return _buildAppRouter(io);
}
