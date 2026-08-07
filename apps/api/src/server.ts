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
  // Constructing the Socket.IO Server here (not after) is required: it
  // calls Engine.IO's attach(), which registers its OWN "request" listener
  // on httpServer as a side effect. That must happen before the manual
  // listener below is registered, so keep this call first if this function
  // is ever refactored.
  const io = createSocketServer(httpServer);

  const app = createApp(io);
  const socketPath = io.path();

  // Engine.IO's own "request" listener (registered above, inside
  // createSocketServer) already fully handles every request under its path
  // and ends the response. Node calls all "request" listeners on a server
  // regardless of what an earlier one did, so without this guard Express
  // would also process /socket.io/* requests, find no matching route, and
  // try to write its own 404 - crashing with ERR_HTTP_HEADERS_SENT.
  httpServer.on("request", (req, res) => {
    if (req.url?.startsWith(socketPath)) return;
    app(req, res);
  });

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
