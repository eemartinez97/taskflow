import { logger } from "../../../src/config/logger";
import { createCallerFactory } from "../../../src/trpc/init";
import { createAppRouter } from "../../../src/trpc/router";
import { prisma } from "./db";
import type { AppServer } from "../../../src/socket/events";

export const emitted: { room: string; event: string; payload: unknown; exceptRoom?: string }[] = [];

/**
 * Records every broadcast instead of opening a real Socket.IO server.
 * `.except(room)` (used by emitToProject/emitToOrg to skip the acting
 * user's own connections - see socket/emit.ts) still records the emit here,
 * with the excluded room noted, since this fake has no real per-socket room
 * membership to filter against - tests assert "was this broadcast" and,
 * where it matters, "was the actor excluded", not actual delivery.
 */
export const recordingIo = {
  to(room: string) {
    const emit = (event: string, payload: unknown, exceptRoom?: string) => {
      emitted.push({ room, event, payload, ...(exceptRoom !== undefined && { exceptRoom }) });
      return true;
    };
    return {
      emit: (event: string, payload: unknown) => emit(event, payload),
      except: (exceptRoom: string) => ({
        emit: (event: string, payload: unknown) => emit(event, payload, exceptRoom),
      }),
    };
  },
} as unknown as AppServer;

const appRouter = createAppRouter(recordingIo);

const _dummyCaller = createCallerFactory(appRouter)({
  db: prisma,
  logger,
  user: null,
  clientIp: "203.0.113.1",
  internalSecretHeader: null,
  e2eSecretHeader: null,
});

export type CallerType = typeof _dummyCaller;

export function callerAs(user: { id: string; email: string } | null): CallerType {
  return createCallerFactory(appRouter)({
    db: prisma,
    logger,
    user,
    clientIp: "203.0.113.1",
    internalSecretHeader: null,
    e2eSecretHeader: null,
  });
}

export function clearEmitted(): void {
  emitted.length = 0;
}
