import { createTRPCRouter } from "./init.js";

/**
 * Root tRPC application router
 *
 * Each resource module exports its own sub-router
 * They are combined here and nowhere else.
 *
 * Current state: empty shell
 * The AppRouter type is exported immediately so apps/web can import it
 * for end-to-end type safety without waiting for all modules to exist.
 */
export const appRouter = createTRPCRouter({
  // Resource routers are wired here one-by-one later
  // auth: authRouter
  // orgs: orgsRouter
  // projects: projectsRouter
  // boards: boardsRouter
  // tasks: tasksRouter
  // comments: commentsRouter
  // labels: labelsRouter
  // notifications: notificationsRouter
});

/** The single source of truth for end-to-end types shared with apps/web. */
export type AppRouter = typeof appRouter;
