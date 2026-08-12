import cors from "cors";
import { env } from "../config/env";
import { E2E_SECRET_HEADER } from "../utils/e2e";

/**
 * CORS middleware - allows only the configured web origin.
 * Credentials must be allowed so the NextAuth v4 session cookie is forwarded.
 *
 * E2E_SECRET_HEADER must be explicitly allowlisted here too, not just
 * accepted server-side by isAuthorizedE2ERequest() - a browser preflight
 * rejects ANY custom request header not in this list before the actual
 * request is even sent, regardless of what the server would do with it.
 * Allowlisting the header name is harmless outside E2E: isAuthorizedE2ERequest
 * still requires isE2ERun() AND the correct secret value, so a real
 * deployment sending this header (or not) makes no difference.
 */
export const corsMiddleware = cors({
  origin: env.WEB_ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", E2E_SECRET_HEADER],
});
