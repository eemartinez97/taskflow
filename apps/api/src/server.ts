import { createApp } from "./app.js";
import http from "node:http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { createSocketServer } from "./socket/server.js";

// Bootstrap

// 1. Create Socket.IO server (attaches to the raw HTTP server)
const httpServer = http.createServer();
const io = createSocketServer(httpServer);

// 2. Wire Express + tRPC (io injected into task/comment routers)
const app = createApp(io);
httpServer.on("request", app);

// Start listening
httpServer.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT, env: env.NODE_ENV }, "API server started");
});

// Graceful shutdown
function shutdown(signal: string): void {
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

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  shutdown("SIGINT");
});

export { httpServer, io };
