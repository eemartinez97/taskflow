import { afterEach, describe, expect, it } from "vitest";
import { isE2ERun, isLocalDatabase } from "../../../src/utils/e2e";

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;
const ORIGINAL_ENABLE_TEST_ROUTES = process.env.ENABLE_TEST_ROUTES;

afterEach(() => {
  process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
  process.env.ENABLE_TEST_ROUTES = ORIGINAL_ENABLE_TEST_ROUTES;
});

describe("isLocalDatabase", () => {
  it("returns true for a localhost DATABASE_URL", () => {
    process.env.DATABASE_URL = "postgresql://taskflow:changeme@localhost:5432/taskflow_test";
    expect(isLocalDatabase()).toBe(true);
  });

  it("returns true for 127.0.0.1", () => {
    process.env.DATABASE_URL = "postgresql://taskflow:changeme@127.0.0.1:5432/taskflow_test";
    expect(isLocalDatabase()).toBe(true);
  });

  it("returns true for the docker-compose 'postgres' service hostname", () => {
    process.env.DATABASE_URL = "postgresql://taskflow:changeme@postgres:5432/taskflow_test";
    expect(isLocalDatabase()).toBe(true);
  });

  it("returns false for a remote hostname", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@db.production-host.example.com:5432/app";
    expect(isLocalDatabase()).toBe(false);
  });

  it("returns false (fails closed) for a malformed DATABASE_URL", () => {
    process.env.DATABASE_URL = "not-a-valid-url";
    expect(isLocalDatabase()).toBe(false);
  });

  it("returns false (fails closed) when DATABASE_URL is unset", () => {
    delete process.env.DATABASE_URL;
    expect(isLocalDatabase()).toBe(false);
  });
});

describe("isE2ERun", () => {
  it("returns true when ENABLE_TEST_ROUTES=true and DATABASE_URL is local", () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    process.env.DATABASE_URL = "postgresql://taskflow:changeme@localhost:5432/taskflow_test";
    expect(isE2ERun()).toBe(true);
  });

  it("returns false when ENABLE_TEST_ROUTES is not 'true', even with a local database", () => {
    process.env.ENABLE_TEST_ROUTES = "false";
    process.env.DATABASE_URL = "postgresql://taskflow:changeme@localhost:5432/taskflow_test";
    expect(isE2ERun()).toBe(false);
  });

  it("returns false when ENABLE_TEST_ROUTES=true but DATABASE_URL is not local (a leaked flag must not count as an E2E run)", () => {
    process.env.ENABLE_TEST_ROUTES = "true";
    process.env.DATABASE_URL = "postgresql://user:pass@db.production-host.example.com:5432/app";
    expect(isE2ERun()).toBe(false);
  });
});
