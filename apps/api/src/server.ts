import http from "node:http";
import type { Server as HttpServer } from "node:http";

import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { createSocketServer } from "./socket/server";
import type { AppServer } from "./socket/events";

export interface Bootstrapped {
  httpServer: HttpServer;
  io: AppServer;
}

/** Wires Socket.IO + Express onto a raw HTTP server. No side effects. */
export function bootstrap(): Bootstrapped {
  const httpServer = http.createServer();
  const io = createSocketServer(httpServer);

  const app = createApp(io);
  httpServer.on("request", app);

  return { httpServer, io };
}

/** Drains connections, then exists. Exported so it can be unit tested. */
export function shutdown({ httpServer, io }: Bootstrapped, signal: string): void {
  logger.info({ signal }, "Shutdown signal received - draining connections");

  // Close Socket.IO first so in-flight events are flushed
  void io.close(() => {
    httpServer.close(() => {
      logger.info("Server closed cleanly");
      process.exit(0);
    });
  });

  // Force shutdown after 10s if connections don't drain
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

/** Binds the port and registers signal handlers. Called only from main.ts. */
export function start(): Bootstrapped {
  const deps = bootstrap();

  deps.httpServer.listen(env.API_PORT, () => {
    logger.info({ port: env.API_PORT, env: env.NODE_ENV }, "API server started");
  });

  process.on("SIGTERM", () => {
    shutdown(deps, "SIGTERM");
  });
  process.on("SIGINT", () => {
    shutdown(deps, "SIGINT");
  });

  return deps;
}
