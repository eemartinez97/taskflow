import { vi } from "vitest";

import { logger } from "../../../src/config/logger";
import { createCallerFactory } from "../../../src/trpc/init";
import { createAppRouter } from "../../../src/trpc/router";
import { prisma } from "./db";
import type { AppServer } from "../../../src/socket/events";

export const emitted: { room: string; event: string; payload: unknown }[] = [];

/** Records every broadcast instead of opening a real Socket.IO server. */
export const recordingIo = {
  to(room: string) {
    return {
      emit: (event: string, payload: unknown) => {
        emitted.push({ room, event, payload });
        return true;
      },
      except: () => ({ emit: vi.fn() }),
    };
  },
} as unknown as AppServer;

const appRouter = createAppRouter(recordingIo);

const _dummyCaller = createCallerFactory(appRouter)({ db: prisma, logger, user: null });

export type CallerType = typeof _dummyCaller;

export function callerAs(user: { id: string; email: string } | null): CallerType {
  return createCallerFactory(appRouter)({ db: prisma, logger, user });
}

export function clearEmitted(): void {
  emitted.length = 0;
}
