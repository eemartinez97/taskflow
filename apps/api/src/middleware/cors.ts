import cors from "cors";
import { env } from "../config/env.js";

/**
 * CORS middleware — allows only the configured web origin.
 * Credentials must be allowed so the NextAuth v4 session cookie is forwarded.
 */
export const corsMiddleware = cors({
  origin: env.WEB_ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});
