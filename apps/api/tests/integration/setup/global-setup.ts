import { execSync } from "node:child_process";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

let container: StartedPostgreSqlContainer | undefined;

export async function setup(project: TestProject): Promise<void> {
  // tmpfs on the postgres data dir causes the server process to crash on
  // macOS + Docker Desktop due to how the Linux VM handles the mount.
  // Standard volume is fast enough for integration tests and avoids the 409 loop.
  // Deliberately NOT "taskflow" - that would match the "taskflow" Postgres
  // schema name, and Postgres's default search_path ("$user", public) would
  // then silently resolve unqualified identifiers (e.g. a migration missing
  // a "taskflow"."Foo" prefix) against the right schema by accident. A real
  // prod database (different role name) has no such coincidence, so a
  // schema-qualification bug in a migration would pass here and fail there.
  // Using a name that matches neither "auth" nor "taskflow" makes this
  // container catch that class of bug instead of masking it.
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("taskflow_test")
    .withUsername("taskflow_test_runner")
    .withPassword("changeme")
    .withStartupTimeout(120_000)
    .start();

  const databaseUrl = container.getConnectionUri();

  execSync("pnpm --filter @taskflow/database exec prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });

  project.provide("databaseUrl", databaseUrl);
}

export async function teardown(): Promise<void> {
  if (!container) return;

  try {
    // stop() in testcontainers v10+ removes the container by default.
    // Passing remove:true makes it explicit and prevents stopped-container zombies.
    await container.stop({ timeout: 10 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[global-teardown] Could not stop container: ${message}`);
  } finally {
    container = undefined;
  }
}
