import { Router, type NextFunction, type Request, type Response } from "express";
import { prisma } from "@taskflow/database";
import { inMemoryEmailSender } from "../mail/sender";
import { E2E_SECRET_HEADER, isAuthorizedE2ERequest } from "../utils/e2e";

const SEED_USER_EMAIL = "admin@taskflow.dev";
const SEED_ORG_SLUG = "demo-org";

/**
 * E2E-only backdoor routes, mounted at /api/test (see app.ts). Moved here
 * from apps/web alongside the mail sender they depend on - see
 * src/mail/sender.ts's docblock and CLAUDE.md's auth-consolidation notes.
 *
 * Always registered (same shape regardless of env, which keeps
 * infrastructure/nginx/nginx.conf and the Express middleware stack
 * deterministic - see tests/unit/infra/nginx-route-sync.test.ts); each
 * request is 404'd by the guard below unless isAuthorizedE2ERequest()
 * passes, so these are structurally unreachable outside a real E2E run.
 */
export const testRouter = Router();

function guard(req: Request, res: Response, next: NextFunction): void {
  const provided = req.headers[E2E_SECRET_HEADER];
  const headerValue = typeof provided === "string" ? provided : undefined;
  if (!isAuthorizedE2ERequest(headerValue)) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  next();
}

testRouter.use(guard);

/**
 * GET /api/test/last-email?to=<email>
 *
 * Returns the most recently captured email's html/text so Playwright can
 * extract a verification/reset token without a real mailbox (see
 * tests/e2e/helpers/auth.ts).
 */
testRouter.get("/last-email", (req: Request, res: Response) => {
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  if (!to) {
    res.status(400).json({ error: "Missing 'to' query parameter." });
    return;
  }

  const email = inMemoryEmailSender().findLastEmailTo(to);
  if (!email) {
    res.status(404).json({ error: "No email captured for that address." });
    return;
  }

  res.json({ subject: email.subject, html: email.html, text: email.text });
});

/**
 * POST /api/test/reset
 *
 * Wipes every Org and User created by test runs, leaving only the data
 * from packages/database/prisma/seed.ts (the "Demo Organization" +
 * admin@taskflow.dev). See the original apps/web route's docblock (git
 * history) for why this exists - unbounded org growth under a shared
 * seeded admin across repeated full-suite runs.
 *
 * Does NOT touch RateLimitBucket - checkRateLimitBucket() (auth/rate-limit.ts)
 * skips the DB entirely whenever isE2ERun() is true, so no e2e run ever
 * writes a row there in the first place.
 */
testRouter.post("/reset", async (_req: Request, res: Response) => {
  // Deleting every non-seed Org cascades (onDelete: Cascade) through
  // Membership, Project, Board, Column, Task, TaskLabel, Label, Comment,
  // Attachment, Invitation - see schema.prisma.
  await prisma.org.deleteMany({ where: { slug: { not: SEED_ORG_SLUG } } });

  // Deleting every non-seed User cascades through Membership, Session,
  // Account, AuthToken, and Notification.userId (the recipient side - see
  // schema.prisma's onDelete: Cascade on Notification.user). Task.assigneeId/
  // creatorId use onDelete: SetNull, so this can't leave a dangling FK even
  // if a task somehow outlived its org.
  await prisma.user.deleteMany({ where: { email: { not: SEED_USER_EMAIL } } });

  // The cascade above only clears notifications addressed to non-seed users.
  // Every invitation-lifecycle E2E test drives the shared seed admin through
  // createIsolatedOrg (see tests/e2e/helpers/org.ts), so INVITATION_ACCEPTED/
  // INVITATION_DECLINED notifications land on admin@taskflow.dev itself -
  // the one User row this route always preserves - and would otherwise
  // accumulate forever across every run. Notification has no FK to Org, so
  // the isolated org's own cascade delete (above) doesn't reach these either.
  await prisma.notification.deleteMany({ where: { user: { email: SEED_USER_EMAIL } } });

  res.json({ ok: true });
});

/**
 * POST /api/test/delete-org  { orgId: string }
 *
 * Deletes ONE org by id (cascades the same way /reset does). Called after
 * every test that used createIsolatedOrg (see tests/e2e/support/fixtures.ts),
 * so a single suite run doesn't accumulate throwaway orgs mid-run.
 */
testRouter.post("/delete-org", async (req: Request, res: Response) => {
  const orgId = (req.body as { orgId?: string } | undefined)?.orgId;
  if (!orgId) {
    res.status(400).json({ error: "Missing 'orgId'." });
    return;
  }

  await prisma.org.deleteMany({ where: { id: orgId } });
  res.json({ ok: true });
});
