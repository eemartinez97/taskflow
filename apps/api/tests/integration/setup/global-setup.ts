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
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("taskflow_test")
    .withUsername("taskflow")
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
