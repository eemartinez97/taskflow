import { createApp } from "./app.js";
import http from "node:http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { type Server } from "socket.io";

const placeholderIo = {
  to: () => ({ emit: (): boolean => false }),
} as unknown as Server;

const app = createApp(placeholderIo);
const server = http.createServer(app);

server.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT, env: env.NODE_ENV }, "API server started");
});

function shutdown(signal: string): void {
  logger.info({ signal }, "Shutdown signal received - draining connections");

  // Stop accepting new connections
  server.close(() => {
    logger.info("HTTP server closed cleanly");
    process.exit(0);
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

export { server };
